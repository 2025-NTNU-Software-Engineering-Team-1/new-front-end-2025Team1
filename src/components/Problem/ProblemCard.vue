<script setup lang="ts">
import { computed } from "vue";
import { useSession } from "@/stores/session";
import api from "@/models/api";
import { isQuotaUnlimited } from "@/constants";

interface Props {
  /** 允許來自 Problem 或 ProblemForm **/
  problem: Problem | ProblemForm;
  preview?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  preview: false,
});

const session = useSession();

/** ✅ 包裝成 computed，讓 TS 不報錯 **/
const submitCount = computed(() => (props.problem as any).submitCount ?? 0);
const highScore = computed(() => (props.problem as any).highScore ?? 0);

/** ✅ 安全取得 subtasks */
const subtasks = computed(() => {
  const p: any = props.problem;
  return p.testCase ?? p.testCaseInfo?.tasks ?? [];
});

function downloadTestCase(problemId: number) {
  window.location.assign(api.Problem.getTestCaseUrl(problemId));
}

// 把清單轉為可讀字串
function listOrEmpty(list?: string[]) {
  if (!list || list.length === 0) return "None";
  return list.join(", ");
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
          <div class="flex flex-wrap">
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
              <i-uil-file-upload-alt class="lg:h-5 lg:w-5" />
              {{ $t("components.problem.card.submit") }}
            </router-link>
            <router-link
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/problem/${$route.params.id}/stats`"
            >
              <i-uil-chart-line class="lg:h-5 lg:w-5" />
              {{ $t("components.problem.card.stats") }}
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

      <!-- ===== Main body ===== -->
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

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.ex") }}
          </div>
          <table class="table mb-10 w-full">
            <thead>
              <tr>
                <th>#</th>
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

          <div class="card-title md:text-xl lg:text-2xl">
            {{ $t("components.problem.card.hint") }}
          </div>
          <markdown-renderer class="mb-10" :md="props.problem.description.hint" />

          <!-- ===== Settings & Restrictions ===== -->
          <div v-if="(props.problem as any).config || (props.problem as any).pipeline" class="mb-10">
            <div class="card-title mb-2 md:text-xl lg:text-2xl">Settings & Restrictions</div>

            <!-- Accepted Format & Artifact -->
            <div v-if="(props.problem as any).config">
              <p><strong>Accepted Format:</strong> {{ (props.problem as any).config.acceptedFormat }}</p>
              <p>
                <strong>Artifact Collection:</strong>
                <span v-if="(props.problem as any).config.artifactCollection?.length">
                  {{ (props.problem as any).config.artifactCollection.join(", ") }}
                </span>
                <span v-else>None</span>
              </p>

              <div class="mt-3">
                <h3 class="mb-1 text-lg font-semibold">Network Access Restriction</h3>
                <template v-if="(props.problem as any).config.networkAccessRestriction?.enabled">
                  <p>
                    <strong>Firewall Extranet Whitelist:</strong>
                    {{
                      listOrEmpty(
                        (props.problem as any).config.networkAccessRestriction?.firewallExtranet?.whitelist,
                      )
                    }}
                  </p>
                  <p>
                    <strong>Firewall Extranet Blacklist:</strong>
                    {{
                      listOrEmpty(
                        (props.problem as any).config.networkAccessRestriction?.firewallExtranet?.blacklist,
                      )
                    }}
                  </p>
                  <p>
                    <strong>Connect With Local Whitelist:</strong>
                    {{
                      listOrEmpty(
                        (props.problem as any).config.networkAccessRestriction?.connectWithLocal?.whitelist,
                      )
                    }}
                  </p>
                  <p>
                    <strong>Connect With Local Blacklist:</strong>
                    {{
                      listOrEmpty(
                        (props.problem as any).config.networkAccessRestriction?.connectWithLocal?.blacklist,
                      )
                    }}
                  </p>
                </template>
                <span v-else>No network restriction</span>
              </div>
            </div>

            <!-- Library Restrictions -->
            <div v-if="(props.problem as any).pipeline" class="mt-5">
              <h3 class="mb-1 text-lg font-semibold">Library Restrictions</h3>
              <p>
                <strong>Whitelist:</strong>
                {{
                  listOrEmpty((props.problem as any).pipeline.staticAnalysis?.libraryRestrictions?.whitelist)
                }}
              </p>
              <p>
                <strong>Blacklist:</strong>
                {{
                  listOrEmpty((props.problem as any).pipeline.staticAnalysis?.libraryRestrictions?.blacklist)
                }}
              </p>
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
              <tr v-for="({ memoryLimit, timeLimit, taskScore }, index) in subtasks" :key="index">
                <td>{{ index + 1 }}</td>
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
