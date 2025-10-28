<![CDATA[<script setup lang="ts">
import { reactive, watchEffect, computed, ref } from "vue";
import hljs from "highlight.js";
import { BlobWriter, ZipWriter, TextReader } from "@zip.js/zip.js";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import useVuelidate from "@vuelidate/core";
import { required, between, helpers } from "@vuelidate/validators";
import api, { fetcher } from "@/models/api";
import { useTitle, useStorage } from "@vueuse/core";
import { LANGUAGE_OPTIONS, LOCAL_STORAGE_KEY } from "@/constants";
import { useI18n } from "vue-i18n";]]>

const route = useRoute();
const { t } = useI18n();

useTitle(`Test - ${route.params.id} - ${route.params.name} | Normal OJ`);
const router = useRouter();
const { data: problem, error, isLoading } = useAxios<Problem>(`/problem/view/${route.params.id}`, fetcher);

const lang = useStorage(LOCAL_STORAGE_KEY.LAST_USED_LANG, -1);
const showSubmitModal = ref(false);

const form = reactive({
  code: "",
  lang,
  testInput: "",
  isLoading: false,
  isSubmitError: false,
});
const rules = {
  code: { required: helpers.withMessage(t("course.problem.submit.err.code"), required) },
  lang: { betweenValue: helpers.withMessage(t("course.problem.submit.err.lang"), between(0, 3)) },
};
const v$ = useVuelidate(rules, form);

const LANGUAGE_EXTENSION = [".c", ".cpp", ".py"];
const langOptions = computed<LangOption[]>(() => {
  if (!problem.value) return [];
  const _problem = problem.value;
  const availables: LangOption[] = [];
  LANGUAGE_OPTIONS.forEach((option) => {
    if (_problem.allowedLanguage & option.mask) {
      availables.push(option);
    }
  });
  if (availables.length === 1) {
    form.lang = availables[0].value;
  }
  return availables;
});

watchEffect(() => {
  if (form.code) {
    const detectedLang = hljs.highlightAuto(form.code, ["c", "cpp", "python"]).language;
    // Since c and cpp are difficult to distinguish, we only detect python.
    if (detectedLang === "python" && langOptions.value.some((option) => option.value === 2)) {
      form.lang = 2;
    }
  }
});

const selectedTestcaseContent = ref("");

async function test() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) return;
  form.isLoading = true;
  form.isSubmitError = false;
  
  try {
    const blobWriter = new BlobWriter("application/zip");
    const writer = new ZipWriter(blobWriter);
    await writer.add(`main${LANGUAGE_EXTENSION[form.lang]}`, new TextReader(form.code));
    await writer.close();
    const blob = await blobWriter.getData();
    const formData = new FormData();
    formData.append("code", blob);
    formData.append("test_input", form.testInput);

    const { testSubmissionId } = (
      await api.Submission.create({
        problemId: Number(route.params.id),
        languageType: Number(form.lang),
        isTest: true,
      })
    ).data;

    await api.Submission.modify(testSubmissionId, formData);
    router.push(`/course/${route.params.name}/problem/${route.params.id}/test-history`);
  } catch (error) {
    form.isSubmitError = true;
    throw error;
  } finally {
    form.isLoading = false;
  }
}

// 這邊的submissionid要改成test_submission_id?
async function submitCode() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) return;
  
  try {
    const blobWriter = new BlobWriter("application/zip");
    const writer = new ZipWriter(blobWriter);
    await writer.add(`main${LANGUAGE_EXTENSION[form.lang]}`, new TextReader(form.code));
    await writer.close();
    const blob = await blobWriter.getData();
    const formData = new FormData();
    formData.append("code", blob);

    const { submissionId } = (
      await api.Submission.create({
        problemId: Number(route.params.id),
        languageType: Number(form.lang),
      })
    ).data;
    await api.Submission.modify(submissionId, formData);
    showSubmitModal.value = false;
    router.push(`/course/${route.params.name}/submission/${submissionId}`);
  } catch (error) {
    form.isSubmitError = true;
    throw error;
  }
}

async function handleTestcaseUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !file.name.endsWith('.zip')) return;

  const zipReader = new ZipReader(new BlobReader(file));
  const entries = await zipReader.getEntries();
  
  testcaseFiles.value = [];
  for (const entry of entries) {
    if (!entry.directory) {
      const textWriter = new TextWriter();
      const content = await entry.getData(textWriter);
      testcaseFiles.value.push({
        name: entry.filename,
        content,
      });
    }
  }
}

