<script setup lang="ts">
import { useSession } from "@/stores/session";
import api from "@/models/api";
import { isQuotaUnlimited } from "@/constants";

interface Props {
  problem: Problem;
  preview?: boolean;
}
withDefaults(defineProps<Props>(), {
  isLoading: false,
  preview: false,
});

const session = useSession();

function downloadTestCase(problemId: number) {
  window.location.assign(api.Problem.getTestCaseUrl(problemId));
}
</script>

<template>
  <div class="card min-w-full">
    <div class="card-body">
      <div class="flex flex-wrap items-start justify-between gap-y-4">
        <div class="flex flex-col gap-4">
          <div class="card-title md:text-2xl lg:text-3xl">
            {{ $t("components.problem.card.title") }}{{ $route.params.id }} - {{ problem.problemName }}
          </div>
          <div class="flex">
            <span class="badge badge-info mr-1" v-for="tag in problem.tags" :key="tag">{{ tag }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-y-4">
          <div class="stats py-1">
            <div class="stat place-items-center py-0">
              <div class="stat-title">{{ $t("components.problem.card.quota") }}</div>
              <div class="stat-value">
                <template v-if="isQuotaUnlimited(problem.quota)">
                  <span class="text-sm">{{ $t("components.problem.card.unlimited") }}</span>
                </template>
                <template v-else>
                  <span>{{ problem.quota - problem.submitCount }}</span>
                  <span class="text-sm font-normal">{{ ` / ${problem.quota}` }}</span>
                </template>
              </div>
            </div>
            <div class="stat place-items-center py-0">
              <div class="stat-title">{{ $t("components.problem.card.score") }}</div>
              <div class="stat-value">
                <span>{{ problem.highScore }}</span>
                <span class="text-sm font-normal">{{ " / 100" }}</span>
              </div>
            </div>
          </div>

          <div class="ml-3 flex flex-wrap place-items-center gap-x-3" v-if="!preview">
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
              :class="['btn tooltip tooltip-bottom btn-ghost btn-sm', 'inline-flex']"
              data-tip="Copycat"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/copycat`"
            >
              <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
            </router-link>
            <router-link
              v-if="session.isAdmin"
              class="btn btn-circle btn-ghost btn-sm"
              data-tip="Edit"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/edit`"
            >
              <i-uil-edit class="lg:h-5 lg:w-5" />
            </router-link>
            <button
              v-if="session.isAdmin"
              :class="['btn tooltip tooltip-bottom btn-ghost btn-sm', 'inline-flex']"
              data-tip="Download test case"
              @click="downloadTestCase(Number.parseInt($route.params.id as string, 10))"
            >
              <i-uil-folder-download class="lg:h-5 lg:w-5" />
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
          <markdown-renderer class="mb-10" :md="problem.description.description" />

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.input") }}
          </div>
          <markdown-renderer class="mb-10" :md="problem.description.input" />

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.output") }}
          </div>
          <markdown-renderer class="mb-10" :md="problem.description.output" />

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
                <tr v-for="i in problem.description.sampleInput.length">
                  <td class="align-top">{{ i }}</td>
                  <td class="align-top">
                    <sample-code-block
                      v-if="problem.description.sampleInput[i - 1]"
                      :code="problem.description.sampleInput[i - 1]"
                    ></sample-code-block>
                    <span v-else class="italic opacity-70">{{
                      $t("components.problem.card.noContent")
                    }}</span>
                  </td>
                  <td class="align-top">
                    <sample-code-block
                      v-if="problem.description.sampleOutput[i - 1]"
                      :code="problem.description.sampleOutput[i - 1]"
                    ></sample-code-block>
                    <span v-else class="italic opacity-70">{{
                      $t("components.problem.card.noContent")
                    }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.hint") }}
          </div>
          <markdown-renderer class="mb-10" :md="problem.description.hint" />

          <!-- Static Analysis Section -->
          <div class="mb-10">
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <!-- Library Restrictions -->
              <div class="rounded-box border border-base-300 bg-base-200">
                <div class="collapse collapse-arrow">
                  <input type="checkbox" class="peer" />
                  <div class="collapse-title text-lg font-semibold">
                    <div class="flex items-center justify-between pr-8">
                      <span>Library Restrictions</span>
                      <span class="text-sm italic opacity-80">
                        {{
                          problem.config?.staticAnalysis?.libraryRestrictions?.whitelist?.length ||
                          problem.config?.staticAnalysis?.libraryRestrictions?.blacklist?.length
                            ? "Configured"
                            : "Empty"
                        }}
                      </span>
                    </div>
                  </div>
                  <div class="collapse-content">
                    <div class="space-y-4">
                      <!-- Whitelist -->
                      <div class="rounded-lg border-l-4 border-accent bg-accent/10 p-4">
                        <div class="mb-3 flex items-center gap-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5 text-accent"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <strong class="text-accent">Whitelist</strong>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <template
                            v-if="problem.config?.staticAnalysis?.libraryRestrictions?.whitelist?.length"
                          >
                            <span
                              v-for="sym in problem.config.staticAnalysis.libraryRestrictions.whitelist"
                              :key="'lib-w-' + sym"
                              class="badge badge-accent badge-lg gap-1"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              {{ sym }}
                            </span>
                          </template>
                          <span v-else class="text-sm italic opacity-60">No restrictions</span>
                        </div>
                      </div>

                      <!-- Blacklist -->
                      <div class="rounded-lg border-l-4 border-error bg-error/10 p-4">
                        <div class="mb-3 flex items-center gap-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5 text-error"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <strong class="text-error">Blacklist</strong>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <template
                            v-if="problem.config?.staticAnalysis?.libraryRestrictions?.blacklist?.length"
                          >
                            <span
                              v-for="sym in problem.config.staticAnalysis.libraryRestrictions.blacklist"
                              :key="'lib-b-' + sym"
                              class="badge badge-error badge-lg gap-1"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                              {{ sym }}
                            </span>
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
                  <div class="collapse-title text-lg font-semibold">
                    <div class="flex items-center justify-between pr-8">
                      <span>Network Access Restrictions</span>
                      <span class="text-sm italic opacity-80">
                        {{
                          problem.config?.staticAnalysis?.networkAccessRestriction?.firewallExtranet
                            ?.whitelist?.length ||
                          problem.config?.staticAnalysis?.networkAccessRestriction?.firewallExtranet
                            ?.blacklist?.length ||
                          problem.config?.staticAnalysis?.networkAccessRestriction?.connectWithLocal
                            ?.whitelist?.length ||
                          problem.config?.staticAnalysis?.networkAccessRestriction?.connectWithLocal
                            ?.blacklist?.length
                            ? "Configured"
                            : "Empty"
                        }}
                      </span>
                    </div>
                  </div>
                  <div class="collapse-content">
                    <div class="space-y-6">
                      <!-- Firewall Extranet -->
                      <div class="rounded-lg bg-base-300/30 p-4">
                        <div class="mb-4 flex items-center gap-2 text-lg font-semibold">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                            />
                          </svg>
                          Firewall Extranet
                        </div>

                        <!-- Whitelist -->
                        <div class="mb-3 rounded-lg border-l-4 border-accent bg-accent/10 p-3">
                          <div class="mb-2 flex items-center gap-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4 w-4 text-accent"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <strong class="text-sm text-accent">Whitelist</strong>
                          </div>
                          <div class="flex flex-wrap gap-2">
                            <template
                              v-if="
                                problem.config?.staticAnalysis?.networkAccessRestriction?.firewallExtranet
                                  ?.whitelist?.length
                              "
                            >
                              <span
                                v-for="sym in problem.config.staticAnalysis.networkAccessRestriction
                                  .firewallExtranet.whitelist"
                                :key="'fw-w-' + sym"
                                class="badge badge-accent gap-1"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                {{ sym }}
                              </span>
                            </template>
                            <span v-else class="text-sm italic opacity-60">No restrictions</span>
                          </div>
                        </div>

                        <!-- Blacklist -->
                        <div class="rounded-lg border-l-4 border-error bg-error/10 p-3">
                          <div class="mb-2 flex items-center gap-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4 w-4 text-error"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <strong class="text-sm text-error">Blacklist</strong>
                          </div>
                          <div class="flex flex-wrap gap-2">
                            <template
                              v-if="
                                problem.config?.staticAnalysis?.networkAccessRestriction?.firewallExtranet
                                  ?.blacklist?.length
                              "
                            >
                              <span
                                v-for="sym in problem.config.staticAnalysis.networkAccessRestriction
                                  .firewallExtranet.blacklist"
                                :key="'fw-b-' + sym"
                                class="badge badge-error gap-1"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                                {{ sym }}
                              </span>
                            </template>
                            <span v-else class="text-sm italic opacity-60">No restrictions</span>
                          </div>
                        </div>
                      </div>

                      <!-- Connect With Local -->
                      <div class="rounded-lg bg-base-300/30 p-4">
                        <div class="mb-4 flex items-center gap-2 text-lg font-semibold">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                            />
                          </svg>
                          Connect With Local
                        </div>

                        <!-- Whitelist -->
                        <div class="mb-3 rounded-lg border-l-4 border-accent bg-accent/10 p-3">
                          <div class="mb-2 flex items-center gap-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4 w-4 text-accent"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <strong class="text-sm text-accent">Whitelist</strong>
                          </div>
                          <div class="flex flex-wrap gap-2">
                            <template
                              v-if="
                                problem.config?.staticAnalysis?.networkAccessRestriction?.connectWithLocal
                                  ?.whitelist?.length
                              "
                            >
                              <span
                                v-for="sym in problem.config.staticAnalysis.networkAccessRestriction
                                  .connectWithLocal.whitelist"
                                :key="'loc-w-' + sym"
                                class="badge badge-accent gap-1"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                {{ sym }}
                              </span>
                            </template>
                            <span v-else class="text-sm italic opacity-60">No restrictions</span>
                          </div>
                        </div>

                        <!-- Blacklist -->
                        <div class="rounded-lg border-l-4 border-error bg-error/10 p-3">
                          <div class="mb-2 flex items-center gap-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4 w-4 text-error"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <strong class="text-sm text-error">Blacklist</strong>
                          </div>
                          <div class="flex flex-wrap gap-2">
                            <template
                              v-if="
                                problem.config?.staticAnalysis?.networkAccessRestriction?.connectWithLocal
                                  ?.blacklist?.length
                              "
                            >
                              <span
                                v-for="sym in problem.config.staticAnalysis.networkAccessRestriction
                                  .connectWithLocal.blacklist"
                                :key="'loc-b-' + sym"
                                class="badge badge-error gap-1"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                                {{ sym }}
                              </span>
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

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.subtasks.title") }}
          </div>
          <table class="table w-full">
            <thead>
              <tr>
                <th>{{ $t("components.problem.card.subtasks.id") }}</th>
                <th>{{ $t("components.problem.card.subtasks.tl") }}</th>
                <th>{{ $t("components.problem.card.subtasks.ml") }}</th>
                <th>{{ $t("components.problem.card.subtasks.score") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="({ memoryLimit, timeLimit, taskScore }, index) in problem.testCase" :key="index">
                <td>{{ index }}</td>
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
