<script setup lang="ts">
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import { computed, ref, watch, watchEffect, reactive } from "vue";
import api, { fetcher } from "@/models/api";
import { UserRole, useSession } from "@/stores/session";
import { useTitle } from "@vueuse/core";
import { isQuotaUnlimited } from "@/constants";
import useInteractions from "@/composables/useInteractions";
import type { AxiosError } from "axios";

const session = useSession();
const rolesCanReadProblemStatus = [UserRole.Admin, UserRole.Teacher, UserRole.TA];
const route = useRoute();
const router = useRouter();

const { isDesktop } = useInteractions();

useTitle(`Problems - ${route.params.name} | Normal OJ`);
const {
  data: problems,
  error,
  isLoading,
} = useAxios<ProblemList>(`/problem?offset=0&count=-1&course=${route.params.name}`, fetcher);

// Cache for problem details (keyed by problemId)
const problemDetailCache = reactive<Record<number, Problem | null>>({});

async function prefetchDetailsFor(ids: number[]) {
  const toFetch = ids.filter((id) => !Object.prototype.hasOwnProperty.call(problemDetailCache, id));
  await Promise.all(
    toFetch.map(async (id) => {
      try {
        // Use api helper to load detailed problem JSON
        const resp = await api.Problem.get(id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r: any = resp;
        if (r && r.status === "ok" && r.data) {
          problemDetailCache[id] = r.data as Problem;
        } else if (r && r.data) {
          problemDetailCache[id] = r.data as Problem;
        } else if (r && (r as Problem).problemName) {
          problemDetailCache[id] = r as Problem;
        } else {
          problemDetailCache[id] = null;
        }
      } catch {
        // Ignore fetch errors but mark as null so we won't retry incessantly
        problemDetailCache[id] = null;
      }
    }),
  );
}

function hasAiVtuber(id: number) {
  const p = problemDetailCache[id];
  return !!(p && p.config && (p.config as ProblemConfigExtra).aiVTuber);
}

function hasTrialHistory(id: number) {
  // check list item first (if backend provides trialMode info)
  const listItem = (problems.value || []).find((p) => p.problemId === id);
  // Check if trialMode is enabled (from list item or detailed config)
  if (listItem && typeof listItem.trialMode !== "undefined") {
    return !!listItem.trialMode;
  }
  // fallback to detailed problem config - only check if trialMode is enabled
  const p = problemDetailCache[id];
  const cfg = p?.config as ProblemConfigExtra | undefined;
  return !!(cfg && cfg.trialMode);
}

const page = ref(!isNaN(Number(route.query.page)) ? Number(route.query.page) : 1);
watchEffect(() => {
  if (problems.value != null && (page.value < 1 || page.value >= problems.value.length)) {
    page.value = 1;
  }
});

// Prefetch visible problem details for AI-TA badge
watchEffect(() => {
  const visible = (problems.value || [])
    .slice((page.value - 1) * 10, page.value * 10)
    .map((p) => p.problemId);
  if (visible.length) prefetchDetailsFor(visible);
});
watch(page, () => {
  router.replace({ query: { page: page.value } });
});
const maxPage = computed(() => {
  return problems.value ? Math.ceil(problems.value.length / 10) : 1;
});
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title justify-between">
          {{ $t("course.problems.text") }}

          <router-link
            v-if="session.isAdmin"
            class="btn btn-success"
            :to="`/course/${$route.params.name}/problem/new`"
          >
            <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.problems.new") }}
          </router-link>
          <router-link
            v-if="session.isTeacher"
            class="btn btn-success"
            :to="`/course/${$route.params.name}/problem/new`"
          >
            <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.problems.new") }}
          </router-link>
          <router-link
            v-if="session.isTA"
            class="btn btn-success"
            :to="`/course/${$route.params.name}/problem/new`"
          >
            <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.problems.new") }}
          </router-link>
        </div>

        <div class="my-2" />
        <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
          <template #loading>
            <skeleton-table v-if="isDesktop" :col="5" :row="5" />
            <div v-else class="flex items-center justify-center">
              <ui-spinner />
            </div>
          </template>
          <template #data>
            <table v-if="isDesktop" class="table w-full">
              <thead>
                <tr>
                  <th>{{ $t("course.problems.id") }}</th>
                  <th>{{ $t("course.problems.name") }}</th>
                  <th v-if="rolesCanReadProblemStatus.includes(session.role)">
                    {{ $t("course.problems.status") }}
                  </th>
                  <th>{{ $t("course.problems.tags") }}</th>
                  <th>{{ $t("course.problems.quota") }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="{ problemId, problemName, tags, quota, submitCount, status, aiVTuber } in (
                    problems || []
                  ).slice((page - 1) * 10, page * 10)"
                  :key="problemId"
                  class="hover"
                >
                  <td>
                    <router-link :to="`/course/${$route.params.name}/problem/${problemId}`" class="link">
                      {{ problemId }}
                    </router-link>
                  </td>
                  <td>
                    {{ problemName }}
                    <span v-if="aiVTuber || hasAiVtuber(problemId)" class="badge badge-secondary ml-2"
                      >AI-TA</span
                    >
                  </td>
                  <td v-if="rolesCanReadProblemStatus.includes(session.role)">
                    <span class="badge ml-1">{{ status === 0 ? "VISIBLE" : "HIDDEN" }}</span>
                  </td>
                  <td>
                    <span class="badge badge-info mr-1" v-for="tag in tags" :key="tag">{{ tag }}</span>
                  </td>
                  <td>
                    <template v-if="isQuotaUnlimited(quota)">
                      <span class="text-sm">{{ $t("components.problem.card.unlimited") }}</span>
                    </template>
                    <template v-else> {{ quota - submitCount }} / {{ quota }} </template>
                  </td>
                  <td>
                    <!-- Test History button (always visible, disabled if no trial mode) -->
                    <div
                      class="tooltip"
                      :data-tip="hasTrialHistory(problemId) ? 'Test History' : 'Trial Mode Disabled'"
                    >
                      <router-link
                        :class="[
                          'btn btn-ghost btn-sm btn-circle mr-1',
                          !hasTrialHistory(problemId) && 'pointer-events-none opacity-30',
                        ]"
                        :to="
                          hasTrialHistory(problemId)
                            ? `/course/${$route.params.name}/problem/${problemId}/test-history?from=problems`
                            : '#'
                        "
                        :tabindex="hasTrialHistory(problemId) ? 0 : -1"
                      >
                        <i-uil-history class="lg:h-5 lg:w-5" />
                      </router-link>
                    </div>
                    <div class="tooltip" data-tip="Stats">
                      <router-link
                        class="btn btn-ghost btn-sm btn-circle mr-1"
                        :to="`/course/${$route.params.name}/problem/${problemId}/stats`"
                      >
                        <i-uil-chart-line class="lg:h-5 lg:w-5" />
                      </router-link>
                    </div>
                    <div class="tooltip" data-tip="Copycat">
                      <router-link
                        v-if="session.isAdmin"
                        class="btn btn-ghost btn-sm btn-circle mr-1"
                        :to="`/course/${$route.params.name}/problem/${problemId}/copycat`"
                      >
                        <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                      </router-link>
                      <router-link
                        v-if="session.isTeacher"
                        class="btn btn-ghost btn-sm btn-circle mr-1"
                        :to="`/course/${$route.params.name}/problem/${problemId}/copycat`"
                      >
                        <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                      </router-link>
                      <router-link
                        v-if="session.isTA"
                        class="btn btn-ghost btn-sm btn-circle mr-1"
                        :to="`/course/${$route.params.name}/problem/${problemId}/copycat`"
                      >
                        <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                      </router-link>
                    </div>

                    <div class="tooltip" data-tip="Edit">
                      <router-link
                        v-if="session.isAdmin"
                        class="btn btn-ghost btn-sm btn-circle"
                        :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                      >
                        <i-uil-edit class="lg:h-5 lg:w-5" />
                      </router-link>
                      <router-link
                        v-if="session.isTeacher"
                        class="btn btn-ghost btn-sm btn-circle"
                        :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                      >
                        <i-uil-edit class="lg:h-5 lg:w-5" />
                      </router-link>
                      <router-link
                        v-if="session.isTA"
                        class="btn btn-ghost btn-sm btn-circle"
                        :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                      >
                        <i-uil-edit class="lg:h-5 lg:w-5" />
                      </router-link>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <template
              v-else
              v-for="{ problemId, problemName, tags, quota, submitCount, status, aiVTuber } in (
                problems || []
              ).slice((page - 1) * 10, page * 10)"
            >
              <problem-info
                :id="problemId"
                :problem-name="problemName"
                :unlimited-quota="isQuotaUnlimited(quota)"
                :quota-limit="quota"
                :quota-remaining="quota - submitCount"
                :tags="tags"
                :visible="status"
                :is-admin="session.isAdmin"
                :is-teacher="session.isTeacher"
                :is-ta="session.isTA"
                :ai-vtuber="aiVTuber || hasAiVtuber(problemId)"
                :has-trial-history="hasTrialHistory(problemId)"
              />
            </template>
          </template>
        </data-status-wrapper>

        <div class="card-actions mt-5">
          <pagination-buttons v-model="page" :maxPage="maxPage" />
        </div>
      </div>
    </div>
  </div>
</template>
