<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useSession } from "@/stores/session";
import api from "@/models/api";
import { isQuotaUnlimited, LANGUAGE_OPTIONS } from "@/constants";

/* =========================================
   [NEW] Image Assets Import
   ========================================= */
import angelImg from "@/assets/angel-mascot.png";
import devilImg from "@/assets/devil-mascot.png";

/* =========================================
   [TYPE DEFINITIONS] - Root Cause Fix
   Defining strict interfaces to replace 'any'.
   These mirror the JSON structure provided by the user.
   ========================================= */

// 1. Define the Network Restriction structure
interface NetworkRestriction {
  sidecars?: Array<{ name: string; image: string; args?: string[] }>;
  external?: {
    model: "White" | "Black"; // Based on logic, model is a string
    ip?: string[];
    url?: string[];
  };
}

// 2. Define the Library/Static Analysis structure
interface LibraryList {
  syntax?: string[];
  imports?: string[];
  headers?: string[];
  functions?: string[];
}

interface LibraryRestrictions {
  enabled: boolean;
  whitelist?: LibraryList;
  blacklist?: LibraryList;
}

// 3. Define the Subtask/Testcase structure
interface TaskInfo {
  memoryLimit: number;
  timeLimit: number;
  taskScore: number;
}

// 4. Unified Problem Interface
// This interface combines properties from both Problem and ProblemForm.
// We mark fields that might be missing in one or the other as optional (?).
interface UnifiedProblem {
  problemName: string;
  allowedLanguage: number;
  tags: string[];
  quota: number;

  // Optional statistics (might not be in Form)
  submitCount?: number;
  highScore?: number;

  // Test cases can be directly in root 'testCase' or inside 'testCaseInfo'
  testCase?: TaskInfo[];
  testCaseInfo?: { tasks: TaskInfo[] };

  // Configuration objects
  config?: {
    trialMode?: boolean;
    networkAccessEnabled?: boolean;
    networkAccessRestriction?: NetworkRestriction;
  };

  pipeline?: {
    staticAnalysis?: {
      libraryRestrictions?: LibraryRestrictions;
    };
  };

  description: {
    description: string;
    input: string;
    output: string;
    sampleInput: string[];
    sampleOutput: string[];
    hint: string;
  };
}

/* =========================================
   [CONFIG] Mascot Positioning
   Adjust these values to move the mascot.
   ========================================= */
const MASCOT_POSITION = {
  right: "10%",
  top: "-110px",
};

/* =========================================
   UI State Management
   ========================================= */
const isLanguagesExpanded = ref(false);
const isLibraryExpanded = ref(true);
const isNetworkExpanded = ref(true);
const areRestrictionsVisible = ref(false);

interface Props {
  // We type the prop as UnifiedProblem to avoid 'any'
  problem: UnifiedProblem;
  preview?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  preview: false,
});

const session = useSession();

/* =========================================
   Basic Problem Data & Statistics
   ========================================= */
// Safe access using optional chaining (?? 0 provides default if undefined)
const submitCount = computed(() => props.problem.submitCount ?? 0);
const highScore = computed(() => props.problem.highScore ?? 0);

const subtasks = computed(() => {
  // Logic: Check root testCase first, fallback to testCaseInfo.tasks
  return props.problem.testCase ?? props.problem.testCaseInfo?.tasks ?? [];
});

function downloadTestCase(problemId: number) {
  window.location.assign(api.Problem.getTestCaseUrl(problemId));
}

/* =========================================
   Language & Config Parsers
   ========================================= */
const allowedLangTexts = computed(() =>
  LANGUAGE_OPTIONS.filter(({ mask }) => (props.problem.allowedLanguage & mask) !== 0).map(({ text }) =>
    text.toUpperCase(),
  ),
);
const hasPython = computed(() => !!(props.problem.allowedLanguage & 4));
const hasCOrCpp = computed(() => !!(props.problem.allowedLanguage & 3));

// Type-safe access to nested properties
const lib = computed(() => props.problem.pipeline?.staticAnalysis?.libraryRestrictions);
const isNetworkEnabled = computed(() => props.problem.config?.networkAccessEnabled ?? false);
const netRestriction = computed(() => props.problem.config?.networkAccessRestriction);