function previewTestcase(file: {name: string, content: string}) {
  selectedTestcaseContent.value = file.content;
}

function deleteTestcase(file: {name: string, content: string}) {
  const index = testcaseFiles.value.findIndex(f => f.name === file.name);
  if (index !== -1) {
    testcaseFiles.value.splice(index, 1);
    selectedTestcases.value = selectedTestcases.value.filter(name => name !== file.name);
    if (selectedTestcaseContent.value === file.content) {
      selectedTestcaseContent.value = "";
    }
  }
}

function saveTestcaseSettings() {
  showTestcaseModal.value = false;
}

</script>

<template>
  <div class="card-container">
    <data-status-wrapper :error="error" :is-loading="isLoading">
      <template #loading>
        <skeleton-card />
      </template>
      <template #data>
        <div class="card min-w-full">
          <div class="card-body">
            <div class="flex justify-between items-center">
              <div class="card-title">{{ t("course.problem.test.card.title") }}{{ route.params.id }}</div>
              <button class="btn btn-primary" @click="showSubmitModal = true">
                <i-uil-file-upload-alt class="mr-1 h-5 w-5" />
                {{ t("course.problem.test.submit") }}
              </button>
            </div>

            <div class="divider" />

            <div class="flex justify-between items-center gap-4">
              <div class="form-control flex-1">
                <select
                  class="select select-bordered w-full"
                  :class="[v$.lang.$error && 'select-error']"
                  v-model="form.lang"
                >
                  <option :value="-1">{{ t("course.problem.test.lang.select") }}</option>
                  <option v-for="lang in langOptions" :key="lang.value" :value="lang.value">
                    {{ lang.text }}
                  </option>
                </select>
                <label class="label" v-show="v$.lang.$error">
                  <span class="label-text-alt text-error">{{ v$.lang.$errors[0]?.$message }}</span>
                </label>
              </div>

              <div class="flex gap-2">
                <router-link
                  class="btn"
                  :to="`/course/${route.params.name}/problem/${route.params.id}/test-history`"
                >
                  <i-uil-history class="mr-1 h-5 w-5" />
                  {{ t("course.problem.test.history") }}
                </router-link>
                <router-link
                  class="btn"
                  :to="`/course/${route.params.name}/problem/${route.params.id}/test-cases`"
                >
                  <i-uil-file-alt class="mr-1 h-5 w-5" />
                  {{ t("course.problem.test.testcase") }}
                </router-link>
                <button :class="['btn btn-primary', form.isLoading && 'loading']" @click="test">
                  <i-uil-play class="mr-1 h-5 w-5" />
                  {{ t("course.problem.test.run") }}
                </button>
              </div>
            </div>

            <div class="form-control mt-4">
              <label class="label">
                <span class="label-text">{{ t("course.problem.test.card.code") }}</span>
              </label>
              <code-editor
                v-model="form.code"
                class="h-96"
                :placeholder="t('course.problem.test.card.placeholder')"
              />
              <label class="label" v-show="v$.code.$error">
                <span class="label-text-alt text-error">{{ v$.code.$errors[0]?.$message }}</span>
              </label>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ t("course.problem.test.card.testInput") }}</span>
              </label>
              <textarea
                v-model="form.testInput"
                class="textarea textarea-bordered h-32"
                :placeholder="t('course.problem.test.card.testInputPlaceholder')"
              />
            </div>

            <div class="alert alert-error" v-if="form.isSubmitError">
              <i-uil-exclamation-triangle class="h-6 w-6" />
              <span>{{ t("course.problem.test.err.msg") }}</span>
            </div>
          </div>

          <!-- Submit Confirmation Modal -->
          <dialog class="modal" :class="{ 'modal-open': showSubmitModal }">
            <div class="modal-box">
              <h3 class="font-bold text-lg">{{ t("course.problem.test.submitModal.title") }}</h3>
              <p class="py-4">{{ t("course.problem.test.submitModal.message") }}</p>
              <div class="modal-action">
                <button class="btn" @click="showSubmitModal = false">
                  {{ t("course.problem.test.submitModal.cancel") }}
                </button>
                <button class="btn btn-primary" @click="submitCode">
                  {{ t("course.problem.test.submitModal.confirm") }}
                </button>
              </div>
            </div>
            <form method="dialog" class="modal-backdrop">
              <button @click="showSubmitModal = false">close</button>
            </form>
          </dialog>


        </div>
      </template>
    </data-status-wrapper>
  </div>
</template>