<script setup lang="ts">
import { inject, ref, Ref, onMounted, provide } from "vue";
import { nextTick, reactive, computed } from "vue";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, between, helpers } from "@vuelidate/validators";
import { useI18n } from "vue-i18n";

import DescriptionSection from "./Sections/DescriptionSection.vue";
import ConfigurationSection from "./Sections/ConfigurationSection.vue";
import PipelineSection from "./Sections/PipelineSection.vue";
import TestDataSection from "./Sections/TestDataSection.vue";
import ResourceDataSection from "./Sections/ResourceDataSection.vue";

interface VuelidateError {
  $propertyPath?: string;
  $property?: string;
  $message: string | import("vue").Ref<string>;
}

type PanelKey = "desc" | "config" | "pipeline" | "testdata" | "resdata";

// ==========================================
// [CONFIG] Console Debug Mode
// ==========================================
const DEBUG_MODE = 1;

//
const openPanels = reactive({
  desc: false,
  config: false,
  pipeline: false,
  testdata: false,
  resdata: false,
});
const { t } = useI18n();
const sectionRefs: Record<PanelKey, ReturnType<typeof ref<HTMLElement | null>>> = {
  desc: ref(null),
  config: ref(null),
  pipeline: ref(null),
  testdata: ref(null),
  resdata: ref(null),
};

function getPanelByErrorPath(path: string): PanelKey {
  if (path.startsWith("description.")) return "desc";

  if (path === "quota" || path === "allowedLanguage" || path === "problemName" || path.startsWith("config."))
    return "config";

  if (path.startsWith("pipeline.")) return "pipeline";
  if (path.startsWith("testCaseInfo.")) return "testdata";

  if (path.startsWith("assets.")) {
    if (path.startsWith("assets.testdataZip")) return "testdata";

    if (
      path.startsWith("assets.makefileZip") ||
      path.startsWith("assets.teacherFile") ||
      path.startsWith("assets.customCheckerPy") ||
      path.startsWith("assets.scorePy")
    )
      return "pipeline";

    if (path.startsWith("assets.dockerfilesZip")) return "config";

    if (
      //path.startsWith("assets.aiVTuberACFiles") ||
      path.startsWith("assets.trialModeACFiles") ||
      path.startsWith("assets.trialModePublicTestDataZip")
    )
      return "config";

    return "config";
  }

  return "config";
}

const errorSummary = computed(() => {
  const errs = v$.value.$errors || [];
  return errs.map((e: VuelidateError) => {
    const path = e.$propertyPath || e.$property || "(unknown)";
    return {
      path,
      message: e.$message || "Invalid field",
      panel: getPanelByErrorPath(path), // PanelKey
    };
  });
});

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const asArr = (v: unknown) => (Array.isArray(v) ? v : []);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!problem.value.pipeline) problem.value.pipeline = {} as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!problem.value.pipeline.staticAnalysis) problem.value.pipeline.staticAnalysis = {} as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staticAnalysis = (problem.value.pipeline.staticAnalysis ??= {} as any) as any;
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

//

