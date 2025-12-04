<script setup lang="ts">
import { inject, Ref, ref, reactive, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";

import LanguageMultiSelect from "../../Forms/LanguageMultiSelect.vue";
import MultiStringInput from "../Controls/MultiStringInput.vue";

import { assertFileSizeOK, validateFilesForAIAC } from "@/utils/checkFileSize";
import { ZipReader, BlobReader } from "@zip.js/zip.js";
import { fetcher } from "@/models/api";
import api from "@/models/api";

/* -------------------- Injection & Setup -------------------- */
const rawProblem = inject<Ref<ProblemForm> | undefined>("problem");
if (!rawProblem || !rawProblem.value) throw new Error("ConfigurationSection requires problem injection");

const problem = rawProblem as Ref<ProblemForm>;
const v$ = inject<any>("v$");
const route = useRoute();

/* -------------------- Course -------------------- */
const courseName = ref<string | null>(null);

async function fetchCourseName() {
  try {
    const resp = await fetcher.get(`/course/${route.params.name}`);
    courseName.value = resp.data;
  } catch {
    console.warn("Failed to fetch course id");
  }
}

/* -------------------- Quota -------------------- */
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

/* Trial Mode */
const trialQuotaError = ref("");
const localTrialLimit = ref<number | "">(problem.value?.config?.maxNumberOfTrial ?? "");
const trialPublicZipError = ref<string>("");

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
  try {
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    await reader.close?.();

    if (!entries.length) return false;

    // ONLY .in
    const invalid = entries.filter(({ filename }) => !filename.endsWith(".in"));
    if (invalid.length > 0) return false;

    return true;
  } catch (err) {
    console.error("Failed to read zip:", err);
    return false;
  }
}

/* -------------------- Problem Config Ensure -------------------- */
function ensureConfig() {
  if (!problem.value.config) {
    problem.value.config = {
      trialMode: false,
      aiVTuber: false,
      acceptedFormat: "code",
      maxStudentZipSizeMB: 50,
      aiVTuberApiKeys: [],
      aiVTuberMode: "gemini-2.5-flash-lite",
      networkAccessRestriction: {
        enabled: false,
        firewallExtranet: { enabled: false, whitelist: [], blacklist: [] },
        connectWithLocal: {
          enabled: false,
          whitelist: [],
          blacklist: [],
          localServiceZip: null,
        },
      },
      artifactCollection: [],
    };
  }
}
ensureConfig();

/* -------------------- Assets -------------------- */
const assetPaths = computed<Record<string, string>>(
  () => ((problem.value.config as any)?.assetPaths as Record<string, string>) || {},
);

const hasAsset = (key: string) => !!(assetPaths.value && assetPaths.value[key]);
const assetDownloadUrl = (key: string) =>
  assetPaths.value[key] ? `/api/problem/${route.params.id}/asset/${key}/download` : null;

/* -------------------- AI File Extensions -------------------- */
function getAIFileExtensions() {
  const lang = problem.value.allowedLanguage;
  const list: string[] = [];
  if (lang & 1) list.push(".c");
  if (lang & 2) list.push(".cpp");
  if (lang & 4) list.push(".py");
  return list;
}

/* -------------------- API Keys -------------------- */
const apiKeys = reactive<{ active: any[]; inactive: any[] }>({
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

  isFetchingKeys.value = true;
  fetchError.value = "";
  try {
    const { data } = await api.AIVTuber.getCourseKeys(courseName.value!);
    const allKeys = data.keys || [];
    apiKeys.active = allKeys.filter((k) => k.is_active);
    apiKeys.inactive = allKeys.filter((k) => !k.is_active);
  } catch {
    fetchError.value = "Failed to load keys.";
  } finally {
    isFetchingKeys.value = false;
  }
}

/* -------------------- Key Search -------------------- */
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

/* -------------------- Suggestion Tooltip -------------------- */
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

  const model = problem.value.config?.aiVTuberMode || "gemini-2.5-flash-lite";

  isFetchingSuggestion.value = true;
  suggestionError.value = "";

  try {
    const { data } = await api.AIVTuber.getKeySuggestion(courseName.value!, model);
    keySuggestion.value = data;
  } catch (err: any) {
    suggestionError.value = err?.response?.data?.detail || "Failed to fetch suggestion.";
    keySuggestion.value = null;
  } finally {
    isFetchingSuggestion.value = false;
  }
}

/* -------------------- Tooltip Outside Click -------------------- */
function onClickOutside(event: MouseEvent) {
  const tooltipEl = document.querySelector(".key-suggestion-tooltip");
  const buttonEl = document.querySelector(".btn-key-suggestion");

  if (tooltipEl?.contains(event.target as Node) || buttonEl?.contains(event.target as Node)) return;

  showSuggestionTooltip.value = false;
}