/* =========================================
   Data Helper: Calculate List Counts
   ========================================= */
function sumArrays(...arrays: (string[] | undefined)[]) {
  return arrays.reduce((sum, arr) => sum + (arr?.length || 0), 0);
}

/* =========================================
   Logic: Blacklist & Whitelist Counters
   ========================================= */
const blacklistCount = computed(() => {
  let count = 0;
  const l = lib.value;

  if (l?.enabled) {
    const syntaxWl = l.whitelist?.syntax?.length || 0;
    const syntaxBl = l.blacklist?.syntax?.length || 0;

    // Logic: If syntax whitelist is empty but blacklist has items, count them as restrictions
    if (syntaxWl === 0 && syntaxBl > 0) {
      count += syntaxBl;
    }

    const trioWlCount = sumArrays(l.whitelist?.imports, l.whitelist?.headers, l.whitelist?.functions);
    if (trioWlCount === 0) {
      const trioBlCount = sumArrays(l.blacklist?.imports, l.blacklist?.headers, l.blacklist?.functions);
      count += trioBlCount;
    }
  }

  if (isNetworkEnabled.value) {
    const ext = netRestriction.value?.external;
    const isWhiteMode = ext?.model === "White";

    // If NOT White mode (meaning Blacklist), explicit items are blocked restrictions
    if (!isWhiteMode) {
      count += (ext?.ip?.length || 0) + (ext?.url?.length || 0);
    }
  }

  return count;
});

const whitelistCount = computed(() => {
  let count = 0;
  const l = lib.value;

  if (l?.enabled) {
    if ((l.whitelist?.syntax?.length || 0) > 0) {
      count += l.whitelist!.syntax!.length;
    }
    const trioWlCount = sumArrays(l.whitelist?.imports, l.whitelist?.headers, l.whitelist?.functions);
    if (trioWlCount > 0) {
      count += trioWlCount;
    }
  }

  if (isNetworkEnabled.value) {
    const ext = netRestriction.value?.external;
    // If White mode, explicit items are allowed, implying everything else is restricted
    if (ext?.model === "White") {
      count += (ext?.ip?.length || 0) + (ext?.url?.length || 0);
    }
  }

  return count;
});

/* =========================================
   Logic: Mascot State Decision
   ========================================= */
const mascotState = computed(() => {
  const THRESHOLD_BL_HIGH = 10;
  const THRESHOLD_WL_LOW = 5;

  const isHighBlacklist = blacklistCount.value > THRESHOLD_BL_HIGH;
  const isLowWhitelist = whitelistCount.value > 0 && whitelistCount.value < THRESHOLD_WL_LOW;

  if (isHighBlacklist && isLowWhitelist) {
    return { type: "super-devil", imgSrc: devilImg };
  } else if (isHighBlacklist || isLowWhitelist) {
    return { type: "devil", imgSrc: devilImg };
  } else {
    return { type: "angel", imgSrc: angelImg };
  }
});

/* =========================================
   UI Helpers: Library Display List
   ========================================= */
function pickSectionMode(sectionSet: { whitelist?: string[]; blacklist?: string[] }) {
  const wl = sectionSet.whitelist?.length || 0;
  const bl = sectionSet.blacklist?.length || 0;

  if (wl === 0 && bl === 0) return { mode: "none", items: [] };

  const mode = wl > 0 ? "whitelist" : "blacklist";
  const items = (mode === "whitelist" ? sectionSet.whitelist : sectionSet.blacklist) || [];
  return { mode, items };
}

const libraryEntries = computed(() => {
  if (!lib.value || !lib.value.enabled) return [];
  const libs = lib.value;

  return [
    {
      label: "Syntax",
      ...pickSectionMode({ whitelist: libs.whitelist?.syntax, blacklist: libs.blacklist?.syntax }),
      disabled: false,
    },
    {
      label: "Imports",
      ...pickSectionMode({ whitelist: libs.whitelist?.imports, blacklist: libs.blacklist?.imports }),
      disabled: !hasPython.value,
    },
    {
      label: "Headers",
      ...pickSectionMode({ whitelist: libs.whitelist?.headers, blacklist: libs.blacklist?.headers }),
      disabled: !hasCOrCpp.value,
    },
    {
      label: "Functions",
      ...pickSectionMode({ whitelist: libs.whitelist?.functions, blacklist: libs.blacklist?.functions }),
      disabled: false,
    },
  ];
});