function hasRemoteAsset(key: string): boolean {
  const paths = (problem.value.config as { assetPaths?: Record<string, unknown> })?.assetPaths;
  return Boolean(paths && paths[key]);
}

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
    /*
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
    */

    trialModeACFiles: {
      requiredWhenTrial: helpers.withMessage(
        "Trial Mode is enabled: please upload at least one AC file.",
        () => {
          const cfg = problem.value.config;
          if (!cfg?.trialMode) return true;
          // Check if already uploaded via assetPaths
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assetPaths = (cfg as any)?.assetPaths || {};
          if (assetPaths["ac_code"]) return true;
          // Check if new file is being uploaded
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
          // Check if already uploaded via assetPaths
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assetPaths = (cfg as any)?.assetPaths || {};
          if (assetPaths["public_testdata"]) return true;
          // Check if new file is being uploaded
          return !!problem.value.assets?.trialModePublicTestDataZip;
        },
      ),
    },

    teacherFile: {
      requiredWhenInteractive: helpers.withMessage("Interactive mode requires uploading Teacher Code", () => {
        if (problem.value.pipeline?.executionMode !== "interactive") return true;
        return !!problem.value.assets?.teacherFile || hasRemoteAsset("teacher_file");
      }),
      validExtension: helpers.withMessage(
        () => {
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
      requiredWhenFunctionOnly: helpers.withMessage(
        "Function Only mode requires uploading Makefile.zip",
        () => {
          if (problem.value.pipeline?.executionMode !== "functionOnly") return true;
          return !!problem.value.assets?.makefileZip || hasRemoteAsset("makefile");
        },
      ),
      validExtension: helpers.withMessage("Makefile must be a .zip file", () => {
        const file = problem.value.assets?.makefileZip;
        if (!file) return true;
        if (problem.value.pipeline?.executionMode !== "functionOnly") return true;
        return file.name.toLowerCase().endsWith(".zip");
      }),
    },

    customCheckerPy: {
      requiredWhenCustomChecker: helpers.withMessage(
        "Custom Checker is enabled: please upload Custom_Checker.py",
        () => {
          if (!problem.value.pipeline?.customChecker) return true;
          return !!problem.value.assets?.customCheckerPy || hasRemoteAsset("checker");
        },
      ),
      validExtension: helpers.withMessage("Custom checker must be a .py file", () => {
        const file = problem.value.assets?.customCheckerPy;
        if (!file) return true;
        if (!problem.value.pipeline?.customChecker) return true;
        return file.name.toLowerCase().endsWith(".py");
      }),
    },

    scorePy: {
      requiredWhenCustomScoring: helpers.withMessage(
        "Custom Scoring Script is enabled: please upload Custom_Scorer.py",
        () => {
          if (!problem.value.pipeline?.scoringScript?.custom) return true;
          return !!problem.value.assets?.scorePy || hasRemoteAsset("scoring_script");
        },
      ),
      validExtension: helpers.withMessage("Scoring script must be a .py file", () => {
        const file = problem.value.assets?.scorePy;
        if (!file) return true;
        if (!problem.value.pipeline?.scoringScript?.custom) return true;
        return file.name.toLowerCase().endsWith(".py");
      }),
    },

    dockerfilesZip: {
      requiredWhenNetworkEnabled: helpers.withMessage(
        "Network & Sidecars is enabled: please upload dockerfiles.zip",
        () => {
          const cfg = problem.value.config as { networkAccessEnabled?: boolean };
          if (!cfg?.networkAccessEnabled) return true;
          return (
            !!problem.value.assets?.dockerfilesZip ||
            hasRemoteAsset("network_dockerfile") ||
            hasRemoteAsset("dockerfiles")
          );
        },
      ),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((v$.value as any)[key]) (v$.value as any)[key].$touch?.();
}

//
async function openAndScroll(panel: PanelKey) {
  openPanels[panel] = true;
  await nextTick();
  sectionRefs[panel].value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submit() {
  logger.group("Form Submission");
  const ok = await v$.value.$validate();

  if (ok) {
    logger.success("Validation Passed. Emitting submit.");
    emits("submit");
  } else {
    logger.error("Validation Failed");

    const errs = v$.value.$errors as VuelidateError[];
    const panelsToOpen = new Set<string>();
    errs.forEach((e) => {
      const path = e.$propertyPath || e.$property || "";
      panelsToOpen.add(getPanelByErrorPath(path));
    });

    panelsToOpen.forEach((p) => {
      if (p in openPanels) {
        openPanels[p as PanelKey] = true;
      }
    });
    await nextTick();
    const first = errs[0];
    const firstPath = first?.$propertyPath || first?.$property || "";
    const firstPanel = getPanelByErrorPath(firstPath);
    sectionRefs[firstPanel as keyof typeof sectionRefs].value?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    // Debug: Log invalid fields
    if (DEBUG_MODE) {
      logger.warn(
        "Invalid Fields:",
        errs.map((e) => e.$propertyPath || e.$property),
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

  <div class="grid grid-cols-2 gap-y-4">
    <div class="form-control w-full max-w-xs">
      <label class="label">
        <span class="label-text">{{ t("course.problems.problemName") }}</span>
      </label>

      <input
        type="text"
        :class="['input-bordered input w-full max-w-xs', v$.problemName.$error && 'input-error']"
        :value="problem.problemName"
        @input="update('problemName', ($event.target as HTMLInputElement).value)"
      />

      <label v-show="v$.problemName.$error" class="label">
        <span class="label-text-alt text-error" v-text="v$.problemName.$errors[0]?.$message" />
      </label>
    </div>

    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">{{ t("components.problem.forms.hiddenToggle") }}</span>
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
  <div ref="sectionRefs.desc" class="mt-4 flex flex-col gap-2">
    <div class="collapse-arrow rounded-box bg-base-200 collapse">
      <input type="checkbox" class="peer" v-model="openPanels.desc" />
      <div
        class="collapse-title flex min-h-0 items-center py-2 text-base font-semibold"
        style="height: 2.5rem; min-height: 2.5rem"
      >
        {{ t("course.problems.setDescription") }}
      </div>
      <div class="collapse-content peer-checked:pt-4">
        <DescriptionSection :v$="v$" @update="update" />
      </div>
    </div>

    <div ref="sectionRefs.config" class="collapse-arrow rounded-box bg-base-200 collapse">
      <input type="checkbox" class="peer" v-model="openPanels.config" />
      <div
        class="collapse-title flex min-h-0 items-center py-2 text-base font-semibold"
        style="height: 2.5rem; min-height: 2.5rem"
      >
        {{ t("course.problems.setConfiguration") }}
      </div>
      <div class="collapse-content peer-checked:pt-4">
        <ConfigurationSection />
      </div>
    </div>

    <div ref="sectionRefs.pipeline" class="collapse-arrow rounded-box bg-base-200 collapse">
      <input type="checkbox" class="peer" v-model="openPanels.pipeline" />
      <div
        class="collapse-title flex min-h-0 items-center py-2 text-base font-semibold"
        style="height: 2.5rem; min-height: 2.5rem"
      >
        {{ t("course.problems.setPipelines") }}
      </div>
      <div class="collapse-content peer-checked:pt-4">
        <PipelineSection />
      </div>
    </div>

    <div ref="sectionRefs.testdata" class="collapse-arrow rounded-box bg-base-200 collapse">
      <input type="checkbox" class="peer" v-model="openPanels.testdata" />
      <div
        class="collapse-title flex min-h-0 items-center py-2 text-base font-semibold"
        style="height: 2.5rem; min-height: 2.5rem"
      >
        {{ t("course.problems.setTestData") }}
      </div>
      <div class="collapse-content peer-checked:pt-4">
        <TestDataSection :v$="v$ as any" />
      </div>
    </div>

    <div ref="sectionRefs.resdata" class="collapse-arrow rounded-box bg-base-200 collapse">
      <input type="checkbox" class="peer" v-model="openPanels.resdata" />
      <div
        class="collapse-title flex min-h-0 items-center py-2 text-base font-semibold"
        style="height: 2.5rem; min-height: 2.5rem"
      >
        {{ t("course.problems.setResourceData") }}
      </div>
      <div class="collapse-content peer-checked:pt-4">
        <div class="flex flex-col gap-4">
          <ResourceDataSection variant="student" />
          <ResourceDataSection variant="teacher" />
        </div>
      </div>
    </div>
  </div>

  <div v-if="v$.$error" class="alert alert-error mt-3">
    <div class="flex flex-col gap-2">
      <div class="font-semibold">{{ t("course.problems.submissionBlocked") }}</div>

      <ul class="list-disc pl-5 text-sm">
        <li v-for="(e, idx) in errorSummary" :key="idx">
          <button type="button" class="link link-hover" @click="openAndScroll(e.panel)">
            {{ e.message }}
          </button>
          <span class="opacity-70"> ({{ e.path }})</span>
        </li>
      </ul>
    </div>
  </div>

  <!-- Submit -->
  <div class="mt-6 flex justify-end">
    <button :class="['btn btn-success', isLoading && 'loading']" @click="submit">
      <i-uil-file-upload-alt class="mr-1 lg:h-5 lg:w-5" /> {{ t("course.members.submit") }}
    </button>
  </div>
</template>

<style>
/* Override DaisyUI collapse for compact, vertically centered headers */
/* Using global styles to ensure proper override of DaisyUI defaults */

.collapse-arrow.rounded-box > .collapse-title {
  padding: 6px 1rem 10px 1rem !important;
  min-height: 2.5rem !important;
  height: 2.5rem !important;
  display: flex !important;
  align-items: center !important;
  line-height: 1 !important;
}

.collapse-arrow.rounded-box > .collapse-title::after {
  /* Ensure the arrow is vertically centered */
  position: absolute !important;
  top: 40% !important;
  right: 1rem !important;
  transform: translateY(-50%) rotate(45deg) !important;
  margin-top: 0 !important;
}

/* When checkbox is NOT checked - hide content completely */
.collapse-arrow.rounded-box > input[type="checkbox"]:not(:checked) ~ .collapse-content {
  padding: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
}

/* When checkbox IS checked - show content with padding */
.collapse-arrow.rounded-box > input[type="checkbox"]:checked ~ .collapse-content {
  padding-top: 1rem !important;
  padding-bottom: 1.5rem !important;
}
</style>
