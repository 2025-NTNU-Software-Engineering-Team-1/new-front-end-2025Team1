<script setup lang="ts">
// ==========================================
// Imports
// ==========================================
import { useI18n } from "vue-i18n";
import { onMounted, inject, Ref, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";

// Components
import MultiStringInput from "../Controls/MultiStringInput.vue";

// Utils & API
import api from "@/models/api";
import { assertFileSizeOK } from "@/utils/checkFileSize";

const { t } = useI18n();

// ==========================================
// [CONFIG] Type Definitions (Locally Defined)
// ==========================================

// 1. Define Static Analysis API response structure
interface StaticAnalysisApiResponse {
  data: {
    librarySymbols: {
      imports: string[];
      headers: string[];
      functions: string[];
    };
  };
}

// 2. Define AI Checker Key API response structure
interface AiKey {
  id: number | string;
  key_name: string;
  is_active: boolean;
}

interface AiCheckerApiResponse {
  data: {
    keys?: AiKey[]; // Handle potential nested structure
    data?: {
      keys: AiKey[];
    };
  };
  keys?: AiKey[]; // Handle direct keys return
}

// 3. Define Vuelidate validation object structure (replacing inject<any>)
interface ValidationErrors {
  $message: string;
}
interface ValidationField {
  $error: boolean;
  $touch: () => void;
  $errors: ValidationErrors[];
}
interface ValidationState {
  assets?: {
    makefileZip?: ValidationField;
    teacherFile?: ValidationField;
    customCheckerPy?: ValidationField;
    scorePy?: ValidationField;
  };
}

// 4. Define Extended Config type (handling legacy fields like fopen/fwrite)
// This allows safe access to legacy properties without using 'any'
interface LegacyConfigProps {
  allowRead?: boolean;
  allowWrite?: boolean;
  allow_read?: boolean; // snake_case support
  allow_write?: boolean;
  fopen?: boolean; // legacy
  fwrite?: boolean; // legacy
  resourceData?: boolean; // Added this to fix the "Unexpected any" error
  assetPaths?: Record<string, string>;
  aiChecker?: {
    enabled: boolean;
    apiKeyId?: string;
    model: string;
  };
}

// Extend the unknown config with our legacy props using intersection type
type ExtendedProblemConfig = LegacyConfigProps & Record<string, unknown>;

// 5. Library Restrictions types
type LibMode = "whitelist" | "blacklist";
type LibSection = "syntax" | "imports" | "headers" | "functions";

// ==========================================
// AI Checker state
// ==========================================
const aiCheckerApiKeys = ref<{ id: string; key_name: string }[]>([]);
const isFetchingAiKeys = ref(false);

// ==========================================
// [CONFIG] Console Debug Mode
// ==========================================
const DEBUG_MODE = 1;

// ==========================================
// [CONFIG] Constants
// ==========================================
// Define the maximum limit for list items
const MAX_ITEMS_LIMIT = 100;

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
// Injection & Setup
// ==========================================
const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;
const v$ = inject<ValidationState>("v$"); // Use defined ValidationState
const route = useRoute();

if (!problem || !problem.value) {
  logger.error("Problem injection failed");
  throw new Error("PipelineSection requires problem injection");
}

// ==========================================
// Section: Pipeline Initialization
// ==========================================

/**
 * Ensures the pipeline object structure exists and populates defaults if missing.
 */
function ensurePipeline() {
  // Safe casting: use 'unknown' first to avoid overlap errors
  const config = (problem.value.config || {}) as unknown as ExtendedProblemConfig;

  if (!problem.value.pipeline) {
    problem.value.pipeline = {
      allowRead: Boolean(config.allowRead ?? config.fopen ?? false),
      allowWrite: Boolean(config.allowWrite ?? config.fwrite ?? false),
      executionMode: "general",
      customChecker: false,
      teacherFirst: false,
      staticAnalysis: {
        libraryRestrictions: {
          enabled: false,
          whitelist: { syntax: [], imports: [], headers: [], functions: [] },
          blacklist: { syntax: [], imports: [], headers: [], functions: [] },
        },
      },
      scoringScript: { custom: false },
    };
  } else {
    // Backfill missing file permission settings
    if (problem.value.pipeline.allowRead === undefined || problem.value.pipeline.allowRead === null) {
      problem.value.pipeline.allowRead = Boolean(config.allowRead ?? config.fopen ?? false);
    }
    if (problem.value.pipeline.allowWrite === undefined || problem.value.pipeline.allowWrite === null) {
      problem.value.pipeline.allowWrite = Boolean(config.allowWrite ?? config.fwrite ?? false);
    }

    // Ensure static analysis structure
    const staticAnalysis = problem.value.pipeline.staticAnalysis;
    if (!staticAnalysis || !staticAnalysis.libraryRestrictions) {
      problem.value.pipeline.staticAnalysis = {
        libraryRestrictions: {
          enabled: false,
          whitelist: { syntax: [], imports: [], headers: [], functions: [] },
          blacklist: { syntax: [], imports: [], headers: [], functions: [] },
        },
      };
    } else {
      const libs = staticAnalysis.libraryRestrictions;
      // Ensure deep structure for whitelist/blacklist using Strict Types
      const modes: LibMode[] = ["whitelist", "blacklist"];
      const sections: LibSection[] = ["syntax", "imports", "headers", "functions"];

      modes.forEach((mode) => {
        if (!libs[mode]) {
          libs[mode] = { syntax: [], imports: [], headers: [], functions: [] };
        }
        const currentModeObj = libs[mode];
        if (currentModeObj) {
          sections.forEach((f) => {
            if (!currentModeObj[f]) currentModeObj[f] = [];
          });
        }
      });
    }
  }
}

/**
 * Initialize pipeline values from backend config (legacy support).
 * Runs only once on mount to avoid reactive dependency loops.
 */
function initPipelineValues() {
  ensurePipeline();
  const pipe = problem.value.pipeline!;
  // Safe casting for legacy field access
  const cfg = (problem.value.config || {}) as unknown as ExtendedProblemConfig;

  // Prioritize existing pipeline values, fallback to config (legacy keys: fopen, fwrite)
  const backendAllowRead = pipe.allowRead ?? cfg.allowRead ?? cfg.allow_read ?? cfg.fopen ?? false;
  const backendAllowWrite = pipe.allowWrite ?? cfg.allowWrite ?? cfg.allow_write ?? cfg.fwrite ?? false;

  pipe.allowRead = Boolean(backendAllowRead);
  pipe.allowWrite = Boolean(backendAllowRead && backendAllowWrite);

  logger.log("Pipeline Values Initialized", { read: pipe.allowRead, write: pipe.allowWrite });
}

// ==========================================
// Section: File Permissions (Read/Write)
// ==========================================

// Track if allowWrite was forcibly closed by allowRead (determines warning color)
const allowWriteForceClosed = ref(false);

/**
 * Toggle for Allow Read.
 * Logic: Allow Write & Resource Data depend on Allow Read.
 */
const allowReadToggle = computed({
  get: () => Boolean(problem.value.pipeline?.allowRead),
  set: (val: boolean) => {
    ensurePipeline();
    problem.value.pipeline!.allowRead = Boolean(val);

    // When closing allowRead, cascade disable allowWrite
    if (!val) {
      // Mark as forcibly closed ONLY if allowWrite was originally active
      if (problem.value.pipeline!.allowWrite) {
        allowWriteForceClosed.value = true;
      }
      problem.value.pipeline!.allowWrite = false;

      // Handle potential resourceData property on config
      const cfg = problem.value.config as unknown as ExtendedProblemConfig;
      if ("resourceData" in cfg) {
        // Fixed: No longer using 'as any' because resourceData is in the type definition
        cfg.resourceData = false;
      }
    } else {
      // When opening allowRead, clear the force closed flag
      allowWriteForceClosed.value = false;
    }
  },
});

/**
 * Toggle for Allow Write.
 */
const allowWriteToggle = computed({
  get: () => Boolean(problem.value.pipeline?.allowWrite && allowReadToggle.value),
  set: (val: boolean) => {
    ensurePipeline();
    // allowWrite can only be true if allowRead is also true
    problem.value.pipeline!.allowWrite = Boolean(val && allowReadToggle.value);

    // Manual operation clears the force closed flag
    allowWriteForceClosed.value = false;
  },
});

// Computed properties for UI warnings
const allowWriteWarning = computed(() => (!allowReadToggle.value ? "Allow Write requires Allow Read." : ""));
// Show red if forcibly closed, otherwise gray
const allowWriteWarningError = computed(() => allowWriteForceClosed.value);

// ==========================================
// Section: Static Analysis Options
// ==========================================
const libraryOptions = ref({
  imports: [] as string[],
  headers: [] as string[],
  functions: [] as string[],
});

// Fetch options from backend
async function fetchStaticAnalysisOptions() {
  logger.group("Fetch Static Analysis Options");
  let imports: string[] = [];
  let headers: string[] = [];
  let functions: string[] = [];

  try {
    // Double casting unknown -> Target Type for safety
    const resp = (await api.Problem.getStaticAnalysisOptions()) as unknown as StaticAnalysisApiResponse;

    // Safe access response structure
    const libs = resp?.data?.librarySymbols || {};

    imports = Array.isArray(libs.imports) ? libs.imports : [];
    headers = Array.isArray(libs.headers) ? libs.headers : [];
    functions = Array.isArray(libs.functions) ? libs.functions : [];

    logger.success("Options Loaded", {
      imports: imports.length,
      headers: headers.length,
      functions: functions.length,
    });
  } catch (err) {
    logger.warn("StaticAnalysisOptions fetch failed, using empty lists:", err);
  } finally {
    libraryOptions.value = { imports, headers, functions };
    logger.groupEnd();
  }
}

// ==========================================
// Section: Mode Switching (White/Blacklist)
// ==========================================
const syntaxMode = ref<LibMode>("blacklist");
const libraryMode = ref<LibMode>("blacklist"); // Combined: imports + headers + functions

// Watchers: Clear the opposite list when mode switches
watch(syntaxMode, (newMode) => {
  const oppositeMode: LibMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  if (problem.value.pipeline?.staticAnalysis?.libraryRestrictions?.[oppositeMode]) {
    problem.value.pipeline.staticAnalysis.libraryRestrictions[oppositeMode]!.syntax = [];
  }
});

watch(libraryMode, (newMode) => {
  const oppositeMode: LibMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  if (problem.value.pipeline?.staticAnalysis?.libraryRestrictions?.[oppositeMode]) {
    const restrictions = problem.value.pipeline.staticAnalysis.libraryRestrictions[oppositeMode]!;
    restrictions.imports = [];
    restrictions.headers = [];
    restrictions.functions = [];
  }
});

const defaultSyntaxOptions = ["while", "for", "recursive"];

// ==========================================
// Section: Language Permissions
// ==========================================
// Bitmask: 1=C, 2=CPP, 4=Python
const allowImports = ref(false); // for Python
const allowHeaders = ref(false); // for C/C++

watch(
  () => problem.value.allowedLanguage,
  (lang: number) => {
    allowImports.value = Boolean(lang & 4);
    allowHeaders.value = Boolean(lang & 1 || lang & 2);
  },
  { immediate: true },
);

// Execution Mode Watcher
watch(
  () => problem.value.pipeline!.executionMode,
  (newMode: string) => {
    if (newMode === "interactive") {
      problem.value.pipeline!.customChecker = false;
      if (problem.value.assets) {
        problem.value.assets.customCheckerPy = null;
      }
    }
  },
);

// ==========================================
// Section: Helpers
// ==========================================

/**
 * Toggles an item in the array via Button Click.
 */
function toggleItem(arr: string[], item: string) {
  const idx = arr.indexOf(item);
  if (idx >= 0) {
    arr.splice(idx, 1);
  } else {
    if (arr.length >= MAX_ITEMS_LIMIT) {
      logger.warn("Limit reached", `Cannot add more than ${MAX_ITEMS_LIMIT} items.`);
      return;
    }
    arr.push(item);
  }
}

/**
 * Select All Items from backend options
 * Respects MAX_ITEMS_LIMIT
 */
function selectAllItems(section: LibSection, mode: LibMode) {
  ensurePipeline();
  const restrictions = problem.value.pipeline!.staticAnalysis!.libraryRestrictions![mode]!;
  const currentArr = restrictions[section] || [];
  const backendOpts = getBackendOptions(section);

  // Combine current items with backend options, removing duplicates
  const combined = new Set([...currentArr, ...backendOpts]);
  const newArr = Array.from(combined);

  // Apply limit
  if (newArr.length > MAX_ITEMS_LIMIT) {
    restrictions[section] = newArr.slice(0, MAX_ITEMS_LIMIT);
    logger.warn("Limit reached", `Selected items truncated to ${MAX_ITEMS_LIMIT}.`);
  } else {
    restrictions[section] = newArr;
  }
}

/**
 * Clear All Items in a section
 */
function clearAllItems(section: LibSection, mode: LibMode) {
  ensurePipeline();
  if (problem.value.pipeline?.staticAnalysis?.libraryRestrictions?.[mode]) {
    problem.value.pipeline.staticAnalysis.libraryRestrictions[mode]![section] = [];
  }
}

/**
 * Handles manual updates from MultiStringInput.
 * INTERCEPTS the v-model update to enforce limits.
 */
function handleManualUpdate(section: LibSection, mode: LibMode, newVal: string[]) {
  ensurePipeline();
  const restrictions = problem.value.pipeline!.staticAnalysis!.libraryRestrictions![mode]!;
  const currentArr = restrictions[section] || [];

  if (newVal.length < currentArr.length) {
    // Allowed: Deletion
    restrictions[section] = newVal;
  } else if (newVal.length <= MAX_ITEMS_LIMIT) {
    // Allowed: Addition within limit
    restrictions[section] = newVal;
  } else {
    logger.warn("Limit reached", `Blocked manual input. Limit: ${MAX_ITEMS_LIMIT}`);
  }
}

function getAllowedFileExtensions(): string[] {
  const lang = problem.value.allowedLanguage;
  const list: string[] = [];
  if (lang & 1) list.push(".c");
  if (lang & 2) list.push(".cpp");
  if (lang & 4) list.push(".py");
  return list;
}

function teacherAllowedExtensions(): string[] {
  if (problem.value.pipeline?.executionMode === "interactive") {
    return [".c", ".cpp", ".py"];
  }
  return getAllowedFileExtensions();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isTeacherFileAllowed(file: File | null): boolean {
  if (!file) return false;
  const allowed = teacherAllowedExtensions().map((ext) => ext.toLowerCase());
  const name = file.name.toLowerCase();
  return allowed.some((ext) => name.endsWith(ext));
}

function getLibList(section: LibSection, mode: LibMode): string[] {
  ensurePipeline();
  return problem.value.pipeline!.staticAnalysis!.libraryRestrictions![mode]![section] || [];
}

function setLibList(section: LibSection, mode: LibMode, next: string[]) {
  ensurePipeline();
  const cleaned = Array.from(new Set((next || []).map((s) => String(s).trim()).filter(Boolean)));
  problem.value.pipeline!.staticAnalysis!.libraryRestrictions![mode]![section] = cleaned;
}

function getBackendOptions(section: LibSection): string[] {
  if (section === "syntax") return defaultSyntaxOptions;
  if (section === "imports") return libraryOptions.value.imports || [];
  if (section === "headers") return libraryOptions.value.headers || [];
  return libraryOptions.value.functions || [];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function selectAllBackend(section: LibSection, mode: LibMode) {
  const current = getLibList(section, mode);
  const backend = getBackendOptions(section);
  setLibList(section, mode, [...current, ...backend]);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function clearSection(section: LibSection, mode: LibMode) {
  setLibList(section, mode, []);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCandidates(section: LibSection, mode: LibMode) {
  const selected = new Set(getLibList(section, mode));
  return getBackendOptions(section).filter((x) => !selected.has(x));
}

// Asset Helper
const assetPaths = computed<Record<string, string>>(() => {
  // Safe casting for assetPaths access
  const cfg = (problem.value.config || {}) as unknown as ExtendedProblemConfig;
  return cfg.assetPaths || {};
});

const hasAsset = (key: string) => Boolean(assetPaths.value && assetPaths.value[key]);
const assetDownloadUrl = (key: string) =>
  assetPaths.value && assetPaths.value[key] ? `/api/problem/${route.params.id}/asset/${key}/download` : null;

// Ensure pipeline object exists at script end (safety check)
// Check if pipeline is null to trigger initialization
if (!problem.value.pipeline) {
  ensurePipeline();
}

// ==========================================
// Lifecycle Hooks
// ==========================================
onMounted(async () => {
  initPipelineValues();
  await fetchStaticAnalysisOptions();
  await fetchAiCheckerKeys();
});

// Fetch AI API Keys for AI Checker
async function fetchAiCheckerKeys() {
  const courseName = typeof route.params.name === "string" ? route.params.name : route.params.name?.[0];
  if (!courseName) return;

  isFetchingAiKeys.value = true;
  try {
    const res = (await api.AIVTuber.getCourseKeys(courseName)) as unknown as AiCheckerApiResponse;

    // Compatibility handling for different API response structures
    let data: AiKey[] = [];
    if (res?.data?.keys) {
      data = res.data.keys;
    } else if (res?.data?.data?.keys) {
      data = res.data.data.keys;
    } else if (res?.keys) {
      data = res.keys;
    }

    aiCheckerApiKeys.value = data
      .filter((k) => k.is_active)
      .map((k) => ({
        id: String(k.id),
        key_name: k.key_name,
      }));
    logger.success("AI Checker Keys", aiCheckerApiKeys.value);
  } catch (err) {
    logger.error("Failed to fetch AI Checker keys", err);
  } finally {
    isFetchingAiKeys.value = false;
  }
}

// Ensure aiChecker config exists
function ensureAiCheckerConfig() {
  // Safe casting
  const config = problem.value.config as unknown as ExtendedProblemConfig;
  if (!config) return;
  if (!config.aiChecker) {
    config.aiChecker = {
      enabled: false,
      apiKeyId: undefined,
      model: "gemini-2.5-flash",
    };
  }
}

// Watch for AI Checker toggle to ensure config exists
watch(
  () => {
    const config = problem.value.config as unknown as ExtendedProblemConfig;
    return config?.aiChecker?.enabled;
  },
  (enabled) => {
    if (enabled) {
      ensureAiCheckerConfig();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="col-span-2 rounded-lg border border-gray-400 p-4">
      <label class="label"
        ><span class="label-text font-semibold">{{ t("course.problems.fileAccess") }}</span></label
      >
      <div class="flex flex-wrap gap-6">
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-2">
            <span class="label-text">{{ t("course.problems.fileAccessAllowedRead") }}</span>
            <input type="checkbox" class="toggle" v-model="allowReadToggle" />
          </label>
        </div>
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-2">
            <span class="label-text flex items-center gap-2">
              <span>{{ t("course.problems.fileAccessAllowedWrite") }}</span>
              <i-uil-lock-alt v-if="!allowReadToggle" class="text-error" />
            </span>
            <input type="checkbox" class="toggle" :disabled="!allowReadToggle" v-model="allowWriteToggle" />
          </label>
          <p
            v-if="allowWriteWarning"
            class="mt-1 pl-1 text-xs"
            :class="allowWriteWarningError ? 'text-error' : 'opacity-70'"
          >
            {{ t("course.problems.allowWriteWarning") }}
          </p>
        </div>
      </div>
    </div>

    <div class="form-control col-span-2 rounded-lg border border-gray-400 p-4">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">{{ t("course.problems.libraryRestrictionsGroup") }}</span>
        <input
          type="checkbox"
          class="toggle"
          v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions!.enabled"
        />
      </label>

      <div v-if="problem.pipeline!.staticAnalysis!.libraryRestrictions!.enabled" class="mt-3 space-y-4">
        <div class="rounded-lg border border-gray-400 p-3">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text font-medium">
              {{ t("course.problems.libraryRestrictionsGroup") || "Library Restrictions" }}
            </h4>
            <div class="mode-switcher">
              <div class="mode-switcher-container">
                <div
                  class="mode-switcher-slider"
                  :class="{ 'slider-blacklist': libraryMode === 'blacklist' }"
                ></div>
                <button
                  class="mode-switcher-option"
                  :class="{ active: libraryMode === 'whitelist' }"
                  @click="libraryMode = 'whitelist'"
                >
                  <span>{{ t("course.problems.restrictionWhite") }}</span>
                </button>
                <button
                  class="mode-switcher-option"
                  :class="{ active: libraryMode === 'blacklist' }"
                  @click="libraryMode = 'blacklist'"
                >
                  <span>{{ t("course.problems.restrictionBlack") }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="relative rounded border border-gray-500 p-2">
              <div
                v-if="!allowImports"
                class="tech-lock-overlay absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden rounded"
              >
                <div
                  class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"
                ></div>

                <div class="relative z-10 flex flex-col items-center p-4 text-center">
                  <div class="relative mb-3 flex h-14 w-14 items-center justify-center">
                    <div class="absolute inset-0 animate-ping rounded-full bg-yellow-500/20"></div>
                    <div
                      class="relative flex h-full w-full items-center justify-center rounded-full border border-yellow-500/30 bg-gradient-to-br from-gray-800 to-black shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                    >
                      <i-uil-lock-alt class="text-2xl text-yellow-400 drop-shadow-md" />
                    </div>
                  </div>

                  <h6 class="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-white drop-shadow-lg">
                    {{ t("course.problems.systemLocked") }}
                  </h6>
                  <div
                    class="mb-2 h-px w-16 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"
                  ></div>

                  <p class="max-w-[200px] px-2 font-mono text-xs leading-relaxed text-gray-300">
                    <span class="mr-1 text-yellow-500/80">>></span>
                    {{ t("course.problems.enablePythonHint") || "Enable Python to unlock." }}
                  </p>
                </div>
              </div>

              <div class="mb-2 flex items-center justify-between">
                <h5 class="text-sm font-medium">{{ t("course.problems.importsRestrictions") }}</h5>
                <div class="flex gap-1" v-if="allowImports">
                  <button
                    class="btn btn-xs btn-ghost h-5 min-h-0 px-1 text-[10px]"
                    @click="selectAllItems('imports', libraryMode)"
                  >
                    {{ t("course.problems.all") }}
                  </button>
                  <button
                    class="btn btn-xs btn-ghost text-error h-5 min-h-0 px-1 text-[10px]"
                    @click="clearAllItems('imports', libraryMode)"
                  >
                    {{ t("course.problems.clear") }}
                  </button>
                </div>
              </div>

              <div v-if="allowImports" class="flex flex-wrap gap-1">
                <button
                  v-for="opt in libraryOptions.imports"
                  :key="`import-${opt}`"
                  class="btn btn-xs"
                  :class="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.imports.includes(opt)
                      ? libraryMode === 'whitelist'
                        ? 'btn-info'
                        : 'btn-error'
                      : ''
                  "
                  :disabled="
                    !problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.imports.includes(
                      opt,
                    ) &&
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.imports.length >=
                      MAX_ITEMS_LIMIT
                  "
                  @click="
                    toggleItem(
                      problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.imports,
                      opt,
                    )
                  "
                >
                  {{ opt }}
                </button>
              </div>
              <div v-if="allowImports" class="mt-2">
                <MultiStringInput
                  :model-value="problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.imports"
                  @update:model-value="(val: string[]) => handleManualUpdate('imports', libraryMode, val)"
                  :placeholder="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.imports.length >=
                    MAX_ITEMS_LIMIT
                      ? t('course.problems.limitReached') || 'Limit Reached'
                      : t('course.problems.placeholderImport')
                  "
                  :badge-class="libraryMode === 'whitelist' ? 'badge-info' : 'badge-error'"
                  :disabled="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.imports.length >=
                    MAX_ITEMS_LIMIT
                  "
                />
              </div>
            </div>

            <div class="relative rounded border border-gray-500 p-2">
              <div
                v-if="!allowHeaders"
                class="tech-lock-overlay absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden rounded"
              >
                <div
                  class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"
                ></div>

                <div class="relative z-10 flex flex-col items-center p-4 text-center">
                  <div class="relative mb-3 flex h-14 w-14 items-center justify-center">
                    <div class="absolute inset-0 animate-ping rounded-full bg-blue-500/20"></div>
                    <div
                      class="relative flex h-full w-full items-center justify-center rounded-full border border-blue-500/30 bg-gradient-to-br from-gray-800 to-black shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    >
                      <i-uil-lock-alt class="text-2xl text-blue-400 drop-shadow-md" />
                    </div>
                  </div>

                  <h6 class="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-white drop-shadow-lg">
                    {{ t("course.problems.accessDenied") }}
                  </h6>
                  <div
                    class="mb-2 h-px w-16 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
                  ></div>

                  <p class="max-w-[200px] px-2 font-mono text-xs leading-relaxed text-gray-300">
                    <span class="mr-1 text-blue-500/80">>></span>
                    {{ t("course.problems.enableCppHint") || "Enable C/C++ to unlock." }}
                  </p>
                </div>
              </div>

              <div class="mb-2 flex items-center justify-between">
                <h5 class="text-sm font-medium">{{ t("course.problems.headersRestrictions") }}</h5>
                <div class="flex gap-1" v-if="allowHeaders">
                  <button
                    class="btn btn-xs btn-ghost h-5 min-h-0 px-1 text-[10px]"
                    @click="selectAllItems('headers', libraryMode)"
                  >
                    {{ t("course.problems.all") }}
                  </button>
                  <button
                    class="btn btn-xs btn-ghost text-error h-5 min-h-0 px-1 text-[10px]"
                    @click="clearAllItems('headers', libraryMode)"
                  >
                    {{ t("course.problems.clear") }}
                  </button>
                </div>
              </div>

              <div v-if="allowHeaders" class="flex flex-wrap gap-1">
                <button
                  v-for="opt in libraryOptions.headers"
                  :key="`header-${opt}`"
                  class="btn btn-xs"
                  :class="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.headers.includes(opt)
                      ? libraryMode === 'whitelist'
                        ? 'btn-info'
                        : 'btn-error'
                      : ''
                  "
                  :disabled="
                    !problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.headers.includes(
                      opt,
                    ) &&
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.headers.length >=
                      MAX_ITEMS_LIMIT
                  "
                  @click="
                    toggleItem(
                      problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.headers,
                      opt,
                    )
                  "
                >
                  {{ opt }}
                </button>
              </div>
              <div v-if="allowHeaders" class="mt-2">
                <MultiStringInput
                  :model-value="problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.headers"
                  @update:model-value="(val: string[]) => handleManualUpdate('headers', libraryMode, val)"
                  :placeholder="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.headers.length >=
                    MAX_ITEMS_LIMIT
                      ? t('course.problems.limitReached') || 'Limit Reached'
                      : t('course.problems.placeholderHeader')
                  "
                  :badge-class="libraryMode === 'whitelist' ? 'badge-info' : 'badge-error'"
                  :disabled="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.headers.length >=
                    MAX_ITEMS_LIMIT
                  "
                />
              </div>
            </div>

            <div class="relative rounded border border-gray-500 p-2">
              <div class="mb-2 flex items-center justify-between">
                <h5 class="text-sm font-medium">{{ t("course.problems.functionsRestrictions") }}</h5>
                <div class="flex gap-1">
                  <button
                    class="btn btn-xs btn-ghost h-5 min-h-0 px-1 text-[10px]"
                    @click="selectAllItems('functions', libraryMode)"
                  >
                    {{ t("course.problems.all") }}
                  </button>
                  <button
                    class="btn btn-xs btn-ghost text-error h-5 min-h-0 px-1 text-[10px]"
                    @click="clearAllItems('functions', libraryMode)"
                  >
                    {{ t("course.problems.clear") }}
                  </button>
                </div>
              </div>

              <div class="flex flex-wrap gap-1">
                <button
                  v-for="opt in libraryOptions.functions"
                  :key="`func-${opt}`"
                  class="btn btn-xs"
                  :class="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.functions.includes(
                      opt,
                    )
                      ? libraryMode === 'whitelist'
                        ? 'btn-info'
                        : 'btn-error'
                      : ''
                  "
                  :disabled="
                    !problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.functions.includes(
                      opt,
                    ) &&
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.functions.length >=
                      MAX_ITEMS_LIMIT
                  "
                  @click="
                    toggleItem(
                      problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.functions,
                      opt,
                    )
                  "
                >
                  {{ opt }}
                </button>
              </div>
              <div class="mt-2">
                <MultiStringInput
                  :model-value="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.functions
                  "
                  @update:model-value="(val: string[]) => handleManualUpdate('functions', libraryMode, val)"
                  :placeholder="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.functions.length >=
                    MAX_ITEMS_LIMIT
                      ? t('course.problems.limitReached') || 'Limit Reached'
                      : t('course.problems.placeholderFunction')
                  "
                  :badge-class="libraryMode === 'whitelist' ? 'badge-info' : 'badge-error'"
                  :disabled="
                    problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.functions.length >=
                    MAX_ITEMS_LIMIT
                  "
                />
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-gray-400 p-3">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text font-medium">{{ t("course.problems.syntaxRestrictions") }}</h4>
            <div class="mode-switcher">
              <div class="mode-switcher-container">
                <div
                  class="mode-switcher-slider"
                  :class="{ 'slider-blacklist': syntaxMode === 'blacklist' }"
                ></div>
                <button
                  class="mode-switcher-option"
                  :class="{ active: syntaxMode === 'whitelist' }"
                  @click="syntaxMode = 'whitelist'"
                >
                  <span>{{ t("course.problems.restrictionWhite") }}</span>
                </button>
                <button
                  class="mode-switcher-option"
                  :class="{ active: syntaxMode === 'blacklist' }"
                  @click="syntaxMode = 'blacklist'"
                >
                  <span>{{ t("course.problems.restrictionBlack") }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="opt in defaultSyntaxOptions"
              :key="`syntax-${opt}`"
              class="btn btn-xs"
              :class="
                problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax.includes(opt)
                  ? syntaxMode === 'whitelist'
                    ? 'btn-info'
                    : 'btn-error'
                  : ''
              "
              :disabled="
                !problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax.includes(opt) &&
                problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax.length >=
                  MAX_ITEMS_LIMIT
              "
              @click="
                toggleItem(problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax, opt)
              "
            >
              {{ opt }}
            </button>
          </div>

          <div class="mt-2">
            <MultiStringInput
              :model-value="problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax"
              @update:model-value="(val: string[]) => handleManualUpdate('syntax', syntaxMode, val)"
              :placeholder="
                problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax.length >=
                MAX_ITEMS_LIMIT
                  ? t('course.problems.limitReached') || 'Limit Reached'
                  : t('course.problems.placeholderSyntax')
              "
              :badge-class="syntaxMode === 'whitelist' ? 'badge-info' : 'badge-error'"
              :disabled="
                problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax.length >=
                MAX_ITEMS_LIMIT
              "
            />
          </div>
        </div>
      </div>
    </div>

    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <label class="label mb-2">
          <span class="label-text">{{ t("course.problems.executionMode") }}</span>
        </label>

        <div class="mb-4 flex flex-wrap gap-6">
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="general"
              v-model="problem.pipeline!.executionMode as 'general' | 'functionOnly' | 'interactive'"
            />
            <span class="label-text">{{ t("course.problems.executionModeGeneral") }}</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="functionOnly"
              v-model="problem.pipeline!.executionMode as 'general' | 'functionOnly' | 'interactive'"
            />
            <span class="label-text">{{ t("course.problems.executionModeFuncitonOnly") }}</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="interactive"
              v-model="problem.pipeline!.executionMode as 'general' | 'functionOnly' | 'interactive'"
            />
            <span class="label-text">{{ t("course.problems.executionModeInteractive") }}</span>
          </label>
        </div>

        <div
          v-if="problem.pipeline!.executionMode === 'functionOnly'"
          class="rounded-lg border border-gray-400 p-4"
        >
          <div class="form-control">
            <div class="flex flex-wrap items-center gap-4">
              <label class="label mb-0 cursor-pointer justify-start gap-x-2">
                <span class="label-text">{{ t("course.problems.uploadFile") }}</span>
              </label>
              <div class="flex items-center gap-2">
                <div
                  v-if="hasAsset('makefile') || problem.assets?.makefileZip"
                  class="flex items-center gap-2"
                >
                  <span class="badge badge-outline badge-success text-xs">{{
                    t("course.problems.upload")
                  }}</span>
                  <a
                    v-if="hasAsset('makefile')"
                    :href="assetDownloadUrl('makefile') || '#'"
                    class="btn btn-xs"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ t("course.problems.download") }}
                  </a>
                </div>
                <span v-else class="badge badge-outline text-xs opacity-70">{{
                  t("course.problems.notNotUploaded")
                }}</span>
              </div>
              <input
                type="file"
                accept=".zip"
                class="file-input-bordered file-input file-input-sm w-56"
                :class="{ 'input-error': v$?.assets?.makefileZip?.$error }"
                @change="
                  (e: Event) => {
                    const file = (e.target as HTMLInputElement).files?.[0] || null;
                    problem.assets!.makefileZip = file;
                    v$?.assets?.makefileZip?.$touch();
                    if (!file || !assertFileSizeOK(file, 'makefileZip')) {
                      problem.assets!.makefileZip = null;
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                "
              />
            </div>
            <label v-if="v$?.assets?.makefileZip?.$error" class="label">
              <span class="label-text-alt text-error">{{ v$.assets.makefileZip.$errors[0]?.$message }}</span>
            </label>
          </div>
        </div>

        <div
          v-if="problem.pipeline!.executionMode === 'interactive'"
          class="rounded-lg border border-gray-400 p-4"
        >
          <div class="form-control">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label class="label mb-0 cursor-pointer justify-start gap-x-2">
                <span class="label-text flex items-center gap-1">{{
                  t("course.problems.ineractiveTeacherFirst")
                }}</span>
                <input type="checkbox" class="toggle toggle-sm" v-model="problem.pipeline!.teacherFirst" />
              </label>

              <div class="flex items-center gap-x-2">
                <span class="text-sm opacity-80">{{
                  t("course.problems.interactiveUploadTeacherCode")
                }}</span>
                <div class="flex items-center gap-2">
                  <div
                    v-if="hasAsset('teacher_file') || problem.assets?.teacherFile"
                    class="flex items-center gap-2"
                  >
                    <span class="badge badge-outline badge-success text-xs">{{
                      t("course.problems.uploaded")
                    }}</span>
                    <a
                      v-if="hasAsset('teacher_file')"
                      :href="assetDownloadUrl('teacher_file') || '#'"
                      class="btn btn-xs"
                      target="_blank"
                      rel="noopener"
                    >
                      {{ t("course.problems.download") }}
                    </a>
                  </div>
                  <span v-else class="badge badge-outline text-xs opacity-70">{{
                    t("course.problems.notNotUploaded")
                  }}</span>
                </div>
                <input
                  type="file"
                  :accept="teacherAllowedExtensions().join(',')"
                  class="file-input-bordered file-input file-input-sm w-56"
                  :class="{ 'input-error': v$?.assets?.teacherFile?.$error }"
                  @change="
                    (e: Event) => {
                      const file = ((e.target as HTMLInputElement).files as FileList)?.[0] || null;
                      problem.assets!.teacherFile = file;
                      v$?.assets?.teacherFile?.$touch();
                      if (!file || !assertFileSizeOK(file, 'teacherFile')) {
                        problem.assets!.teacherFile = null;
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  "
                />
              </div>
              <label v-if="v$?.assets?.teacherFile?.$error" class="label">
                <span class="label-text-alt text-error">{{
                  v$.assets.teacherFile.$errors[0]?.$message
                }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <div class="flex items-center gap-4">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text flex items-center gap-1">
              <span>{{ t("course.problems.customChecker") }}</span>
              <i-uil-lock-alt
                v-if="problem.pipeline!.executionMode === 'interactive'"
                class="text-error"
                title="Disabled in interactive mode"
              />
            </span>
            <input
              type="checkbox"
              class="toggle"
              v-model="problem.pipeline!.customChecker"
              :disabled="problem.pipeline!.executionMode === 'interactive'"
            />
          </label>

          <div class="flex items-center gap-2">
            <div
              v-if="hasAsset('checker') || problem.assets?.customCheckerPy"
              class="flex items-center gap-2"
            >
              <span class="badge badge-outline badge-success text-xs">{{
                t("course.problems.uploaded")
              }}</span>
              <a
                v-if="hasAsset('checker')"
                :href="assetDownloadUrl('checker') || '#'"
                class="btn btn-xs"
                target="_blank"
                rel="noopener"
              >
                {{ t("course.problems.download") }}
              </a>
            </div>
            <span v-else class="badge badge-outline text-xs opacity-70">{{
              t("course.problems.notNotUploaded")
            }}</span>
          </div>
        </div>

        <div v-if="problem.pipeline!.customChecker" class="flex flex-col gap-x-2">
          <div class="flex items-center gap-x-2 pt-4">
            <span class="pl-1 text-sm opacity-80">{{ t("course.problems.uploadCustomChecker") }}</span>
            <input
              type="file"
              accept=".py"
              class="file-input-bordered file-input file-input-sm w-56"
              :class="{ 'input-error': v$?.assets?.customCheckerPy?.$error }"
              :disabled="problem.pipeline!.executionMode === 'interactive'"
              @change="
                (e: Event) => {
                  const file = (e.target as HTMLInputElement).files?.[0] || null;
                  problem.assets!.customCheckerPy = file;
                  v$?.assets?.customCheckerPy?.$touch();
                  if (!file || !assertFileSizeOK(file, 'custom_checker.py')) {
                    problem.assets!.customCheckerPy = null;
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              "
            />
          </div>
          <label v-if="v$?.assets?.customCheckerPy?.$error" class="label">
            <span class="label-text-alt text-error">{{
              v$.assets.customCheckerPy.$errors[0]?.$message
            }}</span>
          </label>

          <div class="bg-base-200/50 mt-4 rounded-lg border border-gray-500 p-4">
            <div class="flex items-center gap-4">
              <label class="label cursor-pointer justify-start gap-x-4">
                <span class="label-text">{{ t("course.problems.aiCheckerEnable") }}</span>
                <input
                  type="checkbox"
                  class="toggle toggle-sm"
                  :checked="problem.config?.aiChecker?.enabled || false"
                  @change="
                    (e: Event) => {
                      // Safe casting
                      const config = problem.config as unknown as ExtendedProblemConfig;
                      if (!config.aiChecker) {
                        config.aiChecker = { enabled: false, model: 'gemini-2.5-flash' };
                      }
                      config.aiChecker.enabled = (e.target as HTMLInputElement).checked;
                    }
                  "
                />
              </label>
            </div>

            <div v-if="problem.config?.aiChecker?.enabled" class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">{{ t("course.problems.aiCheckerApiKey") }}</span>
                </label>
                <div class="dropdown dropdown-bottom w-full">
                  <div
                    tabindex="0"
                    role="button"
                    class="select select-bordered select-sm flex w-full items-center justify-between bg-white"
                  >
                    <span class="truncate">
                      {{
                        aiCheckerApiKeys.find((k) => k.id === (problem.config as any).aiChecker?.apiKeyId)
                          ?.key_name || t("course.problems.aiCheckerSelectKey")
                      }}
                    </span>
                  </div>
                  <ul
                    tabindex="0"
                    class="dropdown-content menu rounded-box left-0 z-[100] mt-1 w-full border border-gray-300 bg-white p-2 shadow-lg"
                  >
                    <li class="disabled px-4 py-2 text-xs opacity-50">
                      {{ t("course.problems.aiCheckerSelectKey") }}
                    </li>
                    <li v-for="key in aiCheckerApiKeys" :key="key.id">
                      <a
                        class="text-gray-700 active:bg-gray-100"
                        @click="(problem.config as any).aiChecker!.apiKeyId = key.id"
                        >{{ key.key_name }}</a
                      >
                    </li>
                  </ul>
                </div>
                <label v-if="isFetchingAiKeys" class="label">
                  <span class="label-text-alt opacity-70">{{ t("course.problems.aiKeyLoadingKeys") }}</span>
                </label>
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text">{{ t("course.problems.aiCheckerModel") }}</span>
                </label>
                <div class="dropdown dropdown-bottom w-full">
                  <div
                    tabindex="0"
                    role="button"
                    class="select select-bordered select-sm flex w-full items-center justify-between bg-white"
                  >
                    <span>{{ (problem.config as any).aiChecker?.model || "Select Model" }}</span>
                  </div>
                  <ul
                    tabindex="0"
                    class="dropdown-content menu rounded-box left-0 z-[100] mt-1 w-full bg-white p-2 shadow"
                  >
                    <li>
                      <a @click="(problem.config as any).aiChecker!.model = 'gemini-2.5-flash-lite'"
                        >gemini 2.5 flash lite</a
                      >
                    </li>
                    <li>
                      <a @click="(problem.config as any).aiChecker!.model = 'gemini-2.5-flash'"
                        >gemini 2.5 flash</a
                      >
                    </li>
                    <li>
                      <a @click="(problem.config as any).aiChecker!.model = 'gemini-2.5-pro'"
                        >gemini 2.5 pro</a
                      >
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="pl-1 pt-2 text-xs opacity-70">
          {{
            problem.pipeline!.executionMode === "interactive"
              ? t("course.problems.uploadCustomCheckerWarning")
              : t("course.problems.uploadCustomCheckerInfo")
          }}
        </div>
      </div>
    </div>

    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <div class="flex items-center gap-4">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">{{ t("course.problems.customScoringScript") }}</span>
            <input type="checkbox" class="toggle" v-model="problem.pipeline!.scoringScript!.custom" />
          </label>
          <div class="flex items-center gap-2">
            <div v-if="hasAsset('scoring_script') || problem.assets?.scorePy" class="flex items-center gap-2">
              <span class="badge badge-outline badge-success text-xs">{{
                t("course.problems.uploaded")
              }}</span>
              <a
                v-if="hasAsset('scoring_script')"
                :href="assetDownloadUrl('scoring_script') || '#'"
                class="btn btn-xs"
                target="_blank"
                rel="noopener"
              >
                {{ t("course.problems.download") }}
              </a>
            </div>
            <span v-else class="badge badge-outline text-xs opacity-70">{{
              t("course.problems.notNotUploaded")
            }}</span>
          </div>
        </div>

        <div v-if="problem.pipeline!.scoringScript?.custom" class="flex flex-col gap-x-2">
          <div class="flex items-center gap-x-2 pt-4">
            <span class="pl-1 text-sm opacity-80">{{ t("course.problems.uploadCustomScorer") }}</span>
            <input
              type="file"
              accept=".py"
              class="file-input-bordered file-input file-input-sm w-56"
              :class="{ 'input-error': v$?.assets?.scorePy?.$error }"
              @change="
                (e: Event) => {
                  const file = (e.target as HTMLInputElement).files?.[0] || null;
                  problem.assets!.scorePy = file;
                  v$?.assets?.scorePy?.$touch();
                  if (!file || !assertFileSizeOK(file, 'scorePy')) {
                    problem.assets!.scorePy = null;
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              "
            />
          </div>
          <label v-if="v$?.assets?.scorePy?.$error" class="label">
            <span class="label-text-alt text-error">{{ v$.assets.scorePy.$errors[0]?.$message }}</span>
          </label>
        </div>
        <div v-else class="pl-1 pt-2 text-xs opacity-70">
          {{ t("course.problems.uploadCustomScorerInfo") }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mode Switcher */
.mode-switcher {
  display: flex;
  align-items: center;
}

.mode-switcher-container {
  position: relative;
  display: inline-flex;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
  padding: 3px;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.3),
    0 1px 2px rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.mode-switcher-slider {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 9px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 2px 8px rgba(59, 130, 246, 0.4),
    0 0 20px rgba(59, 130, 246, 0.2);
  z-index: 1;
}

.mode-switcher-slider.slider-blacklist {
  transform: translateX(calc(100% + 3px));
  background: linear-gradient(135deg, #ee5454 0%, #e04545 100%);
  box-shadow:
    0 2px 8px rgba(239, 68, 68, 0.4),
    0 0 20px rgba(239, 68, 68, 0.2);
}

.mode-switcher-option {
  position: relative;
  z-index: 2;
  padding: 6px 16px;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  border-radius: 9px;
}

.mode-switcher-option:hover {
  color: rgba(255, 255, 255, 0.8);
}

.mode-switcher-option.active {
  color: white;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.mode-switcher-option:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@keyframes pulse-warning {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.mode-switcher-option:disabled {
  animation: pulse-warning 2s ease-in-out infinite;
}

@media (max-width: 640px) {
  .mode-switcher-option {
    padding: 5px 12px;
    font-size: 0.7rem;
  }
}

/* ==========================================
   Tech Lock Overlay Animation
   ========================================== */

.tech-lock-overlay {
  /* Dark semi-transparent background */
  background-color: rgba(15, 23, 42, 0.85);
  /* Frosted glass effect */
  backdrop-filter: blur(4px);
  /* Border with gradient glow */
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);

  /* Diagonal Stripes Pattern */
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.03) 0px,
    rgba(255, 255, 255, 0.03) 2px,
    transparent 2px,
    transparent 12px
  );

  /* Size of the pattern block */
  background-size: 20px 20px;

  /* Animation for moving stripes */
  animation: stripes-move 20s linear infinite;
}

/* Keyframes to move the background pattern */
@keyframes stripes-move {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 40px 40px; /* Moves diagonally */
  }
}

/* Optional: Slight hover effect to make it interactive */
.tech-lock-overlay:hover {
  background-color: rgba(15, 23, 42, 0.9);
  transition: background-color 0.3s ease;
}

.tech-lock-overlay:hover i-uil-lock-alt {
  transform: scale(1.1);
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

:deep(.badge-error) {
  background-color: #e04545 !important;
  border-color: #e04545 !important;
  color: #ffffff !important;
}

:deep(.btn-error) {
  background-color: #e04545 !important;
  border-color: #e04545 !important;
  color: #ffffff !important;
}
</style>