/* -------------------- Firewall & Local Modes -------------------- */
const firewallMode = ref<"whitelist" | "blacklist">("whitelist");
const localMode = ref<"whitelist" | "blacklist">("whitelist");

/* -------------------- Watches -------------------- */
watch(
  () => problem.value,
  (n, o) => {
    if (n !== o) {
      localQuota.value = n?.quota ?? "";
      quotaError.value = "";
    }
  },
);

watch(firewallMode, (newMode) => {
  const oppositeMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  problem.value.config!.networkAccessRestriction!.firewallExtranet![oppositeMode] = [];
});

watch(localMode, (newMode) => {
  const oppositeMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  problem.value.config!.networkAccessRestriction!.connectWithLocal![oppositeMode] = [];
});

watch(selectedKeys, (keys) => {
  problem.value.config!.aiVTuberApiKeys = keys;
});

/* -------------------- Lifecycle -------------------- */
onMounted(() => {
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
          <input type="radio" class="radio" value="code" v-model="(problem.config!.acceptedFormat as any)" />
          <span class="label-text">Code</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input type="radio" class="radio" value="zip" v-model="(problem.config!.acceptedFormat as any)" />
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
        <span class="whitespace-nowrap text-xs opacity-70">(default 50 MB)</span>
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
                  <span class="label-text">AI Model</span>
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
                  <span class="label-text">Upload AC files</span>
                </label>
                <div class="w-full">
                  <input
                    type="file"
                    multiple
                    :accept="getAIFileExtensions().join(',')"
                    class="file-input file-input-bordered file-input-sm w-full"
                    @change="
                      (e: any) => {
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
                      class="key-suggestion-tooltip absolute left-6 top-full z-50 mt-2 w-72 rounded-md border border-gray-400 bg-base-100 p-3 shadow-xl"
                    >
                      <div v-if="isFetchingSuggestion" class="flex items-center text-sm">
                        <ui-spinner class="mr-2" /> Fetching suggestion...
                      </div>
                      <div v-else-if="suggestionError" class="text-sm text-error">
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
                  class="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-base-200"
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
                    class="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-3 transition hover:border-info/30 hover:bg-base-200"
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
                  class="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-base-200"
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
                    class="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-3 transition hover:border-error/30 hover:bg-base-200"
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
        <!-- Max Number of Trial -->
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

        <!-- Upload Public Test Data -->
        <div class="form-control w-full max-w-xs">
          <label class="label">
            <span class="label-text">Upload Public Test Data (.zip)</span>
          </label>
          <input
            type="file"
            accept=".zip"
            class="file-input file-input-bordered file-input-sm w-full"
            @change="
              async (e: any) => {
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
            <span class="label-text-alt opacity-70"> Only <code>.in</code> files inside ZIP; ≤ 1 GB </span>
          </label>
        </div>

        <!-- Upload AC files -->
        <div class="form-control w-full max-w-xs">
          <label class="label">
            <span class="label-text">Upload AC files</span>
          </label>
          <input
            type="file"
            multiple
            :accept="getAIFileExtensions().join(',')"
            class="file-input file-input-bordered file-input-sm w-full"
            @change="
              (e: any) => {
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
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Network Access Restriction</span>
        <input type="checkbox" class="toggle" v-model="problem.config!.networkAccessRestriction!.enabled" />
      </label>

      <div
        v-if="problem.config!.networkAccessRestriction!.enabled"
        class="mt-3 grid grid-cols-1 gap-3 p-3 md:grid-cols-2"
      >
        <!-- Firewall Extranet -->
        <div class="rounded border border-gray-400 p-3">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Firewall Extranet</span>
            <input
              type="checkbox"
              class="toggle"
              v-model="problem.config!.networkAccessRestriction!.firewallExtranet!.enabled"
            />
          </label>

          <div
            v-if="problem.config!.networkAccessRestriction!.firewallExtranet!.enabled"
            class="mt-2 space-y-3 rounded border border-gray-400 p-3"
          >
            <!-- 滑動開關 -->
            <div class="flex justify-center">
              <div class="mode-switcher">
                <div class="mode-switcher-container">
                  <div
                    class="mode-switcher-slider"
                    :class="{ 'slider-blacklist': firewallMode === 'blacklist' }"
                  ></div>
                  <button
                    class="mode-switcher-option"
                    :class="{ active: firewallMode === 'whitelist' }"
                    @click="firewallMode = 'whitelist'"
                  >
                    <span>Whitelist</span>
                  </button>
                  <button
                    class="mode-switcher-option"
                    :class="{ active: firewallMode === 'blacklist' }"
                    @click="firewallMode = 'blacklist'"
                  >
                    <span>Blacklist</span>
                  </button>
                </div>
              </div>
            </div>

            <MultiStringInput
              v-if="firewallMode === 'whitelist'"
              v-model="problem.config!.networkAccessRestriction!.firewallExtranet!.whitelist"
              placeholder="Add whitelist host/IP"
              badge-class="badge-info"
            />
            <MultiStringInput
              v-else
              v-model="problem.config!.networkAccessRestriction!.firewallExtranet!.blacklist"
              placeholder="Add blacklist host/IP"
              badge-class="badge-error"
            />
          </div>
        </div>

        <!-- Connect With Local -->
        <div class="rounded border border-gray-400 p-3">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Connect With Local</span>
            <input
              type="checkbox"
              class="toggle"
              v-model="problem.config!.networkAccessRestriction!.connectWithLocal!.enabled"
            />
          </label>

          <div
            v-if="problem.config!.networkAccessRestriction!.connectWithLocal!.enabled"
            class="mt-2 space-y-3 rounded border border-gray-400 p-3"
          >
            <!-- 滑動開關 -->
            <div class="flex justify-center">
              <div class="mode-switcher">
                <div class="mode-switcher-container">
                  <div
                    class="mode-switcher-slider"
                    :class="{ 'slider-blacklist': localMode === 'blacklist' }"
                  ></div>
                  <button
                    class="mode-switcher-option"
                    :class="{ active: localMode === 'whitelist' }"
                    @click="localMode = 'whitelist'"
                  >
                    <span>Whitelist</span>
                  </button>
                  <button
                    class="mode-switcher-option"
                    :class="{ active: localMode === 'blacklist' }"
                    @click="localMode = 'blacklist'"
                  >
                    <span>Blacklist</span>
                  </button>
                </div>
              </div>
            </div>

            <MultiStringInput
              v-if="localMode === 'whitelist'"
              v-model="problem.config!.networkAccessRestriction!.connectWithLocal!.whitelist"
              placeholder="Add whitelist host/IP/URL"
              badge-class="badge-info"
            />
            <MultiStringInput
              v-else
              v-model="problem.config!.networkAccessRestriction!.connectWithLocal!.blacklist"
              placeholder="Add blacklist host/IP/URL"
              badge-class="badge-error"
            />

            <div class="form-control">
              <label class="label justify-start gap-x-4">
                <span class="label-text">Upload Local_Service.zip</span>
                <div class="flex items-center gap-2">
                  <div v-if="hasAsset('local_service')" class="flex items-center gap-2">
                    <span class="badge badge-success badge-outline text-xs">Uploaded</span>
                    <a
                      :href="assetDownloadUrl('local_service') || '#'"
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
              <input
                type="file"
                accept=".zip"
                class="file-input file-input-bordered"
                :class="{ 'input-error': v$?.assets?.localServiceZip?.$error }"
                @change="
                  (e: any) => {
                    const file = e.target.files?.[0] || null;
                    problem.assets!.localServiceZip = file;
                    v$?.assets?.localServiceZip?.$touch();
                    if (!file || !assertFileSizeOK(file, 'local_service.zip')) {
                      problem.assets!.localServiceZip = null;
                      e.target.value = '';
                    }
                  }
                "
              />
              <label v-if="v$?.assets?.localServiceZip?.$error" class="label">
                <span class="label-text-alt text-error">{{
                  v$.assets.localServiceZip.$errors[0]?.$message
                }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Artifact Collection -->
    <div class="form-control col-span-1 rounded-lg border border-gray-400 p-4 md:col-span-2">
      <label class="label"><span class="label-text">Artifact Collection (optional)</span></label>
      <div class="flex gap-4">
        <label class="label cursor-pointer gap-2">
          <input
            type="checkbox"
            class="checkbox"
            :checked="problem.config!.artifactCollection.includes('compiledBinary')"
            @change="
              ($event.target as HTMLInputElement).checked
                ? problem.config!.artifactCollection.push('compiledBinary')
                : (problem.config!.artifactCollection = problem.config!.artifactCollection.filter(
                    (v) => v !== 'compiledBinary',
                  ))
            "
          />
          <span class="label-text">Compiled Binary</span>
        </label>

        <label class="label cursor-pointer gap-2">
          <input
            type="checkbox"
            class="checkbox"
            :checked="problem.config!.artifactCollection.includes('zip')"
            @change="
              ($event.target as HTMLInputElement).checked
                ? problem.config!.artifactCollection.push('zip')
                : (problem.config!.artifactCollection = problem.config!.artifactCollection.filter(
                    (v) => v !== 'zip',
                  ))
            "
          />
          <span class="label-text">Zip</span>
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
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(255, 255, 255, 0.05);
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
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4), 0 0 20px rgba(59, 130, 246, 0.2);
  z-index: 1;
}

.mode-switcher-slider.slider-blacklist {
  transform: translateX(calc(100% + 3px));
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.2);
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