/* =========================================
   Legacy Counters & Reminders
   ========================================= */
const libraryItemsCount = computed(() => {
  if (!lib.value?.enabled) return 0;
  return libraryEntries.value.reduce((sum, entry) => sum + (entry.items?.length || 0), 0);
});

const sidecarList = computed(() => {
  if (!isNetworkEnabled.value || !netRestriction.value?.sidecars) return [];
  return netRestriction.value.sidecars;
});

const externalConfig = computed(() => {
  if (!isNetworkEnabled.value || !netRestriction.value?.external) return null;
  const ext = netRestriction.value.external;
  const mode = ext.model === "White" ? "whitelist" : "blacklist";
  return { mode, ips: ext.ip || [], urls: ext.url || [] };
});

const networkItemsCount = computed(() => {
  if (!isNetworkEnabled.value) return 0;
  let count = sidecarList.value.length;
  if (externalConfig.value) {
    count += (externalConfig.value.ips?.length || 0) + (externalConfig.value.urls?.length || 0);
  }
  return count;
});

const isReminderDismissed = ref(false);
const totalRestrictionsCount = computed(() => {
  const libCount = lib.value?.enabled ? libraryItemsCount.value : 0;
  const netCount = isNetworkEnabled.value ? networkItemsCount.value : 0;
  return libCount + netCount;
});

const showReminder = computed(() => {
  return !areRestrictionsVisible.value && !isReminderDismissed.value && totalRestrictionsCount.value > 0;
});

function dismissReminder(event?: Event) {
  event?.stopPropagation();
  isReminderDismissed.value = true;
}

watch(areRestrictionsVisible, (newVal) => {
  if (newVal) isReminderDismissed.value = true;
});
</script>

