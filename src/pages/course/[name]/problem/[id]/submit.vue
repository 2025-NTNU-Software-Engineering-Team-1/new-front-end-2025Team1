<script setup lang="ts">
import { reactive, watchEffect, computed } from "vue";
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

const route = useRoute();
const { t } = useI18n();

useTitle(`Submit - ${route.params.id} - ${route.params.name} | Normal OJ`);
const router = useRouter();
const { data: problem, error, isLoading } = useAxios<Problem>(`/problem/view/${route.params.id}`, fetcher);

// 依題目 meta 判斷允許的提交格式；預設為 "code"
const acceptedFormat = computed<AcceptedFormat>(() => {
  const fmt = (problem.value as any)?.config?.acceptedFormat;
  return fmt === "zip" ? "zip" : "code";
});

const lang = useStorage(LOCAL_STORAGE_KEY.LAST_USED_LANG, -1);
const form = reactive({
  code: "",
  zip: null as File | null,
  lang,
  isLoading: false,
  isSubmitError: false,
});

// 驗證規則依 acceptedFormat 切換
const rules = computed(() => ({
  code:
    acceptedFormat.value === "code"
      ? { required: helpers.withMessage(t("course.problem.submit.err.code"), required) }
      : {},
  zip:
    acceptedFormat.value === "zip"
      ? {
          requiredFile: helpers.withMessage(t("course.problem.submit.err.zip"), (v: any) => v instanceof File),
        }
      : {},
  lang: { betweenValue: helpers.withMessage(t("course.problem.submit.err.lang"), between(0, 3)) },
}));
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

// 只在 code 模式下進行簡易語言偵測（python）
watchEffect(() => {
  if (acceptedFormat.value !== "code") return;
  const detectedLang = hljs.highlightAuto(form.code, ["c", "cpp", "python"]).language;
  if (detectedLang === "python" && langOptions.value.some((option) => option.value === 2)) {
    form.lang = 2;
  }
});

async function submit() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) return;
  form.isLoading = true;
  form.isSubmitError = false;
  try {
    const formData = new FormData();

    if (acceptedFormat.value === "code") {
      // 將貼上的程式碼包成 zip 後上傳（延用後端原接口）
      const blobWriter = new BlobWriter("application/zip");
      const writer = new ZipWriter(blobWriter);
      await writer.add(`main${LANGUAGE_EXTENSION[form.lang]}`, new TextReader(form.code));
      await writer.close();
      const blob = await blobWriter.getData();
      formData.append("code", blob);
    } else {
      // 直接上傳使用者選擇的 zip 檔
      if (!form.zip) throw new Error("No zip file selected");
      formData.append("code", form.zip);
    }

    const { submissionId } = (
      await api.Submission.create({
        problemId: Number(route.params.id),
        languageType: Number(form.lang),
      })
    ).data;
    await api.Submission.modify(submissionId, formData);
    router.push(`/course/${route.params.name}/submission/${submissionId}`);
  } catch (error) {
    form.isSubmitError = true;
    throw error;
  } finally {
    form.isLoading = false;
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title md:text-2xl lg:text-3xl">
          {{ t("course.problem.submit.card.title") }}{{ $route.params.id }}
        </div>

        <!-- code 模式 -->
        <template v-if="acceptedFormat === 'code'">
          <div class="card-title mt-10 md:text-lg lg:text-xl">
            {{ t("course.problem.submit.card.placeholder") }}
          </div>
          <code-editor v-model="form.code" class="mt-4" />
          <span
            v-show="(v$ as any).code?.$error"
            class="text-error"
            v-text="(v$ as any).code?.$errors[0]?.$message"
          />
        </template>

        <!-- zip 模式 -->
        <template v-else>
          <div class="card-title mt-10 md:text-lg lg:text-xl">Upload your solution (.zip)</div>
          <div class="mt-4">
            <input
              type="file"
              accept=".zip"
              @change="form.zip = ($event.target as HTMLInputElement).files?.[0] || null"
              class="file-input file-input-bordered"
            />
            <div class="mt-2" v-if="form.zip">
              <span class="mr-2">{{ form.zip.name }}</span>
              <button class="btn btn-sm" @click="form.zip = null">
                <i-uil-times />
              </button>
            </div>
            <label class="label" v-show="(v$ as any).zip?.$error">
              <span class="label-text-alt text-error" v-text="(v$ as any).zip?.$errors[0]?.$message" />
            </label>
          </div>
        </template>

        <div v-if="error" class="alert alert-error shadow-lg">
          <div>
            <i-uil-times-circle />
            <span>{{ t("course.problem.submit.err.msg") }}</span>
          </div>
        </div>

        <div class="mt-10 flex items-center justify-between">
          <div class="form-control w-full max-w-xs">
            <label class="label">
              <span class="label-text">{{ t("course.problem.submit.lang.text") }}</span>
              <ui-spinner v-if="isLoading" class="h-6 w-6" />
            </label>
            <select
              v-model="(v$ as any).lang.$model"
              :class="['select select-bordered', (v$ as any).lang.$error && 'input-error']"
            >
              <option disabled :value="-1">{{ t("course.problem.submit.lang.select") }}</option>
              <option v-for="{ text, value } in langOptions" :key="value" :value="value">{{ text }}</option>
            </select>
            <label class="label" v-show="(v$ as any).lang.$error">
              <span class="label-text-alt text-error" v-text="(v$ as any).lang.$errors[0]?.$message" />
            </label>
          </div>

          <button :class="['btn', form.isLoading && 'loading']" @click="submit">
            <i-uil-file-upload-alt class="mr-1 h-5 w-5" /> {{ t("course.problem.submit.text") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>