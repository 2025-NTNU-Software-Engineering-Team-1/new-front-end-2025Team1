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

// ==========================================
// Props & Setup
// ==========================================
const props = withDefaults(defineProps<{ variant?: "student" | "teacher" }>(), {
  variant: "student",
});

const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;
const route = useRoute();
const isDrag = ref(false);

// Safety Check
if (!problem || !problem.value) {
  logger.error("Problem injection failed");
  throw new Error("ResourceDataSection requires problem injection");
}

// ==========================================
// Section: Dynamic Keys (Teacher vs Student)
// ==========================================
const isTeacher = computed(() => props.variant === "teacher");

// Determine config keys based on variant
const enableKey = computed(() => (isTeacher.value ? "resourceDataTeacher" : "resourceData"));
const assetKey = computed(() => (isTeacher.value ? "resourceDataTeacherZip" : "resourceDataZip"));
const assetPathKey = computed(() => (isTeacher.value ? "resource_data_teacher" : "resource_data"));
const labelText = computed(() =>
  isTeacher.value ? "Set ResourceData (Teacher)" : "Set ResourceData (Student)",
);

// ==========================================
// Section: Permissions & Status
// ==========================================

// Check if Allow Read is enabled in pipeline or legacy config
const allowReadRef = computed(() => {
  const pipe = problem.value.pipeline || {};
  const cfg = problem.value.config || ({} as any);
  return Boolean(pipe.allowRead ?? cfg.allowRead ?? cfg.allow_read ?? cfg.fopen ?? false);
});

// Teachers always have permission; Students need Allow Read
const allowReadSatisfied = computed(() => isTeacher.value || allowReadRef.value);

// Check if test cases exist (Remote or Local)
const hasRemoteTestcase = computed(() => Boolean((problem.value.config as any)?.assetPaths?.case));
const hasTestdata = computed(
  () => hasRemoteTestcase.value || (problem.value.testCaseInfo?.tasks?.length ?? 0) > 0,
);

const hasExistingTasks = computed(() => (problem.value.testCaseInfo?.tasks?.length ?? 0) > 0);

const hasRemoteAsset = computed(() =>
  Boolean((problem.value.config as any)?.assetPaths?.[assetPathKey.value]),
);

// ==========================================
// Section: Validation Messages
// ==========================================

// Warning message (Computed directly, no need for watchers)
const resourceDataWarning = computed(() => {
  if (isTeacher.value) return "";
  if (!allowReadSatisfied.value && enableRef.value) {
    return "Enable Allow Read to use Resource Data.";
  }
  return "";
});

const enableDisabledReason = computed(() => {
  if (!hasTestdata.value) return "Upload TestData first";
  if (!allowReadSatisfied.value) return "Allow Read required";
  return "";
});

const showDisabledText = computed(() => Boolean(enableDisabledReason.value || resourceDataWarning.value));

// ==========================================
// Section: State Accessors (Get/Set)
// ==========================================

// Toggle Switch Reference
const enableRef = computed({
  get: () => (problem.value.config as any)?.[enableKey.value],
  set: (val: boolean) => {
    (problem.value.config as any)[enableKey.value] = val;
  },
});

// File Object Reference
const fileRef = computed({
  get: () => (problem.value.assets as any)?.[assetKey.value] ?? null,
  set: (val: File | null) => {
    if (problem.value.assets) (problem.value.assets as any)[assetKey.value] = val;
  },
});

// Download URL Generator
const downloadUrl = computed(() => {
  const pid = route.params.id;
  if (!pid || Array.isArray(pid)) return null;
  const assetPaths = (problem.value.config as any)?.assetPaths;
  if (assetPaths && !assetPaths[assetPathKey.value]) return null;
  return `/api/problem/${pid}/asset/${assetPathKey.value}/download`;
});

// Reset count if feature is disabled
const resourceCaseCount = ref<number | null>(null);

watch(
  () => problem.value.config?.resourceData,
  (val) => {
    if (!val) {
      resourceCaseCount.value = null;
    }
  },
);

const remoteTaskCount = computed(() => {
  const len = problem.value.testCaseInfo?.tasks?.length ?? 0;
  return len > 0 ? len : null;
});

// ==========================================
// Section: Zip Validation Logic
// ==========================================

// Generate expected prefixes (e.g., "0001", "0002") based on Task/Case count
const expectedPrefixes = computed(() => {
  const tasks = problem.value.testCaseInfo?.tasks || [];
  const prefixes: string[] = [];
  tasks.forEach((t, ti) => {
    for (let ci = 0; ci < (t.caseCount || 0); ci++) {
      prefixes.push(`${String(ti).padStart(2, "0")}${String(ci).padStart(2, "0")}`);
    }
  });
  return prefixes;
});

