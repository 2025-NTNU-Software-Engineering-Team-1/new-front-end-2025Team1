<script setup lang="ts">
// ==========================================
// Imports
// ==========================================
import { inject, Ref, ref, reactive, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { ZipReader, BlobReader } from "@zip.js/zip.js";

// Components
import LanguageMultiSelect from "../../Forms/LanguageMultiSelect.vue";
import MultiStringInput from "../Controls/MultiStringInput.vue";
import SidecarInput from "../Controls/SidecarInput.vue";

// Utils & API
import { assertFileSizeOK, validateFilesForAIAC } from "@/utils/checkFileSize";
import { fetcher } from "@/models/api";
import api from "@/models/api";

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
// Helper: API Response Parser
// ==========================================
function parseApiResponse(res: unknown) {
  const data = res?.data;
  const rawStatus = data?.status || res?.status;
  const statusStr = String(rawStatus || "").toLowerCase();
  const message = data?.message || res?.message || "Unknown response";

  const isSuccess = statusStr === "ok" || statusStr === "success" || rawStatus === 200;

  return { isSuccess, message, data, rawStatus };
}

// ==========================================
// Injection & Setup
// ==========================================
const rawProblem = inject<Ref<ProblemForm> | undefined>("problem");
if (!rawProblem || !rawProblem.value) {
  throw new Error("ConfigurationSection requires problem injection");
}

const problem = rawProblem as Ref<ProblemForm>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const v$ = inject<any>("v$");
const route = useRoute();

// ==========================================
// Section: Course Information
// ==========================================
const courseName = ref<string | null>(null);

async function fetchCourseName() {
  logger.group("Fetch Course Name");
  try {
    const resp = await fetcher.get(`/course/${route.params.name}`);
    logger.log("Raw Response", resp);

    const val = resp?.data;

    // [CRITICAL FIX]: Prevent assigning an object to a string variable.
    // This prevents the API URL from becoming ".../[object Object]/..." which causes 404s.
    if (val && typeof val === "object") {
      logger.warn("Received Object instead of String ID/Name. Extracting name...", val);
      // Attempt to extract 'name' or 'id', fallback to route param if missing.
      courseName.value = val.name || val.id || (route.params.name as string);
    } else {
      courseName.value = val || (route.params.name as string);
    }

    logger.success("Course Name Resolved", courseName.value);
  } catch (err) {
    logger.error("Failed to fetch course info", err);
    // Fallback to route param on failure
    courseName.value = route.params.name as string;
  } finally {
    logger.groupEnd();
  }
}

// ==========================================
// Section: Quota Management
// ==========================================
const quotaError = ref("");
const localQuota = ref<number | "">(problem.value?.quota ?? "");

function onQuotaInput(e: Event) {
  const inputEl = e.target as HTMLInputElement;
  const valStr = inputEl.value;

  if (valStr === "") {
    localQuota.value = "";
    quotaError.value = "";
    return;
  }

  const val = Number(valStr);
  if (val === -1 || (val >= 1 && val <= 500)) {
    localQuota.value = val;
    quotaError.value = "";
    problem.value.quota = val;
  } else {
    inputEl.value = "";
    localQuota.value = "";
    quotaError.value = "Quota must be -1 (unlimited) or between 1 and 500";
  }
}

// ==========================================
// Section: Trial Mode
// ==========================================
const trialQuotaError = ref("");
const localTrialLimit = ref<number | "">(problem.value?.config?.maxNumberOfTrial ?? "");
// const trialPublicZipError = ref<string>("");

function onTrialLimitInput(e: Event) {
  const inputEl = e.target as HTMLInputElement;
  const valStr = inputEl.value;

  if (valStr === "") {
    localTrialLimit.value = "";
    trialQuotaError.value = "";
    problem.value.config!.maxNumberOfTrial = undefined;
    return;
  }

  const val = Number(valStr);
  if (val === -1 || (val >= 1 && val <= 500)) {
    localTrialLimit.value = val;
    trialQuotaError.value = "";
    problem.value.config!.maxNumberOfTrial = val;
  } else {
    inputEl.value = "";
    localTrialLimit.value = "";
    problem.value.config!.maxNumberOfTrial = undefined;
    trialQuotaError.value = "Trial limit must be -1 (unlimited) or between 1 and 500";
  }
}

async function validateTrialPublicZip(file: File): Promise<boolean> {
  logger.group("Validate Trial Zip");
  try {
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    await reader.close?.();

    if (!entries.length) {
      logger.error("Zip is empty");
      return false;
    }

    // Validation: ONLY .in files allowed
    const invalid = entries.filter(({ filename }) => !filename.endsWith(".in"));
    if (invalid.length > 0) {
      logger.error(
        "Invalid files found (must be .in)",
        invalid.map((e) => e.filename),
      );
      return false;
    }

    logger.success("Validation OK", entries.length + " files");
    return true;
  } catch (err) {
    logger.error("Failed to read zip", err);
    return false;
  } finally {
    logger.groupEnd();
  }
}

// ==========================================
// Section: Problem Config Initialization
// ==========================================
function ensureConfig() {
  if (!problem.value.config) {
    problem.value.config = {
      trialMode: false,
      trialResultVisible: false,
      trialResultDownloadable: false,
      aiVTuber: false,
      acceptedFormat: "code",
      maxStudentZipSizeMB: 50,
      aiVTuberApiKeys: [],
      aiVTuberMode: "gemini-2.5-flash-lite",
      networkAccessRestriction: {
        sidecars: [],
        external: {
          model: "Black",
          ip: [],
          url: [],
        },
      },
      artifactCollection: [],
    };
  } else {
    // Ensure network structure exists
    if (!problem.value.config.networkAccessRestriction) {
      problem.value.config.networkAccessRestriction = {
        sidecars: [],
        external: {
          model: "Black",
          ip: [],
          url: [],
        },
      };
    }
    const nar = problem.value.config.networkAccessRestriction;
    if (!nar.sidecars) nar.sidecars = [];
    if (!nar.external) nar.external = { model: "Black", ip: [], url: [] };
  }
}

// Initialize artifactCollection
function initArtifactCollection() {
  ensureConfig();
  const cfg = problem.value.config as unknown;
  // Backward compatibility check
  if (cfg && !Array.isArray(cfg.artifactCollection)) {
    cfg.artifactCollection = Array.isArray(cfg.artifact_collection) ? cfg.artifact_collection : [];
  }
  // Check pipeline compatibility
  if (Array.isArray(cfg.pipeline?.artifactCollection) && cfg.artifactCollection.length === 0) {
    cfg.artifactCollection = cfg.pipeline.artifactCollection.slice();
  }
}

// Synchronous initialization check (to ensure value exists before mount if possible)
if (!Array.isArray(problem.value.config.artifactCollection)) {
  const cfgAny = problem.value.config as unknown;
  problem.value.config.artifactCollection = Array.isArray(cfgAny?.artifact_collection)
    ? cfgAny.artifact_collection
    : [];
}

// Computed properties for Artifact checkboxes
const artifactCompiledBinary = computed({
  get: () => problem.value.config!.artifactCollection.includes("compiledBinary"),
  set: (val: boolean) => {
    const list = problem.value.config!.artifactCollection;
    const next = new Set(list);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    val ? next.add("compiledBinary") : next.delete("compiledBinary");
    problem.value.config!.artifactCollection = Array.from(next);
  },
});

const artifactZip = computed({
  get: () => problem.value.config!.artifactCollection.includes("zip"),
  set: (val: boolean) => {
    const list = problem.value.config!.artifactCollection;
    const next = new Set(list);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    val ? next.add("zip") : next.delete("zip");
    problem.value.config!.artifactCollection = Array.from(next);
  },
});

// ==========================================
// Section: Assets Helper
// ==========================================
const assetPaths = computed<Record<string, string>>(
  () => ((problem.value.config as unknown)?.assetPaths as Record<string, string>) || {},
);

const hasAsset = (key: string) => !!(assetPaths.value && assetPaths.value[key]);
const assetDownloadUrl = (key: string) =>
  assetPaths.value[key] ? `/api/problem/${route.params.id}/asset/${key}/download` : null;

// ==========================================
// Section: Docker Zip Inspection
// ==========================================
const detectedDockerEnvs = ref<string[]>([]);
const dockerZipError = ref("");

// Helper: Read saved env list from config
function loadSavedDockerEnvs() {
  const nar = problem.value.config?.networkAccessRestriction as unknown;
  if (nar?.custom_env?.env_list && Array.isArray(nar.custom_env.env_list)) {
    detectedDockerEnvs.value = nar.custom_env.env_list;
  }
}

// Watch for config changes to load saved envs
watch(
  () => problem.value.config?.networkAccessRestriction,
  () => {
    if (detectedDockerEnvs.value.length === 0) {
      loadSavedDockerEnvs();
    }
  },
  { immediate: true, deep: true },
);

async function inspectDockerZip(file: File) {
  logger.group("Inspect Docker Zip");
  detectedDockerEnvs.value = [];
  dockerZipError.value = "";

  try {
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    await reader.close();

    const dockerfiles = entries.filter((e) => !e.directory && e.filename.endsWith("Dockerfile"));

    if (dockerfiles.length === 0) {
      dockerZipError.value = "Not found any 'Dockerfile'.";
      logger.error(
        "No Dockerfile found in zip",
        entries.map((e) => e.filename),
      );
      return false;
    }

    const envs: string[] = [];
    for (const entry of dockerfiles) {
      const parts = entry.filename.split("/");

      // Validation: Structure must be "folder/Dockerfile"
      if (parts.length !== 2) {
        dockerZipError.value = `Structure error: ${entry.filename}. Please ensure the structure is "environment_folder/Dockerfile".`;
        logger.error("Structure error", entry.filename);
        return false;
      }

      envs.push(parts[0]);
    }

    const sortedEnvs = envs.sort();
    detectedDockerEnvs.value = sortedEnvs;

    // Save to config
    const nar = problem.value.config!.networkAccessRestriction as unknown;
    if (!nar.custom_env) {
      nar.custom_env = {};
    }
    nar.custom_env.env_list = sortedEnvs;

    logger.success("Docker inspection success", sortedEnvs);
    return true;
  } catch (e) {
    logger.error("Zip read error", e);
    dockerZipError.value = "Failed to read Zip file, please ensure the file is not corrupted.";
    return false;
  } finally {
    logger.groupEnd();
  }
}

function removeDockerEnv(index: number) {
  detectedDockerEnvs.value.splice(index, 1);
  const nar = problem.value.config?.networkAccessRestriction as unknown;
  if (nar?.custom_env) {
    nar.custom_env.env_list = detectedDockerEnvs.value;
  }
}

// ==========================================
// Section: AI File Extension Helper
// ==========================================
function getAIFileExtensions() {
  const lang = problem.value.allowedLanguage;
  const list: string[] = [];
  if (lang & 1) list.push(".c");
  if (lang & 2) list.push(".cpp");
  if (lang & 4) list.push(".py");
  return list;
}

// ==========================================
// Section: API Keys Management
// ==========================================
const apiKeys = reactive<{ active: unknown[]; inactive: unknown[] }>({
  active: [],
  inactive: [],
});
const selectedKeys = ref<string[]>([]);
const isFetchingKeys = ref(false);
const fetchError = ref("");
const showActiveKeys = ref(true);
const showInactiveKeys = ref(true);

async function fetchKeys() {
  if (!courseName.value) await fetchCourseName();

  // If fetchCourseName failed or returned invalid data, skip to avoid 404
  if (!courseName.value || typeof courseName.value !== "string") {
    logger.error("Skipping fetchKeys: Invalid courseName", courseName.value);
    fetchError.value = "Invalid Course Name";
    return;
  }

  logger.group(`Fetch Keys: ${courseName.value}`);
  isFetchingKeys.value = true;
  fetchError.value = "";

  try {
    const res = await api.AIVTuber.getCourseKeys(courseName.value!);
    // logger.log("Raw Response", res);

    const { isSuccess, data, message } = parseApiResponse(res);

    if (!isSuccess && !data) {
      throw new Error(message || "Failed to response keys");
    }

    const rawKeys = data?.keys || [];
    logger.log(`Found ${rawKeys.length} keys`);

    // Data Sanitization and Classification
    const safeKeys = rawKeys.map((k: unknown, index: number) => {
      // Integrity Check
      const missing: string[] = [];
      if (!k.id) missing.push("id");
      if (!k.key_name) missing.push("key_name");

      if (missing.length > 0) {
        logger.warn(`Key data incomplete at index ${index}`, missing);
      }

      return {
        id: k.id || `temp-${index}`,
        key_name: k.key_name || "(Unknown Name)",
        masked_value: k.masked_value || "******",
        is_active: !!k.is_active,
        created_by: k.created_by || "",
      };
    });

    apiKeys.active = safeKeys.filter((k: unknown) => k.is_active);
    apiKeys.inactive = safeKeys.filter((k: unknown) => !k.is_active);

    logger.success("Keys Loaded", { active: apiKeys.active.length, inactive: apiKeys.inactive.length });
  } catch (err: unknown) {
    logger.error("Fetch Keys Error", err);
    fetchError.value = err?.message || "Failed to load keys.";
  } finally {
    isFetchingKeys.value = false;
    logger.groupEnd();
  }
}

// ==========================================
// Section: Key Search
// ==========================================
const searchQuery = ref("");
const activeKeyRefs = ref<Record<string, HTMLElement | null>>({});
const inactiveKeyRefs = ref<Record<string, HTMLElement | null>>({});

function scrollToKey() {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return;

  const matchActive = apiKeys.active.find((k) => k.key_name.toLowerCase().includes(query));
  const matchInactive = apiKeys.inactive.find((k) => k.key_name.toLowerCase().includes(query));

  if (matchActive) {
    showActiveKeys.value = true;
    requestAnimationFrame(() => {
      activeKeyRefs.value[matchActive.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  } else if (matchInactive) {
    showInactiveKeys.value = true;
    requestAnimationFrame(() => {
      inactiveKeyRefs.value[matchInactive.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }
}

// ==========================================
// Section: Suggestion Tooltip
// ==========================================
const showSuggestionTooltip = ref(false);
const keySuggestion = ref<{
  student_count?: number;
  suggested_key_count?: number;
  reason?: string;
} | null>(null);

const isFetchingSuggestion = ref(false);
const suggestionError = ref("");

async function fetchKeySuggestion() {
  if (!courseName.value) await fetchCourseName();

  if (!courseName.value || typeof courseName.value !== "string") {
    return;
  }

  const model = problem.value.config?.aiVTuberMode || "gemini-2.5-flash-lite";

  logger.group("Fetch Key Suggestion");
  isFetchingSuggestion.value = true;
  suggestionError.value = "";

  try {
    const res = await api.AIVTuber.getKeySuggestion(courseName.value!, model);
    const { isSuccess, data, message } = parseApiResponse(res);

    if (isSuccess) {
      keySuggestion.value = data;
      logger.success("Suggestion", data);
    } else {
      throw new Error(message || "API returned failed status");
    }
  } catch (err: unknown) {
    logger.error("Suggestion Error", err);
    suggestionError.value = err?.response?.data?.detail || err?.message || "Failed to fetch suggestion.";
    keySuggestion.value = null;
  } finally {
    isFetchingSuggestion.value = false;
    logger.groupEnd();
  }
}

function onClickOutside(event: MouseEvent) {
  const tooltipEl = document.querySelector(".key-suggestion-tooltip");
  const buttonEl = document.querySelector(".btn-key-suggestion");

  if (tooltipEl?.contains(event.target as Node) || buttonEl?.contains(event.target as Node)) return;

  showSuggestionTooltip.value = false;
}

// ==========================================
// Section: Sidecars & Network Helper
// ==========================================
const hasExistingNetworkConfig = computed(() => {
  const nar = problem.value.config?.networkAccessRestriction;
  const hasExternal = (nar?.external?.ip?.length ?? 0) > 0 || (nar?.external?.url?.length ?? 0) > 0;
  const hasSidecars = (nar?.sidecars?.length ?? 0) > 0;
  const hasDocker = !!problem.value.assets?.dockerfilesZip || hasAsset("dockerfiles");
  return hasExternal || hasSidecars || hasDocker;
});
const showNetworkSection = ref(false);

watch(
  hasExistingNetworkConfig,
  (val) => {
    if (val) showNetworkSection.value = true;
  },
  { immediate: true },
);

// ==========================================
// Section: Watchers
// ==========================================
watch(
  () => problem.value,
  (n, o) => {
    if (n !== o) {
      localQuota.value = n?.quota ?? "";
      quotaError.value = "";
    }
  },
);

watch(selectedKeys, (keys) => {
  problem.value.config!.aiVTuberApiKeys = keys;
});

// ==========================================
// Section: Lifecycle Hooks
// ==========================================
onMounted(() => {
  initArtifactCollection();
  fetchKeys();
  document.addEventListener("click", onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickOutside);
});
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <!-- Allowed Languages -->
    <div class="form-control rounded-lg border border-gray-400 p-4">
      <label class="label"><span class="label-text">Allowed Languages</span></label>
      <LanguageMultiSelect
        :model-value="problem.allowedLanguage"
        @update:model-value="(v) => (problem.allowedLanguage = v)"
      />
    </div>

    <!-- Tags -->
    <div class="form-control rounded-lg border border-gray-400 p-4">
      <label class="label"><span class="label-text">Tags</span></label>
      <input
        type="text"
        class="input input-bordered"
        :value="problem.tags.join(',')"
        @input="
          problem.tags = ($event.target as HTMLInputElement).value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        "
      />
      <label class="label"><span class="label-text-alt">Comma separated</span></label>
    </div>

    <!-- Quota -->
    <div class="form-control rounded-lg border border-gray-400 p-4">
      <label class="label"><span class="label-text">Quota</span></label>
      <input
        type="number"
        :min="-1"
        :max="500"
        step="1"
        :class="['input input-bordered w-full', quotaError && 'input-error']"
        :value="localQuota"
        @input="onQuotaInput"
        placeholder="-1 (unlimited) or 1–500"
      />
      <label class="label">
        <span class="label-text-alt" :class="quotaError ? 'text-error' : ''">
          {{ quotaError || "-1 means unlimited" }}
        </span>
      </label>
    </div>

    <!-- Accepted Format -->
    <div class="form-control rounded-lg border border-gray-400 p-4">
      <label class="label"><span class="label-text">Accepted Format</span></label>
      <div class="flex flex-wrap items-center gap-6">
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio"
            value="code"
            v-model="problem.config!.acceptedFormat as unknown"
          />
          <span class="label-text">Code</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input type="radio" class="radio" value="zip" v-model="problem.config!.acceptedFormat as unknown" />
          <span class="label-text">Zip</span>
        </label>
      </div>
      <div
        v-if="problem.config!.acceptedFormat === 'zip'"
        class="mt-3 flex items-center gap-2 rounded border border-gray-400 p-3"
      >
        <span class="label-text">Max ZIP Size (MB)</span>
        <input
          type="number"
          class="input input-bordered input-sm w-28 text-center"
          min="1"
          max="1000"
          step="1"
          :value="problem.config!.maxStudentZipSizeMB ?? 50"
          @input="
            problem.config!.maxStudentZipSizeMB = Math.min(
              1000,
              Math.max(1, Number(($event.target as HTMLInputElement).value)),
            )
          "
        />
        <span class="text-xs whitespace-nowrap opacity-70">(default 50 MB)</span>
      </div>
    </div>

    <!-- AI VTuber -->
    <div class="col-span-2 rounded-lg border border-gray-400 p-4">
      <div class="flex items-center gap-4">
        <label class="label cursor-pointer justify-start gap-x-4">
          <span class="label-text">AI VTuber</span>
          <input type="checkbox" class="toggle" v-model="problem.config!.aiVTuber" />
        </label>
      </div>

      <transition
        enter-active-class="transition ease-out duration-200"
        leave-active-class="transition ease-in duration-150"
      >
        <div v-if="problem.config!.aiVTuber" class="mt-3 space-y-4 rounded border-none p-4">
          <div class="mt-3 space-y-4 rounded border border-gray-400 p-4">
            <div class="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div class="flex min-w-[260px] flex-1 items-center gap-3">
                <label class="label mb-0 w-28">
                  <span class="label-text">AI Model</span>
                </label>
                <select
                  class="select select-bordered select-sm flex-1"
                  v-model="problem.config!.aiVTuberMode"
                >
                  <option value="gemini-2.5-flash-lite">gemini 2.5 flash lite</option>
                  <option value="gemini-2.5-flash">gemini 2.5 flash</option>
                  <option value="gemini-2.5-pro">gemini 2.5 pro</option>
                </select>
              </div>
              <div class="flex min-w-[300px] flex-1 items-center gap-3">
                <label class="label mb-0 w-32">
                  <span class="label-text">Upload AC files</span>
                </label>
                <div class="w-full">
                  <input
                    type="file"
                    multiple
                    :accept="getAIFileExtensions().join(',')"
                    class="file-input file-input-bordered file-input-sm w-full"
                    @change="
                      (e: unknown) => {
                        const files = Array.from(e.target.files || []) as File[];
                        const valid = validateFilesForAIAC(files, getAIFileExtensions());
                        problem.assets!.aiVTuberACFiles = valid;
                        if (valid.length === 0) (e.target as HTMLInputElement).value = '';
                      }
                    "
                  />
                  <label class="label mt-1">
                    <span class="label-text-alt text-sm opacity-70">
                      Allowed: {{ getAIFileExtensions().join(", ") }}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="form-control">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <label class="label-text">Select API Keys</label>
                <!-- 問號 -->
                <div class="relative">
                  <button
                    type="button"
                    class="btn-key-suggestion btn btn-circle btn-ghost btn-xs"
                    @click="
                      showSuggestionTooltip = !showSuggestionTooltip;
                      if (showSuggestionTooltip && !keySuggestion) fetchKeySuggestion();
                    "
                  >
                    <i-uil-question-circle class="text-info" />
                  </button>

                  <!-- 懸浮視窗 -->
                  <transition name="fade">
                    <div
                      v-if="showSuggestionTooltip"
                      class="key-suggestion-tooltip bg-base-100 absolute top-full left-6 z-50 mt-2 w-72 rounded-md border border-gray-400 p-3 shadow-xl"
                    >
                      <div v-if="isFetchingSuggestion" class="flex items-center text-sm">
                        <ui-spinner class="mr-2" /> Fetching suggestion...
                      </div>
                      <div v-else-if="suggestionError" class="text-error text-sm">
                        {{ suggestionError }}
                      </div>
                      <div v-else-if="keySuggestion" class="space-y-1 text-sm">
                        <div><b>Student count:</b> {{ keySuggestion.student_count }}</div>
                        <div><b>Suggested keys:</b> {{ keySuggestion.suggested_key_count }}</div>
                        <div><b>Reason:</b> {{ keySuggestion.reason }}</div>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </div>

            <!-- 搜尋欄 -->
            <div class="mb-2 flex items-center gap-2">
              <input
                v-model="searchQuery"
                type="text"
                class="input input-bordered input-sm flex-1"
                placeholder="Search by Key Name"
                @keyup.enter="scrollToKey"
              />
              <button class="btn btn-sm" @click="scrollToKey">Search</button>
            </div>

            <div v-if="isFetchingKeys" class="flex items-center gap-2 py-4 text-sm opacity-70">
              <span class="loading-spinner loading-sm loading"></span> Loading keys...
            </div>

            <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <!-- Active Keys -->
              <div class="overflow-hidden rounded-lg border border-gray-400">
                <button
                  type="button"
                  @click="showActiveKeys = !showActiveKeys"
                  class="hover:bg-base-200 flex w-full items-center justify-between px-4 py-2 transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 transition-transform duration-200"
                      :class="{ 'rotate-90': showActiveKeys }"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span class="label-text">active keys</span>
                    <span class="badge badge-info badge-sm">{{ apiKeys.active.length }}</span>
                  </div>
                </button>

                <!-- 限高可捲動區域 -->
                <div v-show="showActiveKeys" class="h-64 overflow-y-auto p-3">
                  <label
                    v-for="key in apiKeys.active"
                    :key="key.id"
                    :ref="(el) => (activeKeyRefs[key.id] = el as HTMLElement)"
                    class="hover:border-info/30 hover:bg-base-200 flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-3 transition"
                  >
                    <input
                      type="checkbox"
                      class="checkbox checkbox-info checkbox-sm mt-1"
                      :value="key.id"
                      v-model="selectedKeys"
                    />
                    <div class="flex-1">
                      <div class="truncate text-sm font-semibold">Key: {{ key.key_name }}</div>
                      <div class="mt-1 text-xs text-gray-400">
                        Creator: {{ key.created_by }} // {{ key.masked_value }}
                      </div>
                      <div class="mt-1 text-xs text-gray-400">
                        Number of Requests: {{ key.request_count }}
                      </div>
                      <div class="mt-1 text-xs text-gray-400">
                        Token: input*{{ key.input_token }} ; output*{{ key.output_token }}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Inactive Keys -->
              <div class="overflow-hidden rounded-lg border border-gray-400">
                <button
                  type="button"
                  @click="showInactiveKeys = !showInactiveKeys"
                  class="hover:bg-base-200 flex w-full items-center justify-between px-4 py-2 transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 transition-transform duration-200"
                      :class="{ 'rotate-90': showInactiveKeys }"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span class="label-text">inactive keys</span>
                    <span class="badge badge-error badge-sm">{{ apiKeys.inactive.length }}</span>
                  </div>
                </button>

                <!-- 限高可捲動區域 -->
                <div v-show="showInactiveKeys" class="h-64 overflow-y-auto p-3">
                  <label
                    v-for="key in apiKeys.inactive"
                    :key="key.id"
                    :ref="(el) => (inactiveKeyRefs[key.id] = el as HTMLElement)"
                    class="hover:border-error/30 hover:bg-base-200 flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-3 transition"
                  >
                    <input
                      type="checkbox"
                      class="checkbox checkbox-error checkbox-sm mt-1"
                      :value="key.id"
                      v-model="selectedKeys"
                    />
                    <div class="flex-1">
                      <div class="truncate text-sm font-semibold">Key: {{ key.key_name }}</div>
                      <div class="mt-1 text-xs text-gray-400">
                        Creator: {{ key.created_by }} // {{ key.masked_value }}
                      </div>
                      <div class="mt-1 text-xs text-gray-400">
                        Number of Requests: {{ key.request_count }}
                      </div>
                      <div class="mt-1 text-xs text-gray-400">
                        Token: input*{{ key.input_token }} ; output*{{ key.output_token }}
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div v-if="fetchError" class="alert alert-error mt-2 text-sm">{{ fetchError }}</div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Trial Mode -->
    <div class="form-control col-span-2 rounded-lg border border-gray-400 p-4">
      <label class="label ml-1 cursor-pointer justify-start gap-x-4">
        <span class="label-text">Trial Mode</span>
        <input type="checkbox" class="toggle" v-model="problem.config!.trialMode" />
      </label>
      <div v-if="problem.config!.trialMode" class="mt-3 space-y-4 rounded border border-gray-400 p-4">
        <div class="form-control w-full max-w-xs">
          <label class="label">
            <span class="label-text">Max Number of Trial</span>
          </label>
          <input
            type="number"
            :min="-1"
            :max="500"
            step="1"
            :class="['input input-bordered w-full', trialQuotaError && 'input-error']"
            :value="localTrialLimit"
            @input="onTrialLimitInput"
            placeholder="-1 (unlimited) or 1–500"
          />
          <label class="label">
            <span class="label-text-alt" :class="trialQuotaError ? 'text-error' : ''">
              {{ trialQuotaError || "-1 means unlimited" }}
            </span>
          </label>
        </div>

        <div class="bg-base-100 flex flex-wrap gap-x-8 gap-y-4 rounded border border-gray-300 p-3">
          <div class="form-control">
            <label class="label cursor-pointer gap-3">
              <span class="label-text font-semibold">Result Visible</span>
              <input
                type="checkbox"
                class="toggle toggle-success toggle-sm"
                v-model="problem.config!.trialResultVisible"
              />
            </label>
            <span class="px-1 text-xs opacity-70"> Allow viewing execution output. </span>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer gap-3">
              <span class="label-text font-semibold">Result Downloadable</span>
              <input
                type="checkbox"
                class="toggle toggle-success toggle-sm"
                v-model="problem.config!.trialResultDownloadable"
              />
            </label>
            <span class="px-1 text-xs opacity-70"> Allow downloading output files. </span>
          </div>
        </div>

        <div class="form-control w-full max-w-xs">
          <label class="label">
            <span class="label-text">Upload Public Test Data (.zip)</span>
          </label>
          <input
            type="file"
            accept=".zip"
            class="file-input file-input-bordered file-input-sm w-full"
            @change="
              async (e: unknown) => {
                const inputEl = e.target as HTMLInputElement;
                const file = inputEl.files?.[0] || null;
                problem.assets!.trialModePublicTestDataZip = null;
                inputEl.value = '';
                if (!file) return;
                if (!file.name.endsWith('.zip')) return;
                if (!assertFileSizeOK(file, 'Public Test Data')) return;
                const ok = await validateTrialPublicZip(file);
                if (!ok) return;
                problem.assets!.trialModePublicTestDataZip = file;
              }
            "
          />
          <label class="label">
            <span class="label-text-alt opacity-70"> Only <code>.in</code> files inside ZIP; ≤ 1 GB </span>
          </label>
        </div>

        <div class="form-control w-full max-w-xs">
          <label class="label">
            <span class="label-text">Upload AC files</span>
          </label>
          <input
            type="file"
            multiple
            :accept="getAIFileExtensions().join(',')"
            class="file-input file-input-bordered file-input-sm w-full"
            @change="
              (e: unknown) => {
                const files = Array.from(e.target.files || []) as File[];
                const valid = validateFilesForAIAC(files, getAIFileExtensions());
                problem.assets!.trialModeACFiles = valid;
                if (valid.length === 0) (e.target as HTMLInputElement).value = '';
              }
            "
          />
          <label class="label mt-1">
            <span class="label-text-alt text-sm opacity-70">
              Allowed: {{ getAIFileExtensions().join(", ") }}
            </span>
          </label>
        </div>
      </div>
    </div>

    <!-- Network Access Restriction -->
    <div class="form-control col-span-2 rounded-lg border border-gray-400 p-4">
      <div class="flex items-center gap-4">
        <label class="label ml-1 cursor-pointer justify-start gap-x-4">
          <span class="label-text">Network & Sidecars</span>
          <input type="checkbox" class="toggle" v-model="showNetworkSection" />
        </label>
      </div>

      <transition
        enter-active-class="transition ease-out duration-200"
        leave-active-class="transition ease-in duration-150"
      >
        <div v-if="showNetworkSection" class="mt-3 space-y-4 rounded border-none p-2">
          <div class="rounded border border-gray-400 p-4">
            <label class="label mb-2"
              ><span class="label-text font-semibold">Network Access Restriction (External)</span></label
            >
            <div class="grid grid-cols-1 gap-4 p-1 md:grid-cols-2">
              <div class="col-span-1 flex items-center gap-4 md:col-span-2">
                <span class="label-text">Access Model:</span>
                <div class="mode-switcher">
                  <div class="mode-switcher-container">
                    <div
                      class="mode-switcher-slider"
                      :class="{
                        'slider-blacklist':
                          problem.config!.networkAccessRestriction!.external!.model === 'Black',
                      }"
                    ></div>
                    <button
                      class="mode-switcher-option"
                      :class="{
                        active: problem.config!.networkAccessRestriction!.external!.model === 'White',
                      }"
                      @click="problem.config!.networkAccessRestriction!.external!.model = 'White'"
                    >
                      <span>Whitelist</span>
                    </button>
                    <button
                      class="mode-switcher-option"
                      :class="{
                        active: problem.config!.networkAccessRestriction!.external!.model === 'Black',
                      }"
                      @click="problem.config!.networkAccessRestriction!.external!.model = 'Black'"
                    >
                      <span>Blacklist</span>
                    </button>
                  </div>
                </div>
                <div class="ml-2 text-xs opacity-70">
                  <span v-if="problem.config!.networkAccessRestriction!.external!.model === 'White'">
                    Only allow specific IPs/URLs. Block everything else.
                  </span>
                  <span v-else> Block specific IPs/URLs. Allow everything else. </span>
                </div>
              </div>

              <div>
                <label class="label"><span class="label-text">IP List</span></label>
                <MultiStringInput
                  v-model="problem.config!.networkAccessRestriction!.external!.ip"
                  placeholder="e.g. 8.8.8.8"
                  :badge-class="
                    problem.config!.networkAccessRestriction!.external!.model === 'White'
                      ? 'badge-info'
                      : 'badge-error'
                  "
                />
              </div>

              <div>
                <label class="label"><span class="label-text">URL List</span></label>
                <MultiStringInput
                  v-model="problem.config!.networkAccessRestriction!.external!.url"
                  placeholder="e.g. google.com"
                  :badge-class="
                    problem.config!.networkAccessRestriction!.external!.model === 'White'
                      ? 'badge-info'
                      : 'badge-error'
                  "
                />
              </div>
            </div>
          </div>
          <div class="rounded border border-gray-400 p-4">
            <label class="label mb-2 justify-between">
              <span class="label-text font-semibold">Sandbox Environment (Sidecars & Dockerfiles)</span>
            </label>

            <div class="mb-6">
              <SidecarInput v-model="problem.config!.networkAccessRestriction!.sidecars" />
            </div>

            <div class="divider"></div>

            <div class="form-control">
              <label class="label justify-start gap-x-4">
                <span class="label-text font-semibold">Dockerfiles</span>
                <div class="flex items-center gap-2">
                  <div v-if="hasAsset('network_dockerfile')" class="flex items-center gap-2">
                    <span class="badge badge-success badge-outline text-xs">Uploaded</span>
                    <a
                      :href="assetDownloadUrl('network_dockerfile') || '#'"
                      class="btn btn-xs"
                      target="_blank"
                      rel="noopener"
                    >
                      Download
                    </a>
                  </div>
                  <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
                </div>
              </label>
              <div class="mt-2">
                <label class="label"><span class="label-text">Upload dockerfiles.zip</span></label>
                <input
                  type="file"
                  accept=".zip"
                  class="file-input file-input-bordered w-full max-w-xs"
                  :class="{ 'input-error': v$?.assets?.dockerfilesZip?.$error || dockerZipError }"
                  @change="
                    async (e: unknown) => {
                      const file = e.target.files?.[0] || null;

                      // Reset previous
                      detectedDockerEnvs = [];
                      dockerZipError = '';

                      const nar = problem.config!.networkAccessRestriction as unknown;
                      if (nar?.custom_env) nar.custom_env.env_list = [];

                      if (file) {
                        // file size
                        if (!assertFileSizeOK(file, 'dockerfiles.zip')) {
                          problem.assets!.dockerfilesZip = null;
                          e.target.value = '';
                          return;
                        }
                        // check zip structure
                        const isValid = await inspectDockerZip(file);
                        if (!isValid) {
                          problem.assets!.dockerfilesZip = null;
                          e.target.value = '';
                          return;
                        }
                        problem.assets!.dockerfilesZip = file;
                      } else {
                        problem.assets!.dockerfilesZip = null;
                        loadSavedDockerEnvs();
                      }
                      v$?.assets?.dockerfilesZip?.$touch();
                    }
                  "
                />
                <label v-if="v$?.assets?.dockerfilesZip?.$error || dockerZipError" class="label">
                  <span class="label-text-alt text-error whitespace-pre-line">
                    {{ v$?.assets?.dockerfilesZip?.$errors[0]?.$message || dockerZipError }}
                  </span>
                </label>

                <div
                  v-if="detectedDockerEnvs.length > 0"
                  class="border-success/30 bg-base-200 mt-2 w-full max-w-xs rounded border p-3 text-xs"
                >
                  <div class="text-success mb-2 flex items-center gap-1 font-bold">
                    <i-uil-check-circle />
                    {{
                      problem.assets?.dockerfilesZip
                        ? "Environment(s) to be established:"
                        : "List of environments:"
                    }}
                  </div>
                  <ul class="list-inside space-y-1 opacity-80">
                    <li
                      v-for="(env, index) in detectedDockerEnvs"
                      :key="env"
                      class="hover:bg-base-300 flex items-center justify-between rounded px-1 transition-colors"
                    >
                      <div>
                        <span class="font-mono font-bold">{{ env }}</span>
                      </div>

                      <button
                        type="button"
                        class="btn btn-ghost btn-xs text-error h-6 min-h-0 w-6 p-0"
                        @click="removeDockerEnv(index)"
                        title="Remove this environment"
                      >
                        <i-uil-trash-alt />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Artifact Collection -->
    <div class="form-control border-base-300 col-span-1 rounded-lg border p-4 md:col-span-2">
      <label class="label"><span class="label-text">Artifact Collection (Optional)</span></label>
      <div class="flex gap-4">
        <label class="label cursor-pointer gap-2">
          <input type="checkbox" class="checkbox" v-model="artifactCompiledBinary" />
          <span class="label-text">Compiled Binary</span>
        </label>

        <label class="label cursor-pointer gap-2">
          <input type="checkbox" class="checkbox" v-model="artifactZip" />
          <span class="label-text">Student Artifact (Zip)</span>
        </label>
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

/* 響應式設計 */
@media (max-width: 640px) {
  .mode-switcher-option {
    padding: 5px 12px;
    font-size: 0.7rem;
  }
}
</style>
