<script setup lang="ts">
import { reactive, watchEffect, computed, ref, onMounted, watch } from "vue";
import hljs from "highlight.js";
import { BlobWriter, ZipWriter, TextReader, BlobReader, ZipReader, TextWriter } from "@zip.js/zip.js";
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

// Typed wrappers for template usage (avoid template type-checking issues)
const problemData = computed<Problem | undefined>(() => problem?.value as Problem | undefined);
const axiosError = computed<AxiosError | undefined>(() => (error?.value as AxiosError) ?? undefined);
const loading = computed<boolean>(() => Boolean(isLoading?.value));

const isExpanded = ref(true);

const lang = useStorage(LOCAL_STORAGE_KEY.LAST_USED_LANG, -1);
const showSubmitModal = ref(false);

// const showTestcaseModal = ref(false);
// const testcaseFiles = ref<Array<{ name: string; content: string }>>([]);
// const selectedTestcases = ref<string[]>([]);

// Test settings from test-cases page (loaded from localStorage)
const useDefaultTestcases = ref(true); // Default to using public test cases
const customTestcasesBlob = ref<Blob | null>(null);
const hasCustomTestcases = ref(false); // Track if custom testcases exist

// Unified preview modal state (public or custom)
const showTestcasePreviewModal = ref(false);
const previewMode = ref<"custom" | "public">("custom");

// custom
const customTestcaseFiles = ref<Array<{ name: string; content: string }>>([]);
const customTestcaseLoading = ref(false);
const customTestcaseError = ref("");

// public
const publicTestcaseFiles = ref<Array<{ name: string; content: string }>>([]);
const publicTestcaseLoading = ref(false);
const publicTestcaseError = ref("");

const selectedPreviewFileIndex = ref(0);

async function loadCustomTestcasePreview() {
  if (!customTestcasesBlob.value) {
    customTestcaseFiles.value = [];
    customTestcaseError.value = "No custom testcases";
    return;
  }
  customTestcaseLoading.value = true;
  customTestcaseError.value = "";
  try {
    // Try reading as a zip archive
    const zipReader = new ZipReader(new BlobReader(customTestcasesBlob.value));
    const entries = await zipReader.getEntries();
    if (!entries || entries.length === 0) {
      customTestcaseFiles.value = [];
      customTestcaseError.value = "Archive is empty";
      await zipReader.close();
      customTestcaseLoading.value = false;
      return;
    }
    const files: Array<{ name: string; content: string }> = [];
    for (const entry of entries) {
      // Only attempt to read entries that are files and provide getData
      if (
        entry &&
        !entry.directory &&
        "getData" in entry &&
        typeof (entry as unknown as { getData?: unknown }).getData === "function"
      ) {
        const e = entry as {
          getData: (writer: TextWriter) => Promise<string>;
          filename?: string;
          directory?: boolean;
        };
        try {
          const text = await e.getData(new TextWriter());
          files.push({ name: e.filename || "unnamed", content: text });
        } catch {
          files.push({ name: e.filename || "unnamed", content: "[Binary or unreadable]" });
        }
      }
    }
    customTestcaseFiles.value = files;
    await zipReader.close();
  } catch {
    // Fallback: try reading blob as plain text
    try {
      const text = await customTestcasesBlob.value.text();
      customTestcaseFiles.value = [{ name: "custom_testcases", content: text }];
      customTestcaseError.value = "";
    } catch {
      customTestcaseFiles.value = [];
      customTestcaseError.value = "Failed to read custom testcases";
    }
  } finally {
    customTestcaseLoading.value = false;
    selectedPreviewFileIndex.value = 0;
  }
}

function openCustomTestcasesModal() {
  previewMode.value = "custom";
  showTestcasePreviewModal.value = true;
  if (customTestcaseFiles.value.length === 0 && !customTestcaseLoading.value) {
    loadCustomTestcasePreview();
  }
}

type RawPublicCase = {
  fFile_name?: string;
  File_Name?: string;
  file_name?: string;
  fileName?: string;
  input_content?: string;
  Input_Content?: string;
  inputContent?: string;
  output_content?: string;
  Output_Content?: string;
  outputContent?: string;
};

function asRecord(x: unknown): Record<string, unknown> | undefined {
  if (x && typeof x === "object") return x as Record<string, unknown>;
  return undefined;
}

function getArrayField(obj: Record<string, unknown> | undefined, keys: string[]): unknown[] | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v as unknown[];
  }
  return undefined;
}