// Watch file changes to validate structure
watch(
  () => fileRef.value,
  async () => {
    isDrag.value = false;
    const file = fileRef.value;

    if (!file) {
      resourceCaseCount.value = null;
      return;
    }

    logger.group("Validate Resource Data Zip");
    logger.log("File Selected", file.name);

    // Pre-check: Do test tasks exist?
    if (!hasExistingTasks.value) {
      logger.warn("No existing tasks found. Clearing file.");
      fileRef.value = null;
      logger.groupEnd();
      return;
    }

    try {
      // 1. Read Zip
      const reader = new ZipReader(new BlobReader(file));
      const entries = await reader.getEntries();

      // Filter out folders
      const filenames = entries.map(({ filename }) => filename).filter((f) => !f.endsWith("/"));

      const prefixes = expectedPrefixes.value;
      const prefixSet = new Set(prefixes);

      const seenCases = new Set<string>();
      const seenTasks = new Set<string>();

      // 2. Iterate entries
      for (const name of filenames) {
        const base = name.split("/").pop() || name;
        const [prefix] = base.split("_");

        // Check if prefix matches defined TestData (0001, 0002...)
        if (!prefixSet.has(prefix)) {
          const msg = `ResourceData 檔名前綴不符測資結構: ${base}`;
          logger.error("Validation Failed", msg);
          alert(msg);
          fileRef.value = null;
          logger.groupEnd();
          return;
        }

        seenCases.add(prefix);
        seenTasks.add(prefix.slice(0, 2));
      }

      // 3. Verify completeness (Every test case must have a resource file?)
      // Logic from original code: sizes must match exactly.
      if (seenCases.size !== prefixSet.size) {
        const msg = "ResourceData 檔案數量與 TestData 測資數量不一致，請確認每個 case 都有對應資源。";
        logger.error("Count Mismatch", { seen: seenCases.size, expected: prefixSet.size });
        alert(msg);
        fileRef.value = null;
        resourceCaseCount.value = null;
        logger.groupEnd();
        return;
      }

      // 4. Success
      resourceCaseCount.value = seenTasks.size;
      logger.success("Validation Passed", { taskCount: seenTasks.size });
    } catch (err) {
      logger.error("Zip Processing Error", err);
      fileRef.value = null;
    } finally {
      logger.groupEnd();
    }
  },
);
</script>

<template>
  <div class="form-control col-span-2">
    <div class="flex flex-wrap items-center gap-3">
      <span class="label-text">{{ labelText }}</span>
      <label class="label cursor-pointer justify-start gap-x-2">
        <span class="label-text">Enable</span>
        <input
          type="checkbox"
          class="toggle"
          :disabled="Boolean(enableDisabledReason)"
          v-model="enableRef"
          @change="
            () => {
              if (!enableRef) fileRef = null;
            }
          "
        />
      </label>
      <i-uil-lock-alt v-if="enableDisabledReason" class="text-error" />
      <span v-if="showDisabledText" class="text-error whitespace-nowrap text-sm">
        {{ resourceDataWarning || enableDisabledReason }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <span
          v-if="resourceCaseCount !== null || hasRemoteAsset"
          class="badge badge-outline badge-success text-xs"
        >
          Current: {{ resourceCaseCount ?? remoteTaskCount ?? "remote" }} task(s)
        </span>
        <span v-else-if="fileRef" class="badge badge-outline badge-success text-xs"> Uploaded </span>
        <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
        <a
          v-if="downloadUrl && hasRemoteAsset"
          class="btn btn-xs"
          :href="downloadUrl"
          target="_blank"
          rel="noopener"
        >
          Download current
        </a>
      </div>
    </div>

    <div class="mt-2 overflow-hidden rounded-lg">
      <div class="grid grid-cols-5">
        <div class="bg-base-300 col-span-1 flex items-center justify-center text-sm">zip file</div>
        <div
          class="textarea-bordered bg-base-100 col-span-4 flex flex-col p-4"
          :class="[isDrag && 'border-accent border']"
          @drop.prevent="fileRef = enableRef && !enableDisabledReason ? $event.dataTransfer!.files![0] : null"
          @dragover.prevent="isDrag = enableRef && !enableDisabledReason"
          @dragleave="isDrag = false"
        >
          <div class="mb-2 text-sm opacity-70">
            {{
              enableDisabledReason
                ? enableDisabledReason
                : allowReadSatisfied
                  ? enableRef
                    ? "Drop a zip file here"
                    : "Enable first, then upload"
                  : "Enable Allow Read first"
            }}
          </div>

          <template v-if="!fileRef">
            <input
              type="file"
              accept=".zip"
              class="file-input-bordered file-input file-input-sm w-full"
              :disabled="!enableRef || Boolean(enableDisabledReason)"
              @change="
                (e: Event) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file && !assertFileSizeOK(file, 'resourceDataZip')) {
                    (e.target as HTMLInputElement).value = '';
                    return;
                  }
                  fileRef = enableRef ? file || null : null;
                }
              "
            />
          </template>
          <template v-else>
            <div class="flex items-center">
              <span class="mr-3 font-medium">{{ fileRef.name }}</span>
              <button class="btn btn-sm" @click="fileRef = null">
                <i-uil-times />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
