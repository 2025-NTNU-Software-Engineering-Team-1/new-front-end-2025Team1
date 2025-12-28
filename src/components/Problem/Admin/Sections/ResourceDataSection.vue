<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
// ==========================================
// Imports
// ==========================================
import { inject, Ref, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { ZipReader, BlobReader } from "@zip.js/zip.js";
import { assertFileSizeOK } from "@/utils/checkFileSize";
import { useI18n } from "vue-i18n";
import { hover_zh } from "../../Hovers/hover-zh-tw";
import { hover_en } from "../../Hovers/hover-en";

import { isMacOsZip } from "@/utils/zipValidator";

// ==========================================
// Definitions
// ==========================================

const props = defineProps<{
  variant: "student" | "teacher";
}>();

const problem = inject<Ref<ProblemForm>>("problem")!;
const { t, locale } = useI18n();
const route = useRoute();

const hover = computed(() => {
  return locale.value === "english" ? hover_en : hover_zh;
});

// ==========================================
// Local Logger
// ==========================================
const logger = {
  log: (label: string, data?: unknown) => {
    console.log(`%c[Log] ${label}`, "color: #3b82f6; font-weight: bold;", data || "");
  },
  success: (label: string, data?: unknown) => {
    console.log(`%c[Success] ${label}`, "color: #10b981; font-weight: bold;", data || "");
  },
  error: (label: string, error?: unknown) => {
    console.log(`%c[Error] ${label}`, "color: #ef4444; font-weight: bold;", error || "");
  },
  warn: (label: string, data?: unknown) => {
    console.log(`%c[Warn] ${label}`, "color: #f59e0b; font-weight: bold;", data || "");
  },
  group: (label: string) => {
    console.group(`%c[Group] ${label}`, "color: #8b5cf6; font-weight: bold;");
  },
  groupEnd: () => {
    console.groupEnd();
  },
};

// ==========================================
// State
// ==========================================

const isDrag = ref(false);
const resourceCaseCount = ref<number | null>(null);

// Computed mappings based on variant
const isStudent = computed(() => props.variant === "student");

const labelText = computed(() =>
  isStudent.value ? t("course.problems.setResourceData") : t("course.problems.setResourceDataTeacher"),
);

const enableRef = computed({
  get: () => {
    if (isStudent.value) return problem.value.config?.resourceData || false;
    return problem.value.config?.resourceDataTeacher || false;
  },
  set: (val: boolean) => {
    if (!problem.value.config) problem.value.config = {} as any;
    if (isStudent.value) {
      problem.value.config.resourceData = val;
    } else {
      problem.value.config.resourceDataTeacher = val;
    }
  },
});

const fileRef = computed({
  get: () => {
    if (isStudent.value) return problem.value.assets?.resourceDataZip || null;
    return problem.value.assets?.resourceDataTeacherZip || null;
  },
  set: (val: File | null) => {
    if (!problem.value.assets) problem.value.assets = {};
    if (isStudent.value) {
      problem.value.assets.resourceDataZip = val;
    } else {
      problem.value.assets.resourceDataTeacherZip = val;
    }
  },
});

const hasRemoteAsset = computed(() => {
  const assetPaths = problem.value.config?.assetPaths;
  const key = isStudent.value ? "resource_data" : "resource_data_teacher";
  return Boolean(assetPaths && assetPaths[key]);
});

const downloadUrl = computed(() => {
  const assetPaths = problem.value.config?.assetPaths;
  const key = isStudent.value ? "resource_data" : "resource_data_teacher";
  return assetPaths ? assetPaths[key] : null;
});

const allowReadSatisfied = computed(() => true);
const enableDisabledReason = computed(() => "");
const showDisabledText = computed(() => false);
const resourceDataWarning = computed(() => "");
const remoteTaskCount = computed(() => null);

const hasExistingTasks = computed(() => {
  return (problem.value.testCaseInfo?.tasks?.length || 0) > 0;
});

const expectedPrefixes = computed(() => {
  const prefixes: string[] = [];
  const tasks = problem.value.testCaseInfo?.tasks || [];
  let taskIdx = 0;
  for (const task of tasks) {
    const tParams = String(taskIdx).padStart(2, "0");
    for (let i = 0; i < task.caseCount; i++) {
      const cParams = String(i + 1).padStart(2, "0");
      prefixes.push(`${tParams}${cParams}`);
    }
    taskIdx++;
  }
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

    try {
      // 0. MacOS Check
      if (await isMacOsZip(file)) {
        logger.warn("MacOS Zip detected. Blocking silently.");
        fileRef.value = null;
        logger.groupEnd();
        return;
      }

      // Pre-check: Do test tasks exist?
      // ... (existing logic)
      if (!hasExistingTasks.value) {
        logger.warn("No existing tasks found. Clearing file.");
        fileRef.value = null;
        logger.groupEnd();
        return;
      }

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
          const msg = t("course.problems.prefixMismatch", { base });
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
        const msg = t("course.problems.countMismatch", {
          seen: seenCases.size,
          expected: prefixSet.size,
        });
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
      <span
        class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
        :data-tip="(hover as any)[labelText || ''] || hover.setResourceData"
        >{{ labelText }}</span
      >
      <label class="label cursor-pointer justify-start gap-x-2">
        <span class="label-text">{{ t("course.problems.enable") }}</span>
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
      <span v-if="showDisabledText" class="text-error text-sm whitespace-nowrap">
        {{ resourceDataWarning || enableDisabledReason }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <span
          v-if="resourceCaseCount !== null || hasRemoteAsset"
          class="badge badge-outline badge-success text-xs"
        >
          {{ t("course.problems.current") }} {{ resourceCaseCount ?? remoteTaskCount ?? "remote" }}
          {{ t("course.problems.tasks") }}
        </span>
        <span v-else-if="fileRef" class="badge badge-outline badge-success text-xs">
          {{ t("course.problems.uploaded") }}
        </span>
        <span v-else class="badge badge-outline text-xs opacity-70">{{
          t("course.problems.notUploaded")
        }}</span>
        <a
          v-if="downloadUrl && hasRemoteAsset"
          class="btn btn-xs"
          :href="downloadUrl"
          target="_blank"
          rel="noopener"
        >
          {{ t("course.problems.downloadCurrent") }}
        </a>
      </div>
    </div>

    <div class="mt-2 overflow-hidden rounded-lg">
      <div class="grid grid-cols-5 pb-4">
        <div
          class="bg-base-300 tooltip tooltip-right col-span-1 flex cursor-help items-center justify-center gap-1 rounded-l-lg text-sm"
          :data-tip="(hover as any)[`${labelText}_zip`]"
        >
          {{ t("course.problems.zipFile") }}<span class="text-error ml-1" aria-hidden="true">*</span>
        </div>
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
                    ? t("course.problems.dropFileHere")
                    : t("course.problems.EnablefirstThenUpload")
                  : t("course.problems.EnableAllowReadfirst")
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
