<script setup lang="ts">
import { reactive, watchEffect, computed } from "vue";
import hljs from "highlight.js";
import { BlobWriter, ZipWriter, TextReader, ZipReader, BlobReader } from "@zip.js/zip.js";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import useVuelidate from "@vuelidate/core";
import { required, between, helpers } from "@vuelidate/validators";
import api, { fetcher } from "@/models/api";
import { useTitle, useStorage } from "@vueuse/core";
import { LANGUAGE_OPTIONS, LOCAL_STORAGE_KEY } from "@/constants";
import { useI18n } from "vue-i18n";
import { useSession } from "@/stores/session";
import AIChatbot from "@/components/AIChatbot.vue";

// ==========================================
// [CONFIG] Console Debug Mode
// ==========================================
const DEBUG_MODE = 1; // Setting it to 0 will disable all logs.

// ==========================================
// Logger Utility
// ==========================================
const logger = {
  log: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Log] ${label}`, "color: #3b82f6; font-weight: bold;", data || "");
  },
  success: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Success] ${label}`, "color: #10b981; font-weight: bold;", data || "");
  },
  error: (label: string, error?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Error] ${label}`, "color: #ef4444; font-weight: bold;", error || "");
  },
  warn: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Warn] ${label}`, "color: #f59e0b; font-weight: bold;", data || "");
  },
  group: (label: string) => {
    if (!DEBUG_MODE) return;
    console.group(`%c[Group] ${label}`, "color: #8b5cf6; font-weight: bold;");
  },
  groupEnd: () => {
    if (!DEBUG_MODE) return;
    console.groupEnd();
  },
};

// ==========================================
// Setup & State
// ==========================================
const route = useRoute();
const { t } = useI18n();
const session = useSession();

useTitle(`Submit - ${route.params.id} - ${route.params.name} | Normal OJ`);
const router = useRouter();
const { data: problem, error } = useAxios<Problem>(`/problem/view/${route.params.id}`, fetcher);

