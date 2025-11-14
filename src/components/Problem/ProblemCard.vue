<script setup lang="ts">
import { computed } from "vue";
import { useSession } from "@/stores/session";
import api from "@/models/api";
import { isQuotaUnlimited } from "@/constants";

interface Props {
  problem: Problem | ProblemForm;
  preview?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  preview: false,
});

const session = useSession();

/** 裝成 computed，取代直接訪問 problem.submitCount / highScore */
const submitCount = computed(() => (props.problem as any).submitCount ?? 0);
const highScore = computed(() => (props.problem as any).highScore ?? 0);

/** 安全取得 subtasks */
const subtasks = computed(() => {
  const p: any = props.problem;
  return p.testCase ?? p.testCaseInfo?.tasks ?? [];
});

function downloadTestCase(problemId: number) {
  window.location.assign(api.Problem.getTestCaseUrl(problemId));
}
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
                  <span class="text-sm font-normal">{{ ` / ${props.problem.quota}` }}</span>
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
              <i-uil-file-upload-alt class="lg:h-5 lg:w-5" /> {{ $t("components.problem.card.submit") }}
            </router-link>
            <router-link
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/stats`"
            >
              <i-uil-chart-line class="lg:h-5 lg:w-5" /> {{ $t("components.problem.card.stats") }}
            </router-link>
            <router-link
              v-if="session.isAdmin"
              class="btn btn-circle btn-ghost btn-sm"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/edit`"
            >
              <i-uil-edit class="lg:h-5 lg:w-5" />
            </router-link>
            <button
              v-if="session.isAdmin"
              class="btn btn-ghost btn-sm"
              data-tip="Download test case"
              @click="downloadTestCase(Number($route.params.id))"
            >
              <i-uil-folder-download class="lg:h-5 lg:w-5" />
            </button>
          </div>
        </div>
      </div>

      <div class="divider" />

      <!-- ===== Description ===== -->
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
                  <th>{{ $t("components.problem.card.sample.id") }}</th>
                  <th>{{ $t("components.problem.card.sample.input") }}</th>
                  <th>{{ $t("components.problem.card.sample.output") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="i in props.problem.description.sampleInput.length" :key="i">
                  <td>{{ i }}</td>
                  <td>
                    <sample-code-block :code="props.problem.description.sampleInput[i - 1]" />
                  </td>
                  <td>
                    <sample-code-block :code="props.problem.description.sampleOutput[i - 1]" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card-title md:text-xl lg:text-2xl">{{ $t("components.problem.card.hint") }}</div>
          <markdown-renderer class="mb-10" :md="props.problem.description.hint" />

          <!-- ===== Restrictions ===== -->
          <div class="mb-10">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <!-- Library Restrictions -->
              <div class="rounded-box border border-base-300 bg-base-200">
                <div class="collapse collapse-arrow">
                  <input type="checkbox" class="peer" />
                  <div class="collapse-title flex justify-between pr-8 text-lg font-semibold">
                    <span>Library Restrictions</span>
                    <span class="text-sm italic opacity-80">
                      {{
                        (props.problem as any).pipeline?.staticAnalysis?.libraryRestrictions?.whitelist
                          ?.length ||
                        (props.problem as any).pipeline?.staticAnalysis?.libraryRestrictions?.blacklist
                          ?.length
                          ? "Configured"
                          : "Empty"
                      }}
                    </span>
                  </div>
                  <div class="collapse-content">
                    <div class="space-y-4">
                      <div class="rounded-lg border-l-4 border-accent bg-accent/10 p-4">
                        <strong class="text-accent">Whitelist</strong>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <template
                            v-if="(props.problem as any).pipeline?.staticAnalysis?.libraryRestrictions?.whitelist?.length"
                          >
                            <span
                              v-for="sym in (props.problem as any).pipeline.staticAnalysis.libraryRestrictions.whitelist"
                              :key="sym"
                              class="badge badge-accent badge-lg gap-1"
                              >{{ sym }}</span
                            >
                          </template>
                          <span v-else class="text-sm italic opacity-60">No restrictions</span>
                        </div>
                      </div>

                      <div class="rounded-lg border-l-4 border-error bg-error/10 p-4">
                        <strong class="text-error">Blacklist</strong>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <template
                            v-if="(props.problem as any).pipeline?.staticAnalysis?.libraryRestrictions?.blacklist?.length"
                          >
                            <span
                              v-for="sym in (props.problem as any).pipeline.staticAnalysis.libraryRestrictions.blacklist"
                              :key="sym"
                              class="badge badge-error badge-lg gap-1"
                              >{{ sym }}</span
                            >
                          </template>
                          <span v-else class="text-sm italic opacity-60">No restrictions</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Network Access Restrictions -->
              <div class="rounded-box border border-base-300 bg-base-200">
                <div class="collapse collapse-arrow">
                  <input type="checkbox" class="peer" />
                  <div class="collapse-title flex justify-between pr-8 text-lg font-semibold">
                    <span>Network Access Restrictions</span>
                    <span class="text-sm italic opacity-80">
                      {{
                        (props.problem as any).config?.networkAccessRestriction?.firewallExtranet?.whitelist
                          ?.length ||
                        (props.problem as any).config?.networkAccessRestriction?.firewallExtranet?.blacklist
                          ?.length ||
                        (props.problem as any).config?.networkAccessRestriction?.connectWithLocal?.whitelist
                          ?.length ||
                        (props.problem as any).config?.networkAccessRestriction?.connectWithLocal?.blacklist
                          ?.length
                          ? "Configured"
                          : "Empty"
                      }}
                    </span>
                  </div>
                  <div class="collapse-content">
                    <div class="space-y-6">
                      <!-- Firewall Extranet -->
                      <div class="rounded-lg bg-base-300/30 p-4">
                        <strong class="mb-2 block text-lg">Firewall Extranet</strong>

                        <div class="mb-3 rounded-lg border-l-4 border-accent bg-accent/10 p-3">
                          <strong class="text-sm text-accent">Whitelist</strong>
                          <div class="mt-2 flex flex-wrap gap-2">
                            <template
                              v-if="(props.problem as any).config?.networkAccessRestriction?.firewallExtranet?.whitelist?.length"
                            >
                              <span
                                v-for="sym in (props.problem as any).config.networkAccessRestriction.firewallExtranet.whitelist"
                                :key="sym"
                                class="badge badge-accent gap-1"
                                >{{ sym }}</span
                              >
                            </template>
                            <span v-else class="text-sm italic opacity-60">No restrictions</span>
                          </div>
                        </div>

                        <div class="rounded-lg border-l-4 border-error bg-error/10 p-3">
                          <strong class="text-sm text-error">Blacklist</strong>
                          <div class="mt-2 flex flex-wrap gap-2">
                            <template
                              v-if="(props.problem as any).config?.networkAccessRestriction?.firewallExtranet?.blacklist?.length"
                            >
                              <span
                                v-for="sym in (props.problem as any).config.networkAccessRestriction.firewallExtranet.blacklist"
                                :key="sym"
                                class="badge badge-error gap-1"
                                >{{ sym }}</span
                              >
                            </template>
                            <span v-else class="text-sm italic opacity-60">No restrictions</span>
                          </div>
                        </div>
                      </div>

                      <!-- Connect With Local -->
                      <div class="rounded-lg bg-base-300/30 p-4">
                        <strong class="mb-2 block text-lg">Connect With Local</strong>

                        <div class="mb-3 rounded-lg border-l-4 border-accent bg-accent/10 p-3">
                          <strong class="text-sm text-accent">Whitelist</strong>
                          <div class="mt-2 flex flex-wrap gap-2">
                            <template
                              v-if="(props.problem as any).config?.networkAccessRestriction?.connectWithLocal?.whitelist?.length"
                            >
                              <span
                                v-for="sym in (props.problem as any).config.networkAccessRestriction.connectWithLocal.whitelist"
                                :key="sym"
                                class="badge badge-accent gap-1"
                                >{{ sym }}</span
                              >
                            </template>
                            <span v-else class="text-sm italic opacity-60">No restrictions</span>
                          </div>
                        </div>

                        <div class="rounded-lg border-l-4 border-error bg-error/10 p-3">
                          <strong class="text-sm text-error">Blacklist</strong>
                          <div class="mt-2 flex flex-wrap gap-2">
                            <template
                              v-if="(props.problem as any).config?.networkAccessRestriction?.connectWithLocal?.blacklist?.length"
                            >
                              <span
                                v-for="sym in (props.problem as any).config.networkAccessRestriction.connectWithLocal.blacklist"
                                :key="sym"
                                class="badge badge-error gap-1"
                                >{{ sym }}</span
                              >
                            </template>
                            <span v-else class="text-sm italic opacity-60">No restrictions</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