async function loadPublicTestcasePreview() {
  publicTestcaseLoading.value = true;
  publicTestcaseError.value = "";
  publicTestcaseFiles.value = [];
  try {
    const resp = await api.TrialSubmission.getPublicTestCases(Number(route.params.id));

    // Normalize possible response shapes and extract array field safely
    // Prefer resp.data when present (Axios-like responses) to avoid missing the payload
    const top = (resp && asRecord((resp as unknown as { data?: unknown }).data)) ?? asRecord(resp);
    // Debug: log response shape when no cases found (helps diagnose backend shape differences)
    const rawCasesUnknown = getArrayField(top, ["Trial_Cases", "trial_cases", "TrialCases", "trialCases"]);
    if (!rawCasesUnknown) console.debug("loadPublicTestcasePreview: no Trial_Cases found on response", resp);
    const items = (rawCasesUnknown ?? []) as RawPublicCase[];

    const files: Array<{ name: string; content: string }> = [];
    items.forEach((it, idx) => {
      const itRec = asRecord(it) ?? {};
      const name = (itRec["fFile_name"] ??
        itRec["File_Name"] ??
        itRec["file_name"] ??
        itRec["fileName"] ??
        `public_case_${idx}`) as string;
      const input = (itRec["input_content"] ??
        itRec["Input_Content"] ??
        itRec["inputContent"] ??
        "") as string;
      const output = (itRec["output_content"] ??
        itRec["Output_Content"] ??
        itRec["outputContent"] ??
        "") as string;
      const content = `--- Input ---\n${input}\n\n--- Output ---\n${output}`;
      files.push({ name, content });
    });

    if (files.length === 0) {
      publicTestcaseError.value = "No public testcases";
    }
    publicTestcaseFiles.value = files;
  } catch (err) {
    console.error("Failed to load public testcases:", err);
    // Show detailed backend message if available (typed to avoid `any`)
    const backendMessage =
      (err as unknown as { response?: { data?: { message?: string } }; message?: string })?.response?.data
        ?.message ||
      (err as unknown as { message?: string })?.message ||
      "Failed to load public testcases";
    publicTestcaseError.value = backendMessage;
  } finally {
    publicTestcaseLoading.value = false;
    selectedPreviewFileIndex.value = 0;
  }
}

function openPublicTestcasesModal() {
  previewMode.value = "public";
  showTestcasePreviewModal.value = true;
  if (publicTestcaseFiles.value.length === 0 && !publicTestcaseLoading.value) {
    loadPublicTestcasePreview();
  }
}

const storageKey = computed(() => `testcase_settings_${route.params.id}`);
const loadTestcaseSettings = async () => {
  try {
    // Load custom testcases blob if exists
    const blobBase64 = localStorage.getItem(`${storageKey.value}_blob`);
    if (blobBase64) {
      try {
        // Convert data URL to blob
        const response = await fetch(blobBase64);
        const blob = await response.blob();
        customTestcasesBlob.value = blob;
        hasCustomTestcases.value = true;
      } catch (err) {
        console.error("Failed to load custom testcases blob:", err);
        hasCustomTestcases.value = false;
      }
    } else {
      customTestcasesBlob.value = null;
      hasCustomTestcases.value = false;
    }
  } catch (err) {
    console.error("Failed to load testcase settings:", err);
    hasCustomTestcases.value = false;
  }
};

// Load settings when component mounts
onMounted(() => {
  loadTestcaseSettings();
});

const form = reactive({
  code: "",
  lang,
  testInput: "",
  isLoading: false,
  isSubmitError: false,
  errorMessage: "",
});

// Persist source code so users won't lose typed code when navigating away
const codeStorageKey = `test_code_${(route.params.name as string) || ""}_${(route.params.id as string) || ""}`;
const storedCode = useStorage(codeStorageKey, "");
// Initialize form.code from storage (if any)
if (storedCode.value) form.code = storedCode.value;
// Keep storage in sync with editor content
watch(
  () => form.code,
  (v) => {
    try {
      storedCode.value = v ?? "";
    } catch (err) {
      console.error("Failed to persist code to storage:", err);
    }
  },
);
const rules = {
  code: { required: helpers.withMessage(t("course.problem.submit.err.code"), required) },
  lang: { betweenValue: helpers.withMessage(t("course.problem.submit.err.lang"), between(0, 3)) },
};
const v$ = useVuelidate(rules, form);

// Template-friendly alias to avoid Volar template type errors
const v = computed(() => v$.value) as unknown as (typeof v$)["value"];

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
    form.lang.value = availables[0].value;
  }
  return availables;
});

