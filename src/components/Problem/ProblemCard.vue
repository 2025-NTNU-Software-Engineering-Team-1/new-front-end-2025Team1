<script setup lang="ts">
import { computed, ref } from "vue";
import { useSession } from "@/stores/session";
import api from "@/models/api";
import { isQuotaUnlimited, LANGUAGE_OPTIONS } from "@/constants";

const isLanguagesExpanded = ref(false);
const isLibraryExpanded = ref(false);
const isNetworkExpanded = ref(false);

interface Props {
  problem: Problem | ProblemForm;
  preview?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  preview: false,
});

const session = useSession();

// 高分、提交次數、子任務
const submitCount = computed(() => (props.problem as any).submitCount ?? 0);
const highScore = computed(() => (props.problem as any).highScore ?? 0);
const subtasks = computed(() => {
  const p: any = props.problem;
  return p.testCase ?? p.testCaseInfo?.tasks ?? [];
});

// 下載測資
function downloadTestCase(problemId: number) {
  window.location.assign(api.Problem.getTestCaseUrl(problemId));
}

/* ===== Allowed Languages ===== */
const allowedLangTexts = computed(() =>
  LANGUAGE_OPTIONS.filter(({ mask }) => (props.problem.allowedLanguage & mask) !== 0).map(({ text }) =>
    text.toUpperCase(),
  ),
);
const hasPython = computed(() => !!(props.problem.allowedLanguage & 4));
const hasCOrCpp = computed(() => !!(props.problem.allowedLanguage & 3));

/* ====== Library Restriction ====== */
const lib = computed(() => (props.problem as any).pipeline?.staticAnalysis?.libraryRestrictions);

function pickSectionMode(sectionSet: any) {
  if (!sectionSet) return { mode: "none", items: [] };
  const wl = (sectionSet.whitelist ?? []).length ?? 0;
  const bl = (sectionSet.blacklist ?? []).length ?? 0;
  const mode = wl >= bl ? "whitelist" : "blacklist";
  const items = sectionSet[mode] ?? [];
  return { mode, items };
}

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

/* ====== Network Restriction ====== */
const net = computed(() => (props.problem as any).config?.networkAccessRestriction);
function pickNetMode(obj?: any) {
  if (!obj) return { mode: "none", items: [] };
  const wl = obj.whitelist?.length ?? 0;
  const bl = obj.blacklist?.length ?? 0;
  const mode = wl >= bl ? "whitelist" : "blacklist";
  const items = obj[mode] ?? [];
  return { mode, items };
}
const networkSections = computed(() => {
  if (!net.value?.enabled) return [];
  return [
    {
      label: "Firewall Extranet",
      ...pickNetMode(net.value.firewallExtranet),
    },
    { label: "Connect With Local", ...pickNetMode(net.value.connectWithLocal) },
  ];
});

/* ====== 統計數據 ====== */
const libraryItemsCount = computed(() => {
  if (!lib.value?.enabled) return 0;
  return libraryEntries.value.reduce((sum, entry) => sum + (entry.items?.length || 0), 0);
});

const networkItemsCount = computed(() => {
  if (!net.value?.enabled) return 0;
  return networkSections.value.reduce((sum, section) => sum + (section.items?.length || 0), 0);
});
</script>