<template>
  <div class="card min-w-full">
    <div class="card-body">
      <div class="flex flex-wrap items-start justify-between gap-y-4">
        <div class="flex flex-col gap-4">
          <div class="card-title md:text-2xl lg:text-3xl">
            {{ $t("components.problem.card.title") }}
            {{ $route.params.id }} - {{ props.problem.problemName }}
          </div>
          <div class="flex">
            <span class="badge badge-info mr-1" v-for="tag in props.problem.tags" :key="tag">{{ tag }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-y-4">
          <div class="stats py-1">
            <div class="stat place-items-center py-0">
              <div class="stat-title">{{ $t("components.problem.card.quota") }}</div>
              <div class="stat-value">
                <template v-if="isQuotaUnlimited(props.problem.quota)">
                  <span class="text-sm">{{ $t("components.problem.card.unlimited") }}</span>
                </template>
                <template v-else>
                  <span>{{ props.problem.quota - submitCount }}</span>
                  <span class="text-sm font-normal">/ {{ props.problem.quota }}</span>
                </template>
              </div>
            </div>
            <div class="stat place-items-center py-0">
              <div class="stat-title">{{ $t("components.problem.card.score") }}</div>
              <div class="stat-value">
                <span>{{ highScore }}</span>
                <span class="text-sm font-normal">/ 100</span>
              </div>
            </div>
          </div>

          <div v-if="!props.preview" class="ml-3 flex flex-wrap place-items-center gap-x-3">
            <router-link
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/submit`"
            >
              <i-uil-file-upload-alt /> {{ $t("components.problem.card.submit") }}
            </router-link>
            <router-link
              v-if="props.problem.config?.trialMode"
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/test`"
            >
              <i-uil-flask class="lg:h-5 lg:w-5" /> {{ $t("components.problem.card.test") }}
            </router-link>
            <router-link
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/stats`"
            >
              <i-uil-chart-line /> {{ $t("components.problem.card.stats") }}
            </router-link>
            <router-link
              v-if="session.isAdmin"
              class="btn btn-ghost btn-sm btn-circle"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/edit`"
            >
              <i-uil-edit />
            </router-link>
            <button
              v-if="session.isAdmin"
              class="btn btn-ghost btn-sm"
              data-tip="Download test case"
              @click="downloadTestCase(Number($route.params.id))"
            >
              <i-uil-folder-download />
            </button>
          </div>
        </div>
      </div>

      <div class="divider" />

      <div class="card min-w-full rounded-none">
        <div class="card-body p-0">
          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.desc") }}
          </div>
          <markdown-renderer class="mb-10" :md="props.problem.description.description" />

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.input") }}
          </div>
          <markdown-renderer class="mb-10" :md="props.problem.description.input" />

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.output") }}
          </div>
          <markdown-renderer class="mb-10" :md="props.problem.description.output" />

          <div class="card-title md:text-xl lg:text-2xl">{{ $t("components.problem.card.ex") }}</div>
          <div class="mb-10">
            <table class="table w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Input</th>
                  <th>Output</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="i in props.problem.description.sampleInput.length" :key="i">
                  <td>{{ i }}</td>
                  <td><sample-code-block :code="props.problem.description.sampleInput[i - 1]" /></td>
                  <td><sample-code-block :code="props.problem.description.sampleOutput[i - 1]" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card-title md:text-xl lg:text-2xl">{{ $t("components.problem.card.hint") }}</div>
          <markdown-renderer class="mb-8" :md="props.problem.description.hint" />

          <div class="relative my-12">
            <div class="mb-8 flex justify-center">
              <div class="relative inline-block">
                <button
                  class="btn btn-outline border-base-300 hover:bg-base-200 hover:border-primary gap-2 rounded-full px-6 font-mono normal-case transition-all active:scale-95"
                  @click="areRestrictionsVisible = !areRestrictionsVisible"
                >
                  <span class="text-lg">{{ areRestrictionsVisible ? "×" : "⚙" }}</span>
                  <span>{{
                    areRestrictionsVisible ? "Hide Constraints" : "View Environment Constraints"
                  }}</span>
                </button>

                <transition name="fade">
                  <div
                    v-if="showReminder"
                    class="group absolute -right-2 -top-2 z-10 flex animate-bounce cursor-pointer items-center justify-center hover:animate-none"
                    title="Active restrictions found"
                    @click="areRestrictionsVisible = true"
                  >
                    <div
                      class="badge badge-error shadow-error/40 gap-1 p-3 text-xs font-bold text-white shadow-lg"
                    >
                      <span>{{ totalRestrictionsCount }}</span>
                      <div class="h-3 w-[1px] bg-white/30"></div>
                      <div
                        class="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-white/20"
                        @click="dismissReminder"
                        title="Dismiss reminder"
                      >
                        ×
                      </div>
                    </div>
                  </div>
                </transition>
              </div>
            </div>

            <transition name="fly-away">
              <div
                v-if="areRestrictionsVisible"
                class="pointer-events-none absolute z-20 flex flex-col items-center"
                :style="{ right: MASCOT_POSITION.right, top: MASCOT_POSITION.top }"
              >
                <div class="transition-transform duration-500 ease-out">
                  <div
                    v-if="mascotState.type === 'super-devil'"
                    class="flex items-center -space-x-6 md:-space-x-8"
                  >
                    <img
                      :src="mascotState.imgSrc"
                      class="z-0 h-24 w-24 origin-bottom-right -rotate-12 object-contain opacity-80 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)] filter md:h-28 md:w-28"
                    />
                    <img
                      :src="mascotState.imgSrc"
                      class="z-10 -mt-8 h-32 w-32 scale-110 object-contain drop-shadow-[0_0_20px_rgba(220,38,38,0.8)] filter md:h-40 md:w-40"
                    />
                    <img
                      :src="mascotState.imgSrc"
                      class="z-0 h-24 w-24 origin-bottom-left rotate-12 object-contain opacity-80 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)] filter md:h-28 md:w-28"
                    />
                  </div>

                  <div v-else>
                    <img
                      :src="mascotState.imgSrc"
                      class="h-32 w-32 object-contain filter transition-all duration-500 md:h-40 md:w-40"
                      :class="
                        mascotState.type === 'devil'
                          ? 'drop-shadow-[0_0_15px_rgba(239,68,68,0.6)] hover:drop-shadow-[0_0_25px_rgba(239,68,68,0.9)]'
                          : 'drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:drop-shadow-[0_0_25px_rgba(59,130,246,0.8)]'
                      "
                    />
                  </div>
                </div>
              </div>
            </transition>

            <transition name="drop" mode="out-in">
              <div
                v-if="areRestrictionsVisible"
                class="bg-base-200/30 border-base-200 space-y-12 rounded-3xl border p-6 md:p-10"
              >
                <div>
                  <div
                    class="mb-6 flex cursor-pointer select-none items-center gap-3"
                    @click="isLanguagesExpanded = !isLanguagesExpanded"
                  >
                    <div class="bg-primary h-6 w-1 rounded-full"></div>
                    <span class="text-base-content/80 text-lg font-bold uppercase tracking-wide"
                      >Allowed Languages</span
                    >
                    <span class="bg-base-300 text-base-content/60 rounded px-2 py-1 font-mono text-xs">{{
                      allowedLangTexts.length
                    }}</span>
                  </div>

                  <transition name="fade">
                    <div
                      v-show="isLanguagesExpanded"
                      class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6"
                    >
                      <div
                        v-for="(lang, idx) in allowedLangTexts"
                        :key="lang"
                        class="border-base-content/10 bg-base-100 hover:border-primary group relative flex cursor-default items-center justify-center rounded-lg border px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                        :style="{ animationDelay: `${idx * 0.05}s` }"
                      >
                        <span
                          class="text-base-content/80 group-hover:text-primary font-mono text-sm font-bold transition-colors"
                        >
                          {{ lang }}
                        </span>
                      </div>
                    </div>
                  </transition>
                </div>

                <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
                  <div class="space-y-6">
                    <div
                      class="mb-2 flex cursor-pointer select-none items-center gap-3"
                      @click="isLibraryExpanded = !isLibraryExpanded"
                    >
                      <div class="bg-secondary h-6 w-1 rounded-full"></div>
                      <span class="text-base-content/80 text-lg font-bold uppercase tracking-wide"
                        >Static Analysis</span
                      >
                      <span
                        v-if="lib?.enabled"
                        class="bg-base-300 text-base-content/60 rounded px-2 py-1 font-mono text-xs"
                      >
                        {{ libraryItemsCount }}
                      </span>
                      <span v-else class="badge badge-ghost badge-sm">Disabled</span>
                    </div>

                    <transition name="fade">
                      <div v-show="isLibraryExpanded && lib?.enabled" class="space-y-3">
                        <div
                          v-for="(s, idx) in libraryEntries"
                          :key="s.label"
                          class="border-base-content/5 bg-base-100/60 hover:bg-base-100 hover:border-base-content/20 relative flex flex-col gap-3 rounded-xl border p-4 transition-all hover:shadow-sm"
                          :class="{ 'opacity-50 grayscale': s.disabled }"
                          :style="{ animationDelay: `${idx * 0.1}s` }"
                        >
                          <div class="flex items-center justify-between">
                            <span class="text-base-content/90 text-sm font-bold">{{ s.label }}</span>
                            <div
                              class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                            >
                              <template v-if="s.mode === 'whitelist'">
                                <span
                                  class="bg-success h-2 w-2 animate-pulse rounded-full shadow-[0_0_8px_rgba(var(--su),0.6)]"
                                ></span>
                                <span class="text-success">Allowed Only</span>
                              </template>
                              <template v-else-if="s.mode === 'blacklist'">
                                <span
                                  class="bg-error h-2 w-2 rounded-full shadow-[0_0_8px_rgba(var(--er),0.6)]"
                                ></span>
                                <span class="text-error">Blocked</span>
                              </template>
                              <template v-else>
                                <span class="bg-base-300 h-2 w-2 rounded-full"></span>
                                <span class="text-base-content/40">Unrestricted</span>
                              </template>
                            </div>
                          </div>

                          <div
                            v-if="s.items?.length"
                            class="border-base-content/10 flex flex-wrap gap-2 border-l-2 pl-3"
                          >
                            <span
                              v-for="sym in s.items"
                              :key="sym"
                              class="bg-base-200/50 text-base-content/80 hover:text-primary hover:bg-base-200 inline-flex select-none items-center rounded px-2 py-1 font-mono text-xs transition-colors"
                            >
                              {{ sym }}
                            </span>
                          </div>
                          <div v-else class="text-base-content/30 pl-3 text-xs italic">
                            {{ s.disabled ? "Not applicable" : "No rules defined" }}
                          </div>
                        </div>
                      </div>
                    </transition>
                    <div v-if="!lib?.enabled" class="text-base-content/40 pl-4 text-sm italic">
                      No library restrictions active.
                    </div>
                  </div>

                  <div class="space-y-6">
                    <div
                      class="mb-2 flex cursor-pointer select-none items-center gap-3"
                      @click="isNetworkExpanded = !isNetworkExpanded"
                    >
                      <div class="bg-warning h-6 w-1 rounded-full"></div>
                      <span class="text-base-content/80 text-lg font-bold uppercase tracking-wide"
                        >Network Access</span
                      >
                      <span
                        v-if="isNetworkEnabled"
                        class="bg-base-300 text-base-content/60 rounded px-2 py-1 font-mono text-xs"
                      >
                        {{ networkItemsCount }}
                      </span>
                      <span v-else class="badge badge-ghost badge-sm">Disabled</span>
                    </div>

                    <transition name="fade">
                      <div v-show="isNetworkExpanded && isNetworkEnabled" class="space-y-4">
                        <div
                          v-if="externalConfig"
                          class="border-base-content/5 bg-base-100/60 hover:bg-base-100 hover:border-base-content/20 relative flex flex-col gap-3 rounded-xl border p-4 transition-all hover:shadow-sm"
                        >
                          <div class="flex items-center justify-between">
                            <span class="text-base-content/90 text-sm font-bold"
                              >🔗 External Connections</span
                            >

                            <div
                              class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                            >
                              <template v-if="externalConfig.mode === 'whitelist'">
                                <span
                                  class="bg-success h-2 w-2 animate-pulse rounded-full shadow-[0_0_8px_rgba(var(--su),0.6)]"
                                ></span>
                                <span class="text-success">Whitelist (Allowed Only)</span>
                              </template>
                              <template v-else>
                                <span
                                  class="bg-error h-2 w-2 rounded-full shadow-[0_0_8px_rgba(var(--er),0.6)]"
                                ></span>
                                <span class="text-error">Blacklist (Blocked)</span>
                              </template>
                            </div>
                          </div>

                          <div class="flex flex-col gap-1">
                            <span class="text-base-content/50 text-xs font-bold uppercase">IP Addresses</span>
                            <div v-if="externalConfig.ips.length" class="flex flex-wrap gap-2">
                              <span
                                v-for="ip in externalConfig.ips"
                                :key="ip"
                                class="bg-base-200/50 text-base-content/80 hover:text-primary inline-flex select-none items-center rounded px-2 py-1 font-mono text-xs transition-colors"
                              >
                                {{ ip }}
                              </span>
                            </div>
                            <div v-else class="text-base-content/30 text-xs italic">
                              No specific IPs defined
                            </div>
                          </div>

                          <div class="mt-2 flex flex-col gap-1">
                            <span class="text-base-content/50 text-xs font-bold uppercase"
                              >URLs / Domains</span
                            >
                            <div v-if="externalConfig.urls.length" class="flex flex-wrap gap-2">
                              <span
                                v-for="url in externalConfig.urls"
                                :key="url"
                                class="bg-base-200/50 text-base-content/80 hover:text-primary inline-flex h-auto select-none items-center break-all rounded px-2 py-1 text-left font-mono text-xs transition-colors"
                              >
                                {{ url }}
                              </span>
                            </div>
                            <div v-else class="text-base-content/30 text-xs italic">
                              No specific URLs defined
                            </div>
                          </div>
                        </div>

                        <div v-if="sidecarList.length > 0">
                          <div
                            class="text-base-content/40 mb-2 pl-1 text-xs font-bold uppercase tracking-widest"
                          >
                            Sidecar Services
                          </div>

                          <div
                            class="grid gap-3"
                            :class="{
                              'max-h-[400px] overflow-y-auto pr-2': sidecarList.length > 5,
                            }"
                          >
                            <div
                              v-for="(car, idx) in sidecarList"
                              :key="idx"
                              class="border-base-content/5 bg-base-100/60 hover:bg-base-100 hover:border-info/30 group relative flex flex-col gap-2 overflow-hidden rounded-xl border p-3 transition-all"
                            >
                              <div
                                class="animate-signal-move pointer-events-none absolute inset-0 z-0 opacity-0"
                                :style="{ animationDelay: `${idx * 0.5}s` }"
                              >
                                <div
                                  class="via-info/10 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-transparent"
                                ></div>
                              </div>

                              <div class="relative z-10 flex items-center gap-2">
                                <div
                                  class="bg-info/10 text-info flex h-8 w-8 min-w-[2rem] items-center justify-center rounded-lg"
                                >
                                  <span class="text-lg">💻</span>
                                </div>
                                <div class="min-w-0 flex-1">
                                  <div class="text-base-content/90 break-all text-sm font-bold">
                                    {{ car.name }}
                                  </div>
                                  <div class="text-base-content/50 break-all font-mono text-xs">
                                    Image: {{ car.image }}
                                  </div>
                                </div>
                              </div>

                              <div
                                v-if="car.args && car.args.length"
                                class="border-base-content/5 relative z-10 mt-1 border-t pt-2"
                              >
                                <div class="flex flex-wrap gap-1">
                                  <span class="text-base-content/40 mr-1 self-center text-[10px] uppercase"
                                    >Args:</span
                                  >
                                  <span
                                    v-for="(arg, argIdx) in car.args"
                                    :key="argIdx"
                                    class="bg-base-200 text-base-content/70 h-auto break-all rounded px-1.5 py-0.5 text-left font-mono text-[10px]"
                                  >
                                    {{ arg }}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          v-if="!externalConfig && sidecarList.length === 0"
                          class="text-base-content/40 pl-4 text-sm italic"
                        >
                          Network access is enabled, but no specific restrictions or sidecars are configured.
                        </div>
                      </div>
                    </transition>

                    <div v-if="!isNetworkEnabled" class="text-base-content/40 pl-4 text-sm italic">
                      Network access is completely disabled.
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.subtasks.title") }}
          </div>
          <table class="table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ $t("components.problem.card.subtasks.tl") }}</th>
                <th>{{ $t("components.problem.card.subtasks.ml") }}</th>
                <th>{{ $t("components.problem.card.subtasks.score") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="({ memoryLimit, timeLimit, taskScore }, i) in subtasks" :key="i">
                <td>{{ Number(i) + 1 }}</td>
                <td>{{ timeLimit }} ms</td>
                <td>{{ memoryLimit }} KB</td>
                <td>{{ taskScore }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Standard Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* Drop Down Expand Transition */
.drop-enter-active {
  animation: dropDown 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.drop-leave-active {
  animation: dropDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) reverse;
}

@keyframes dropDown {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.98);
    max-height: 0;
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    max-height: 2000px;
  }
}

/* Mascot Fly Away Animation */
.fly-away-enter-active {
  /* Bouncy pop-in effect */
  animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.fly-away-leave-active {
  /* Smooth exit */
  transition: all 0.7s ease-in;
}

.fly-away-leave-to {
  opacity: 0;
  /* Moves up and right, rotates slightly, scales down */
  transform: translate(60px, -100px) rotate(15deg) scale(0.7);
}

@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0) translateY(30px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes signalMove {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translateX(200%);
    opacity: 0;
  }
}

.animate-signal-move {
  /* Runs infinitely every 3 seconds.
    ease-in-out makes it smooth.
  */
  animation: signalMove 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
</style>