watchEffect(() => {
  if (form.code) {
    const detectedLang = hljs.highlightAuto(form.code, ["c", "cpp", "python"]).language;
    // Since c and cpp are difficult to distinguish, we only detect python.
    if (detectedLang === "python" && langOptions.value.some((option) => option.value === 2)) {
      form.lang.value = 2;
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
    })) as unknown as { status?: string; data?: { trial_submission_id?: string }; message?: string };

    if (requestResponse.status === "err" || !requestResponse.data?.trial_submission_id) {
      throw new Error(requestResponse.message || "Failed to create trial submission");
    }

    const trialSubmissionId = requestResponse.data.trial_submission_id;
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
    )) as unknown as { status?: string; message?: string };
    console.log("uploadResponse =", uploadResponse);
    if (uploadResponse.status === "err") {
      throw new Error(uploadResponse.message || "Failed to upload trial submission files");
    }

    // Navigate to test detail page directly
    router.push(`/course/${route.params.name}/problem/${route.params.id}/test-history/${trialSubmissionId}`);
  } catch (error) {
    form.isSubmitError = true;
    // Check for specific error messages from backend
    const axiosError = error as AxiosError<{ message?: string }>;
    const backendMessage = axiosError?.response?.data?.message || "";

    if (backendMessage.includes("Trial mode is not enabled")) {
      form.errorMessage = t("course.problem.test.err.trialModeNotEnabled");
    } else if (backendMessage.includes("permission") || backendMessage.includes("Forbidden")) {
      form.errorMessage = t("course.problem.test.err.permissionDenied");
    } else {
      form.errorMessage = t("course.problem.test.err.msg");
    }
    console.error("Trial submission error:", error);
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
    await writer.add(`main${LANGUAGE_EXTENSION[form.lang.value]}`, new TextReader(form.code));
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
    <data-status-wrapper :error="axiosError" :is-loading="loading">
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
                class="absolute right-4 bottom-3 z-10 cursor-pointer text-gray-500 hover:text-gray-700"
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
                <h2 class="mb-2 text-xl font-bold">{{ problemData?.problemName }}</h2>
                <div class="prose max-w-none leading-relaxed">
                  <h2 class="mt-4 text-lg font-semibold">{{ t("course.problem.test.topic.dec") }}</h2>
                  <div
                    v-html="renderMarkdown(problemData?.description.description)"
                    class="whitespace-normal"
                  ></div>
                  <h2 class="mt-4 text-lg font-semibold">{{ t("course.problem.test.topic.input") }}</h2>
                  <div
                    v-html="renderMarkdown(problemData?.description.input)"
                    class="whitespace-normal"
                  ></div>
                  <h2 class="mt-4 text-lg font-semibold">{{ t("course.problem.test.topic.output") }}</h2>
                  <div
                    v-html="renderMarkdown(problemData?.description.output)"
                    class="whitespace-normal"
                  ></div>
                  <div
                    class="border-base-300 bg-base-100 overflow-hidden overflow-x-auto rounded-lg border p-0"
                  >
                    <table class="!m-0 table w-full table-fixed border-collapse border-0">
                      <thead class="bg-base-300 rounded-none">
                        <tr>
                          <th class="w-12 text-center">{{ t("course.problem.test.topic.sample.id") }}</th>
                          <th class="w-1/2">{{ t("course.problem.test.topic.sample.input") }}</th>
                          <th class="w-1/2">{{ t("course.problem.test.topic.sample.output") }}</th>
                        </tr>
                      </thead>
                      <tbody class="rounded-none">
                        <tr v-for="(input, i) in problemData?.description?.sampleInput || []" :key="i">
                          <td class="px-2 py-8 text-center align-top">{{ i + 1 }}</td>
                          <td class="px-2 align-top">
                            <sample-code-block
                              v-if="problemData?.description?.sampleInput?.[i]"
                              :code="problemData?.description?.sampleInput?.[i]"
                            ></sample-code-block>
                            <span v-else class="italic opacity-70">{{
                              t("course.problem.test.topic.noContent")
                            }}</span>
                          </td>
                          <td class="px-2 align-top">
                            <sample-code-block
                              v-if="problemData?.description?.sampleOutput?.[i]"
                              :code="problemData?.description?.sampleOutput?.[i]"
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
                  <div v-html="renderMarkdown(problemData?.description.hint)" class="whitespace-normal"></div>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-1 gap-4">
                <label class="form-control w-60">
                  <div class="label">
                    <span class="label-text text-sm text-gray-500">{{
                      t("course.problem.test.lang.text")
                    }}</span>
                  </div>
                  <select
                    v-model="v.lang.$model"
                    :class="['select-bordered select w-full', v.lang.$error && 'input-error']"
                  >
                    <option :value="-1" disabled hidden>{{ t("course.problem.test.lang.select") }}</option>
                    <option v-for="lang in langOptions" :key="lang.value" :value="lang.value">
                      {{ lang.text }}
                    </option>
                  </select>
                  <label class="label" v-show="v.lang.$error">
                    <span class="label-text-alt text-error">{{ v.lang.$errors[0]?.$message }}</span>
                  </label>
                </label>

                <!-- Test Case Type Selection (only show if custom testcases exist) -->
                <label v-if="hasCustomTestcases" class="form-control w-60">
                  <div class="label">
                    <span class="label-text text-sm text-gray-500">
                      {{ t("course.problem.test.testcaseType.label") }}
                    </span>
                  </div>
                  <div class="flex flex-col gap-2">
                    <label class="label cursor-pointer justify-start gap-3 py-1">
                      <input
                        type="radio"
                        class="radio radio-sm border-white transition-all [--chkfg:black] checked:border-white checked:bg-white"
                        :value="true"
                        v-model="useDefaultTestcases"
                      />
                      <span class="label-text">{{ t("course.problem.test.testcaseType.public") }}</span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs ml-2"
                        @click="openPublicTestcasesModal"
                      >
                        {{ t("course.problem.test.testcaseType.viewPublic") }}
                      </button>
                    </label>
                    <label class="label cursor-pointer justify-start gap-3 py-1">
                      <input
                        type="radio"
                        class="radio radio-sm border-white transition-all [--chkfg:black] checked:border-white checked:bg-white"
                        :value="false"
                        v-model="useDefaultTestcases"
                      />
                      <span class="label-text">{{ t("course.problem.test.testcaseType.custom") }}</span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs ml-2"
                        @click="openCustomTestcasesModal"
                      >
                        {{ t("course.problem.test.testcaseType.viewCustom") }}
                      </button>
                    </label>
                  </div>
                </label>

                <!-- Testcases Preview Modal (public or custom) -->
                <dialog
                  class="modal border-0 bg-transparent p-0 backdrop:bg-black/20 backdrop:backdrop-blur-[1px]"
                  :class="{ 'modal-open': showTestcasePreviewModal }"
                >
                  <div class="modal-box max-w-5xl rounded-3xl shadow-[0_4px_15px_rgba(0,0,0,0.2)]">
                    <h3 class="text-lg font-bold">
                      {{
                        previewMode === "public"
                          ? t("course.problem.test.testcaseType.viewPublicTitle")
                          : t("course.problem.test.testcaseType.viewCustomTitle")
                      }}
                    </h3>
                    <div class="py-4">
                      <!-- Public -->
                      <div v-if="previewMode === 'public'">
                        <div v-if="publicTestcaseLoading" class="flex items-center justify-center">
                          Loading...
                        </div>
                        <div v-else-if="publicTestcaseError" class="text-error">
                          {{ publicTestcaseError }}
                        </div>
                        <div v-else>
                          <div class="flex gap-4">
                            <ul class="menu bg-base-100 w-48 rounded p-2">
                              <li v-for="(f, idx) in publicTestcaseFiles" :key="f.name">
                                <a
                                  href="#"
                                  @click.prevent="selectedPreviewFileIndex = idx"
                                  :class="{ 'font-bold': selectedPreviewFileIndex === idx }"
                                  >{{ f.name }}</a
                                >
                              </li>
                              <li v-if="publicTestcaseFiles.length === 0" class="italic opacity-70">
                                {{ t("course.problem.test.topic.noContent") }}
                              </li>
                            </ul>
                            <div class="prose max-w-none flex-1 overflow-auto rounded border p-2">
                              <pre class="break-words whitespace-pre-wrap">{{
                                publicTestcaseFiles[selectedPreviewFileIndex]?.content ||
                                t("course.problem.test.topic.noContent")
                              }}</pre>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Custom -->
                      <div v-else>
                        <div v-if="customTestcaseLoading" class="flex items-center justify-center">
                          Loading...
                        </div>
                        <div v-else-if="customTestcaseError" class="text-error">
                          {{ customTestcaseError }}
                        </div>
                        <div v-else>
                          <div class="flex gap-4">
                            <ul class="menu bg-base-100 w-48 rounded p-2">
                              <li v-for="(f, idx) in customTestcaseFiles" :key="f.name">
                                <a
                                  href="#"
                                  @click.prevent="selectedPreviewFileIndex = idx"
                                  :class="{ 'font-bold': selectedPreviewFileIndex === idx }"
                                  >{{ f.name }}</a
                                >
                              </li>
                              <li v-if="customTestcaseFiles.length === 0" class="italic opacity-70">
                                {{ t("course.problem.test.topic.noContent") }}
                              </li>
                            </ul>
                            <div class="prose max-w-none flex-1 overflow-auto rounded border p-2">
                              <pre class="break-words whitespace-pre-wrap">{{
                                customTestcaseFiles[selectedPreviewFileIndex]?.content ||
                                t("course.problem.test.topic.noContent")
                              }}</pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="modal-action">
                      <button class="btn" @click="showTestcasePreviewModal = false">
                        {{ t("common.close") }}
                      </button>
                    </div>
                  </div>
                </dialog>
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
              <label class="label" v-show="v.code.$error">
                <span class="label-text-alt text-error">{{ v.code.$errors[0]?.$message }}</span>
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
              <span>{{ form.errorMessage }}</span>
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
</template>
