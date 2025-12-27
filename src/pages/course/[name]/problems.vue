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
// Fetch all problems (count=-1) to enable client-side sorting and searching
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
  const listItem = (problems.value || []).find((p) => p.problemId === id);
  if (listItem && typeof listItem.trialMode !== "undefined") {
    return !!listItem.trialMode;
  }
  const p = problemDetailCache[id];
  const cfg = p?.config as ProblemConfigExtra | undefined;
  return !!(cfg && cfg.trialMode);
}

// --- Sorting Logic ---
const isSortDesc = ref(false); // false = Ascending, true = Descending

// Computed property to sort ALL problems before pagination
const sortedProblems = computed(() => {
  if (!problems.value) return [];
  const list = [...problems.value];

  // Sort by ID
  list.sort((a, b) => a.problemId - b.problemId);

  // Reverse if descending
  if (isSortDesc.value) {
    list.reverse();
  }
  return list;
});

// --- Search Logic (Name & ID) ---
const searchQuery = ref("");
// State to track if a search yielded no results
const searchNotFound = ref(false);

/**
 * Helper: Calculates similarity score for Name search
 */
function calculateScore(targetName: string, query: string): number {
  const t = targetName.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 10000; // Exact match

  let score = 0;
  const targetChars = t.split("");
  for (const char of q) {
    const idx = targetChars.indexOf(char);
    if (idx !== -1) {
      score++;
      targetChars.splice(idx, 1);
    }
  }
  return score;
}

/**
 * Helper: Navigates to the page containing the target problem ID
 */
function navigateToProblem(targetId: number) {
  const indexInSortedList = sortedProblems.value.findIndex((p) => p.problemId === targetId);

  if (indexInSortedList !== -1) {
    const targetPage = Math.ceil((indexInSortedList + 1) / 10);
    page.value = targetPage;
    // Reset not found state on success
    searchNotFound.value = false;
    // Optional: Log for debugging
    console.log(`Mapsd to Problem ID: ${targetId} on Page ${targetPage}`);
  }
}

/**
 * Main Search Function
 * Priority 1: Exact ID match (if input is number)
 * Priority 2: Name similarity match
 */
function performSearch() {
  // Clear previous error state
  searchNotFound.value = false;

  if (!searchQuery.value || !sortedProblems.value.length) return;

  const query = searchQuery.value.trim();
  if (!query) return;

  // Priority 1: Check if query is a valid ID (Number)
  const queryId = Number(query);
  if (!isNaN(queryId)) {
    const exactIdMatch = sortedProblems.value.find((p) => p.problemId === queryId);
    if (exactIdMatch) {
      navigateToProblem(exactIdMatch.problemId);
      return; // Found by ID, stop here
    }
  }

  // Priority 2: Name Search (Existing logic)
  let bestMatchId = -1;
  let maxScore = -1;

  for (const p of sortedProblems.value) {
    const score = calculateScore(p.problemName, query);

    if (score > maxScore) {
      maxScore = score;
      bestMatchId = p.problemId;
    } else if (score === maxScore) {
      // Tie-breaker: smaller ID wins
      if (bestMatchId === -1 || p.problemId < bestMatchId) {
        bestMatchId = p.problemId;
      }
    }
  }

  // Determine if a valid name match was found
  if (maxScore > 0 && bestMatchId !== -1) {
    navigateToProblem(bestMatchId);
  } else {
    // No match found for either ID or Name
    searchNotFound.value = true;
  }
}

// Watcher to clear error when user types
watch(searchQuery, () => {
  if (searchNotFound.value) searchNotFound.value = false;
});
// ----------------------------------------

const page = ref(!isNaN(Number(route.query.page)) ? Number(route.query.page) : 1);
watchEffect(() => {
  if (
    sortedProblems.value != null &&
    sortedProblems.value.length > 0 &&
    (page.value < 1 || page.value > Math.ceil(sortedProblems.value.length / 10))
  ) {
    page.value = 1;
  }
});

// Prefetch visible problem details for AI-TA badge
watchEffect(() => {
  const visible = (sortedProblems.value || [])
    .slice((page.value - 1) * 10, page.value * 10)
    .map((p) => p.problemId);
  if (visible.length) prefetchDetailsFor(visible);
});

watch(page, () => {
  router.replace({ query: { page: page.value } });
});

// Reset page when sort changes
watch(isSortDesc, () => {
  page.value = 1;
});

const maxPage = computed(() => {
  return sortedProblems.value ? Math.ceil(sortedProblems.value.length / 10) : 1;
});
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title flex-wrap justify-between gap-2">
          <div class="flex items-center gap-2">
            {{ $t("course.problems.text") }}
          </div>

          <div class="relative flex flex-col">
            <div class="flex items-center gap-2">
              <input
                v-model="searchQuery"
                type="text"
                maxlength="50"
                placeholder="Search Name or ID..."
                class="input input-bordered input-sm w-40 transition-colors lg:w-64"
                :class="{ 'input-error': searchNotFound }"
                @keyup.enter="performSearch"
              />
              <button class="btn btn-sm btn-ghost" @click="performSearch">
                <i-uil-search class="h-5 w-5" />
              </button>
            </div>
            <span v-if="searchNotFound" class="text-error absolute -bottom-5 left-1 text-xs">
              No result found.
            </span>
          </div>

          <div class="flex gap-2">
            <router-link
              v-if="session.isAdmin"
              class="btn btn-success btn-sm lg:btn-md"
              :to="`/course/${$route.params.name}/problem/new`"
            >
              <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.problems.new") }}
            </router-link>
            <router-link
              v-if="session.isTeacher"
              class="btn btn-success btn-sm lg:btn-md"
              :to="`/course/${$route.params.name}/problem/new`"
            >
              <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.problems.new") }}
            </router-link>
            <router-link
              v-if="session.isTA"
              class="btn btn-success btn-sm lg:btn-md"
              :to="`/course/${$route.params.name}/problem/new`"
            >
              <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.problems.new") }}
            </router-link>
          </div>
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
                  <th
                    class="hover:bg-base-200 cursor-pointer transition-colors select-none"
                    @click="isSortDesc = !isSortDesc"
                  >
                    <div class="flex items-center gap-1">
                      {{ $t("course.problems.id") }}
                      <span class="text-xs">{{ isSortDesc ? "▼" : "▲" }}</span>
                    </div>
                  </th>
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
                    sortedProblems || []
                  ).slice((page - 1) * 10, page * 10)"
                  :key="problemId"
                  class="hover"
                  :class="{
                    'bg-base-200':
                      searchQuery &&
                      (problemName.toLowerCase() === searchQuery.toLowerCase() ||
                        Number(searchQuery) === problemId),
                  }"
                >
                  <td>
                    <router-link :to="`/course/${$route.params.name}/problem/${problemId}`" class="link">
                      {{ problemId }}
                    </router-link>
                  </td>
                  <td>
                    <div class="flex w-full items-center justify-between">
                      <span class="mr-2">{{ problemName }}</span>
                      <span
                        v-if="aiVTuber || hasAiVtuber(problemId)"
                        class="inline-flex shrink-0 items-center rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 px-2 py-0.5 text-xs font-medium text-white"
                      >
                        AI-TA
                      </span>
                    </div>
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
                sortedProblems || []
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
