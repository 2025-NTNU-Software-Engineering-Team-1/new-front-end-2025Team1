<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
// ==========================================
// Imports
// ==========================================
import { inject, Ref, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { ZipReader, BlobReader, ZipWriter, BlobWriter, TextReader } from "@zip.js/zip.js";
import { assertFileSizeOK } from "@/utils/checkFileSize";
import { isMacOsZip } from "@/utils/zipValidator";
import api from "@/models/api";
import { useI18n } from "vue-i18n";
import { getHoverTranslations } from "../../Hovers";
import AITestcaseModal from "@/components/AITestcaseModal.vue";

// ==========================================
// Props & Injection
// ==========================================
defineProps<{ v$: any }>();

const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;
const route = useRoute();
const isDrag = ref(false);
const { t, locale } = useI18n();
const hover = computed(() => getHoverTranslations(locale.value));

// AI Testcase Modal State
const showAITestcaseModal = ref(false);
const isCreatingZip = ref(false);

// Type for advanced testcase assignment
type TestcaseAssignment = {
  task: number;
  case: number;
  input: string;
  output: string;
};

// Handle AI-generated testcases (simple mode - legacy, each as separate task)
async function handleAITestcases(inputs: string[], outputs?: string[]) {
  if (!inputs.length) return;
  isCreatingZip.value = true;

  try {
    const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

    for (let i = 0; i < inputs.length; i++) {
      const task = String(i).padStart(2, "0");
      const caseNum = "00";
      await zipWriter.add(`${task}${caseNum}.in`, new TextReader(inputs[i]));
      if (outputs && outputs[i]) {
        await zipWriter.add(`${task}${caseNum}.out`, new TextReader(outputs[i]));
      }
    }

    const blob = await zipWriter.close();
    const file = new File([blob], "ai_generated_testdata.zip", { type: "application/zip" });
    problem.value.assets!.testdataZip = file;
  } catch (err) {
    console.error("Failed to create testdata zip from AI:", err);
    testdataError.value = "Failed to create testdata from AI-generated test cases.";
  } finally {
    isCreatingZip.value = false;
  }
}

// Handle AI-generated testcases (advanced mode - with custom task/case assignment)
async function handleAITestcasesAdvanced(assignments: TestcaseAssignment[]) {
  if (!assignments.length) return;
  isCreatingZip.value = true;

  try {
    const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

    for (const a of assignments) {
      const task = String(a.task).padStart(2, "0");
      const caseNum = String(a.case).padStart(2, "0");
      await zipWriter.add(`${task}${caseNum}.in`, new TextReader(a.input));
      if (a.output) {
        await zipWriter.add(`${task}${caseNum}.out`, new TextReader(a.output));
      }
    }

    const blob = await zipWriter.close();
    const file = new File([blob], "ai_generated_testdata.zip", { type: "application/zip" });
    problem.value.assets!.testdataZip = file;
  } catch (err) {
    console.error("Failed to create testdata zip from AI:", err);
    testdataError.value = "Failed to create testdata from AI-generated test cases.";
  } finally {
    isCreatingZip.value = false;
  }
}

// ==========================================
// [CONFIG] Console Debug Mode
// ==========================================
const DEBUG_MODE = 1;

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

// Safety Check
if (!problem || !problem.value) {
  logger.error("Problem injection failed");
  throw new Error("TestDataSection requires problem injection");
}

// ==========================================
// Testdata Validation Error State
// ==========================================
const testdataError = ref<string | null>(null);

// ==========================================
// Computed Properties
// ==========================================

const downloadUrl = computed(() => {
  const id = route.params.id;
  if (!id || Array.isArray(id)) return null;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;
  return api.Problem.getTestCaseUrl(numericId);
});

const hasRemoteTestcase = computed(() => Boolean((problem.value.config as any)?.assetPaths?.case));
const hasExistingTasks = computed(() => (problem.value.testCaseInfo?.tasks?.length ?? 0) > 0);
const hasBackendTestcase = computed(() => hasExistingTasks.value || hasRemoteTestcase.value);

const currentTaskLabel = computed(() => {
  if (!hasBackendTestcase.value) return "";
  const len = problem.value.testCaseInfo?.tasks?.length ?? 0;
  return len > 0 ? `${len} ${t("course.problems.task")}` : "remote";
});

// ==========================================
// Input Validation Helper
// ==========================================

/**
 * Validates and updates task fields based on specific constraints:
 * - taskScore: Max 100
 * - memoryLimit: Max 10 digits (Length check)
 * - timeLimit: Max value 180000ms
 */
const validateTaskInput = (index: number, field: string, target: HTMLInputElement) => {
  let val = target.value;

  // 1. Validate Score: Max 100
  if (field === "taskScore") {
    if (Number(val) > 100) {
      val = "100";
    }
  }

  // 2. Validate Memory: Max length of 10 digits
  if (field === "memoryLimit") {
    if (val.length > 10) {
      val = val.slice(0, 10);
    }
  }

  // 3. Validate Time: Max value 180000
  if (field === "timeLimit") {
    if (Number(val) > 180000) {
      val = "180000";
    }
  }

  // Ensure positive numbers only (optional check to prevent negative inputs)
  if (Number(val) < 0) {
    val = "0";
  }

  // Update the input value visually if it was modified by our logic
  if (target.value !== val) {
    target.value = val;
  }

  // Update the reactive data model
  (problem.value.testCaseInfo.tasks[index] as any)[field] = Number(val);
};

// ==========================================
// Watcher: Zip File Processing
// ==========================================
watch(
  () => problem.value.assets?.testdataZip,
  async () => {
    isDrag.value = false;
    const file = problem.value.assets?.testdataZip;

    // Case 1: File removed - don't clear error (it might have been set by validation)
    if (!file) {
      logger.log("Testdata Zip removed, clearing tasks.");
      problem.value.testCaseInfo = { ...problem.value.testCaseInfo, tasks: [] };
      return;
    }

    // New file uploaded - clear previous errors
    testdataError.value = null;

    logger.group("Process Testdata Zip");
    logger.log("File Name", file.name);

    try {
      // 1. Check for macOS metadata files (Fast fail)
      if (await isMacOsZip(file)) {
        const msg = t("course.problems.macosZipDetected", {
          files: "MacOS System Files",
        });
        logger.error("macOS Metadata Files Detected");
        testdataError.value = msg;
        problem.value.assets!.testdataZip = null; // Clear invalid file
        problem.value.testCaseInfo = { ...problem.value.testCaseInfo, tasks: [] };
        return;
      }

      // 2. Read Zip Content
      const reader = new ZipReader(new BlobReader(file));
      const entries = await reader.getEntries();
      await reader.close();

      const filenames = entries.map(({ filename }) => filename);

      const inputs = filenames.filter((f) => f.endsWith(".in"));
      const outputs = filenames.filter((f) => f.endsWith(".out"));

      logger.log("File Scan", { inputs: inputs.length, outputs: outputs.length });

      // 3. Validate Symmetry
      if (inputs.length !== outputs.length) {
        const msg = `Mismatch between Input (.in) and Output (.out) files.\n(in=${inputs.length}, out=${outputs.length})`;
        logger.error("Validation Failed", msg);
        testdataError.value = msg;
        problem.value.assets!.testdataZip = null; // Clear invalid file
        return;
      }

      // 4. Parse Tasks based on naming convention (00, 01, 02...)
      let i = 0;
      const tasks = [];

      while (true) {
        // Use padStart for cleaner "00", "01" generation
        const prefix = String(i).padStart(2, "0");

        // Count files starting with this prefix
        const count = inputs.filter((fn) => fn.startsWith(prefix)).length;

        if (count > 0) {
          tasks.push({
            caseCount: count,
            memoryLimit: 134218, // Default ~128MB (in KB) + overhead
            taskScore: 0,
            timeLimit: 1000, // Default 1000ms
          });
          logger.log(`Task Found: Prefix ${prefix}, Cases: ${count}`);
          i++;
        } else {
          // Break loop when no files match the next index
          break;
        }
      }

      // 5. Update Problem State
      if (tasks.length > 0) {
        problem.value.testCaseInfo = { ...problem.value.testCaseInfo, tasks };
        logger.success("Tasks Updated", tasks);
      } else {
        const msg = "No valid test data found in the zip file (Expected structure: 00_xx.in).";
        logger.warn(msg);
        testdataError.value = msg;
        // Optional: clear file if invalid? keeping it for now as per original logic logic
      }
    } catch (err) {
      logger.error("Zip Processing Error", err);
      testdataError.value = "Failed to read the zip file. Please ensure it is a valid zip archive.";
      problem.value.assets!.testdataZip = null;
    } finally {
      logger.groupEnd();
    }
  },
);
</script>

<template>
  <div class="form-control col-span-2">
    <label class="label">
      <span class="label-text"
        >{{ t("course.problems.testDataZip") }}<span class="text-error ml-1" aria-hidden="true">*</span></span
      >
      <div class="flex items-center gap-2">
        <span v-if="hasBackendTestcase" class="badge badge-outline badge-success text-xs">
          {{ t("course.problems.current") }} {{ currentTaskLabel }}
        </span>
        <span v-else class="badge badge-outline text-xs opacity-70">{{
          t("course.problems.notUploaded")
        }}</span>
        <a
          v-if="hasBackendTestcase && downloadUrl"
          class="btn btn-xs"
          :href="downloadUrl"
          target="_blank"
          rel="noopener"
        >
          {{ t("course.problems.downloadCurrent") }}
        </a>
        <!-- AI Generate Button -->
        <button
          type="button"
          class="btn btn-xs btn-outline gap-1"
          :disabled="isCreatingZip"
          @click="showAITestcaseModal = true"
        >
          <i-uil-robot class="h-4 w-4" />
          {{ t("aiChatbot.testcaseGenerator.generateForJudging") }}
        </button>
      </div>
    </label>

    <div class="mt-2 overflow-hidden rounded-lg">
      <div class="grid grid-cols-5">
        <div
          class="bg-base-300 tooltip tooltip-right col-span-1 flex cursor-help items-center justify-center gap-1 text-sm"
          :data-tip="hover.setDataZipFile"
        >
          {{ t("course.problems.zipFile") }}
        </div>

        <div
          class="textarea-bordered bg-base-100 col-span-4 flex flex-col p-4"
          :class="[isDrag && 'border-accent border']"
          @drop.prevent="problem.assets!.testdataZip = $event.dataTransfer!.files![0]"
          @dragover.prevent="isDrag = true"
          @dragleave="isDrag = false"
        >
          <div class="mb-2 text-sm opacity-70">{{ t("course.problems.dropFileHere") }}</div>

          <template v-if="!problem.assets!.testdataZip">
            <input
              type="file"
              accept=".zip"
              class="file-input-bordered file-input file-input-sm w-full"
              @change="
                (e: Event) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file && !assertFileSizeOK(file, 'testdataZip')) {
                    (e.target as HTMLInputElement).value = '';
                    return;
                  }
                  problem.assets!.testdataZip = file || null;
                }
              "
            />
          </template>
          <template v-else>
            <div class="flex items-center">
              <span class="mr-3 font-medium">{{ problem.assets!.testdataZip.name }}</span>
              <button class="btn btn-sm" @click="problem.assets!.testdataZip = null">
                <i-uil-times />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Testdata Validation Error Display (same style as vuelidate errors) -->
    <label class="label text-error" v-show="testdataError" v-text="testdataError" />

    <label
      class="label text-error"
      v-show="v$.testCaseInfo.tasks.$error"
      v-text="v$.testCaseInfo.tasks.$errors[0]?.$message"
    />

    <template v-for="(task, i) in problem.testCaseInfo.tasks" :key="i">
      <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div class="form-control">
          <label class="label"
            ><span class="label-text">{{ t("course.problems.cases") }}</span></label
          >
          <input type="text" class="input-bordered input" :value="task.caseCount" readonly />
        </div>

        <div class="form-control">
          <label class="label"
            ><span class="label-text">{{ t("course.problems.score") }}</span></label
          >
          <input
            type="number"
            class="input-bordered input"
            :value="task.taskScore"
            @input="validateTaskInput(i, 'taskScore', $event.target as HTMLInputElement)"
          />
        </div>

        <div class="form-control">
          <label class="label"
            ><span class="label-text">{{ t("course.problems.memoryLimit") }}</span></label
          >
          <input
            type="number"
            class="input-bordered input"
            :value="task.memoryLimit"
            @input="validateTaskInput(i, 'memoryLimit', $event.target as HTMLInputElement)"
          />
        </div>

        <div class="form-control">
          <label class="label"
            ><span class="label-text">{{ t("course.problems.timeLimit") }}</span></label
          >
          <input
            type="number"
            class="input-bordered input"
            :value="task.timeLimit"
            @input="validateTaskInput(i, 'timeLimit', $event.target as HTMLInputElement)"
          />
        </div>
      </div>
    </template>

    <!-- AI Testcase Generator Modal -->
    <AITestcaseModal
      v-if="showAITestcaseModal"
      :problem-id="route.params.id as string | undefined"
      :course-name="(problem.courses?.[0] || route.params.name) as string"
      mode="teacher"
      :problem-context="{
        title: problem.problemName || '',
        description: problem.description?.description || '',
        input_format: problem.description?.input || '',
        output_format: problem.description?.output || '',
      }"
      @close="showAITestcaseModal = false"
      @use-testcases="
        (inputs: string[], outputs?: string[]) => {
          handleAITestcases(inputs, outputs);
          showAITestcaseModal = false;
        }
      "
      @use-testcases-advanced="
        (assignments: TestcaseAssignment[]) => {
          handleAITestcasesAdvanced(assignments);
          showAITestcaseModal = false;
        }
      "
    />
  </div>
</template>
