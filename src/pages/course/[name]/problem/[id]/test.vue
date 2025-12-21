<script setup lang="ts">
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
import { useI18n } from "vue-i18n";
import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { AxiosError } from "axios";

const md = new MarkdownIt({
  html: true,
  breaks: true,
}).use(texmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: { macros: { "\\RR": "\\mathbb{R}" } },
});

const renderMarkdown = (content: unknown): string => {
  if (typeof content !== "string") return "";
  return md.render(content);
};

const route = useRoute();
const { t } = useI18n();

useTitle(`Test - ${route.params.id} - ${route.params.name} | Normal OJ`);
const router = useRouter();
const { data: problem, error, isLoading } = useAxios<Problem>(`/problem/view/${route.params.id}`, fetcher);

const isExpanded = ref(true);

const lang = useStorage(LOCAL_STORAGE_KEY.LAST_USED_LANG, -1);
const showSubmitModal = ref(false);
// const showTestcaseModal = ref(false);
// const testcaseFiles = ref<Array<{ name: string; content: string }>>([]);
// const selectedTestcases = ref<string[]>([]);

// Test settings from test-cases page
const useDefaultTestcases = ref(true);
const customTestcasesBlob = ref<Blob | null>(null);

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

// const selectedTestcaseContent = ref("");

