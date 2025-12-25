<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
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

// AI Checker state
const aiCheckerApiKeys = ref<{ id: string; key_name: string }[]>([]);
const isFetchingAiKeys = ref(false);
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
// Injection & Setup
// ==========================================
const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;
const v$ = inject<any>("v$"); // Inject validation object
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
  if (!problem.value.pipeline) {
    problem.value.pipeline = {
      allowRead: Boolean(problem.value.config?.allowRead ?? (problem.value.config as any)?.fopen ?? false),
      allowWrite: Boolean(problem.value.config?.allowWrite ?? (problem.value.config as any)?.fwrite ?? false),
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
      problem.value.pipeline.allowRead = Boolean(
        problem.value.config?.allowRead ?? (problem.value.config as any)?.fopen ?? false,
      );
    }
    if (problem.value.pipeline.allowWrite === undefined || problem.value.pipeline.allowWrite === null) {
      problem.value.pipeline.allowWrite = Boolean(
        problem.value.config?.allowWrite ?? (problem.value.config as any)?.fwrite ?? false,
      );
    }

    // Ensure static analysis structure
    const libs = problem.value.pipeline.staticAnalysis?.libraryRestrictions;
    if (!libs) {
      problem.value.pipeline.staticAnalysis = {
        libraryRestrictions: {
          enabled: false,
          whitelist: { syntax: [], imports: [], headers: [], functions: [] },
          blacklist: { syntax: [], imports: [], headers: [], functions: [] },
        },
      };
    } else {
      // Ensure deep structure for whitelist/blacklist
      ["whitelist", "blacklist"].forEach((key) => {
        if (!(libs as any)[key]) (libs as any)[key] = {};
        ["syntax", "imports", "headers", "functions"].forEach((f) => {
          if (!(libs as any)[key][f]) (libs as any)[key][f] = [];
        });
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
  const cfg = (problem.value.config as any) || {};

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

    // When closing allowRead, cascade disable allowWrite and resourceData
    if (!val) {
      // Mark as forcibly closed ONLY if allowWrite was originally active
      if (problem.value.pipeline!.allowWrite) {
        allowWriteForceClosed.value = true;
      }
      problem.value.pipeline!.allowWrite = false;
      problem.value.config.resourceData = false;
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

// const resourceDataEnabled = computed({
//   get: () => problem.value.config.resourceData,
//   set: (val: boolean) => {
//     problem.value.config.resourceData = val;
//   },
// });

// Computed properties for UI warnings
// const allowWriteDisabled = computed(() => !allowReadToggle.value);
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
    const resp = await api.Problem.getStaticAnalysisOptions();
    // logger.log("Raw Response", resp);

    const libs = (resp && resp.data && (resp.data as any).librarySymbols) || {};
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
// Simplified: 2 modes instead of 4
const syntaxMode = ref<"whitelist" | "blacklist">("blacklist");
const libraryMode = ref<"whitelist" | "blacklist">("blacklist"); // Combined: imports + headers + functions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const importMode = ref<"whitelist" | "blacklist">("blacklist");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const headerMode = ref<"whitelist" | "blacklist">("blacklist");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const functionMode = ref<"whitelist" | "blacklist">("blacklist");

// Watchers: Clear the opposite list when mode switches
watch(syntaxMode, (newMode) => {
  const oppositeMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  if (problem.value.pipeline?.staticAnalysis?.libraryRestrictions?.[oppositeMode]) {
    problem.value.pipeline.staticAnalysis.libraryRestrictions[oppositeMode].syntax = [];
  }
});

// libraryMode controls imports, headers, and functions together
watch(libraryMode, (newMode) => {
  const oppositeMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  if (problem.value.pipeline?.staticAnalysis?.libraryRestrictions?.[oppositeMode]) {
    problem.value.pipeline.staticAnalysis.libraryRestrictions[oppositeMode].imports = [];
    problem.value.pipeline.staticAnalysis.libraryRestrictions[oppositeMode].headers = [];
    problem.value.pipeline.staticAnalysis.libraryRestrictions[oppositeMode].functions = [];
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
function toggleItem(arr: string[], item: string) {
  const idx = arr.indexOf(item);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(item);
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

//

type LibSection = "syntax" | "imports" | "headers" | "functions";
type LibMode = "whitelist" | "blacklist";

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
const assetPaths = computed<Record<string, string>>(
  () => ((problem.value.config as any)?.assetPaths as Record<string, string>) || {},
);

const hasAsset = (key: string) => Boolean(assetPaths.value && assetPaths.value[key]);
const assetDownloadUrl = (key: string) =>
  assetPaths.value && assetPaths.value[key] ? `/api/problem/${route.params.id}/asset/${key}/download` : null;

// Ensure pipeline object exists at script end (safety check)
problem.value.pipeline = problem.value.pipeline || ({} as any);

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
    const res = await api.AIVTuber.getCourseKeys(courseName);
    // Handle potential nested data structure from API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resData = res?.data as any;
    const data = resData?.data?.keys || resData?.keys || [];
    aiCheckerApiKeys.value = data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((k: any) => k.is_active)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((k: any) => ({
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
  if (!problem.value.config) return;
  if (!problem.value.config.aiChecker) {
    problem.value.config.aiChecker = {
      enabled: false,
      apiKeyId: undefined,
      model: "gemini-2.5-flash",
    };
  }
}

// Watch for AI Checker toggle to ensure config exists
watch(
  () => problem.value.config?.aiChecker?.enabled,
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
    <!-- File Access -->
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

    <!-- Library Restrictions -->
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
        <!-- ===== Library Restrictions (Imports/Headers/Functions) 統一開關 ===== -->
        <div class="rounded-lg border border-gray-400 p-3">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text font-medium">
              {{ t("course.problems.libraryRestrictionsGroup") || "Library Restrictions" }}
            </h4>
            <!-- 統一滑動開關 -->
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

          <!-- 三個輸入區塊並排 -->
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <!-- Imports -->
            <div class="relative rounded border border-gray-500 p-2">
              <div
                v-if="!allowImports"
                class="absolute inset-0 z-10 flex items-center justify-center rounded bg-gray-900/80 backdrop-blur-sm"
              >
                <div class="px-2 text-center">
                  <i-uil-lock-alt class="text-warning mb-1 text-2xl" />
                  <p class="text-xs font-medium text-gray-300">
                    {{ t("course.problems.restrictionDisabled") }}
                  </p>
                </div>
              </div>
              <h5 class="mb-2 text-sm font-medium">{{ t("course.problems.importsRestrictions") }}</h5>
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
                  v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.imports"
                  :placeholder="t('course.problems.placeholderImport')"
                  :badge-class="libraryMode === 'whitelist' ? 'badge-info' : 'badge-error'"
                />
              </div>
            </div>

            <!-- Headers -->
            <div class="relative rounded border border-gray-500 p-2">
              <div
                v-if="!allowHeaders"
                class="absolute inset-0 z-10 flex items-center justify-center rounded bg-gray-900/80 backdrop-blur-sm"
              >
                <div class="px-2 text-center">
                  <i-uil-lock-alt class="text-warning mb-1 text-2xl" />
                  <p class="text-xs font-medium text-gray-300">
                    {{ t("course.problem.headersRestrictionDisabled") }}
                  </p>
                </div>
              </div>
              <h5 class="mb-2 text-sm font-medium">{{ t("course.problems.headersRestrictions") }}</h5>
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
                  v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.headers"
                  :placeholder="t('course.problems.placeholderHeader')"
                  :badge-class="libraryMode === 'whitelist' ? 'badge-info' : 'badge-error'"
                />
              </div>
            </div>

            <!-- Functions -->
            <div class="rounded border border-gray-500 p-2">
              <h5 class="mb-2 text-sm font-medium">{{ t("course.problems.functionsRestrictions") }}</h5>
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
                  v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions![libraryMode]!.functions"
                  :placeholder="t('course.problems.placeholderFunction')"
                  :badge-class="libraryMode === 'whitelist' ? 'badge-info' : 'badge-error'"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- ===== Syntax Restrictions 獨立開關 ===== -->
        <div class="rounded-lg border border-gray-400 p-3">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text font-medium">{{ t("course.problems.syntaxRestrictions") }}</h4>
            <!-- 滑動開關 -->
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
              @click="
                toggleItem(problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax, opt)
              "
            >
              {{ opt }}
            </button>
          </div>

          <div class="mt-2">
            <MultiStringInput
              v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax"
              :placeholder="t('course.problems.placeholderSyntax')"
              :badge-class="syntaxMode === 'whitelist' ? 'badge-info' : 'badge-error'"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- === Execution mode (with all mode-linked fields) === -->
    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <label class="label mb-2">
          <span class="label-text">{{ t("course.problems.executionMode") }}</span>
        </label>

        <!-- radio options -->
        <div class="mb-4 flex flex-wrap gap-6">
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="general"
              v-model="problem.pipeline!.executionMode as any"
            />
            <span class="label-text">{{ t("course.problems.executionModeGeneral") }}</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="functionOnly"
              v-model="problem.pipeline!.executionMode as any"
            />
            <span class="label-text">{{ t("course.problems.executionModeFuncitonOnly") }}</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="interactive"
              v-model="problem.pipeline!.executionMode as any"
            />
            <span class="label-text">{{ t("course.problems.executionModeInteractive") }}</span>
          </label>
        </div>

        <!-- General mode fields -->

        <!-- functionOnly fields -->
        <div
          v-if="problem.pipeline!.executionMode === 'functionOnly'"
          class="rounded-lg border border-gray-400 p-4"
        >
          <!-- makefile.zip -->
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

        <!-- interactive fields -->
        <div
          v-if="problem.pipeline!.executionMode === 'interactive'"
          class="rounded-lg border border-gray-400 p-4"
        >
          <!-- Teacher first & Teacher_file -->
          <div class="form-control">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <!-- 左：Teacher first -->
              <label class="label mb-0 cursor-pointer justify-start gap-x-2">
                <span class="label-text flex items-center gap-1">{{
                  t("course.problems.ineractiveTeacherFirst")
                }}</span>
                <input type="checkbox" class="toggle toggle-sm" v-model="problem.pipeline!.teacherFirst" />
              </label>

              <!-- 右：Teacher_Code -->
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

    <!-- Custom checker (shared) -->
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
          <div class="flex items-center gap-x-2">
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

          <!-- AI Checker Sub-Options -->
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
                      if (!problem.config!.aiChecker) {
                        problem.config!.aiChecker = { enabled: false, model: 'gemini-2.5-flash' };
                      }
                      problem.config!.aiChecker!.enabled = (e.target as HTMLInputElement).checked;
                    }
                  "
                />
              </label>
            </div>

            <!-- AI Checker Settings (only when enabled) -->
            <div v-if="problem.config?.aiChecker?.enabled" class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <!-- API Key Selector -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text">{{ t("course.problems.aiCheckerApiKey") }}</span>
                </label>
                <select
                  class="select-bordered select select-sm"
                  v-model="problem.config!.aiChecker!.apiKeyId"
                >
                  <option disabled :value="undefined">{{ t("course.problems.aiCheckerSelectKey") }}</option>
                  <option v-for="key in aiCheckerApiKeys" :key="key.id" :value="key.id">
                    {{ key.key_name }}
                  </option>
                </select>
                <label v-if="isFetchingAiKeys" class="label">
                  <span class="label-text-alt opacity-70">{{ t("course.problems.aiKeyLoadingKeys") }}</span>
                </label>
              </div>

              <!-- Model Selector (hardcoded like AI TA) -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text">{{ t("course.problems.aiCheckerModel") }}</span>
                </label>
                <select class="select-bordered select select-sm" v-model="problem.config!.aiChecker!.model">
                  <option value="gemini-2.5-flash-lite">gemini 2.5 flash lite</option>
                  <option value="gemini-2.5-flash">gemini 2.5 flash</option>
                  <option value="gemini-2.5-pro">gemini 2.5 pro</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="pl-1 text-xs opacity-70">
          {{
            problem.pipeline!.executionMode === "interactive"
              ? t("course.problems.uploadCustomCheckerWarning")
              : t("course.problems.uploadCustomCheckerInfo")
          }}
        </div>
      </div>
    </div>

    <!-- Custom Scoring Script -->
    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <div class="flex items-center gap-4">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">{{ t("course.problems.customScoringScript") }}</span>
            <input type="checkbox" class="toggle" v-model="(problem as any).pipeline.scoringScript.custom" />
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

        <div v-if="(problem as any).pipeline.scoringScript?.custom" class="flex flex-col gap-x-2">
          <div class="flex items-center gap-x-2">
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
        <div v-else class="pl-1 text-xs opacity-70">{{ t("course.problems.uploadCustomScorerInfo") }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 黑白名單切換器 */
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
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
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
</style>