const acceptedFormat = computed<AcceptedFormat>(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fmt = (problem.value as any)?.config?.acceptedFormat;
  return fmt === "zip" ? "zip" : "code";
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aiChatEnabled = computed(() => Boolean((problem.value as any)?.config?.aiVTuber));

const lang = useStorage(LOCAL_STORAGE_KEY.LAST_USED_LANG, -1);
const form = reactive({
  code: "",
  zip: null as File | null,
  lang,
  isLoading: false,
  isSubmitError: false,
  errorMessage: "", // Added state for UI error notification
});
const aiCurrentCode = computed(() => {
  if (acceptedFormat.value === "code") return form.code ?? "";
  if (form.zip) return `[ZIP upload] ${form.zip.name}`;
  return "";
});

// Verification rules switch according to acceptedFormat
const rules = computed(() => ({
  code:
    acceptedFormat.value === "code"
      ? { required: helpers.withMessage(t("course.problem.submit.err.code"), required) }
      : {},
  zip:
    acceptedFormat.value === "zip"
      ? {
          requiredFile: helpers.withMessage(
            t("course.problem.submit.err.zip"),
            (v: unknown) => v instanceof File,
          ),
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

// Simple language detection (Python) only in code mode.
watchEffect(() => {
  if (acceptedFormat.value !== "code") return;
  const detectedLang = hljs.highlightAuto(form.code, ["c", "cpp", "python"]).language;
  if (detectedLang === "python" && langOptions.value.some((option) => option.value === 2)) {
    logger.log("Auto-detected Language", "Python");
    form.lang = 2;
  }
});

// ==========================================
// Submit Logic
// ==========================================
async function submit() {
  logger.group("Submit Solution Process");
  form.errorMessage = ""; // Reset error message on new submission

  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    logger.warn("Validation Failed", v$.value.$errors);
    logger.groupEnd(); // Early return cleanup
    return;
  }

  form.isLoading = true;
  form.isSubmitError = false;

  try {
    logger.log("Step 1: Check Constraints", { format: acceptedFormat.value, lang: form.lang });

    // [Constraint Check] Code Mode
    if (acceptedFormat.value === "code") {
      const maxGB = 0.5;
      const codeBytes = new Blob([form.code], { type: "text/plain" }).size;
      const maxBytes = maxGB * 1024 * 1024 * 1024;

      if (codeBytes > maxBytes) {
        const codeSizeMB = (codeBytes / 1024 / 1024).toFixed(2);
        const msg = `Your code is too large (${codeSizeMB} MB). Maximum allowed is ${maxGB} GB.`;
        logger.warn("Size Limit Exceeded (Code)", { size: codeSizeMB, limit: maxGB });

        form.errorMessage = msg; // Update UI state instead of alert
        form.isLoading = false;
        logger.groupEnd(); // Early return cleanup
        return;
      }
    }

    const formData = new FormData();

    // [Payload Prep] Code Mode
    if (acceptedFormat.value === "code") {
      logger.log("Step 2: Compressing Code to Zip...");
      const blobWriter = new BlobWriter("application/zip");
      const writer = new ZipWriter(blobWriter);
      const fileName = `main${LANGUAGE_EXTENSION[form.lang]}`;

      await writer.add(fileName, new TextReader(form.code));
      await writer.close();
      const blob = await blobWriter.getData();

      formData.append("code", blob);
      logger.log("Compression Complete", { fileName, blobSize: blob.size });
    }
    // [Payload Prep] Zip Mode
    else {
      if (!form.zip) throw new Error("No zip file selected");

      // limitation of zip from teacher
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const limitMB = (problem.value as any)?.config?.maxStudentZipSizeMB ?? 50;
      const maxSizeBytes = limitMB * 1024 * 1024;

      logger.log("Step 2: Checking Zip Size", { current: form.zip.size, limit: maxSizeBytes });

      if (form.zip.size > maxSizeBytes) {
        const currentMB = (form.zip.size / 1024 / 1024).toFixed(2);
        const msg = `The uploaded file is too large (${currentMB} MB). Max allowed: ${limitMB} MB.`;
        logger.warn("Size Limit Exceeded (Zip)", { size: currentMB, limit: limitMB });

        form.errorMessage = msg; // Update UI state instead of alert
        form.isLoading = false;
        logger.groupEnd(); // Early return cleanup
        return;
      }

      // -----------------------------------------------------------------------
      // Deep Inspection: Structure, Logging & Validation
      // -----------------------------------------------------------------------
      logger.log("Step 2.1: Inspecting Zip Structure & Integrity...");

      const zipReader = new ZipReader(new BlobReader(form.zip));
      const entries = await zipReader.getEntries();
      await zipReader.close();

      const fileNames = entries.map((entry) => entry.filename);

      // ==========================================
      // Debug Console: Tree View
      // ==========================================
      if (DEBUG_MODE) {
        logger.group("Inspect Zip Content Structure");

        // Helper: Convert paths to nested object
        const buildTree = (paths: string[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tree: Record<string, any> = {};
          paths.forEach((path) => {
            const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
            if (!cleanPath) return;

            const parts = cleanPath.split("/");
            let current = tree;
            parts.forEach((part, index) => {
              if (!current[part]) {
                // If last part, it's a file (null), else folder ({})
                current[part] = index === parts.length - 1 ? null : current[part] || {};
              }
              current = current[part];
            });
          });
          return tree;
        };

        // Helper: Recursive print
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const printTree = (node: any) => {
          const keys = Object.keys(node).sort();
          for (const key of keys) {
            if (node[key] === null) {
              // File: Green
              console.log(`%c📄 ${key}`, "color: #10b981; margin-left: 2px;");
            } else {
              // Folder: Yellow
              console.groupCollapsed(`%c📁 ${key}/`, "color: #f59e0b; font-weight: bold;");
              printTree(node[key]);
              console.groupEnd();
            }
          }
        };

        // Execute print
        if (fileNames.length === 0) {
          console.log("%c[Empty Zip]", "color: #ef4444");
        } else {
          printTree(buildTree(fileNames));
        }
        logger.groupEnd();
      }

      // ==========================================
      // 2. Validation Logic
      // ==========================================

      // Check for makefile in ROOT with ANY extension (e.g., makefile, makefile.txt)
      // [UPDATE]: Allow both "makefile" and "Makefile" (case insensitive for M)
      const hasRootMakefile = fileNames.some((name) => {
        // Must be in root (no '/')
        if (name.includes("/")) return false;
        const lower = name.toLowerCase();
        // Strict "makefile" prefix check (covers Makefile, makefile, Makefile.txt, etc.)
        return lower === "makefile" || lower.startsWith("makefile.");
      });

      const cFiles = fileNames.filter((n) => n.endsWith(".c"));
      const cppFiles = fileNames.filter((n) => n.endsWith(".cpp"));
      const pyFiles = fileNames.filter((n) => n.endsWith(".py"));

      const allSourceFiles = [...cFiles, ...cppFiles, ...pyFiles];

      // Check if any source code is hidden inside folders
      const hasNestedFiles = allSourceFiles.some((n) => n.includes("/"));

      const selectedLang = form.lang;
      let errorMsg = "";

      if (hasNestedFiles) {
        errorMsg =
          "Incorrect directory structure. Please select the files directly and zip them, do not zip the folder containing them.";
      } else if (selectedLang === 0) {
        // User chose C
        if (!hasRootMakefile) {
          errorMsg =
            "Missing 'makefile' (or 'Makefile') at root level. File must be named 'makefile' (extensions like .txt are allowed).";
        } else if (cppFiles.length > 0) {
          errorMsg = "Language mismatch: You selected C, but the Zip contains C++ files (.cpp).";
        } else if (pyFiles.length > 0) {
          errorMsg = "Language mismatch: You selected C, but the Zip contains Python files (.py).";
        }
      } else if (selectedLang === 1) {
        // User chose C++
        if (!hasRootMakefile) {
          errorMsg =
            "Missing 'makefile' (or 'Makefile') at root level. File must be named 'makefile' (extensions like .txt are allowed).";
        } else if (cFiles.length > 0) {
          errorMsg = "Language mismatch: You selected C++, but the Zip contains C files (.c).";
        } else if (pyFiles.length > 0) {
          errorMsg = "Language mismatch: You selected C++, but the Zip contains Python files (.py).";
        }
      } else if (selectedLang === 2) {
        // User chose Python
        if (cFiles.length > 0) {
          errorMsg = "Language mismatch: You selected Python, but the Zip contains C files (.c).";
        } else if (cppFiles.length > 0) {
          errorMsg = "Language mismatch: You selected Python, but the Zip contains C++ files (.cpp).";
        }
      }

      // Stop if error found
      if (errorMsg) {
        logger.warn("Validation Failed", errorMsg);
        form.errorMessage = errorMsg;
        form.isLoading = false;
        logger.groupEnd();
        return;
      }

      logger.success("Zip Structure Validated");

      formData.append("code", form.zip);
    }

    // [API Calls]
    logger.log("Step 3: Creating Submission Record...");
    const { submissionId } = (
      await api.Submission.create({
        problemId: Number(route.params.id),
        languageType: Number(form.lang),
      })
    ).data;

    logger.success("Submission Record Created", submissionId);
    logger.log("Step 4: Uploading Payload...");

    await api.Submission.modify(submissionId, formData);

    logger.success("Upload Complete. Redirecting...");
    router.push(`/course/${route.params.name}/submission/${submissionId}`);
  } catch (error) {
    logger.error("Submission Failed", error);
    form.isSubmitError = true;
    form.errorMessage = t("course.problem.submit.err.msg"); // Set generic error on catch
    throw error;
  } finally {
    form.isLoading = false;
    logger.groupEnd();
  }
}
</script>

<template>
  <div class="card-container pb-28">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title md:text-2xl lg:text-3xl">
          {{ t("course.problem.submit.card.title") }}{{ $route.params.id }}
        </div>

        <template v-if="acceptedFormat === 'code'">
          <div class="mt-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-start md:gap-8">
            <div class="card-title md:text-lg lg:text-xl">
              {{ t("course.problem.submit.card.placeholder") }}
            </div>

            <div class="form-control w-full md:max-w-xs">
              <label class="label">
                <span class="label-text">Select Language</span>
              </label>
              <select
                v-model="(v$ as any).lang.$model"
                :class="['select-bordered select', (v$ as any).lang.$error && 'input-error']"
              >
                <option disabled :value="-1">{{ t("course.problem.submit.lang.select") }}</option>
                <option v-for="{ text, value } in langOptions" :key="value" :value="value">{{ text }}</option>
              </select>
              <label class="label" v-show="(v$ as any).lang.$error">
                <span class="label-text-alt text-error" v-text="(v$ as any).lang.$errors[0]?.$message" />
              </label>
            </div>
          </div>
          <code-editor v-model="form.code" class="mt-4" />
          <span
            v-show="(v$ as any).code?.$error"
            class="text-error"
            v-text="(v$ as any).code?.$errors[0]?.$message"
          />
        </template>

        <template v-else>
          <div class="mt-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-start md:gap-8">
            <div class="card-title md:text-lg lg:text-xl">Upload your solution (.zip)</div>

            <div class="form-control w-full md:max-w-xs">
              <label class="label">
                <span class="label-text">Select Language</span>
              </label>
              <select
                v-model="(v$ as any).lang.$model"
                :class="['select-bordered select', (v$ as any).lang.$error && 'input-error']"
              >
                <option disabled :value="-1">{{ t("course.problem.submit.lang.select") }}</option>
                <option v-for="{ text, value } in langOptions" :key="value" :value="value">{{ text }}</option>
              </select>
              <label class="label" v-show="(v$ as any).lang.$error">
                <span class="label-text-alt text-error" v-text="(v$ as any).lang.$errors[0]?.$message" />
              </label>
            </div>
          </div>
          <div class="mt-4">
            <input
              type="file"
              accept=".zip"
              @change="form.zip = ($event.target as HTMLInputElement).files?.[0] || null"
              class="file-input-bordered file-input"
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

        <div v-if="error" class="alert alert-error mt-4 shadow-lg">
          <div>
            <i-uil-times-circle />
            <span>{{ t("course.problem.submit.err.msg") }}</span>
          </div>
        </div>

        <div v-if="form.errorMessage" class="alert alert-warning mt-4 shadow-lg">
          <div>
            <i-uil-exclamation-circle />
            <span>{{ form.errorMessage }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    class="border-base-300 bg-base-100 fixed right-0 bottom-0 left-0 z-50 w-full border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
  >
    <div class="flex w-full justify-end px-4 md:px-8">
      <button :class="['btn btn-primary min-w-[150px]', form.isLoading && 'loading']" @click="submit">
        <i-uil-file-upload-alt class="mr-2 h-5 w-5" /> {{ t("course.problem.submit.text") }}
      </button>
    </div>
  </div>

  <AIChatbot
    v-if="aiChatEnabled"
    :course-id="route.params.name as string"
    :course-name="route.params.name as string"
    :problem-id="route.params.id as string"
    :current-code="aiCurrentCode"
    :username="session.username"
  />
</template>
