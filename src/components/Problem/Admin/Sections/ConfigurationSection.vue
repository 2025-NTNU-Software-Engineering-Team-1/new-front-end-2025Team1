<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
// ==========================================
// Imports
// ==========================================
import { inject, Ref, ref, reactive, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { ZipReader, BlobReader } from "@zip.js/zip.js";
import { getHoverTranslations } from "../../Hovers";
// Components
import LanguageMultiSelect from "../../Forms/LanguageMultiSelect.vue";
import MultiStringInput from "../Controls/MultiStringInput.vue";
import SidecarInput from "../Controls/SidecarInput.vue";
import RandomCoin from "../Controls/RandomCoin.vue";

// Utils & API
import { assertFileSizeOK } from "@/utils/checkFileSize";
import { fetcher } from "@/models/api";
import api from "@/models/api";

import { useI18n } from "vue-i18n";
const { t, locale } = useI18n();
const hover = computed(() => getHoverTranslations(locale.value));

// ==========================================
// [CONFIG] Console Debug Mode
// ==========================================
const DEBUG_MODE = 1;

// ==========================================
// [CONSTANTS] Validation Limits
// ==========================================
const MAX_CHAR_LENGTH = 2048;
const MAX_DOCKER_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB
const IP_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// AC file
const acFileError = ref("");

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
function parseApiResponse(res: any) {
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
const v$ = inject<any>("v$");
const route = useRoute();

// ==========================================
// Trial Mode Logic
// ==========================================
watch(
  () => problem.value.config?.trialResultVisible,
  (newVal: boolean | undefined) => {
    // If viewing is disabled, downloading must also be disabled
    if (newVal === false && problem.value.config) {
      problem.value.config.trialResultDownloadable = false;
    }
  },
);

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
    if (val && typeof val === "object") {
      logger.warn("Received Object instead of String ID/Name. Extracting name...", val);
      courseName.value = val.name || val.id || (route.params.name as string);
    } else {
      courseName.value = val || (route.params.name as string);
    }

    logger.success("Course Name Resolved", courseName.value);
  } catch (err) {
    logger.error("Failed to fetch course info", err);
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
const trialTestdataError = ref<string | null>(null);
const localTrialLimit = ref<number | "">(problem.value?.config?.maxNumberOfTrial ?? "");

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

/**
 * Checks if the filenames array contains macOS metadata files.
 * macOS creates hidden files like `._filename` and `__MACOSX/` folder when zipping.
 * These files can cause issues with testcase processing.
 */
function hasMacOSMetadataFiles(filenames: string[]): string[] {
  const macosFiles: string[] = [];
  for (const filename of filenames) {
    // Check for __MACOSX directory (macOS resource fork folder)
    if (filename.startsWith("__MACOSX/") || filename === "__MACOSX") {
      macosFiles.push(filename);
      continue;
    }
    // Check for ._ prefixed files (macOS extended attributes)
    const basename = filename.split("/").pop() || "";
    if (basename.startsWith("._")) {
      macosFiles.push(filename);
    }
  }
  return macosFiles;
}

async function validateTrialPublicZip(file: File): Promise<boolean> {
  logger.group("Validate Trial Zip");
  trialTestdataError.value = null;

  try {
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    await reader.close?.();

    const filenames = entries.map((e) => e.filename);

    // [Validation] Block Mac Zip
    const macosFiles = hasMacOSMetadataFiles(filenames);
    if (macosFiles.length > 0) {
      const sampleFiles = macosFiles.slice(0, 3).join(", ");
      const moreCount = macosFiles.length > 3 ? ` (and ${macosFiles.length - 3} more)` : "";
      const msg = t("course.problems.macosZipDetected", {
        files: sampleFiles + moreCount,
      });
      logger.error("macOS Metadata Files Detected", macosFiles);
      trialTestdataError.value = msg;
      return false;
    }

    // Filter out directories and system files
    const validEntries = entries.filter((e: any) => {
      if (e.directory) return false;
      if (e.filename.endsWith("/")) return false;
      if (e.filename.includes("__MACOSX")) return false;
      if (e.filename.split("/").pop()?.startsWith(".")) return false;
      return true;
    });

    if (!validEntries.length) {
      const msg = "Zip contains no valid files (or only empty folders).";
      logger.error(msg);
      trialTestdataError.value = msg;
      return false;
    }

    // Validation 1: ONLY .in and .out files allowed
    const invalid = validEntries.filter(
      (e: any) => !e.filename.endsWith(".in") && !e.filename.endsWith(".out"),
    );
    if (invalid.length > 0) {
      const msg =
        "Invalid files found (must be .in or .out only):\n" + invalid.map((e: any) => e.filename).join("\n");
      logger.error(msg);
      trialTestdataError.value = msg;
      return false;
    }

    // Validation 2: Pairs check
    const inFiles = validEntries
      .filter((e: any) => e.filename.endsWith(".in"))
      .map((e: any) => e.filename.replace(/\.in$/, ""));
    const outFiles = validEntries
      .filter((e: any) => e.filename.endsWith(".out"))
      .map((e: any) => e.filename.replace(/\.out$/, ""));

    const missingOutFiles = inFiles.filter((name: any) => !outFiles.includes(name));
    if (missingOutFiles.length > 0) {
      const msg =
        "Missing .out files for the following .in files:\n" +
        missingOutFiles.map((name: any) => `${name}.in`).join("\n");
      logger.error(msg);
      trialTestdataError.value = msg;
      return false;
    }

    logger.success("Validation OK", validEntries.length + " files");
    return true;
  } catch (err) {
    const msg = "Failed to read zip file: " + err;
    logger.error(msg);
    trialTestdataError.value = msg;
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
      aiMaxToken: 500,
      acceptedFormat: "code",
      maxStudentZipSizeMB: 50,
      aiVTuberApiKeys: [],
      aiVTuberMode: "gemini-2.5-flash-lite",
      networkAccessRestriction: {
        sidecars: [],
        external: {
          model: "White",
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
  const cfg = problem.value.config as any;
  // Backward compatibility check
  if (cfg && !Array.isArray(cfg.artifactCollection)) {
    cfg.artifactCollection = Array.isArray(cfg.artifact_collection) ? cfg.artifact_collection : [];
  }
  // Check pipeline compatibility
  if (Array.isArray(cfg.pipeline?.artifactCollection) && cfg.artifactCollection.length === 0) {
    cfg.artifactCollection = cfg.pipeline.artifactCollection.slice();
  }
}

// Synchronous initialization check
if (!Array.isArray(problem.value.config.artifactCollection)) {
  const cfgAny = problem.value.config as any;
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
  () => ((problem.value.config as any)?.assetPaths as Record<string, string>) || {},
);

const hasAsset = (key: string) => !!(assetPaths.value && assetPaths.value[key]);
const assetDownloadUrl = (key: string) =>
  assetPaths.value[key] ? `/api/problem/${route.params.id}/asset/${key}/download` : null;

// ==========================================
// Section: Docker Zip Inspection & Validation
// ==========================================
const detectedDockerEnvs = ref<string[]>([]);
const dockerZipError = ref("");

// Helper: Read saved env list from config
function loadSavedDockerEnvs() {
  const nar = problem.value.config?.networkAccessRestriction as any;
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

  // [Validation] File Size
  if (file.size > MAX_DOCKER_SIZE_BYTES) {
    dockerZipError.value = "File size exceeds limit (1GB)";
    logger.error("File too large", file.size);
    return false;
  }

  try {
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    await reader.close();

    // [Validation] Block Mac Zip
    const hasMacFiles = entries.some(
      (e) => e.filename.includes("__MACOSX") || e.filename.split("/").pop()?.startsWith("._"),
    );

    if (hasMacFiles) {
      dockerZipError.value = "MacOS Zip files are not allowed. Please remove __MACOSX and ._ files.";
      logger.error("Mac zip detected");
      return false;
    }

    const dockerfiles = entries.filter((e) => !e.directory && e.filename.endsWith("Dockerfile"));

    if (dockerfiles.length === 0) {
      dockerZipError.value = "No 'Dockerfile' found.";
      logger.error("No Dockerfile found in zip");
      return false;
    }

    const envs: string[] = [];
    for (const entry of dockerfiles) {
      const parts = entry.filename.split("/");

      // [Validation] Structure must be "folder/Dockerfile" (2 levels)
      if (parts.length !== 2) {
        dockerZipError.value = `Structure error: ${entry.filename}. Please ensure the structure is "environment_folder/Dockerfile".`;
        logger.error("Structure error", entry.filename);
        return false;
      }

      envs.push(parts[0]);
    }

    const uniqueEnvs = Array.from(new Set(envs.sort()));

    // [Validation] Folder Count (1-5)
    if (uniqueEnvs.length < 1 || uniqueEnvs.length > 5) {
      dockerZipError.value = `Invalid folder count: Detected ${uniqueEnvs.length}. Must be between 1 and 5 (inclusive).`;
      logger.error("Folder count invalid", uniqueEnvs.length);
      return false;
    }

    detectedDockerEnvs.value = uniqueEnvs;

    // Save to config
    const nar = problem.value.config!.networkAccessRestriction as any;
    if (!nar.custom_env) {
      nar.custom_env = {};
    }
    nar.custom_env.env_list = uniqueEnvs;

    logger.success("Docker inspection success", uniqueEnvs);
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
  const nar = problem.value.config?.networkAccessRestriction as any;
  if (nar?.custom_env) {
    nar.custom_env.env_list = detectedDockerEnvs.value;
  }
}

// ==========================================
// Network & Sidecar Validation Logic (修正版)
// ==========================================
const networkErrors = computed(() => {
  const errors: Record<string, string[]> = {
    global: [],
    ip: [],
    url: [],
    sidecars: [],
    docker: [],
  };

  const cfg = problem.value.config;
  if (!cfg?.networkAccessEnabled) return errors;

  const nar = cfg.networkAccessRestriction;
  const model = nar?.external?.model || "Black";
  const ips = nar?.external?.ip || [];
  const urls = nar?.external?.url || [];
  const sidecars = nar?.sidecars || [];

  // === IP 檢查 ===
  ips.forEach((ip, i) => {
    if (!IP_REGEX.test(ip)) {
      errors.ip.push(`IP #${i + 1} Formatting error (0-255.0-255.0-255.0-255)`);
    }
  });

  // === URL 檢查 ===
  urls.forEach((url, i) => {
    if (url.length > MAX_CHAR_LENGTH) {
      errors.url.push(`URL #${i + 1} Length Exceeding ${MAX_CHAR_LENGTH}`);
    }
  });

  // === UX 提示：空白清單時 ===
  if (model === "Black" && ips.length === 0 && urls.length === 0) {
    errors.global.push(
      "※ No blocking options are set; external network access is fully open by default (Blacklist mode).",
    );
  }
  if (model === "White" && ips.length === 0 && urls.length === 0) {
    errors.global.push(
      "※ No allowed items are set; external network access is disabled by default (Whitelist mode).",
    );
  }

  // === Sidecar 檢查 ===
  sidecars.forEach((sc: any, idx: number) => {
    const hasAny =
      !!sc.name?.trim() ||
      !!sc.image?.trim() ||
      (Array.isArray(sc.args) && sc.args.some((a: string) => !!a.trim())) ||
      (typeof sc.args === "string" && sc.args.trim() !== "") ||
      (typeof sc.env === "string" ? sc.env.trim() !== "" : sc.env && Object.keys(sc.env).length > 0);

    if (hasAny && (!sc.name || !sc.image)) {
      errors.sidecars.push(`Sidecar #${idx + 1}：If any field is entered, Name and Image are required.`);
    }
  });

  return errors;
});

// Optional: expose a validity flag for the parent component to disable submit
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isNetworkConfigValid = computed(() => {
  const e = networkErrors.value;
  return (
    e.global.length === 0 &&
    e.ip.length === 0 &&
    e.url.length === 0 &&
    e.sidecars.length === 0 &&
    !dockerZipError.value
  );
});

// ==========================================
// Section: Restore Selected Keys via Usage API & Local JSON
// ==========================================
async function fetchExistingKeySelection() {
  // 1. Validate Course Name
  if (!courseName.value) await fetchCourseName();
  if (!courseName.value || typeof courseName.value !== "string") return;

  const currentProblemId = Number(route.params.id);

  logger.group(`Key Restoration (Merge Strategy)`);

  // Container for keys from different sources
  const keysFromLocal: string[] = [];
  const keysFromApi: string[] = [];

  // ---------------------------------------------------------
  // [SOURCE 1] Local JSON (Current Config) - Modified
  // ---------------------------------------------------------
  // Modification: Instead of using hardcoded localJsonData,
  // we directly read from the problem.value configuration.
  // This captures ALL keys present in the 'aiVTuberApiKeys' array.
  try {
    const currentConfigKeys = problem.value.config?.aiVTuberApiKeys;

    if (Array.isArray(currentConfigKeys)) {
      // Push all found Key IDs into the local array
      keysFromLocal.push(...currentConfigKeys);
      logger.log(`[Source: Local JSON] Found ${keysFromLocal.length} keys from config:`, keysFromLocal);
    } else {
      logger.log(`[Source: Local JSON] No keys found in config or format is invalid.`);
    }
  } catch (err) {
    logger.error("[Source: Local] Failed to parse local config data", err);
  }

  // ---------------------------------------------------------
  // [SOURCE 2] Usage API (Historical Data)
  // ---------------------------------------------------------
  if (currentProblemId && !isNaN(currentProblemId)) {
    try {
      const res = await api.CourseAPIUsage.getCourseUsage(courseName.value);
      const { isSuccess, data } = parseApiResponse(res);

      if (isSuccess && data?.keys) {
        // Filter keys that were used by this problemId
        const foundKeyIds = data.keys
          .filter((key: any) => {
            const usages = key.problem_usages || [];
            // Check if any usage record matches the current problem ID
            return usages.some((u: any) => Number(u.problem_id) === currentProblemId);
          })
          .map((key: any) => String(key.id));

        keysFromApi.push(...foundKeyIds);
        logger.log(`[Source: API] Found ${keysFromApi.length} keys from history:`, keysFromApi);
      } else {
        logger.warn("[Source: API] Request failed or returned no data. Skipping API keys.");
      }
    } catch (err) {
      logger.error("[Source: API] Exception during fetch. Ignoring API keys.", err);
    }
  } else {
    logger.warn("[Source: API] Invalid Problem ID, skipping API fetch.");
  }

  // ---------------------------------------------------------
  // [MERGE] Combine & Remove Duplicates
  // ---------------------------------------------------------
  try {
    // Merge: Current Selection + Local JSON Keys + API Keys
    // The Set object automatically removes duplicates.
    // This combines the keys from your JSON and the keys from the API history.
    const mergedSet = new Set([...selectedKeys.value, ...keysFromLocal, ...keysFromApi]);

    const finalKeys = Array.from(mergedSet);

    // Update State
    selectedKeys.value = finalKeys;

    // Ensure problem config is synced
    if (problem.value.config) {
      problem.value.config.aiVTuberApiKeys = finalKeys;
    }

    logger.success(`Merge Complete. Total Keys: ${finalKeys.length}`, finalKeys);
  } catch (err) {
    logger.error("Failed to merge keys", err);
  } finally {
    logger.groupEnd();
  }
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
    const { isSuccess, data, message } = parseApiResponse(res);

    if (!isSuccess && !data) {
      throw new Error(message || "Failed to response keys");
    }

    const rawKeys = data?.keys || [];
    logger.log(`Found ${rawKeys.length} keys`);

    const safeKeys = rawKeys.map((k: any, index: number) => {
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
    apiKeys.active = safeKeys.filter((k: any) => k.is_active);
    apiKeys.inactive = safeKeys.filter((k: any) => !k.is_active);

    logger.success("Keys Loaded", { active: apiKeys.active.length, inactive: apiKeys.inactive.length });
  } catch (err: any) {
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

// [Optimized] Real-time filtering
const filteredActiveKeys = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return apiKeys.active;
  return apiKeys.active.filter(
    (k: any) =>
      k.key_name.toLowerCase().includes(query) || (k.created_by || "").toLowerCase().includes(query),
  );
});

const filteredInactiveKeys = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return apiKeys.inactive;
  return apiKeys.inactive.filter(
    (k: any) =>
      k.key_name.toLowerCase().includes(query) || (k.created_by || "").toLowerCase().includes(query),
  );
});

// ==========================================
// Section: Selected Keys Management
// ==========================================
const selectedKeyObjects = computed(() => {
  const all = [...(apiKeys.active || []), ...(apiKeys.inactive || [])] as any[];
  return all.filter((k) => selectedKeys.value.includes(k.id));
});
function removeSelectedKey(id: string) {
  const idx = selectedKeys.value.indexOf(id);
  if (idx !== -1) {
    selectedKeys.value.splice(idx, 1);
  }
}
const isSelectedKeysOpen = ref(true);

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
  } catch (err: any) {
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
// [NEW] Section: Drag and Drop Logic & API Update
// ==========================================
const isDragging = ref(false); // Controls UI styling during drag operations

// 1. Call backend API to update Key status
async function updateKeyStatus(keyId: string, newStatus: boolean) {
  if (!courseName.value) return;

  logger.log(`Updating key ${keyId} to status: ${newStatus}`);

  try {
    // API path implementation based on the provided screenshot
    // Route: /course/${courseName}/ai/key/${keyId}
    const res = await fetcher.patch(`/course/${courseName.value}/ai/key/${keyId}`, {
      is_active: newStatus,
    });

    const { isSuccess, message } = parseApiResponse(res);

    if (isSuccess) {
      logger.success("Key status updated successfully");
      // After successful update, re-fetch Keys to refresh list categorization
      await fetchKeys();
    } else {
      throw new Error(message || "Update failed");
    }
  } catch (err) {
    logger.error("Failed to update key status", err);
    alert("Failed to update key status. Please try again.");
  }
}

// 2. Drag Start Handler
function onDragStart(evt: DragEvent, keyId: string, currentStatus: boolean) {
  if (evt.dataTransfer) {
    evt.dataTransfer.effectAllowed = "move";
    evt.dataTransfer.dropEffect = "move";
    // Store the dragged ID and its current status in the data transfer object
    evt.dataTransfer.setData("keyId", keyId);
    evt.dataTransfer.setData("currentStatus", String(currentStatus));
    isDragging.value = true;
  }
}

// 3. Drag End Handler - Used to reset UI state
function onDragEnd() {
  isDragging.value = false;
}

// 4. Drop Handler
async function onDrop(evt: DragEvent, targetStatus: boolean) {
  isDragging.value = false;
  if (!evt.dataTransfer) return;

  const keyId = evt.dataTransfer.getData("keyId");
  const currentStatusStr = evt.dataTransfer.getData("currentStatus");
  const currentStatus = currentStatusStr === "true";

  // If status hasn't changed (e.g., dragged from Active to Active), do nothing
  if (currentStatus === targetStatus) return;

  // Call API to update the status
  await updateKeyStatus(keyId, targetStatus);
}

// ==========================================
// Section: AI key MaxToken
// ==========================================
const localAiMaxToken = ref<string>(String(problem.value.config?.aiMaxToken ?? 500));

function onAiMaxTokenInput(e: Event) {
  localAiMaxToken.value = (e.target as HTMLInputElement).value;
}
function fixAiMaxToken() {
  let val = parseInt(localAiMaxToken.value, 10);
  if (isNaN(val)) val = 500;
  if (val < 500) val = 500;
  if (val > 100000) val = 100000;
  localAiMaxToken.value = String(val);
  problem.value.config!.aiMaxToken = val;
}
function onAiMaxTokenBlur() {
  fixAiMaxToken();
}
function onAiMaxTokenKeyup(e: KeyboardEvent) {
  if (e.key === "Enter") {
    fixAiMaxToken();
    (e.target as HTMLInputElement).blur();
  }
}
watch(
  () => problem.value.config?.aiMaxToken,
  (v) => {
    if (typeof v === "number") localAiMaxToken.value = String(v);
  },
);

// ==========================================
// Handler for Random Coin
// ==========================================
function onCoinGenerated(val: number) {
  // Update local string value for input display
  localAiMaxToken.value = String(val);
  // Update actual config data
  if (problem.value.config) {
    problem.value.config.aiMaxToken = val;
  }
  logger.log("Random Token Generated", val);
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

const showNetworkSection = computed({
  get: () => !!problem.value.config?.networkAccessEnabled,
  set: (v: boolean) => {
    ensureConfig();
    problem.value.config!.networkAccessEnabled = v;
  },
});

// ==========================================
// Helper: Selected Keys Statistics
// ==========================================
const selectedKeyStats = computed(() => {
  const selectedSet = new Set(selectedKeys.value);
  const activeCount = apiKeys.active.filter((k: any) => selectedSet.has(k.id)).length;
  const inactiveCount = apiKeys.inactive.filter((k: any) => selectedSet.has(k.id)).length;
  return {
    total: selectedSet.size,
    active: activeCount,
    inactive: inactiveCount,
  };
});

// tag
const tagsString = computed({
  get: () => {
    return problem.value.tags ? problem.value.tags.join(", ") : "";
  },
  set: (val: string) => {
    if (!val) {
      problem.value.tags = [];
      return;
    }
    problem.value.tags = val
      .replace(/(?:，|逗號|逗點|COMMA)/g, ",")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  },
});

// ==========================================
// [NEW] Section: Zip Size Validation
// ==========================================
/**
 * Validate Zip size on blur.
 * Range: 50MB ~ 3000MB.
 * If out of range, it reverts to the boundary values.
 */
function validateZipSize(e: Event) {
  const input = e.target as HTMLInputElement;
  let val = Number(input.value);

  // Check boundaries
  if (val < 50) val = 50;
  if (val > 3000) val = 3000;

  // Update configuration
  if (problem.value.config) {
    problem.value.config.maxStudentZipSizeMB = val;
  }

  // Force update the input display value
  input.value = String(val);
}

// ==========================================
// Section: Lifecycle Hooks
// ==========================================
onMounted(async () => {
  localAiMaxToken.value = String(problem.value.config?.aiMaxToken ?? 500);
  initArtifactCollection();
  await fetchKeys();
  await fetchExistingKeySelection();
  document.addEventListener("click", onClickOutside);
});

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

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickOutside);
});
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="form-control rounded-lg border border-gray-400 p-4">
      <label class="label"
        ><span
          class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
          :data-tip="hover.allowedLanguages"
        >
          {{ t("course.problems.allowedLanguages")
          }}<span class="text-error ml-1" aria-hidden="true">*</span></span
        ></label
      >
      <LanguageMultiSelect
        :model-value="problem.allowedLanguage"
        @update:model-value="(v) => (problem.allowedLanguage = v)"
      />
    </div>

    <div class="form-control rounded-lg border border-gray-400 p-4">
      <label class="label">
        <span
          class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
          :data-tip="hover.tags"
        >
          {{ t("course.problems.tags") }}</span
        >
      </label>

      <input type="text" class="input-bordered input" v-model.lazy="tagsString" placeholder="tag1, tag 2" />

      <label class="label">
        <span class="label-text-alt">{{ t("course.problems.commaSeparated") }}</span>
      </label>
    </div>

    <div class="form-control rounded-lg border border-gray-400 p-4">
      <label class="label">
        <span
          class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
          :data-tip="hover.quota"
        >
          {{ t("course.problems.quota") }}</span
        >
      </label>
      <input
        type="number"
        :min="-1"
        :max="500"
        step="1"
        :class="['input-bordered input w-full', quotaError && 'input-error']"
        :value="localQuota"
        @input="onQuotaInput"
        placeholder="-1 (unlimited) or 1–500"
      />
      <label class="label">
        <span class="label-text-alt" :class="quotaError ? 'text-error' : ''">
          {{ quotaError || t("course.problems.meansUnlimited") }}
        </span>
      </label>
    </div>

    <div class="form-control rounded-lg border border-gray-400 p-4">
      <label class="label"
        ><span class="label-text"
          >{{ t("course.problems.acceptedFormat")
          }}<span class="text-error ml-1" aria-hidden="true">*</span></span
        ></label
      >
      <div class="mt-2 flex flex-wrap items-center gap-6">
        <label class="label cursor-pointer gap-2">
          <input type="radio" class="radio" value="code" v-model="problem.config!.acceptedFormat as any" />
          <span class="label-text">{{ t("course.problems.code") }}</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input type="radio" class="radio" value="zip" v-model="problem.config!.acceptedFormat as any" />
          <span class="label-text">{{ t("course.problems.zip") }}</span>
        </label>
      </div>
      <div
        v-if="problem.config!.acceptedFormat === 'zip'"
        class="mt-3 flex items-center gap-2 rounded border border-gray-400 p-3"
      >
        <span
          class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
          :data-tip="hover.maxZipSize"
          >{{ t("course.problems.maxZipSize") }}</span
        >
        <input
          type="number"
          class="input-bordered input input-sm w-28 text-center"
          min="50"
          max="3000"
          step="1"
          :value="problem.config!.maxStudentZipSizeMB ?? 50"
          @input="problem.config!.maxStudentZipSizeMB = Number(($event.target as HTMLInputElement).value)"
          @blur="validateZipSize"
        />
        <span class="text-xs whitespace-nowrap opacity-70">{{ t("course.problems.maxZipSizeDefault") }}</span>
      </div>
    </div>

    <div class="col-span-2 rounded-lg border border-gray-400 p-4">
      <div class="flex items-center gap-4">
        <label class="label cursor-pointer justify-start gap-x-4">
          <span
            class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
            :data-tip="hover.aiTA"
            >{{ t("course.problems.aiTA") }}</span
          >
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
                  <span
                    class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                    :data-tip="hover.aiModel"
                    >{{ t("course.problems.aiModel") }}</span
                  >
                </label>
                <select
                  class="select-bordered select select-sm flex-1"
                  v-model="problem.config!.aiVTuberMode"
                >
                  <option value="gemini-2.5-flash-lite">gemini 2.5 flash lite</option>
                  <option value="gemini-2.5-flash">gemini 2.5 flash</option>
                  <option value="gemini-2.5-pro">gemini 2.5 pro</option>
                </select>
              </div>
              <!-- MAX AI Token -->
              <div class="flex min-w-[200px] flex-1 flex-col">
                <label class="label mb-1">
                  <span class="label-text">{{ t("course.problems.aiMaxToken") }}</span>
                </label>

                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    class="input input-bordered input-sm flex-1"
                    :min="500"
                    :max="100000"
                    step="1"
                    :value="localAiMaxToken"
                    @input="onAiMaxTokenInput"
                    @blur="onAiMaxTokenBlur"
                    @keyup="onAiMaxTokenKeyup"
                    placeholder="500~100000"
                  />
                  <RandomCoin :min="500" :max="100000" @generated="onCoinGenerated" />
                </div>

                <label class="label">
                  <span class="label-text-alt">500~100000</span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-control">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <label
                  class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                  :data-tip="hover.selectAPIKeys"
                  >{{ t("course.problems.selectAPIKeys")
                  }}<span class="text-error ml-1" aria-hidden="true">*</span></label
                >

                <div v-if="selectedKeyStats.total > 0" class="ml-2 flex items-center gap-2">
                  <div class="badge badge-neutral badge-sm">
                    {{ t("course.problems.aiKeyTotal", { total: selectedKeyStats.total }) }}
                  </div>
                </div>

                <div class="relative">
                  <button
                    type="button"
                    class="btn-key-suggestion btn btn-ghost btn-xs btn-circle"
                    @click="
                      showSuggestionTooltip = !showSuggestionTooltip;
                      if (showSuggestionTooltip && !keySuggestion) fetchKeySuggestion();
                    "
                  >
                    <i-uil-question-circle class="text-info" />
                  </button>
                  <transition name="fade">
                    <div
                      v-if="showSuggestionTooltip"
                      class="key-suggestion-tooltip bg-base-100 absolute top-full left-6 z-50 mt-2 w-72 rounded-md border border-gray-400 p-3 shadow-xl"
                    >
                      <div v-if="isFetchingSuggestion" class="flex items-center text-sm">
                        <ui-spinner class="mr-2" /> {{ t("course.problems.aiKeyFetchingSuggestion") }}
                      </div>
                      <div v-else-if="suggestionError" class="text-error text-sm">
                        {{ suggestionError }}
                      </div>
                      <div v-else-if="keySuggestion" class="space-y-1 text-sm">
                        <div>
                          <b>{{ t("course.problems.aiKeySuggestionStudentCount") }}</b>
                          {{ keySuggestion.student_count }}
                        </div>
                        <div>
                          <b>{{ t("course.problems.aiKeySuggestionSuggestedKeys") }}</b>
                          {{ keySuggestion.suggested_key_count }}
                        </div>
                        <div>
                          <b>{{ t("course.problems.aiKeySuggestionReason") }}</b> {{ keySuggestion.reason }}
                        </div>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </div>

            <div
              v-if="selectedKeyObjects.length > 0"
              class="border-info/50 bg-base-200 mb-4 overflow-hidden rounded-lg border"
            >
              <button
                type="button"
                @click="isSelectedKeysOpen = !isSelectedKeysOpen"
                class="hover:bg-info/10 flex w-full items-center justify-between px-3 py-2 text-left transition-colors"
              >
                <div class="flex items-center gap-2">
                  <span class="text-info text-xs font-bold">
                    {{ t("course.problems.selectedKeysTitle", { count: selectedKeyObjects.length }) }}
                  </span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="text-info h-4 w-4 transition-transform duration-200"
                  :class="{ 'rotate-180': isSelectedKeysOpen }"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div v-show="isSelectedKeysOpen" class="p-2 pt-0">
                <transition-group name="list" tag="div" class="grid grid-cols-1 gap-2">
                  <div
                    v-for="key in selectedKeyObjects"
                    :key="key.id"
                    @click="removeSelectedKey(key.id)"
                    class="bg-base-100 border-info/30 group flex cursor-pointer items-start gap-3 rounded-lg border p-2 shadow-sm transition hover:border-red-300 hover:bg-red-50"
                  >
                    <div class="flex h-full items-center pt-1">
                      <i-uil-check-circle class="text-success text-lg group-hover:hidden" />
                      <i-uil-times-circle class="text-error hidden text-lg group-hover:block" />
                    </div>
                    <div class="flex-1 overflow-hidden">
                      <div class="flex items-center gap-2">
                        <span class="text-base-content group-hover:text-error truncate text-sm font-semibold">
                          {{ key.key_name }}
                        </span>
                        <span v-if="key.is_active" class="badge badge-success badge-xs font-mono">{{
                          t("course.problems.active")
                        }}</span>
                        <span v-else class="badge badge-error badge-xs font-mono">{{
                          t("course.problems.inactive")
                        }}</span>
                      </div>
                      <div class="mt-0.5 truncate text-xs text-gray-400">
                        {{ key.masked_value }} ({{ key.created_by }})
                      </div>
                    </div>
                  </div>
                </transition-group>
              </div>
            </div>

            <div class="mb-2 flex items-center gap-2">
              <input
                v-model="searchQuery"
                type="text"
                class="input-bordered input input-sm flex-1"
                :placeholder="t('course.problems.aiKeySearch')"
              />
            </div>

            <div v-if="isFetchingKeys" class="flex items-center gap-2 py-4 text-sm opacity-70">
              <span class="loading-spinner loading-sm loading"></span>
              {{ t("course.problems.aiKeyLoadingKeys") }}
            </div>

            <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div
                class="overflow-hidden rounded-lg border border-gray-400 transition-colors duration-300"
                :class="{ 'border-info bg-info/5 border-dashed': isDragging }"
                @dragover.prevent
                @dragenter.prevent
                @drop="onDrop($event, true)"
              >
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
                    <span
                      class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                      :data-tip="hover.activeAiKeys"
                      >{{ t("course.problems.activeAiKeys") }}</span
                    >
                    <span class="badge badge-info badge-sm">{{ apiKeys.active.length }}</span>
                  </div>
                  <span v-if="isDragging" class="text-info animate-pulse text-xs font-bold">
                    {{ t("course.problems.dropToActivate") }}
                  </span>
                </button>

                <div v-show="showActiveKeys" class="h-64 overflow-y-auto p-3">
                  <template v-for="key in filteredActiveKeys as any[]" :key="(key as any).id">
                    <label
                      v-if="!selectedKeys.includes(key.id)"
                      class="hover:border-info/30 hover:bg-base-200 flex cursor-move items-start gap-3 rounded-lg border border-transparent p-3 transition"
                      draggable="true"
                      @dragstart="onDragStart($event, key.id, true)"
                      @dragend="onDragEnd"
                    >
                      <input
                        type="checkbox"
                        class="checkbox checkbox-info checkbox-sm mt-1"
                        :value="key.id"
                        v-model="selectedKeys"
                      />
                      <div class="flex-1">
                        <div class="truncate text-sm font-semibold">
                          {{ t("course.problems.keyNameLabel", { name: key.key_name }) }}
                        </div>
                        <div class="mt-1 text-xs text-gray-400">
                          {{
                            t("course.problems.creatorInfo", {
                              name: key.created_by,
                              value: key.masked_value,
                            })
                          }}
                        </div>
                        <div class="mt-1 text-xs text-gray-400">
                          {{ t("course.problems.requestCount", { count: key.request_count }) }}
                        </div>
                        <div class="mt-1 text-xs text-gray-400">
                          {{
                            t("course.problems.tokenDisplay", {
                              input: key.input_token,
                              output: key.output_token,
                            })
                          }}
                        </div>
                      </div>
                    </label>
                  </template>
                </div>
              </div>

              <div
                class="overflow-hidden rounded-lg border border-gray-400 transition-colors duration-300"
                :class="{ 'border-error bg-error/5 border-dashed': isDragging }"
                @dragover.prevent
                @dragenter.prevent
                @drop="onDrop($event, false)"
              >
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
                    <span
                      class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                      :data-tip="hover.inactiveAiKeys"
                      >{{ t("course.problems.inactiveAiKeys") }}</span
                    >
                    <span class="badge badge-error badge-sm">{{ apiKeys.inactive.length }}</span>
                  </div>
                  <span v-if="isDragging" class="text-error animate-pulse text-xs font-bold">
                    {{ t("course.problems.dropToDeactivate") }}
                  </span>
                </button>

                <div v-show="showInactiveKeys" class="h-64 overflow-y-auto p-3">
                  <template v-for="key in filteredInactiveKeys as any[]" :key="(key as any).id">
                    <label
                      v-if="!selectedKeys.includes(key.id)"
                      class="hover:border-error/30 hover:bg-base-200 flex cursor-move items-start gap-3 rounded-lg border border-transparent p-3 transition"
                      draggable="true"
                      @dragstart="onDragStart($event, key.id, false)"
                      @dragend="onDragEnd"
                    >
                      <input
                        type="checkbox"
                        class="checkbox checkbox-error checkbox-sm mt-1"
                        :value="key.id"
                        v-model="selectedKeys"
                      />
                      <div class="flex-1">
                        <div class="truncate text-sm font-semibold">
                          {{ t("course.problems.keyNameLabel", { name: key.key_name }) }}
                        </div>
                        <div class="mt-1 text-xs text-gray-400">
                          {{
                            t("course.problems.creatorInfo", {
                              name: key.created_by,
                              value: key.masked_value,
                            })
                          }}
                        </div>
                        <div class="mt-1 text-xs text-gray-400">
                          {{ t("course.problems.requestCount", { count: key.request_count }) }}
                        </div>
                        <div class="mt-1 text-xs text-gray-400">
                          {{
                            t("course.problems.tokenDisplay", {
                              input: key.input_token,
                              output: key.output_token,
                            })
                          }}
                        </div>
                      </div>
                    </label>
                  </template>
                </div>
              </div>
            </div>

            <div v-if="fetchError" class="alert alert-error mt-2 text-sm">{{ fetchError }}</div>
          </div>
        </div>
      </transition>
    </div>

    <div class="form-control col-span-2 rounded-lg border border-gray-400 p-4">
      <label class="label ml-1 cursor-pointer justify-start gap-x-4">
        <span
          class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
          :data-tip="hover.trialMode"
          >{{ t("course.problems.trialMode") }}</span
        >
        <input type="checkbox" class="toggle" v-model="problem.config!.trialMode" />
      </label>
      <div v-if="problem.config!.trialMode" class="mt-3 space-y-4">
        <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div class="form-control w-full max-w-xs">
            <label class="label">
              <span
                class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                :data-tip="hover.trialMaxNumber"
                >{{ t("course.problems.trialMaxNumber") }}</span
              >
            </label>
            <input
              type="number"
              :min="-1"
              :max="500"
              step="1"
              :class="['input-bordered input w-full', trialQuotaError && 'input-error']"
              :value="localTrialLimit"
              @input="onTrialLimitInput"
              :placeholder="t('course.problems.trialMaxNumberPlaceholder')"
            />
            <label class="label">
              <span class="label-text-alt" :class="trialQuotaError ? 'text-error' : ''">
                {{ trialQuotaError || t("course.problems.meansUnlimited") }}
              </span>
            </label>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-x-4">
              <span
                class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                :data-tip="hover.resultVisible"
                >{{ t("course.problems.resultVisible") }}</span
              >
              <input
                type="checkbox"
                class="toggle toggle-success toggle-sm"
                v-model="problem.config!.trialResultVisible"
              />
            </label>
            <span class="text-xs opacity-70">{{ t("course.problems.allowViewingExecutionOutput") }}</span>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-x-4">
              <span
                class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                :data-tip="hover.resultDownloadable"
                >{{ t("course.problems.resultDownloadable") }}</span
              >
              <input
                type="checkbox"
                class="toggle toggle-success toggle-sm"
                v-model="problem.config!.trialResultDownloadable"
                :disabled="!problem.config!.trialResultVisible"
              />
            </label>
            <span class="text-xs opacity-70">
              {{ t("course.problems.allowDownloadingOutputFiles") }}
            </span>
          </div>
        </div>

        <div class="rounded-lg border border-gray-500 p-4">
          <div class="flex items-center gap-4">
            <span
              class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
              :data-tip="hover.uploadPublicTestData"
              >{{ t("course.problems.uploadPublicTestData")
              }}<span class="text-error ml-1" aria-hidden="true">*</span></span
            >
            <div class="flex items-center gap-2">
              <div
                v-if="hasAsset('public_testdata') || problem.assets?.trialModePublicTestDataZip"
                class="flex items-center gap-2"
              >
                <span class="badge badge-outline badge-success text-xs">{{
                  t("course.problems.uploaded")
                }}</span>
                <a
                  v-if="hasAsset('public_testdata')"
                  :href="assetDownloadUrl('public_testdata') || '#'"
                  class="btn btn-xs"
                  target="_blank"
                  rel="noopener"
                >
                  {{ t("course.problems.download") }}
                </a>
              </div>
              <span v-else class="badge badge-outline text-xs opacity-70">{{
                t("course.problems.notUploaded")
              }}</span>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <input
              type="file"
              accept=".zip"
              class="file-input-bordered file-input file-input-sm w-56"
              :class="{ 'input-error': v$?.assets?.trialModePublicTestDataZip?.$error }"
              @change="
                async (e: Event) => {
                  const inputEl = e.target as HTMLInputElement;
                  const file = inputEl.files?.[0] || null;
                  problem.assets!.trialModePublicTestDataZip = null;
                  trialTestdataError = null;
                  if (!file) {
                    inputEl.value = '';
                    v$?.assets?.trialModePublicTestDataZip?.$touch();
                    return;
                  }
                  if (!file.name.endsWith('.zip')) {
                    inputEl.value = '';
                    return;
                  }
                  if (!assertFileSizeOK(file, 'Public Test Data')) {
                    inputEl.value = '';
                    return;
                  }
                  const ok = await validateTrialPublicZip(file);
                  if (!ok) {
                    inputEl.value = '';
                    return;
                  }
                  problem.assets!.trialModePublicTestDataZip = file;
                  v$?.assets?.trialModePublicTestDataZip?.$touch();
                }
              "
            />
          </div>
          <div class="mt-1 pl-1 text-xs opacity-70">
            {{ t("course.problems.onlyInOutFiles") }}
          </div>
          <label v-if="v$?.assets?.trialModePublicTestDataZip?.$error" class="label">
            <span class="label-text-alt text-error">{{
              v$.assets.trialModePublicTestDataZip.$errors[0]?.$message
            }}</span>
          </label>
          <label v-if="trialTestdataError" class="label text-error">
            <span class="label-text-alt whitespace-pre-wrap">{{ trialTestdataError }}</span>
          </label>
        </div>

        <div class="rounded-lg border border-gray-500 p-4">
          <div class="flex items-center gap-4">
            <span
              class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
              :data-tip="hover.uploadACFiles"
              >{{ t("course.problems.uploadACFiles")
              }}<span class="text-error ml-1" aria-hidden="true">*</span></span
            >
            <div class="flex items-center gap-2">
              <div
                v-if="
                  hasAsset('ac_code') ||
                  (problem.assets?.trialModeACFiles && problem.assets.trialModeACFiles.length > 0)
                "
                class="flex items-center gap-2"
              >
                <span class="badge badge-outline badge-success text-xs">{{
                  t("course.problems.uploaded")
                }}</span>
                <a
                  v-if="hasAsset('ac_code')"
                  :href="assetDownloadUrl('ac_code') || '#'"
                  class="btn btn-xs"
                  target="_blank"
                  rel="noopener"
                >
                  {{ t("course.problems.download") }}
                </a>
              </div>
              <span v-else class="badge badge-outline text-xs opacity-70">{{
                t("course.problems.notUploaded")
              }}</span>
            </div>
          </div>

          <div class="mt-3 flex items-center gap-2">
            <input
              type="file"
              multiple
              accept=".py,.c,.cpp"
              class="file-input-bordered file-input file-input-sm w-56"
              :class="{ 'input-error': v$?.assets?.trialModeACFiles?.$error || acFileError }"
              @change="
                (e: Event) => {
                  const inputEl = e.target as HTMLInputElement;
                  const files = Array.from(inputEl.files || []) as File[];

                  // Reset error message
                  acFileError = '';

                  // Filter: Check both file size AND file extension
                  const valid = files.filter((f) => {
                    const isSizeOk = assertFileSizeOK(f, 'AC File');
                    // Check extension (case insensitive)
                    const isExtOk = /\.(py|c|cpp)$/i.test(f.name);
                    return isSizeOk && isExtOk;
                  });

                  // If files were dropped due to extension, set error message for UI
                  if (files.length > 0 && valid.length < files.length) {
                    acFileError = 'Some files were ignored. Only .py, .c, .cpp are allowed.';
                    // Optional: clear input if you want to force re-selection,
                    // but keeping valid files is usually better UX.
                  }

                  problem.assets!.trialModeACFiles = valid;

                  // If no valid files remain, clear the input value completely
                  if (valid.length === 0) {
                    inputEl.value = '';
                  }

                  v$?.assets?.trialModeACFiles?.$touch();
                }
              "
            />
          </div>
          <div class="mt-1 pl-1 text-xs opacity-70">{{ t("course.problems.ACFile") }}</div>

          <label v-if="v$?.assets?.trialModeACFiles?.$error || acFileError" class="label">
            <span v-if="v$?.assets?.trialModeACFiles?.$error" class="label-text-alt text-error">
              {{ v$.assets.trialModeACFiles.$errors[0]?.$message }}
            </span>
            <span v-else-if="acFileError" class="label-text-alt text-error">
              {{ acFileError }}
            </span>
          </label>
        </div>
      </div>
    </div>

    <div class="form-control col-span-2 rounded-lg border border-gray-400 p-4">
      <div class="flex items-center gap-4">
        <label class="label ml-1 cursor-pointer justify-start gap-x-4">
          <span
            class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
            :data-tip="hover.networkSidecars"
            >{{ t("course.problems.networkSidecars") }}</span
          >
          <input type="checkbox" class="toggle" v-model="problem.config!.networkAccessEnabled" />
        </label>
      </div>

      <transition
        enter-active-class="transition ease-out duration-200"
        leave-active-class="transition ease-in duration-150"
      >
        <div v-if="showNetworkSection" class="mt-3 space-y-4 p-2">
          <div v-if="networkErrors.global.length > 0" class="alert alert-warning text-sm shadow-md">
            <div class="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                class="h-6 w-6 shrink-0 stroke-current"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                ></path>
              </svg>
              <span>{{ t("course.problems.networkErrors.global[0]") }} </span>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-500">
            <div class="bg-base-300 px-4 py-2">
              <span
                class="text-base-content tooltip tooltip-bottom z-50 flex cursor-help items-center gap-1 font-medium"
                :data-tip="hover.networkAccessRestriction"
                >{{ t("course.problems.networkAccessRestriction") }}</span
              >
            </div>
            <div class="p-4">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="col-span-1 flex items-center gap-4 md:col-span-2">
                  <span
                    class="label-text tooltip tooltip-right z-50 flex cursor-help items-center gap-1"
                    :data-tip="hover.networkAccessModel"
                    >{{ t("course.problems.networkAccessModel") }}</span
                  >
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
                        <span>{{ t("course.problems.networkAccessWhitelist") }}</span>
                      </button>
                      <button
                        class="mode-switcher-option"
                        :class="{
                          active: problem.config!.networkAccessRestriction!.external!.model === 'Black',
                        }"
                        @click="problem.config!.networkAccessRestriction!.external!.model = 'Black'"
                      >
                        <span>{{ t("course.problems.networkAccessBlacklist") }}</span>
                      </button>
                    </div>
                  </div>
                  <div class="ml-2 text-xs opacity-70">
                    <span v-if="problem.config!.networkAccessRestriction!.external!.model === 'White'">
                      {{ t("course.problems.onlyAllowSpecificInfo") }}
                    </span>
                    <span v-else> {{ t("course.problems.blockSpecificInfo") }} </span>
                  </div>
                </div>

                <div>
                  <label class="label"
                    ><span
                      class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                      :data-tip="hover.networkAccessIPList"
                      >{{ t("course.problems.networkAccessIPList") }}</span
                    ></label
                  >
                  <MultiStringInput
                    v-model="problem.config!.networkAccessRestriction!.external!.ip"
                    placeholder="e.g. 8.8.8.8"
                    :badge-class="
                      problem.config!.networkAccessRestriction!.external!.model === 'White'
                        ? 'badge-info'
                        : 'badge-error'
                    "
                  />
                  <div v-if="networkErrors.ip.length > 0" class="text-error mt-1 text-xs">
                    <div v-for="(err, i) in networkErrors.ip" :key="i">* {{ err }}</div>
                  </div>
                </div>

                <div>
                  <label class="label"
                    ><span
                      class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                      :data-tip="hover.networkAccessURLList"
                      >{{ t("course.problems.networkAccessURLList") }}</span
                    ></label
                  >
                  <MultiStringInput
                    v-model="problem.config!.networkAccessRestriction!.external!.url"
                    placeholder="e.g. google.com"
                    :is-link="true"
                    :badge-class="
                      problem.config!.networkAccessRestriction!.external!.model === 'White'
                        ? 'badge-info'
                        : 'badge-error'
                    "
                  />
                  <div v-if="networkErrors.url.length > 0" class="text-error mt-1 text-xs">
                    <div v-for="(err, i) in networkErrors.url" :key="i">* {{ err }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-500">
            <div class="bg-base-300 px-4 py-2">
              <span
                class="text-base-content tooltip tooltip-bottom flex cursor-help items-center gap-1 font-medium"
                :data-tip="hover.SandboxEnvironment"
                >{{ t("course.problems.SandboxEnvironment") }}</span
              >
            </div>
            <div class="space-y-4 p-4">
              <div class="border-base-content/30 rounded-lg border p-4">
                <div class="mb-3">
                  <span
                    class="label-text tooltip tooltip-top flex cursor-help items-center gap-1 font-medium"
                    :data-tip="hover.Sidecars"
                    >{{ t("course.problems.Sidecars") }}</span
                  >
                </div>
                <SidecarInput v-model="problem.config!.networkAccessRestriction!.sidecars" />
                <div
                  v-if="networkErrors.sidecars.length > 0"
                  class="text-error mt-2 rounded bg-red-50 p-2 text-xs"
                >
                  <div v-for="(err, i) in networkErrors.sidecars" :key="i">* {{ err }}</div>
                </div>
              </div>

              <div class="border-base-content/30 rounded-lg border p-4">
                <div class="flex items-center gap-3">
                  <span
                    class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                    :data-tip="hover.dockerFiles"
                    >{{ t("course.problems.dockerFiles") }}</span
                  >
                  <div class="flex items-center gap-2">
                    <div v-if="hasAsset('network_dockerfile')" class="flex items-center gap-2">
                      <span class="badge badge-success badge-outline text-xs">{{
                        t("course.problems.uploaded")
                      }}</span>
                      <a
                        :href="assetDownloadUrl('network_dockerfile') || '#'"
                        class="btn btn-xs"
                        target="_blank"
                        rel="noopener"
                      >
                        {{ t("course.problems.download") }}
                      </a>
                    </div>
                    <span v-else class="badge badge-outline text-xs opacity-70">{{
                      t("course.problems.notUploaded")
                    }}</span>
                  </div>
                </div>
                <div class="mt-3 flex items-center gap-3">
                  <span class="label-text text-sm opacity-80">{{
                    t("course.problems.uploadDockerFilesZip")
                  }}</span>
                  <input
                    type="file"
                    accept=".zip"
                    class="file-input-bordered file-input w-full max-w-xs"
                    :class="{ 'input-error': v$?.assets?.dockerfilesZip?.$error || dockerZipError }"
                    @change="
                      async (e: Event) => {
                        const file = (e.target as HTMLInputElement).files?.[0] || null;
                        // Reset previous
                        detectedDockerEnvs = [];
                        dockerZipError = '';

                        const nar = problem.config!.networkAccessRestriction as any;
                        if (nar?.custom_env) nar.custom_env.env_list = [];

                        if (file) {
                          // Note: File size check is now inside inspectDockerZip
                          const isValid = await inspectDockerZip(file);
                          if (!isValid) {
                            problem.assets!.dockerfilesZip = null;
                            (e.target as HTMLInputElement).value = '';
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
                          :title="t('course.problems.removeEnvironment')"
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
        </div>
      </transition>
    </div>

    <div class="form-control col-span-1 rounded-lg border border-gray-400 p-4 md:col-span-2">
      <label class="label"
        ><span
          class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
          :data-tip="hover.ArtifactCollection"
          >{{ t("course.problems.ArtifactCollection") }}</span
        ></label
      >
      <div class="flex gap-4">
        <label class="label cursor-pointer gap-2">
          <input type="checkbox" class="checkbox" v-model="artifactCompiledBinary" />
          <span
            class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
            :data-tip="hover.CompiledBinary"
            >{{ t("course.problems.CompiledBinary") }}</span
          >
        </label>

        <label class="label cursor-pointer gap-2">
          <input type="checkbox" class="checkbox" v-model="artifactZip" />
          <span
            class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
            :data-tip="hover.StudentArtifact"
            >{{ t("course.problems.StudentArtifact") }}</span
          >
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Blacklist/whitelist switcher */
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

/* Responsive design */
@media (max-width: 640px) {
  .mode-switcher-option {
    padding: 5px 12px;
    font-size: 0.7rem;
  }
}
</style>
