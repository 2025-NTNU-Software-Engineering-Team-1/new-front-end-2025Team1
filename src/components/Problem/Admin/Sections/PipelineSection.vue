<script setup lang="ts">
// ==========================================
// Imports
// ==========================================
import { useI18n } from "vue-i18n";
import { onMounted, inject, Ref, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { hover_zh } from "../../Hovers/hover-zh-tw";
import { hover_en } from "../../Hovers/hover-en";

// Components
import MultiStringInput from "../Controls/MultiStringInput.vue";

// Utils & API
import api from "@/models/api";
import { assertFileSizeOK } from "@/utils/checkFileSize";

const { t, locale } = useI18n();
const hover = computed(() => {
  return locale.value === "english" ? hover_en : hover_zh;
});

// teacher file (interactive)
const teacherFileError = ref("");

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
const MAX_ITEMS_LIMIT = 300;

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
// [CONFIG] Function Categories Definition
// ==========================================
const FUNCTION_CATEGORIES_MAP: Record<string, string[]> = {
  "Python Built-ins": [
    "print",
    "input",
    "eval",
    "exec",
    "open",
    "compile",
    "sorted",
    "reversed",
    "enumerate",
    "zip",
    "map",
    "filter",
    "range",
    "len",
    "sum",
    "min",
    "max",
    "abs",
    "round",
    "pow",
    "type",
    "isinstance",
    "issubclass",
    "hasattr",
    "getattr",
    "setattr",
    "delattr",
    "callable",
    "hash",
    "id",
    "repr",
    "str",
    "int",
    "float",
    "bool",
    "list",
    "dict",
    "set",
    "tuple",
    "frozenset",
    "bytes",
    "bytearray",
    "memoryview",
    "ord",
    "chr",
    "bin",
    "oct",
    "hex",
    "format",
    "vars",
    "dir",
    "globals",
    "locals",
    "help",
    "__import__",
    "breakpoint",
    "exit",
    "quit",
  ],
  "C I/O": [
    "printf",
    "scanf",
    "fprintf",
    "fscanf",
    "sprintf",
    "sscanf",
    "snprintf",
    "vprintf",
    "vfprintf",
    "vsprintf",
    "vsnprintf",
    "fopen",
    "fclose",
    "fread",
    "fwrite",
    "fgets",
    "fputs",
    "fgetc",
    "fputc",
    "getc",
    "putc",
    "getchar",
    "putchar",
    "fseek",
    "ftell",
    "rewind",
    "fflush",
    "feof",
    "ferror",
  ],
  "C String": [
    "strlen",
    "strcpy",
    "strncpy",
    "strcat",
    "strncat",
    "strcmp",
    "strncmp",
    "strchr",
    "strrchr",
    "strstr",
    "strtok",
    "memcpy",
    "memmove",
    "memset",
    "memcmp",
    "memchr",
  ],
  "C Memory": ["malloc", "calloc", "realloc", "free"],
  "C Math": [
    "sqrt",
    "cbrt",
    "exp",
    "log",
    "log10",
    "log2",
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "atan2",
    "sinh",
    "cosh",
    "tanh",
    "ceil",
    "floor",
    "trunc",
    "fabs",
    "fmod",
    "remainder",
    "fmax",
    "fmin",
  ],
  "C Utility": [
    "atoi",
    "atof",
    "atol",
    "strtol",
    "strtod",
    "strtoul",
    "rand",
    "srand",
    "qsort",
    "bsearch",
    "abort",
    "atexit",
    "system",
    "getenv",
    "setenv",
  ],
  "C++ STL Algorithms": [
    "sort",
    "stable_sort",
    "partial_sort",
    "nth_element",
    "find",
    "find_if",
    "find_if_not",
    "count",
    "count_if",
    "search",
    "binary_search",
    "lower_bound",
    "upper_bound",
    "equal_range",
    "merge",
    "includes",
    "copy",
    "copy_if",
    "copy_n",
    "move",
    "swap",
    "fill",
    "fill_n",
    "transform",
    "replace",
    "replace_if",
    "remove",
    "remove_if",
    "unique",
    "reverse",
    "rotate",
    "shuffle",
    "random_shuffle",
    "is_sorted",
    "is_partitioned",
    "partition",
    "stable_partition",
    "min_element",
    "max_element",
    "minmax",
    "minmax_element",
    "accumulate",
    "inner_product",
    "adjacent_difference",
    "partial_sum",
    "iota",
    "gcd",
    "lcm",
  ],
  "C++ Container Methods": [
    "push_back",
    "pop_back",
    "push_front",
    "pop_front",
    "push",
    "pop",
    "top",
    "front",
    "back",
    "insert",
    "erase",
    "clear",
    "empty",
    "size",
    "capacity",
    "resize",
    "reserve",
    "shrink_to_fit",
    "begin",
    "end",
    "rbegin",
    "rend",
    "cbegin",
    "cend",
    "emplace",
    "emplace_back",
    "emplace_front",
  ],
  "C++ I/O": ["cout", "cin", "cerr", "clog", "endl", "flush", "getline", "get", "put", "read", "write"],
};

// ==========================================
// Section: File Permissions (Read/Write)
// ==========================================

// Track if allowWrite was forcibly closed by allowRead (determines warning color)
const allowWriteForceClosed = ref(false);

/**
 * Toggle for Allow Read.
 */
const allowReadToggle = computed({
  get: () => Boolean(problem.value.pipeline?.allowRead),
  set: (val: boolean) => {
    ensurePipeline();
    problem.value.pipeline!.allowRead = Boolean(val);

    // When closing allowRead, cascade disable allowWrite
    if (!val) {
      if (problem.value.pipeline!.allowWrite) {
        allowWriteForceClosed.value = true;
      }
      problem.value.pipeline!.allowWrite = false;

      const cfg = problem.value.config as unknown as ExtendedProblemConfig;
      if ("resourceData" in cfg) {
        cfg.resourceData = false;
      }
    } else {
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
    problem.value.pipeline!.allowWrite = Boolean(val && allowReadToggle.value);
    allowWriteForceClosed.value = false;
  },
});

// Computed properties for UI warnings
const allowWriteWarning = computed(() => (!allowReadToggle.value ? "Allow Write requires Allow Read." : ""));
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
const pythonPresets = [
  "math",
  "random",
  "itertools",
  "functools",
  "operator",
  "collections",
  "heapq",
  "bisect",
  "string",
  "statistics",
  "time",
  "re",
  "json",
  "csv",
  "numpy",
  "pandas",
  "matplotlib.pyplot",
  "sklearn",
  "sklearn.model_selection",
  "sklearn.metrics",
  "sklearn.linear_model",
  "sklearn.neighbors",
  "sklearn.tree",
  "os",
  "sys",
  "pathlib",
  "subprocess",
  "typing",
  "dataclasses",
];

async function fetchStaticAnalysisOptions() {
  logger.group("Fetch Static Analysis Options");
  let imports: string[] = [];
  let headers: string[] = [];
  let functions: string[] = [];

  try {
    const resp = (await api.Problem.getStaticAnalysisOptions()) as unknown as StaticAnalysisApiResponse;
    const libs = resp?.data?.librarySymbols || {};
    const backendImports = Array.isArray(libs.imports) ? libs.imports : [];
    imports = Array.from(new Set([...pythonPresets, ...backendImports]));
    headers = Array.isArray(libs.headers) ? libs.headers : [];
    functions = Array.isArray(libs.functions) ? libs.functions : [];

    logger.success("Options Loaded", {
      imports: imports.length,
      headers: headers.length,
      functions: functions.length,
    });
  } catch (err) {
    imports = [...pythonPresets];
    logger.warn("StaticAnalysisOptions fetch failed, using empty lists:", err);
  } finally {
    libraryOptions.value = { imports, headers, functions };
    logger.groupEnd();
  }
}

// ==========================================
// Section: Function Categorization & Tabs
// ==========================================

// 1. Language Filter State
type LangFilter = "All" | "Python" | "C" | "CPP";
const activeLanguageFilter = ref<LangFilter>("All");

// 2. Active Category Tab State
const activeFunctionCategory = ref("");

// 3. Computed: Filter Categories based on Language AND Backend Options
const functionGroups = computed(() => {
  const backendFunctionsSet = new Set(libraryOptions.value.functions || []);
  const groups: { name: string; items: string[]; lang: LangFilter }[] = [];
  const categorizedItems = new Set<string>();

  // Helper to detect language from category name
  const getLangFromCategory = (name: string): LangFilter => {
    if (name.startsWith("Python")) return "Python";
    if (name.startsWith("C++")) return "CPP";
    if (name.startsWith("C ")) return "C";
    return "All"; // Fallback
  };

  // Iterate map and build groups
  for (const [categoryName, items] of Object.entries(FUNCTION_CATEGORIES_MAP)) {
    // 1. Filter by Language Toggle
    const catLang = getLangFromCategory(categoryName);
    if (activeLanguageFilter.value !== "All" && activeLanguageFilter.value !== catLang) {
      continue;
    }

    // 2. Filter items by Backend Availability
    const validItems = items.filter((item) => backendFunctionsSet.has(item));

    if (validItems.length > 0) {
      groups.push({ name: categoryName, items: validItems, lang: catLang });
      validItems.forEach((i) => categorizedItems.add(i));
    }
  }

  // Handle "Others" (Only show if Language is All or matches broadly)
  const otherItems = (libraryOptions.value.functions || []).filter((item) => !categorizedItems.has(item));

  if (otherItems.length > 0 && activeLanguageFilter.value === "All") {
    groups.push({ name: "Others / Uncategorized", items: otherItems, lang: "All" });
  }

  return groups;
});

// Watcher to reset active tab when groups change (e.g., switching language)
watch(
  functionGroups,
  (newGroups) => {
    if (newGroups.length > 0) {
      // If current active category is no longer visible, switch to first available
      const exists = newGroups.find((g) => g.name === activeFunctionCategory.value);
      if (!exists) {
        activeFunctionCategory.value = newGroups[0].name;
      }
    } else {
      activeFunctionCategory.value = "";
    }
  },
  { immediate: true },
);

// Computed to get the items of the currently active tab
const activeGroupData = computed(() => {
  return functionGroups.value.find((g) => g.name === activeFunctionCategory.value) || { name: "", items: [] };
});

/**
 * Select all items within a specific category group.
 */
function selectCategoryItems(categoryItems: string[], mode: LibMode) {
  ensurePipeline();
  const restrictions = problem.value.pipeline!.staticAnalysis!.libraryRestrictions![mode]!;
  const currentArr = restrictions.functions || [];
  const resultSet = new Set(currentArr);
  categoryItems.forEach((item) => resultSet.add(item));
  const newArr = Array.from(resultSet);

  if (newArr.length > MAX_ITEMS_LIMIT) {
    restrictions.functions = newArr.slice(0, MAX_ITEMS_LIMIT);
    logger.warn("Limit reached", `Category selection truncated.`);
  } else {
    restrictions.functions = newArr;
  }
}

/**
 * Clear all items belonging to a specific category group.
 */
function clearCategoryItems(categoryItems: string[], mode: LibMode) {
  ensurePipeline();
  const restrictions = problem.value.pipeline!.staticAnalysis!.libraryRestrictions![mode]!;
  const currentArr = restrictions.functions || [];
  const categorySet = new Set(categoryItems);
  restrictions.functions = currentArr.filter((item) => !categorySet.has(item));
}

// ==========================================
// Section: Mode Switching (White/Blacklist)
// ==========================================
const syntaxMode = ref<LibMode>("blacklist");
const libraryMode = ref<LibMode>("blacklist");

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

// Syntax options
const syntaxOptions = ref<{
  python: { common: string[]; all: string[]; allSet: Set<string> };
  cpp: { common: string[]; all: string[]; allSet: Set<string> };
}>({
  python: { common: ["while", "for", "recursive"], all: [], allSet: new Set() },
  cpp: { common: ["while", "for", "recursive"], all: [], allSet: new Set() },
});

// Get syntax options based on current language
const currentSyntaxOptions = computed(() => {
  const lang = problem.value.allowedLanguage;
  if (lang & 4) return syntaxOptions.value.python;
  if (lang & 3) return syntaxOptions.value.cpp;
  return syntaxOptions.value.python;
});

// Validate syntax value
function validateSyntaxValue(value: string): boolean {
  const validSet = currentSyntaxOptions.value.allSet;
  if (validSet.size === 0) return true;
  return validSet.has(value.toLowerCase());
}

// Warning message
const syntaxWarningMessage = ref<string>("");
let syntaxWarningTimer: ReturnType<typeof setTimeout> | null = null;

function showSyntaxWarning(invalidValues: string[]) {
  if (syntaxWarningTimer) {
    clearTimeout(syntaxWarningTimer);
  }
  syntaxWarningMessage.value = `不合法的語法值已被過濾: ${invalidValues.join(", ")}`;
  syntaxWarningTimer = setTimeout(() => {
    syntaxWarningMessage.value = "";
  }, 5000);
}

// ==========================================
// Section: Language Permissions
// ==========================================
const allowImports = ref(false);
const allowHeaders = ref(false);

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

function selectAllItems(section: LibSection, mode: LibMode) {
  ensurePipeline();
  const restrictions = problem.value.pipeline!.staticAnalysis!.libraryRestrictions![mode]!;
  const currentArr = restrictions[section] || [];
  const backendOpts = getBackendOptions(section);
  const combined = new Set([...currentArr, ...backendOpts]);
  const newArr = Array.from(combined);

  if (newArr.length > MAX_ITEMS_LIMIT) {
    restrictions[section] = newArr.slice(0, MAX_ITEMS_LIMIT);
    logger.warn("Limit reached", `Selected items truncated to ${MAX_ITEMS_LIMIT}.`);
  } else {
    restrictions[section] = newArr;
  }
}

function clearAllItems(section: LibSection, mode: LibMode) {
  ensurePipeline();
  if (problem.value.pipeline?.staticAnalysis?.libraryRestrictions?.[mode]) {
    problem.value.pipeline.staticAnalysis.libraryRestrictions[mode]![section] = [];
  }
}

function handleManualUpdate(section: LibSection, mode: LibMode, newVal: string[]) {
  ensurePipeline();
  const restrictions = problem.value.pipeline!.staticAnalysis!.libraryRestrictions![mode]!;
  const currentArr = restrictions[section] || [];

  let filteredVal = newVal;
  if (section === "syntax" && currentSyntaxOptions.value.allSet.size > 0) {
    const invalid = newVal.filter((v) => !validateSyntaxValue(v));
    if (invalid.length > 0) {
      showSyntaxWarning(invalid);
      filteredVal = newVal.filter((v) => validateSyntaxValue(v));
    }
  }

  if (filteredVal.length < currentArr.length) {
    restrictions[section] = filteredVal;
  } else if (filteredVal.length <= MAX_ITEMS_LIMIT) {
    restrictions[section] = filteredVal;
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
  if (section === "syntax") return currentSyntaxOptions.value.common;
  if (section === "imports") return libraryOptions.value.imports || [];
  if (section === "headers") return libraryOptions.value.headers || [];
  return libraryOptions.value.functions || [];
}

// Asset Helper
const assetPaths = computed<Record<string, string>>(() => {
  const cfg = (problem.value.config || {}) as unknown as ExtendedProblemConfig;
  return cfg.assetPaths || {};
});

const hasAsset = (key: string) => Boolean(assetPaths.value && assetPaths.value[key]);
const assetDownloadUrl = (key: string) =>
  assetPaths.value && assetPaths.value[key] ? `/api/problem/${route.params.id}/asset/${key}/download` : null;

if (!problem.value.pipeline) {
  ensurePipeline();
}

// ==========================================
// Lifecycle Hooks
// ==========================================
onMounted(async () => {
  initPipelineValues();
  await Promise.all([fetchStaticAnalysisOptions(), fetchSyntaxOptions(), fetchAiCheckerKeys()]);
});

async function fetchSyntaxOptions() {
  try {
    const res = await api.Problem.getSyntaxOptions();
    const data = res.data as {
      python: { common: string[]; all: string[]; categories: Record<string, string[]> };
      cpp: { common: string[]; all: string[]; categories: Record<string, string[]> };
    };
    syntaxOptions.value = {
      python: {
        common: data.python.common,
        all: data.python.all,
        allSet: new Set(data.python.all.map((s) => s.toLowerCase())),
      },
      cpp: {
        common: data.cpp.common,
        all: data.cpp.all,
        allSet: new Set(data.cpp.all.map((s) => s.toLowerCase())),
      },
    };
    logger.success("Syntax options loaded", {
      python: data.python.all.length,
      cpp: data.cpp.all.length,
    });
  } catch (err) {
    logger.warn("Failed to fetch syntax options, using defaults", err);
  }
}

async function fetchAiCheckerKeys() {
  const courseName = typeof route.params.name === "string" ? route.params.name : route.params.name?.[0];
  if (!courseName) return;

  isFetchingAiKeys.value = true;
  try {
    const res = (await api.AIVTuber.getCourseKeys(courseName)) as unknown as AiCheckerApiResponse;
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

function ensureAiCheckerConfig() {
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
        ><span
          class="label-text tooltip tooltip-right flex cursor-help items-center gap-1 font-semibold"
          :data-tip="hover.fileAccess"
          >{{ t("course.problems.fileAccess") }}</span
        ></label
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
        <span
          class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
          :data-tip="hover.libraryRestrictionsGroup1"
          >{{ t("course.problems.staticAnalysisGroup") }}</span
        >
        <input
          type="checkbox"
          class="toggle"
          v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions!.enabled"
        />
      </label>

      <div v-if="problem.pipeline!.staticAnalysis!.libraryRestrictions!.enabled" class="mt-3 space-y-4">
        <div class="rounded-lg border border-gray-400 p-3">
          <div class="mb-3 flex items-center justify-between">
            <h4
              class="text tooltip tooltip-right flex cursor-help items-center gap-1 font-medium"
              :data-tip="hover.libraryRestrictionsGroup2"
            >
              {{ t("course.problems.staticAnalysisGroup") || "Library Restrictions" }}
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
            <div class="relative min-h-[16rem] rounded border border-gray-500 p-2">
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
                <h5
                  class="tooltip tooltip-right flex cursor-help items-center gap-1 text-sm font-medium"
                  :data-tip="hover.importsRestrictions"
                >
                  {{ t("course.problems.importsRestrictions") }}
                </h5>
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

            <div class="relative min-h-[16rem] rounded border border-gray-500 p-2">
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
                <h5
                  class="tooltip tooltip-right flex cursor-help items-center gap-1 text-sm font-medium"
                  :data-tip="hover.headersRestrictions"
                >
                  {{ t("course.problems.headersRestrictions") }}
                </h5>
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

            <div class="relative flex min-h-[26rem] flex-col rounded border border-gray-500 p-2">
              <div class="mb-2 flex items-center justify-between">
                <h5
                  class="tooltip tooltip-right flex cursor-help items-center gap-1 text-sm font-medium"
                  :data-tip="hover.functionsRestrictions"
                >
                  {{ t("course.problems.functionsRestrictions") }}
                </h5>

                <div class="flex gap-1">
                  <button
                    class="btn btn-xs btn-ghost h-5 min-h-0 px-1 text-[10px]"
                    @click="selectAllItems('functions', libraryMode)"
                  >
                    + All (Global)
                  </button>
                  <button
                    class="btn btn-xs btn-ghost text-error h-5 min-h-0 px-1 text-[10px]"
                    @click="clearAllItems('functions', libraryMode)"
                  >
                    {{ t("course.problems.clear") }} (All)
                  </button>
                </div>
              </div>

              <div class="mb-3 flex justify-center">
                <div class="join border-base-content/20 rounded-btn border shadow-sm">
                  <input
                    class="join-item btn btn-xs px-4"
                    type="radio"
                    name="langOptions"
                    aria-label="All"
                    :checked="activeLanguageFilter === 'All'"
                    @click="activeLanguageFilter = 'All'"
                  />
                  <input
                    class="join-item btn btn-xs px-4"
                    type="radio"
                    name="langOptions"
                    aria-label="Python"
                    :checked="activeLanguageFilter === 'Python'"
                    @click="activeLanguageFilter = 'Python'"
                  />
                  <input
                    class="join-item btn btn-xs px-4"
                    type="radio"
                    name="langOptions"
                    aria-label="C"
                    :checked="activeLanguageFilter === 'C'"
                    @click="activeLanguageFilter = 'C'"
                  />
                  <input
                    class="join-item btn btn-xs px-4"
                    type="radio"
                    name="langOptions"
                    aria-label="C++"
                    :checked="activeLanguageFilter === 'CPP'"
                    @click="activeLanguageFilter = 'CPP'"
                  />
                </div>
              </div>

              <div class="mb-2 w-full px-1">
                <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start">
                  <a
                    v-for="group in functionGroups"
                    :key="group.name"
                    class="tab tab-bordered tab-sm whitespace-nowrap px-1 transition-all duration-200"
                    :class="{
                      'tab-active border-primary text-primary font-bold':
                        activeFunctionCategory === group.name,
                      'hover:border-base-content/40 border-transparent':
                        activeFunctionCategory !== group.name,
                    }"
                    @click="activeFunctionCategory = group.name"
                  >
                    {{ group.name }}
                  </a>

                  <span v-if="functionGroups.length === 0" class="py-2 text-xs opacity-50">
                    No categories available for this language.
                  </span>
                </div>
              </div>

              <div
                class="custom-scrollbar border-base-content/10 bg-base-200/30 mb-3 min-h-[12rem] flex-1 overflow-y-auto rounded-lg border p-2"
              >
                <div
                  v-if="activeGroupData.name"
                  class="border-base-content/10 bg-base-200 sticky top-0 z-10 mb-2 flex items-center justify-between border-b pb-1 opacity-95"
                >
                  <span class="text-xs font-bold opacity-70">{{ activeGroupData.name }}</span>
                  <div class="flex gap-1">
                    <button
                      class="btn btn-xs btn-ghost hover:bg-base-300 h-5 min-h-0 px-2 text-[10px]"
                      @click="selectCategoryItems(activeGroupData.items, libraryMode)"
                    >
                      + All
                    </button>
                    <button
                      class="btn btn-xs btn-ghost text-error hover:bg-base-300 h-5 min-h-0 px-2 text-[10px]"
                      @click="clearCategoryItems(activeGroupData.items, libraryMode)"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div class="flex flex-wrap content-start gap-1">
                  <button
                    v-for="opt in activeGroupData.items"
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
                      !problem.pipeline!.staticAnalysis!.libraryRestrictions![
                        libraryMode
                      ]!.functions.includes(opt) &&
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
              </div>

              <div class="mt-auto border-t border-gray-600 pt-2">
                <label class="label pb-1 pt-0">
                  <span class="label-text-alt text-gray-400">Search / Add Custom Functions</span>
                </label>
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
            <div class="flex items-center gap-4">
              <h4
                class="text tooltip tooltip-right flex cursor-help items-center gap-1 font-medium"
                :data-tip="hover.syntaxRestrictions"
              >
                {{ t("course.problems.syntaxRestrictions") }}
              </h4>

              <div class="flex gap-1">
                <button
                  class="btn btn-xs btn-ghost h-5 min-h-0 px-1 text-[10px]"
                  @click="selectAllItems('syntax', syntaxMode)"
                >
                  {{ t("course.problems.all") }}
                </button>
                <button
                  class="btn btn-xs btn-ghost text-error h-5 min-h-0 px-1 text-[10px]"
                  @click="clearAllItems('syntax', syntaxMode)"
                >
                  {{ t("course.problems.clear") }}
                </button>
              </div>
            </div>

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
              v-for="opt in currentSyntaxOptions.common"
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

          <div v-if="syntaxWarningMessage" class="alert alert-warning mt-2 py-2 text-sm shadow-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{{ syntaxWarningMessage }}</span>
            <button class="btn btn-ghost btn-xs" @click="syntaxWarningMessage = ''">✕</button>
          </div>
        </div>
      </div>
    </div>

    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <label class="label mb-2">
          <span
            class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
            :data-tip="hover.executionMode"
            >{{ t("course.problems.executionMode") }}</span
          >
        </label>

        <div class="mb-4 flex flex-wrap gap-6">
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="general"
              v-model="problem.pipeline!.executionMode as 'general' | 'functionOnly' | 'interactive'"
            />
            <span
              class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
              :data-tip="hover.executionModeGeneral"
              >{{ t("course.problems.executionModeGeneral") }}</span
            >
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="functionOnly"
              v-model="problem.pipeline!.executionMode as 'general' | 'functionOnly' | 'interactive'"
            />
            <span
              class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
              :data-tip="hover.executionModeFuncitonOnly"
              >{{ t("course.problems.executionModeFuncitonOnly") }}</span
            >
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="interactive"
              v-model="problem.pipeline!.executionMode as 'general' | 'functionOnly' | 'interactive'"
            />
            <span
              class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
              :data-tip="hover.executionModeInteractive"
              >{{ t("course.problems.executionModeInteractive") }}</span
            >
          </label>
        </div>

        <div
          v-if="problem.pipeline!.executionMode === 'functionOnly'"
          class="rounded-lg border border-gray-400 p-4"
        >
          <div class="form-control">
            <div class="flex flex-wrap items-center gap-4">
              <label class="label mb-0 cursor-pointer justify-start gap-x-2">
                <span
                  class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                  :data-tip="hover.uploadFile"
                  >{{ t("course.problems.uploadFile")
                  }}<span class="text-error ml-1" aria-hidden="true">*</span></span
                >
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
                <span
                  class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                  :data-tip="hover.interactiveTeacherFirsts"
                  >{{ t("course.problems.interactiveTeacherFirst") }}</span
                >
                <input type="checkbox" class="toggle toggle-sm" v-model="problem.pipeline!.teacherFirst" />
              </label>

              <div class="flex items-center gap-x-2">
                <span
                  class="tooltip tooltip-right flex cursor-help items-center gap-1 text-sm opacity-80"
                  :data-tip="hover.interactiveUploadTeacherCode"
                  >{{ t("course.problems.interactiveUploadTeacherCode")
                  }}<span class="text-error ml-1" aria-hidden="true">*</span></span
                >
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
                  :class="{ 'input-error': v$?.assets?.teacherFile?.$error || teacherFileError }"
                  @change="
                    (e: Event) => {
                      const inputEl = e.target as HTMLInputElement;
                      const file = inputEl.files?.[0] || null;

                      // 1. Reset Error
                      teacherFileError = '';

                      if (!file) {
                        problem.assets!.teacherFile = null;
                        return;
                      }

                      // 2. Validate Extension (.py, .c, .cpp)
                      const isExtOk = /\.(py|c|cpp)$/i.test(file.name);

                      if (!isExtOk) {
                        teacherFileError = 'Invalid file type. Only .py, .c, .cpp are allowed.';
                        problem.assets!.teacherFile = null;
                        inputEl.value = ''; // Force clear the input
                        return;
                      }

                      // 3. Validate File Size
                      if (!assertFileSizeOK(file, 'teacherFile')) {
                        problem.assets!.teacherFile = null;
                        inputEl.value = ''; // Force clear the input
                        return;
                      }

                      // 4. Valid
                      problem.assets!.teacherFile = file;
                      v$?.assets?.teacherFile?.$touch();
                    }
                  "
                />
                <div>
                  <span class="pl-4">{{ t("course.problems.interActive") }}</span>
                </div>
              </div>

              <label v-if="v$?.assets?.teacherFile?.$error || teacherFileError" class="label">
                <span v-if="v$?.assets?.teacherFile?.$error" class="label-text-alt text-error">
                  {{ v$.assets.teacherFile.$errors[0]?.$message }}
                </span>
                <span v-else-if="teacherFileError" class="label-text-alt text-error">
                  {{ teacherFileError }}
                </span>
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
              <span
                class="tooltip tooltip-right flex cursor-help items-center gap-1"
                :data-tip="hover.customChecker"
                >{{ t("course.problems.customChecker") }}</span
              >
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
            <span
              class="tooltip tooltip-right flex cursor-help items-center gap-1 pl-1 text-sm opacity-80"
              :data-tip="hover.uploadCustomChecker"
              >{{ t("course.problems.uploadCustomChecker")
              }}<span class="text-error ml-1" aria-hidden="true">*</span></span
            >
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
              <label
                class="label tooltip tooltip-right flex cursor-help cursor-pointer items-center justify-start gap-1 gap-x-4"
                :data-tip="hover.aiCheckerEnable"
              >
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
                    class="select select-bordered select-sm flex w-full items-center justify-between"
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
                    class="dropdown-content menu rounded-box border-base-300 bg-base-100 left-0 z-[100] mt-1 w-full border p-2 shadow-lg"
                  >
                    <li class="disabled px-4 py-2 text-xs opacity-50">
                      {{ t("course.problems.aiCheckerSelectKey") }}
                    </li>
                    <li v-for="key in aiCheckerApiKeys" :key="key.id">
                      <a
                        class="text-base-content active:bg-primary"
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
                    class="select select-bordered select-sm flex w-full items-center justify-between"
                  >
                    <span>{{ (problem.config as any).aiChecker?.model || "Select Model" }}</span>
                  </div>
                  <ul
                    tabindex="0"
                    class="dropdown-content menu rounded-box border-base-300 bg-base-100 left-0 z-[100] mt-1 w-full border p-2 shadow"
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
            <span
              class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
              :data-tip="hover.customScoringScript"
              >{{ t("course.problems.customScoringScript") }}</span
            >
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
            <span
              class="tooltip tooltip-right flex cursor-help items-center gap-1 pl-1 text-sm opacity-80"
              :data-tip="hover.uploadCustomScorer"
              >{{ t("course.problems.uploadCustomScorer")
              }}<span class="text-error ml-1" aria-hidden="true">*</span></span
            >
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

/* ==========================================
   Scrollbar Customization
   ========================================== */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* ==========================================
   Scrollbar Customization (Horizontal & Vertical)
   ========================================== */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}
</style>
