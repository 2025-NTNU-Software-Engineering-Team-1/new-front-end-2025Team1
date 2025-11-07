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
                    <div>
                      <strong>Whitelist</strong>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <template
                          v-if="problem.config?.staticAnalysis?.libraryRestrictions?.whitelist?.length"
                        >
                          <span
                            v-for="sym in problem.config.staticAnalysis.libraryRestrictions.whitelist"
                            :key="'lib-w-' + sym"
                            class="badge badge-accent text-base-100"
                          >
                            {{ sym }}
                          </span>
                        </template>
                        <span v-else class="italic opacity-70">Null</span>
                      </div>
                    </div>
                    <div class="mt-4">
                      <strong>Blacklist</strong>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <template
                          v-if="problem.config?.staticAnalysis?.libraryRestrictions?.blacklist?.length"
                        >
                          <span
                            v-for="sym in problem.config.staticAnalysis.libraryRestrictions.blacklist"
                            :key="'lib-b-' + sym"
                            class="badge badge-error text-base-100"
                          >
                            {{ sym }}
                          </span>
                        </template>
                        <span v-else class="italic opacity-70">Null</span>
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
                    <!-- Firewall Extranet -->
                    <div class="border-b border-base-300 pb-3">
                      <div class="mb-2 font-semibold">Firewall Extranet</div>
                      <div class="ml-2">
                        <div><strong>Whitelist</strong></div>
                        <div class="mt-2 flex flex-wrap gap-2">
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
                              class="badge badge-accent text-base-100"
                            >
                              {{ sym }}
                            </span>
                          </template>
                          <span v-else class="italic opacity-70">Null</span>
                        </div>
                        <div class="mt-3"><strong>Blacklist</strong></div>
                        <div class="mt-2 flex flex-wrap gap-2">
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
                              class="badge badge-error text-base-100"
                            >
                              {{ sym }}
                            </span>
                          </template>
                          <span v-else class="italic opacity-70">Null</span>
                        </div>
                      </div>
                    </div>

                    <!-- Connect With Local -->
                    <div class="mt-4">
                      <div class="mb-2 font-semibold">Connect With Local</div>
                      <div class="ml-2">
                        <div><strong>Whitelist</strong></div>
                        <div class="mt-2 flex flex-wrap gap-2">
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
                              class="badge badge-accent text-base-100"
                            >
                              {{ sym }}
                            </span>
                          </template>
                          <span v-else class="italic opacity-70">Null</span>
                        </div>
                        <div class="mt-3"><strong>Blacklist</strong></div>
                        <div class="mt-2 flex flex-wrap gap-2">
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
                              class="badge badge-error text-base-100"
                            >
                              {{ sym }}
                            </span>
                          </template>
                          <span v-else class="italic opacity-70">Null</span>
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