<template>
  <div class="card min-w-full">
    <div class="card-body">
      <!-- ===== Header ===== -->
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
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/stats`"
            >
              <i-uil-chart-line /> {{ $t("components.problem.card.stats") }}
            </router-link>
            <router-link
              v-if="session.isAdmin"
              class="btn btn-circle btn-ghost btn-sm"
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

      <!-- ===== Descriptions / Examples ===== -->
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

          <!-- ===== Allowed Languages ===== -->
          <div class="mb-8">
            <div
              class="group card-title mb-4 flex cursor-pointer select-none items-center justify-between text-xl"
              @click="isLanguagesExpanded = !isLanguagesExpanded"
            >
              <span>Allowed Languages</span>
              <span
                class="text-base-content/50 transition-transform duration-300 group-hover:text-base-content"
                :class="{ 'rotate-180': isLanguagesExpanded }"
              >
                ▼
              </span>
            </div>
            <div
              class="relative overflow-hidden rounded-2xl border border-base-300 bg-gradient-to-br from-base-200 to-base-300 shadow-lg transition-all duration-300"
              :class="isLanguagesExpanded ? 'p-6' : 'p-4'"
            >
              <div
                class="absolute inset-0 animate-pulse bg-gradient-to-r from-info/5 via-success/5 to-info/5"
                style="animation-duration: 3s"
              ></div>

              <div
                v-show="isLanguagesExpanded"
                class="relative flex flex-wrap gap-3 transition-all duration-300"
              >
                <span
                  v-for="(lang, idx) in allowedLangTexts"
                  :key="lang"
                  class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-info/20 to-info/30 px-5 py-3 font-mono text-base font-bold text-info-content shadow-md transition-all duration-300 hover:scale-105 hover:from-info/30 hover:to-info/40 hover:shadow-xl"
                  :style="{ animationDelay: `${idx * 0.1}s` }"
                >
                  <div
                    class="absolute inset-0 translate-x-[-200%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]"
                  ></div>
                  <span class="relative">{{ lang }}</span>
                </span>
              </div>

              <div v-show="!isLanguagesExpanded" class="relative text-center text-base-content/70">
                <span class="font-semibold">{{ allowedLangTexts.length }}</span>
                <span class="text-sm"
                  >{{ allowedLangTexts.length === 1 ? "language" : "languages" }} allowed</span
                >
              </div>
            </div>
          </div>

          <!-- ===== Restrictions ===== -->
          <div class="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Library Restrictions -->
            <div
              class="group relative overflow-hidden rounded-2xl border border-base-300 bg-gradient-to-br from-base-200 via-base-200 to-base-300 shadow-lg transition-all duration-300 hover:shadow-2xl"
              :class="isLibraryExpanded ? 'p-6' : 'p-4'"
            >
              <div
                class="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              ></div>
              <div class="relative">
                <div
                  class="mb-4 flex cursor-pointer select-none items-center justify-between"
                  @click="isLibraryExpanded = !isLibraryExpanded"
                >
                  <div class="flex flex-1 items-center gap-3">
                    <div
                      class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-xl font-bold text-transparent"
                    >
                      Library Restrictions
                    </div>
                    <div
                      class="h-1 flex-1 rounded-full bg-gradient-to-r from-primary/30 to-secondary/30"
                    ></div>
                  </div>
                  <span
                    class="ml-3 text-base-content/50 transition-transform duration-300 hover:text-base-content"
                    :class="{ 'rotate-180': isLibraryExpanded }"
                  >
                    ▼
                  </span>
                </div>

                <template v-if="isLibraryExpanded">
                  <template v-if="lib?.enabled">
                    <div class="space-y-4">
                      <div
                        v-for="(s, idx) in libraryEntries"
                        :key="s.label"
                        class="relative overflow-hidden rounded-xl border border-base-300 bg-base-100/80 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-base-100 hover:shadow-md"
                        :class="s.disabled && 'opacity-50'"
                        :style="{ animationDelay: `${idx * 0.15}s` }"
                      >
                        <div class="mb-3 flex items-center justify-between">
                          <span class="text-lg font-bold text-base-content">{{ s.label }}</span>
                          <span
                            class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                            :class="
                              s.mode === 'whitelist'
                                ? 'bg-accent/20 text-accent-content'
                                : s.mode === 'blacklist'
                                ? 'bg-error/20 text-error-content'
                                : 'bg-base-300 text-base-content'
                            "
                          >
                            {{ s.mode }}
                          </span>
                        </div>

                        <div class="mt-2 flex flex-wrap gap-2">
                          <template v-if="s.items?.length">
                            <span
                              v-for="(sym, symIdx) in s.items"
                              :key="sym"
                              class="relative overflow-hidden rounded-lg px-3 py-1.5 font-mono text-sm font-semibold transition-all duration-200 hover:scale-105 hover:shadow-md"
                              :class="
                                s.mode === 'whitelist'
                                  ? 'bg-gradient-to-br from-accent/80 to-accent text-accent-content'
                                  : 'bg-gradient-to-br from-error/80 to-error text-error-content'
                              "
                              :style="{ animationDelay: `${idx * 0.15 + symIdx * 0.05}s` }"
                            >
                              <span class="relative z-10">{{ sym }}</span>
                              <div
                                class="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0"
                              ></div>
                            </span>
                          </template>
                          <span class="text-sm italic text-base-content/60" v-else>No restriction</span>
                        </div>
                      </div>
                    </div>
                  </template>
                  <div v-else class="py-8 text-center italic text-base-content/60">
                    <div class="mb-2 text-lg">No restrictions</div>
                    <div
                      class="mx-auto h-1 w-20 rounded-full bg-gradient-to-r from-transparent via-base-content/20 to-transparent"
                    ></div>
                  </div>
                </template>

                <div v-if="!isLibraryExpanded" class="text-center text-base-content/70">
                  <template v-if="lib?.enabled">
                    <span class="font-semibold">{{ libraryItemsCount }}</span>
                    <span class="text-sm">{{ libraryItemsCount === 1 ? "item" : "items" }} restricted</span>
                  </template>
                  <span v-else class="text-sm italic">Empty</span>
                </div>
              </div>
            </div>

            <!-- Network Access Restriction -->
            <div
              class="group relative overflow-hidden rounded-2xl border border-base-300 bg-gradient-to-br from-base-200 via-base-200 to-base-300 shadow-lg transition-all duration-300 hover:shadow-2xl"
              :class="isNetworkExpanded ? 'p-6' : 'p-4'"
            >
              <div
                class="absolute inset-0 bg-gradient-to-br from-info/5 to-warning/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              ></div>
              <div class="relative">
                <div
                  class="mb-4 flex cursor-pointer select-none items-center justify-between"
                  @click="isNetworkExpanded = !isNetworkExpanded"
                >
                  <div class="flex flex-1 items-center gap-3">
                    <div
                      class="bg-gradient-to-r from-info to-warning bg-clip-text text-xl font-bold text-transparent"
                    >
                      Network Access Restriction
                    </div>
                    <div class="h-1 flex-1 rounded-full bg-gradient-to-r from-info/30 to-warning/30"></div>
                  </div>
                  <span
                    class="ml-3 text-base-content/50 transition-transform duration-300 hover:text-base-content"
                    :class="{ 'rotate-180': isNetworkExpanded }"
                  >
                    ▼
                  </span>
                </div>

                <template v-if="isNetworkExpanded">
                  <template v-if="net?.enabled">
                    <div class="space-y-4">
                      <div
                        v-for="(s, idx) in networkSections"
                        :key="s.label"
                        class="relative overflow-hidden rounded-xl border border-base-300 bg-base-100/80 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-base-100 hover:shadow-md"
                        :style="{ animationDelay: `${idx * 0.15}s` }"
                      >
                        <div class="mb-3 flex items-center justify-between">
                          <span class="text-lg font-bold text-base-content">{{ s.label }}</span>
                          <span
                            class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                            :class="
                              s.mode === 'whitelist'
                                ? 'bg-accent/20 text-accent-content'
                                : s.mode === 'blacklist'
                                ? 'bg-error/20 text-error-content'
                                : 'bg-base-300 text-base-content'
                            "
                          >
                            {{ s.mode }}
                          </span>
                        </div>

                        <div class="mt-2 flex flex-wrap gap-2">
                          <template v-if="s.items?.length">
                            <span
                              v-for="(sym, symIdx) in s.items"
                              :key="sym"
                              class="relative overflow-hidden rounded-lg px-3 py-1.5 font-mono text-sm font-semibold transition-all duration-200 hover:scale-105 hover:shadow-md"
                              :class="
                                s.mode === 'whitelist'
                                  ? 'bg-gradient-to-br from-accent/80 to-accent text-accent-content'
                                  : 'bg-gradient-to-br from-error/80 to-error text-error-content'
                              "
                              :style="{ animationDelay: `${idx * 0.15 + symIdx * 0.05}s` }"
                            >
                              <span class="relative z-10">{{ sym }}</span>
                              <div
                                class="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0"
                              ></div>
                            </span>
                          </template>
                          <span v-else class="text-sm italic text-base-content/60">No restriction</span>
                        </div>
                      </div>
                    </div>
                  </template>
                  <div v-else class="py-8 text-center italic text-base-content/60">
                    <div class="mb-2 text-lg">No restrictions</div>
                    <div
                      class="mx-auto h-1 w-20 rounded-full bg-gradient-to-r from-transparent via-base-content/20 to-transparent"
                    ></div>
                  </div>
                </template>

                <div v-if="!isNetworkExpanded" class="text-center text-base-content/70">
                  <template v-if="net?.enabled">
                    <span class="font-semibold">{{ networkItemsCount }}</span>
                    <span class="text-sm">{{ networkItemsCount === 1 ? "item" : "items" }} restricted</span>
                  </template>
                  <span v-else class="text-sm italic">Empty</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ===== Subtasks ===== -->
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
                <td>{{ i + 1 }}</td>
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
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.space-y-4 > *,
.space-y-3 > * {
  animation: fadeInUp 0.5s ease-out forwards;
  opacity: 0;
}
</style>
