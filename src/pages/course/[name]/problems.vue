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
import { useI18n } from "vue-i18n";

// hello

const session = useSession();
const rolesCanReadProblemStatus = [UserRole.Admin, UserRole.Teacher, UserRole.TA];
const route = useRoute();
const router = useRouter();

const { t: $t } = useI18n();

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

// --- Grouping Logic ---
const isGroupedView = ref(false);

const groupedProblems = computed(() => {
  if (!sortedProblems.value) return [];

  const groups: Record<string, typeof sortedProblems.value> = {};

  for (const p of sortedProblems.value) {
    // Sort tags to ensure consistency (e.g. "A,B" is same as "B,A")
    const tags = p.tags ? [...p.tags].sort() : [];
    const key = tags.length > 0 ? tags.join(", ") : $t("course.problems.uncategorized");

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(p);
  }

  // Convert map to array of objects for easier template iteration
  // Sort groups by key (Uncategorized Last? Or Alphabetical?)
  // Let's do alphabetical, but put Uncategorized at the end if we want.
  // For now, simple alphabetical key sort.
  return Object.keys(groups)
    .sort()
    .map((key) => ({
      groupName: key,
      problems: groups[key],
    }));
});

function toggleGroupView() {
  isGroupedView.value = !isGroupedView.value;
}

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
  // If in grouped view, we might not have pagination in the same way.
  // But currently Grouped View implies we show EVERYTHING or we Pagination Groups?
  // The user requirement says "maintain functionalities".
  // If Grouped View is ON, maybe we disable pagination and show all?
  // Or we paginate the LIST?
  // Let's assume Grouped View shows ALL problems for simplicity as typical for "Group By" features,
  // or checks if the found ID is visible.

  // If we are sticking to pagination in Table mode, Search finds the page.
  // In Grouped Mode, if we show all, we just scroll to it?
  // For now, let's keep the logic about "Page" for Table View.

  const indexInSortedList = sortedProblems.value.findIndex((p) => p.problemId === targetId);

  if (indexInSortedList !== -1) {
    const targetPage = Math.ceil((indexInSortedList + 1) / 10);
    // Only affect page if we aren't grouped, or if we decide to paginate groups (complex).
    // Let's assume pagination is relevant for Tabled view.
    if (!isGroupedView.value) {
      page.value = targetPage;
    }

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

// --- Delete Logic ---
// --- Delete Logic ---
const deleteModalOpen = ref(false);
const itemToDelete = ref<{ id: number; name: string } | null>(null);
const isDeleting = ref(false);

async function performDelete(id: number) {
  try {
    const res = await api.Problem.delete(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((res as any).ok) {
      if (problems.value) {
        problems.value = problems.value.filter((p) => p.problemId !== id);
      }
    }
  } catch (e) {
    console.error("Failed to delete problem:", e);
    alert("Failed to delete problem. Please try again.");
  }
}

function deleteProblem(event: MouseEvent, id: number, name: string) {
  // If Shift is held, delete immediately
  if (event.shiftKey) {
    performDelete(id);
    return;
  }
  // Otherwise open modal
  itemToDelete.value = { id, name };
  deleteModalOpen.value = true;
}

async function confirmDelete() {
  if (!itemToDelete.value) return;
  isDeleting.value = true;
  await performDelete(itemToDelete.value.id);
  isDeleting.value = false;
  deleteModalOpen.value = false;
  itemToDelete.value = null;
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
  // In Grouped View, we might be showing ALL problems or a lot of them.
  // Warning: Prefetching ALL might be heavy if there are thousands.
  // Assuming list size is reasonable (<100).
  if (isGroupedView.value) {
    // Prefetch all if reasonable size?
    // Let's prefetch all sortedProblems IDs to ensure badges work in grouped view.
    const allIds = (sortedProblems.value || []).map((p) => p.problemId);
    if (allIds.length) prefetchDetailsFor(allIds);
  } else {
    const visible = (sortedProblems.value || [])
      .slice((page.value - 1) * 10, page.value * 10)
      .map((p) => p.problemId);
    if (visible.length) prefetchDetailsFor(visible);
  }
});

watch(page, () => {
  // Only push query param if NOT in grouped view (or if we support page param in grouped view)
  if (!isGroupedView.value) {
    router.replace({ query: { page: page.value } });
  }
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
              <!-- Group By Tag Toggle -->
              <div class="tooltip mr-2" :data-tip="isGroupedView ? 'Back to Table' : 'Group By Tag'">
                <button
                  class="btn btn-sm btn-circle"
                  :class="isGroupedView ? 'btn-primary' : 'btn-ghost'"
                  @click="toggleGroupView"
                >
                  <i-uil-layer-group class="h-5 w-5" v-if="!isGroupedView" />
                  <i-uil-table class="h-5 w-5" v-else />
                </button>
              </div>
              <input
                v-model="searchQuery"
                type="text"
                maxlength="50"
                :placeholder="$t('course.problems.searchPlaceholder')"
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

          <div class="flex items-center gap-2">
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
            <!-- Normal Table View -->
            <div v-if="!isGroupedView" class="w-full">
              <table v-if="isDesktop" class="table w-full">
                <thead>
                  <tr>
                    <th
                      class="hover:bg-base-200 cursor-pointer transition-colors select-none"
                      @click="isSortDesc = !isSortDesc"
                    >
                      <div class="flex items-center gap-1">
                        {{ $t("course.problems.id") }}
                        <i-uil-angle-down v-if="isSortDesc" class="h-4 w-4" />
                        <i-uil-angle-up v-else class="h-4 w-4" />
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
                    class="hover hover-suction cursor-pointer transition-all duration-300"
                    :class="{
                      'bg-base-200':
                        searchQuery &&
                        (problemName.toLowerCase() === searchQuery.toLowerCase() ||
                          Number(searchQuery) === problemId),
                    }"
                    @click="router.push(`/course/${$route.params.name}/problem/${problemId}`)"
                  >
                    <td>
                      <router-link
                        :to="`/course/${$route.params.name}/problem/${problemId}`"
                        class="link"
                        @click.stop
                      >
                        {{ problemId }}
                      </router-link>
                    </td>
                    <td>
                      <div class="flex w-full items-center justify-between">
                        <router-link
                          :to="`/course/${$route.params.name}/problem/${problemId}`"
                          class="mr-2 no-underline hover:no-underline"
                          @click.stop
                        >
                          {{ problemName }}
                        </router-link>
                        <span
                          v-if="aiVTuber || hasAiVtuber(problemId)"
                          class="inline-flex shrink-0 items-center rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 px-2 py-0.5 text-xs font-medium text-white"
                        >
                          AI-TA
                        </span>
                      </div>
                    </td>
                    <td v-if="rolesCanReadProblemStatus.includes(session.role)">
                      <span class="badge ml-1">{{
                        status === 0 ? $t("course.problems.visible") : $t("course.problems.hidden")
                      }}</span>
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
                        @click.stop
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
                      <div class="tooltip" data-tip="Stats" @click.stop>
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
                          @click.stop
                        >
                          <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                        </router-link>
                        <router-link
                          v-if="session.isTeacher"
                          class="btn btn-ghost btn-sm btn-circle mr-1"
                          :to="`/course/${$route.params.name}/problem/${problemId}/copycat`"
                          @click.stop
                        >
                          <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                        </router-link>
                        <router-link
                          v-if="session.isTA"
                          class="btn btn-ghost btn-sm btn-circle mr-1"
                          :to="`/course/${$route.params.name}/problem/${problemId}/copycat`"
                          @click.stop
                        >
                          <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                        </router-link>
                      </div>

                      <div class="tooltip" data-tip="Edit">
                        <router-link
                          v-if="session.isAdmin"
                          class="btn btn-ghost btn-sm btn-circle"
                          :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                          @click.stop
                        >
                          <i-uil-edit class="lg:h-5 lg:w-5" />
                        </router-link>
                        <router-link
                          v-if="session.isTeacher"
                          class="btn btn-ghost btn-sm btn-circle"
                          :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                          @click.stop
                        >
                          <i-uil-edit class="lg:h-5 lg:w-5" />
                        </router-link>
                        <router-link
                          v-if="session.isTA"
                          class="btn btn-ghost btn-sm btn-circle"
                          :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                          @click.stop
                        >
                          <i-uil-edit class="lg:h-5 lg:w-5" />
                        </router-link>
                      </div>
                      <!-- Delete Button -->
                      <div v-if="session.isAdmin || session.isTeacher" class="tooltip" data-tip="Delete">
                        <button
                          class="btn btn-ghost btn-sm btn-circle text-error"
                          @click.stop="deleteProblem($event, problemId, problemName)"
                        >
                          <i-uil-trash-alt class="lg:h-5 lg:w-5" />
                        </button>
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
            </div>

            <!-- Grouped View -->
            <div v-else class="flex w-full flex-col gap-6">
              <div v-for="group in groupedProblems" :key="group.groupName" class="w-full">
                <!-- Group Header -->
                <div class="mb-2 flex items-center gap-2 px-2">
                  <i-uil-tag-alt class="text-primary h-5 w-5" />
                  <h3 class="text-lg font-bold">{{ group.groupName }}</h3>
                  <span class="badge badge-sm badge-ghost">{{ group.problems.length }}</span>
                </div>

                <!-- Group Table -->
                <div class="bg-base-100 rounded-box border-base-200 overflow-x-auto border shadow-sm">
                  <table class="table w-full">
                    <thead>
                      <tr>
                        <th>{{ $t("course.problems.id") }}</th>
                        <th>{{ $t("course.problems.name") }}</th>
                        <th v-if="rolesCanReadProblemStatus.includes(session.role)">
                          {{ $t("course.problems.status") }}
                        </th>
                        <!-- <th>{{ $t("course.problems.tags") }}</th> -->
                        <!-- Tags redundant here -->
                        <th>{{ $t("course.problems.quota") }}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="{
                          problemId,
                          problemName,
                          tags,
                          quota,
                          submitCount,
                          status,
                          aiVTuber,
                        } in group.problems"
                        :key="problemId"
                        class="hover hover-suction cursor-pointer transition-all duration-300"
                        :class="{
                          'bg-base-200':
                            searchQuery &&
                            (problemName.toLowerCase() === searchQuery.toLowerCase() ||
                              Number(searchQuery) === problemId),
                        }"
                        @click="router.push(`/course/${$route.params.name}/problem/${problemId}`)"
                      >
                        <td>
                          <router-link
                            :to="`/course/${$route.params.name}/problem/${problemId}`"
                            class="link"
                            @click.stop
                          >
                            {{ problemId }}
                          </router-link>
                        </td>
                        <td>
                          <div class="flex w-full items-center justify-between">
                            <router-link
                              :to="`/course/${$route.params.name}/problem/${problemId}`"
                              class="mr-2 no-underline hover:no-underline"
                              @click.stop
                            >
                              {{ problemName }}
                            </router-link>
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
                        <!-- <td>
                                    <span class="badge badge-info mr-1" v-for="tag in tags" :key="tag">{{ tag }}</span>
                                </td> -->
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
                            @click.stop
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
                              @click.stop
                            >
                              <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                            </router-link>
                            <router-link
                              v-if="session.isTeacher"
                              class="btn btn-ghost btn-sm btn-circle mr-1"
                              :to="`/course/${$route.params.name}/problem/${problemId}/copycat`"
                              @click.stop
                            >
                              <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                            </router-link>
                            <router-link
                              v-if="session.isTA"
                              class="btn btn-ghost btn-sm btn-circle mr-1"
                              :to="`/course/${$route.params.name}/problem/${problemId}/copycat`"
                              @click.stop
                            >
                              <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
                            </router-link>
                          </div>

                          <div class="tooltip" data-tip="Edit">
                            <router-link
                              v-if="session.isAdmin"
                              class="btn btn-ghost btn-sm btn-circle"
                              :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                              @click.stop
                            >
                              <i-uil-edit class="lg:h-5 lg:w-5" />
                            </router-link>
                            <router-link
                              v-if="session.isTeacher"
                              class="btn btn-ghost btn-sm btn-circle"
                              :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                              @click.stop
                            >
                              <i-uil-edit class="lg:h-5 lg:w-5" />
                            </router-link>
                            <router-link
                              v-if="session.isTA"
                              class="btn btn-ghost btn-sm btn-circle"
                              :to="`/course/${$route.params.name}/problem/${problemId}/edit`"
                              @click.stop
                            >
                              <i-uil-edit class="lg:h-5 lg:w-5" />
                            </router-link>
                          </div>
                          <!-- Delete Button (Grouped) -->
                          <div v-if="session.isAdmin || session.isTeacher" class="tooltip" data-tip="Delete">
                            <button
                              class="btn btn-ghost btn-sm btn-circle text-error"
                              @click.stop="deleteProblem($event, problemId, problemName)"
                            >
                              <i-uil-trash-alt class="lg:h-5 lg:w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Empty State for Grouped View if no problems -->
              <div v-if="!groupedProblems.length" class="py-10 text-center text-gray-500">
                No problems found.
              </div>
            </div>
          </template>
        </data-status-wrapper>

        <!-- Pagination for Normal View Only -->
        <div class="card-actions mt-5" v-if="!isGroupedView">
          <pagination-buttons v-model="page" :maxPage="maxPage" />
        </div>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <dialog class="modal" :class="{ 'modal-open': deleteModalOpen }">
    <div class="modal-box">
      <h3 class="text-lg font-bold">{{ $t("general.deleteConfirmTitle") }}</h3>
      <p class="py-4">
        {{ $t("general.deleteConfirmText", { name: itemToDelete?.name }) }}
        <br />
        <span class="text-error">{{ $t("general.deleteDetails") }}</span>
      </p>
      <p class="mt-2 text-xs text-gray-500">
        {{ $t("general.shiftTip") }}
      </p>
      <div class="modal-action">
        <button class="btn" @click="deleteModalOpen = false" :disabled="isDeleting">
          {{ $t("general.cancel") }}
        </button>
        <button class="btn btn-error" @click="confirmDelete" :disabled="isDeleting">
          {{ isDeleting ? "..." : $t("general.delete") }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="deleteModalOpen = false">close</button>
    </form>
  </dialog>
</template>

<style scoped>
.hover-suction {
  transform-origin: center;
  transition:
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.4s ease;
  will-change: transform, box-shadow;
}

.hover-suction:hover {
  /* Suction effect: Scale down slightly + Rotate X to look like it's tilting in + Translate Z for depth */
  transform: scale(0.98) perspective(500px) rotateX(2deg) translateY(2px);
  box-shadow: inset 0 4px 12px rgba(0, 0, 0, 0.05);
  background-color: var(--base-200, #f2f2f2);
  z-index: 10;
}
</style>