async function test() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) return;
  form.isLoading = true;
  form.isSubmitError = false;

  try {
    // NEW IMPLEMENTATION - Trial Submission APIs

    // API 2: Create trial submission request
    const requestResponse = (await api.TrialSubmission.createTrialRequest({
      problem_id: Number(route.params.id),
      language_type: Number(form.lang), // 0: Python, 1: C++, 2: C
      use_default_test_cases: useDefaultTestcases.value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;

    if (requestResponse.status === "err" || !requestResponse.trial_submission_id) {
      throw new Error(requestResponse.message || "Failed to create trial submission");
    }

    const trialSubmissionId = requestResponse.trial_submission_id;
    console.log("requestResponse =", requestResponse);
    console.log("trialSubmissionId =", trialSubmissionId);

    // Prepare code zip file
    const codeWriter = new ZipWriter(new BlobWriter("application/zip"));
    await codeWriter.add(`main${LANGUAGE_EXTENSION[form.lang]}`, new TextReader(form.code));
    const codeBlob = await codeWriter.close();

    // API 3: Upload code and optional custom testcases
    const formData = new FormData();
    formData.append("code", codeBlob);

    // Add custom testcases if they were configured in test-cases page
    if (!useDefaultTestcases.value && customTestcasesBlob.value) {
      formData.append("custom_testcases", customTestcasesBlob.value);
      console.log("Uploading custom testcases");
    }

    const uploadResponse = (await api.TrialSubmission.uploadTrialFiles(
      trialSubmissionId,
      formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;
    console.log("uploadResponse =", uploadResponse);
    if (uploadResponse.status === "err") {
      throw new Error(uploadResponse.message || "Failed to upload trial submission files");
    }

    // Navigate to test history
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
</script>

<template>
  <div class="card-container">
    <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
      <template #loading>
        <skeleton-card />
      </template>
      <template #data>
        <div class="card min-w-full">
          <div class="card-body">
            <div class="flex items-center justify-between">
              <div class="card-title md:text-2xl lg:text-3xl">
                {{ t("course.problem.test.card.title") }}{{ route.params.id }}
              </div>
            </div>

            <div class="divider" />
            <div class="bg-base-200 relative mt-4 rounded-lg p-4 transition-all duration-300">
              <button
                class="absolute right-4 bottom-3 z-10 text-gray-500 hover:text-gray-700"
                @click="isExpanded = !isExpanded"
              >
                <img
                  v-if="isExpanded"
                  src="/expand.png"
                  alt="t('course.problem.test.topic.collapse')"
                  class="h-5 w-5"
                />
                <img v-else src="/expand.png" alt="t('course.problem.test.topic.expand')" class="h-5 w-5" />
              </button>
              <div class="transition-all duration-300" :class="{ 'max-h-96 overflow-hidden': !isExpanded }">
                <h2 class="mb-2 text-xl font-bold">{{ problem?.problemName }}</h2>
                <div class="prose max-w-none leading-relaxed">
                  <h2 class="mt-4 text-lg font-semibold">{{ t("course.problem.test.topic.dec") }}</h2>
                  <div
                    v-html="renderMarkdown(problem?.description.description)"
                    class="whitespace-normal"
                  ></div>
                  <h2 class="mt-4 text-lg font-semibold">{{ t("course.problem.test.topic.input") }}</h2>
                  <div v-html="renderMarkdown(problem?.description.input)" class="whitespace-normal"></div>
                  <h2 class="mt-4 text-lg font-semibold">{{ t("course.problem.test.topic.output") }}</h2>
                  <div v-html="renderMarkdown(problem?.description.output)" class="whitespace-normal"></div>
                  <div
                    class="border-base-300 bg-base-100 overflow-hidden overflow-x-auto rounded-lg border p-0"
                  >
                    <table class="!m-0 table w-full border-collapse !border-spacing-0 border-0">
                      <thead class="bg-base-300 rounded-none">
                        <tr>
                          <th>{{ t("course.problem.test.topic.sample.id") }}</th>
                          <th>{{ t("course.problem.test.topic.sample.input") }}</th>
                          <th>{{ t("course.problem.test.topic.sample.output") }}</th>
                        </tr>
                      </thead>
                      <tbody class="rounded-none">
                        <tr v-for="(input, i) in problem?.description?.sampleInput || []" :key="i">
                          <td class="align-top">{{ i + 1 }}</td>
                          <td class="align-top">
                            <sample-code-block
                              v-if="problem?.description?.sampleInput?.[i]"
                              :code="problem?.description?.sampleInput?.[i]"
                            ></sample-code-block>
                            <span v-else class="italic opacity-70">{{
                              t("course.problem.test.topic.noContent")
                            }}</span>
                          </td>
                          <td class="align-top">
                            <sample-code-block
                              v-if="problem?.description?.sampleOutput?.[i]"
                              :code="problem?.description?.sampleOutput?.[i]"
                            ></sample-code-block>
                            <span v-else class="italic opacity-70">{{
                              t("course.problem.test.topic.noContent")
                            }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <h2 class="mt-4 text-lg font-semibold">{{ t("course.problem.test.topic.hint") }}</h2>
                  <div v-html="renderMarkdown(problem?.description.hint)" class="whitespace-normal"></div>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between gap-4">
              <div class="form-control flex-1">
                <label class="form-control w-60">
                  <div class="label">
                    <span class="label-text text-sm text-gray-500">{{
                      t("course.problem.test.lang.text")
                    }}</span>
                  </div>
                  <select
                    v-model="v$.lang.$model"
                    :class="['select select-bordered w-60', v$.lang.$error && 'input-error']"
                  >
                    <option :value="-1">{{ t("course.problem.test.lang.select") }}</option>
                    <option v-for="lang in langOptions" :key="lang.value" :value="lang.value">
                      {{ lang.text }}
                    </option>
                  </select>
                </label>

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

            <div class="submit submit-place">
              <div class="flex justify-end">
                <button class="btn btn-primary" @click="showSubmitModal = true">
                  <i-uil-file-upload-alt class="mr-1 h-5 w-5" />
                  {{ t("course.problem.test.submit") }}
                </button>
              </div>
            </div>

            <div class="alert alert-error" v-if="form.isSubmitError">
              <i-uil-exclamation-triangle class="h-6 w-6" />
              <span>{{ t("course.problem.test.err.msg") }}</span>
            </div>
          </div>

          <!-- Submit Confirmation Modal -->
          <dialog
            class="modal border-0 bg-transparent p-0 backdrop:bg-black/20 backdrop:backdrop-blur-[1px]"
            :class="{ 'modal-open': showSubmitModal }"
          >
            <div class="modal-box rounded-3xl shadow-[0_4px_15px_rgba(0,0,0,0.2)]">
              <h3 class="text-lg font-bold">{{ t("course.problem.test.submitModal.title") }}</h3>
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
          </dialog>
        </div>
      </template>
    </data-status-wrapper>
  </div>

  <!--改動介面-->
  <!--card title 的class更改: 沿用舊noj-->
  <!--解決submit按鈕彈跳視窗背景陰影問題-->
  <!--取消test input textarea-->
  <!--submit按鈕移動到右下-->
  <!--語言框調短-->
</template>
