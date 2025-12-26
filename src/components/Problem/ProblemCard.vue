<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, ref, watch } from "vue";
import { useSession } from "@/stores/session";
import api from "@/models/api";
import { isQuotaUnlimited, LANGUAGE_OPTIONS } from "@/constants";

// UI state for expanding/collapsing sections
const isLanguagesExpanded = ref(false);
const isLibraryExpanded = ref(true);
const isNetworkExpanded = ref(true);

const areRestrictionsVisible = ref(false);

interface Props {
  problem: Problem | ProblemForm;
  preview?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  preview: false,
});

const session = useSession();

// Basic problem statistics
const submitCount = computed(() => (props.problem as any).submitCount ?? 0);
const highScore = computed(() => (props.problem as any).highScore ?? 0);
const subtasks = computed(() => {
  const p: any = props.problem;
  return p.testCase ?? p.testCaseInfo?.tasks ?? [];
});

// Download test data
function downloadTestCase(problemId: number) {
  window.location.assign(api.Problem.getTestCaseUrl(problemId));
}

/* ===== Allowed Languages Logic ===== */
// Calculates which languages are allowed based on the bitmask
const allowedLangTexts = computed(() =>
  LANGUAGE_OPTIONS.filter(({ mask }) => (props.problem.allowedLanguage & mask) !== 0).map(({ text }) =>
    text.toUpperCase(),
  ),
);
// Helper flags for specific language features
const hasPython = computed(() => !!(props.problem.allowedLanguage & 4));
const hasCOrCpp = computed(() => !!(props.problem.allowedLanguage & 3));

/* ====== Library Restriction Logic ====== */
const lib = computed(() => (props.problem as any).pipeline?.staticAnalysis?.libraryRestrictions);

// Helper to determine whitelist/blacklist mode for library sections
function pickSectionMode(sectionSet: any) {
  if (!sectionSet) return { mode: "none", items: [] };
  const wl = (sectionSet.whitelist ?? []).length ?? 0;
  const bl = (sectionSet.blacklist ?? []).length ?? 0;
  const mode = wl >= bl ? "whitelist" : "blacklist";
  const items = sectionSet[mode] ?? [];
  return { mode, items };
}

// Construct the list of library restrictions (Syntax, Imports, etc.)
const libraryEntries = computed(() => {
  if (!lib.value || !lib.value.enabled) return [];
  const libs = lib.value;
  return [
    {
      label: "Syntax",
      ...pickSectionMode({
        whitelist: libs.whitelist.syntax,
        blacklist: libs.blacklist.syntax,
      }),
      disabled: false,
    },
    {
      label: "Imports",
      ...pickSectionMode({
        whitelist: libs.whitelist.imports,
        blacklist: libs.blacklist.imports,
      }),
      disabled: !hasPython.value,
    },
    {
      label: "Headers",
      ...pickSectionMode({
        whitelist: libs.whitelist.headers,
        blacklist: libs.blacklist.headers,
      }),
      disabled: !hasCOrCpp.value,
    },
    {
      label: "Functions",
      ...pickSectionMode({
        whitelist: libs.whitelist.functions,
        blacklist: libs.blacklist.functions,
      }),
      disabled: false,
    },
  ];
});

/* ====== Network Restriction Logic (Updated) ====== */

// Check if network access is globally enabled in config
const isNetworkEnabled = computed(() => (props.problem as any).config?.networkAccessEnabled ?? false);
// Access the raw network restriction object
const netRestriction = computed(() => (props.problem as any).config?.networkAccessRestriction);

// Process External Network Rules (IPs/URLs)
const externalConfig = computed(() => {
  // If disabled or no external config exists, return null
  if (!isNetworkEnabled.value || !netRestriction.value?.external) return null;

  const ext = netRestriction.value.external;
  // Map "Black"/"White" model to UI friendly keys
  const mode = ext.model === "White" ? "whitelist" : "blacklist";
  const ips = ext.ip || [];
  const urls = ext.url || [];

  return { mode, ips, urls };
});

// Process Sidecar Services
const sidecarList = computed(() => {
  if (!isNetworkEnabled.value || !netRestriction.value?.sidecars) return [];
  return netRestriction.value.sidecars;
});

/* ====== Statistical Counts ====== */
const libraryItemsCount = computed(() => {
  if (!lib.value?.enabled) return 0;
  return libraryEntries.value.reduce((sum, entry) => sum + (entry.items?.length || 0), 0);
});

// Updated count logic: Sum of Sidecars + IPs + URLs
const networkItemsCount = computed(() => {
  if (!isNetworkEnabled.value) return 0;
  let count = sidecarList.value.length;
  if (externalConfig.value) {
    count += (externalConfig.value.ips?.length || 0) + (externalConfig.value.urls?.length || 0);
  }
  return count;
});

/* ====== Reminder / Notification Logic ====== */
const isReminderDismissed = ref(false);

// Total active restrictions (Library + Network items)
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

// Auto-dismiss reminder when the panel is opened
watch(areRestrictionsVisible, (newVal) => {
  if (newVal) {
    isReminderDismissed.value = true;
  }
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
                        >Library Analysis</span
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
                            <span class="text-base-content/90 text-sm font-bold">External Connections</span>

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

                          <div class="grid gap-3">
                            <div
                              v-for="(car, idx) in sidecarList"
                              :key="idx"
                              class="border-base-content/5 bg-base-100/60 hover:bg-base-100 hover:border-info/30 flex flex-col gap-2 rounded-xl border p-3 transition-all"
                            >
                              <div class="flex items-center gap-2">
                                <div
                                  class="bg-info/10 text-info flex h-8 w-8 min-w-[2rem] items-center justify-center rounded-lg"
                                >
                                  <span class="text-lg">📦</span>
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
                                class="border-base-content/5 mt-1 border-t pt-2"
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
</style>
