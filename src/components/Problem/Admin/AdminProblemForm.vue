<script setup lang="ts">
import { inject, ref, Ref, onMounted, provide } from "vue";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, between, helpers } from "@vuelidate/validators";

import DescriptionSection from "./Sections/DescriptionSection.vue";
import ConfigurationSection from "./Sections/ConfigurationSection.vue";
import PipelineSection from "./Sections/PipelineSection.vue";
import TestDataSection from "./Sections/TestDataSection.vue";
import ResourceDataSection from "./Sections/ResourceDataSection.vue";

// ==========================================
// [CONFIG] Console Debug Mode
// ==========================================
const DEBUG_MODE = 1;

// ==========================================
// Logger Utility
// ==========================================
const logger = {
  log: (label: string, data?: any) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Log] ${label}`, "color: #3b82f6; font-weight: bold;", data || "");
  },
  success: (label: string, data?: any) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Success] ${label}`, "color: #10b981; font-weight: bold;", data || "");
  },
  error: (label: string, error?: any) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Error] ${label}`, "color: #ef4444; font-weight: bold;", error || "");
  },
  warn: (label: string, data?: any) => {
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
// Section: Utility Functions
// ==========================================
function getAllowedFileExtensions(allowedLanguage: number): string[] {
  const list: string[] = [];
  if (allowedLanguage & 1) list.push(".c");
  if (allowedLanguage & 2) list.push(".cpp");
  if (allowedLanguage & 4) list.push(".py");
  return list;
}

// ==========================================
// Section: Initialization & Refs
// ==========================================
const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;

if (!problem || !problem.value) {
  logger.error("Problem injection failed");
  throw new Error("ProblemFormParent requires problem injection");
}

const emits = defineEmits<{
  (e: "update", key: keyof ProblemForm, value: ProblemForm[typeof key]): void;
  (e: "submit"): void;
}>();

const isLoading = ref(false);
const errorMsg = ref("");

defineExpose({ isLoading, errorMsg });

// ==========================================
// Section: Data Normalization
// ==========================================

/**
 * Dual-version compatible normalize function for library restrictions.
 * Handles both legacy array format and new object format.
 */
function normalizeLibraryRestrictions(raw: any) {
  const base = {
    enabled: false,
    whitelist: { syntax: [], imports: [], headers: [], functions: [] },
    blacklist: { syntax: [], imports: [], headers: [], functions: [] },
  };
  if (!raw) return base;

  // Check if it's the new structure (contains internal keys)
  const isNewStructure =
    typeof raw.whitelist === "object" &&
    raw.whitelist !== null &&
    Array.isArray(raw.whitelist.syntax) &&
    Array.isArray(raw.blacklist.syntax);

  if (isNewStructure) {
    // Preserve all fields but ensure keys exist
    return {
      enabled: !!raw.enabled,
      whitelist: {
        syntax: raw.whitelist.syntax ?? [],
        imports: raw.whitelist.imports ?? [],
        headers: raw.whitelist.headers ?? [],
        functions: raw.whitelist.functions ?? [],
      },
      blacklist: {
        syntax: raw.blacklist.syntax ?? [],
        imports: raw.blacklist.imports ?? [],
        headers: raw.blacklist.headers ?? [],
        functions: raw.blacklist.functions ?? [],
      },
    };
  }

  // Legacy format: whitelist/blacklist are direct arrays (usually syntax)
  logger.warn("Legacy LibraryRestrictions format detected, normalizing...");
  const asArr = (v: any) => (Array.isArray(v) ? v : []);
  return {
    enabled: !!raw.enabled,
    whitelist: {
      syntax: asArr(raw.whitelist),
      imports: [],
      headers: [],
      functions: [],
    },
    blacklist: {
      syntax: asArr(raw.blacklist),
      imports: [],
      headers: [],
      functions: [],
    },
  };
}

/**
 * Auto-correct form structure on initialization.
 * Runs only once to avoid resetting user edits during hot-reload.
 */
function initFormStructure() {
  logger.group("Init Form Structure");
  if (!problem.value) {
    logger.warn("Problem value is null");
    logger.groupEnd();
    return;
  }

  // Ensure pipeline and staticAnalysis exist
  if (!problem.value.pipeline) problem.value.pipeline = {} as any;
  if (!problem.value.pipeline.staticAnalysis) problem.value.pipeline.staticAnalysis = {} as any;

  const staticAnalysis = (problem.value.pipeline.staticAnalysis ??= {} as any);
  const libs = staticAnalysis.libraryRestrictions;

  // Normalize Library Restrictions
  if (!libs || typeof libs !== "object") {
    logger.log("Initializing Library Restrictions (Empty)");
    staticAnalysis.libraryRestrictions = normalizeLibraryRestrictions(null);
  } else {
    // logger.log("Normalizing existing Library Restrictions");
    staticAnalysis.libraryRestrictions = normalizeLibraryRestrictions(libs);
  }

  logger.success("Form Structure Initialized");
  logger.groupEnd();
}

onMounted(() => {
  initFormStructure();
});

// ==========================================
// Section: Validation Rules
// ==========================================
const rules = {
  problemName: { required, maxLength: maxLength(64) },

  description: {
    description: { maxLength: maxLength(10000) },
    input: { maxLength: maxLength(10000) },
    output: { maxLength: maxLength(10000) },
    hint: { maxLength: maxLength(10000) },
    sampleInput: {
      itemMaxLength: helpers.withMessage("Each sample input must be <= 1024 chars", (v: string[]) =>
        v.every((d) => d.length <= 1024),
      ),
    },
    sampleOutput: {
      itemMaxLength: helpers.withMessage("Each sample output must be <= 1024 chars", (v: string[]) =>
        v.every((d) => d.length <= 1024),
      ),
    },
  },

  tags: {
    itemMaxLength: (v: string[]) => v.every((d) => d.length <= 16),
  },

  allowedLanguage: { required, between: between(1, 7) },

  quota: {
    required,
    validRange: helpers.withMessage(
      "Quota must be -1 (unlimited) or between 1 and 500",
      (v: number) => v === -1 || (v >= 1 && v <= 500),
    ),
  },

  testCaseInfo: {
    tasks: {
      scoreSum: helpers.withMessage(
        "The sum of all subtasks score must be 100",
        (tasks: ProblemTestCase[]) => tasks.reduce((a, c) => a + (c?.taskScore || 0), 0) === 100,
      ),
    },
  },

  config: {
    acceptedFormat: {
      required: helpers.withMessage(
        "Accepted format is required",
        () => !!problem.value.config.acceptedFormat,
      ),
    },
    vtuberApiKeyRequired: helpers.withMessage(
      "AI VTuber is enabled: please select at least one API key.",
      () => {
        const cfg = problem.value.config;
        if (!cfg?.aiVTuber) return true;
        return (cfg.aiVTuberApiKeys?.length ?? 0) > 0;
      },
    ),
  },

  pipeline: {
    executionMode: {
      required: helpers.withMessage("Execution mode is required", () =>
        ["general", "functionOnly", "interactive"].includes(problem.value.pipeline.executionMode),
      ),
    },
  },

  assets: {
    aiVTuberACFiles: {
      requiredWhenVtuber: helpers.withMessage(
        "AI VTuber is enabled: please upload at least one AC file.",
        () => {
          const cfg = problem.value.config;
          if (!cfg?.aiVTuber) return true;
          return (problem.value.assets?.aiVTuberACFiles?.length ?? 0) > 0;
        },
      ),
    },

    trialModeACFiles: {
      requiredWhenTrial: helpers.withMessage(
        "Trial Mode is enabled: please upload at least one AC file.",
        () => {
          const cfg = problem.value.config;
          if (!cfg?.trialMode) return true;
          return (problem.value.assets?.trialModeACFiles?.length ?? 0) > 0;
        },
      ),
    },

    trialModePublicTestDataZip: {
      requiredWhenTrial: helpers.withMessage(
        "Trial Mode is enabled: please upload Public Test Data (.zip).",
        () => {
          const cfg = problem.value.config;
          if (!cfg?.trialMode) return true;
          return !!problem.value.assets?.trialModePublicTestDataZip;
        },
      ),
    },

    teacherFile: {
      validExtension: helpers.withMessage(
        (ctx) => {
          const exts = getAllowedFileExtensions(problem.value.allowedLanguage);
          return `Teacher file must have one of the following extensions: ${exts.join(", ")}`;
        },
        () => {
          const file = problem.value.assets?.teacherFile;
          if (!file) return true; // Allow null/undefined
          if (problem.value.pipeline?.executionMode !== "interactive") return true;
          const exts = getAllowedFileExtensions(problem.value.allowedLanguage);
          const fileName = file.name.toLowerCase();
          return exts.some((ext) => fileName.endsWith(ext.toLowerCase()));
        },
      ),
    },

    makefileZip: {
      validExtension: helpers.withMessage("Makefile must be a .zip file", () => {
        const file = problem.value.assets?.makefileZip;
        if (!file) return true;
        if (problem.value.pipeline?.executionMode !== "functionOnly") return true;
        return file.name.toLowerCase().endsWith(".zip");
      }),
    },

    customCheckerPy: {
      validExtension: helpers.withMessage("Custom checker must be a .py file", () => {
        const file = problem.value.assets?.customCheckerPy;
        if (!file) return true;
        if (!problem.value.pipeline?.customChecker) return true;
        return file.name.toLowerCase().endsWith(".py");
      }),
    },

    scorePy: {
      validExtension: helpers.withMessage("Scoring script must be a .py file", () => {
        const file = problem.value.assets?.scorePy;
        if (!file) return true;
        if (!problem.value.pipeline?.scoringScript?.custom) return true;
        return file.name.toLowerCase().endsWith(".py");
      }),
    },

    dockerfilesZip: {
      validExtension: helpers.withMessage("Dockerfiles must be a .zip file", () => {
        const file = problem.value.assets?.dockerfilesZip;
        if (!file) return true;
        return file.name.toLowerCase().endsWith(".zip");
      }),
    },
  },
};

// ==========================================
// Section: Vuelidate & Methods
// ==========================================
const v$ = useVuelidate(rules, problem);

// Provide v$ to child components (e.g., PipelineSection)
provide("v$", v$);

function update<K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) {
  // logger.log(`Update Field: ${String(key)}`, value); // Optional: verbose logging
  emits("update", key, value);
  if ((v$.value as any)[key]) (v$.value as any)[key].$touch?.();
}

async function submit() {
  logger.group("Form Submission");
  const ok = await v$.value.$validate();

  if (ok) {
    logger.success("Validation Passed. Emitting submit.");
    emits("submit");
  } else {
    logger.error("Validation Failed");
    // Debug: Log invalid fields
    if (DEBUG_MODE) {
      const errors = v$.value.$errors;
      logger.warn(
        "Invalid Fields:",
        errors.map((e: any) => e.$property),
      );
    }
  }
  logger.groupEnd();
}
</script>

<template>
  <div v-if="errorMsg" class="alert alert-error shadow-lg">
    <div>
      <i-uil-times-circle />
      <span>{{ errorMsg }}</span>
    </div>
  </div>

  <!-- 第一層：題名與隱藏開關 -->
  <div class="grid grid-cols-2 gap-y-4">
    <div class="form-control w-full max-w-xs">
      <label class="label">
        <span class="label-text">Problem name</span>
      </label>

      <input
        type="text"
        :class="['input input-bordered w-full max-w-xs', v$.problemName.$error && 'input-error']"
        :value="problem.problemName"
        @input="update('problemName', ($event.target as HTMLInputElement).value)"
      />

      <label v-show="v$.problemName.$error" class="label">
        <span class="label-text-alt text-error" v-text="v$.problemName.$errors[0]?.$message" />
      </label>
    </div>

    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Hidden</span>
        <input
          type="checkbox"
          class="toggle toggle-success"
          :checked="problem.status === 1"
          @change="update('status', (problem.status ^ 1) as 0 | 1)"
        />
      </label>
    </div>
  </div>

  <!-- Section fold panels -->
  <div class="mt-4 flex flex-col gap-3">
    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Description</div>
      <div class="collapse-content">
        <DescriptionSection :v$="v$" @update="update" />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Configuration</div>
      <div class="collapse-content">
        <ConfigurationSection />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Pipeline</div>
      <div class="collapse-content">
        <PipelineSection />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Test Data</div>
      <div class="collapse-content">
        <TestDataSection :v$="v$" />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Resource Data</div>
      <div class="collapse-content">
        <div class="flex flex-col gap-4">
          <ResourceDataSection variant="student" />
          <ResourceDataSection variant="teacher" />
        </div>
      </div>
    </div>
  </div>

  <!-- 提交按鈕 -->
  <div class="mt-6 flex justify-end">
    <button :class="['btn btn-success', isLoading && 'loading']" @click="submit">
      <i-uil-file-upload-alt class="mr-1 lg:h-5 lg:w-5" /> Submit
    </button>
  </div>
</template>
