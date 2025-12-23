<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
// ==========================================
// Imports
// ==========================================
import { inject, Ref, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { ZipReader, BlobReader } from "@zip.js/zip.js";
import { assertFileSizeOK } from "@/utils/checkFileSize";

// ==========================================
// Props & Injection
// ==========================================
defineProps<{ v$: any }>();

const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;
const route = useRoute();
const isDrag = ref(false);

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
// Computed Properties
// ==========================================

const downloadUrl = computed(() => {
  const id = route.params.id;
  if (!id || Array.isArray(id)) return null;
  return `/api/problem/${id}/testcase`;
});

const hasRemoteTestcase = computed(() => Boolean((problem.value.config as any)?.assetPaths?.case));
const hasExistingTasks = computed(() => (problem.value.testCaseInfo?.tasks?.length ?? 0) > 0);
const hasBackendTestcase = computed(() => hasExistingTasks.value || hasRemoteTestcase.value);

const currentTaskLabel = computed(() => {
  if (!hasBackendTestcase.value) return "";
  const len = problem.value.testCaseInfo?.tasks?.length ?? 0;
  return len > 0 ? `${len} task(s)` : "remote";
});

// ==========================================
// Watcher: Zip File Processing
// ==========================================
watch(
  () => problem.value.assets?.testdataZip,
  async () => {
    isDrag.value = false;
    const file = problem.value.assets?.testdataZip;

    // Case 1: File removed
    if (!file) {
      logger.log("Testdata Zip removed, clearing tasks.");
      problem.value.testCaseInfo = { ...problem.value.testCaseInfo, tasks: [] };
      return;
    }

    logger.group("Process Testdata Zip");
    logger.log("File Name", file.name);

    try {
      // 1. Read Zip Content
      const reader = new ZipReader(new BlobReader(file));
      const entries = await reader.getEntries();
      await reader.close();

      const filenames = entries.map(({ filename }) => filename);
      const inputs = filenames.filter((f) => f.endsWith(".in"));
      const outputs = filenames.filter((f) => f.endsWith(".out"));

      logger.log("File Scan", { inputs: inputs.length, outputs: outputs.length });

      // 2. Validate Symmetry
      if (inputs.length !== outputs.length) {
        const msg = `Mismatch between Input (.in) and Output (.out) files.\n(in=${inputs.length}, out=${outputs.length})`;
        logger.error("Validation Failed", msg);
        alert(msg);
        problem.value.assets!.testdataZip = null; // Clear invalid file
        return;
      }

      // 3. Parse Tasks based on naming convention (00, 01, 02...)
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

      // 4. Update Problem State
      if (tasks.length > 0) {
        problem.value.testCaseInfo = { ...problem.value.testCaseInfo, tasks };
        logger.success("Tasks Updated", tasks);
      } else {
        const msg = "No valid test data found in the zip file (Expected structure: 00_xx.in).";
        logger.warn(msg);
        alert(msg);
        // Optional: clear file if invalid? keeping it for now as per original logic logic
      }
    } catch (err) {
      logger.error("Zip Processing Error", err);
      alert("Failed to read the zip file. Please ensure it is a valid zip archive.");
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
      <span class="label-text">Test Data Zip</span>
      <div class="flex items-center gap-2">
        <span v-if="hasBackendTestcase" class="badge badge-outline badge-success text-xs">
          Current: {{ currentTaskLabel }}
        </span>
        <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
        <a
          v-if="hasBackendTestcase && downloadUrl"
          class="btn btn-xs"
          :href="downloadUrl"
          target="_blank"
          rel="noopener"
        >
          Download current
        </a>
      </div>
    </label>

    <!-- Test Data Upload Row -->
    <div class="mt-2 overflow-hidden rounded-lg">
      <div class="grid grid-cols-5">
        <!-- 左側灰底區 -->
        <div class="bg-base-300 col-span-1 flex items-center justify-center text-sm">zip file</div>

        <!-- 右側白底上傳區 -->
        <div
          class="textarea-bordered bg-base-100 col-span-4 flex flex-col p-4"
          :class="[isDrag && 'border-accent border']"
          @drop.prevent="problem.assets!.testdataZip = $event.dataTransfer!.files![0]"
          @dragover.prevent="isDrag = true"
          @dragleave="isDrag = false"
        >
          <!-- 永� 在上方顯示 -->
          <div class="mb-2 text-sm opacity-70">Drop a zip file here</div>

          <!-- 選擇或顯示檔案 -->
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

    <!-- 驗證錯誤訊息 -->
    <label
      class="label text-error"
      v-show="v$.testCaseInfo.tasks.$error"
      v-text="v$.testCaseInfo.tasks.$errors[0]?.$message"
    />

    <!-- Tasks 表� � -->
    <template v-for="(t, i) in problem.testCaseInfo.tasks" :key="i">
      <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div class="form-control">
          <label class="label"><span class="label-text">#Cases</span></label>
          <input type="text" class="input-bordered input" :value="t.caseCount" readonly />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Score</span></label>
          <input
            type="number"
            class="input-bordered input"
            :value="t.taskScore"
            @input="
              problem.testCaseInfo.tasks[i].taskScore = Number(($event.target as HTMLInputElement).value)
            "
          />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Memory limit (KB)</span></label>
          <input
            type="number"
            class="input-bordered input"
            :value="t.memoryLimit"
            @input="
              problem.testCaseInfo.tasks[i].memoryLimit = Number(($event.target as HTMLInputElement).value)
            "
          />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Time limit (ms)</span></label>
          <input
            type="number"
            class="input-bordered input"
            :value="t.timeLimit"
            @input="
              problem.testCaseInfo.tasks[i].timeLimit = Number(($event.target as HTMLInputElement).value)
            "
          />
        </div>
      </div>
    </template>
  </div>
</template>
