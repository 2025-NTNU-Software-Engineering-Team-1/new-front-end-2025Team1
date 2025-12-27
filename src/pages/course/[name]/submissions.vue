<script setup lang="ts">
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import { computed, ref, watch, watchEffect, onActivated } from "vue";
import { useIntervalFn } from "@vueuse/core";
import queryString from "query-string";
import api, { fetcher } from "@/models/api";
import { useSession } from "@/stores/session";
import { LANG, LANGUAGE_OPTIONS, SUBMISSION_STATUS_REPR, SUBMISSION_STATUS_CODE } from "@/constants";
import { formatTime } from "@/utils/formatTime";
import { timeFromNow } from "@/utils/timeFromNow";
import { useTitle, useClipboard } from "@vueuse/core";
import { useProblemSelection } from "@/composables/useProblemSelection";
import { AxiosError } from "axios";

const route = useRoute();
const router = useRouter();
const session = useSession();

useTitle(`Submissions - ${route.params.name} | Normal OJ`);

// Utility: remove empty values from an object (for query string)
function removeEmpty(obj: object) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ""));
}

// Computed: parse query from URL for pagination and filters
const routeQuery = computed<{
  page: number;
  filter: SubmissionListFilter;
}>(() => ({
  page: parseInt(route.query.page as string, 10) || 1,
  filter: {
    problemId: route.query.problemId as string,
    status: route.query.status as string,
    languageType: route.query.languageType as string,
    username: route.query.username as string,
  },
}));

// Change page (updates URL)
function mutatePage(newPage: number) {
  router.replace({
    query: {
      page: newPage,
      ...removeEmpty(routeQuery.value.filter),
    },
  });
}

// Change filter (updates URL)
function mutateFilter(newFilter: Partial<SubmissionListFilter>) {
  router.replace({
    query: {
      page: 1,
      ...removeEmpty({
        ...routeQuery.value.filter,
        ...newFilter,
      }),
    },
  });
}

// Build submissions API URL
const getSubmissionsUrl = computed(() => {
  const query: SubmissionListQuery = {
    ...routeQuery.value.filter,
    offset: (routeQuery.value.page - 1) * 10,
    count: 10,
    course: route.params.name as string,
  };
  const qs = queryString.stringify(query, { skipNull: true, skipEmptyString: true });
  return `/submission?${qs}`;
});

// Fetch submissions using VueUse + Axios
const { execute, data, error, isLoading } = useAxios<GetSubmissionListResponse>(fetcher);
watch(
  getSubmissionsUrl,
  (url) => {
    execute(url);
  },
  { immediate: true },
);

const submissions = computed(() => data.value?.submissions);
const submissionCount = computed(() => data.value?.submissionCount);
const maxPage = computed(() => {
  return submissionCount.value ? Math.ceil(submissionCount.value / 10) : 1;
});

// Only show loading skeleton on first load
const isInitialLoading = computed(() => {
  return isLoading.value && data.value == null;
});

// Check if any submissions are pending
const hasPendingSubmissions = computed(() => {
  return submissions.value?.some((sub) => sub.status === SUBMISSION_STATUS_CODE.PENDING) ?? false;
});

// Polling: auto-refresh every 2 seconds if there are pending submissions
const { pause, resume, isActive } = useIntervalFn(
  () => {
    if (submissions.value != null && !isLoading.value) {
      const url = `${getSubmissionsUrl.value}${getSubmissionsUrl.value.includes("?") ? "&" : "?"}_t=${Date.now()}`;
      execute(url);
    }
  },
  2000,
  { immediate: false },
);

// Start/stop polling based on pending submissions
watchEffect(() => {
  if (submissions.value != null) {
    if (hasPendingSubmissions.value) {
      if (!isActive.value) resume();
    } else {
      if (isActive.value) pause();
    }
  }
});

// Refresh data when page is activated (e.g., after returning from detail page)
onActivated(() => {
  if (!isLoading.value) {
    const url = `${getSubmissionsUrl.value}${getSubmissionsUrl.value.includes("?") ? "&" : "?"}_t=${Date.now()}`;
    execute(url);
  }
  if (hasPendingSubmissions.value && !isActive.value) {
    resume();
  }
});

// Problem selection and meta info
const {
  problemSelections,
  problemId2Meta,
  error: fetchProblemError,
} = useProblemSelection(route.params.name as string);

// Filter options for status, language, username
const submissionStatusCodes = Object.entries(SUBMISSION_STATUS_REPR).map(([statusCode, { label }]) => ({
  text: label,
  value: statusCode,
}));
const languageTypes = LANGUAGE_OPTIONS.map(({ text, value }) => ({
  text,
  value: value.toString(),
}));
const searchUsername = ref("");

// Clipboard copy logic
const { copy, copied, isSupported } = useClipboard();
function copySubmissionLink(path: string) {
  copy(new URL(path, window.location.origin).href);
}

// Download all submissions as a JSON file
async function downloadAllSubmissions() {
  const query: SubmissionListQuery = {
    ...routeQuery.value.filter,
    offset: 0,
    count: submissionCount.value ?? 0,
    course: route.params.name as string,
  };
  const qs = queryString.stringify(query, { skipNull: true, skipEmptyString: true });
  const url = `/submission?${qs}`;
  const { data } = await fetcher.get<GetSubmissionListResponse>(url);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const urlBlob = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = urlBlob;
  a.download = "submissions.json";
  a.click();
  URL.revokeObjectURL(urlBlob);
}

// Rejudge all submissions matching current filter
const isRejudgeAllLoading = ref(false);
async function rejudgeAll() {
  const query: SubmissionListQuery = {
    ...routeQuery.value.filter,
    offset: 0,
    count: -1,
    course: route.params.name as string,
  };
  const qs = queryString.stringify(query, { skipNull: true, skipEmptyString: true });
  const url = `/submission?${qs}`;
  let allSubmissions: SubmissionListItem[] = [];
  try {
    const { data } = await fetcher.get<GetSubmissionListResponse>(url);
    allSubmissions = data?.submissions || [];
  } catch (err) {
    console.error("Failed to fetch submissions:", err);
    alert("Failed to fetch submissions. Please try again.");
    return;
  }
  if (allSubmissions.length === 0) {
    alert("No submissions found matching the current filter.");
    return;
  }
  if (allSubmissions.length > 20) {
    const confirmed = confirm(
      `Warning: You are about to rejudge ${allSubmissions.length} submissions.\n\n` +
        `This may take a long time and put significant load on the system.\n\n` +
        `Are you sure you want to continue?`,
    );
    if (!confirmed) return;
  } else {
    const confirmed = confirm(`Are you sure you want to rejudge ${allSubmissions.length} submission(s)?`);
    if (!confirmed) return;
  }
  isRejudgeAllLoading.value = true;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  try {
    for (const submission of allSubmissions) {
      try {
        // Skip if never judged or recently sent
        if (submission.status === -2) {
          skippedCount++;
          continue;
        }
        if (submission.status === -1) {
          const submissionTime = new Date(submission.timestamp).getTime();
          const now = Date.now();
          if (now - submissionTime < 60000) {
            skippedCount++;
            continue;
          }
        }
        await api.Submission.rejudge(submission.submissionId);
        successCount++;
      } catch (err) {
        console.error(`Failed to rejudge submission ${submission.submissionId}:`, err);
        failedCount++;
      }
    }
    console.log(
      `Rejudge completed. Success: ${successCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`,
    );
    router.go(0); // Reload the list
  } catch (err) {
    console.error("Rejudge all failed:", err);
  } finally {
    isRejudgeAllLoading.value = false;
  }
}

// Delete submission by ID
const deletingIds = ref<Set<string>>(new Set());
async function deleteSubmission(id: string) {
  if (!confirm(`Are you sure you want to delete submission ${id}?`)) return;
  deletingIds.value.add(id);
  try {
    const response = await api.Submission.delete(id);
    if (response.data?.ok) {
      execute(getSubmissionsUrl.value); // Reload the list
    }
  } catch (err) {
    console.error("Delete failed:", err);
  } finally {
    deletingIds.value.delete(id);
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title justify-between">
          {{ $t("course.submissions.text") }}

          <!-- Admin/Teacher/TA actions: rejudge, download, search -->
          <div
            v-if="session.isAdmin || session.isTeacher || session.isTA"
            class="flex items-center justify-between gap-4"
          >
            <button
              class="btn btn-warning btn-sm"
              :disabled="isRejudgeAllLoading"
              @click="rejudgeAll"
            >
              <i-uil-repeat :class="['mr-1', isRejudgeAllLoading && 'animate-spin']" /> Rejudge All
            </button>
            <div class="tooltip tooltip-bottom" data-tip="Download submissions json file">
              <button class="btn btn-sm" @click="downloadAllSubmissions">
                <i-uil-file-download class="h-5 w-5" />
              </button>
            </div>
            <input
              v-model="searchUsername"
              type="text"
              placeholder="Username (exact match)"
              class="input-bordered input w-full max-w-xs"
              @keydown.enter="mutateFilter({ username: searchUsername })"
            />
          </div>
        </div>

        <div class="my-2" />
        <!-- Filters -->
        <div class="mb-4 flex items-end gap-x-4">
          <select
            :value="routeQuery.filter.problemId"
            class="select-bordered select w-full flex-1"
            @change="(event) => mutateFilter({ problemId: (event.target as HTMLSelectElement).value })"
          >
            <option value="" selected>{{ $t("course.submissions.problem") }}</option>
            <option v-for="{ text, value } in problemSelections" :value="value">{{ text }}</option>
          </select>
          <select
            :value="routeQuery.filter.status"
            class="select-bordered select w-full flex-1"
            @change="(event) => mutateFilter({ status: (event.target as HTMLSelectElement).value })"
          >
            <option value="" selected>{{ $t("course.submissions.status") }}</option>
            <option v-for="{ text, value } in submissionStatusCodes" :value="value">{{ text }}</option>
          </select>
          <select
            :value="routeQuery.filter.languageType"
            class="select-bordered select w-full flex-1"
            @change="(event) => mutateFilter({ languageType: (event.target as HTMLSelectElement).value })"
          >
            <option value="" selected>{{ $t("course.submissions.lang") }}</option>
            <option v-for="{ text, value } in languageTypes" :value="value">{{ text }}</option>
          </select>
          <div
            v-show="
              routeQuery.filter.problemId != null ||
              routeQuery.filter.status != null ||
              routeQuery.filter.languageType != null
            "
            class="btn"
            @click="mutateFilter({ problemId: '', status: '', languageType: '' })"
          >
            <i-uil-filter-slash class="mr-1" /> {{ $t("course.submissions.clear") }}
          </div>
        </div>

        <data-status-wrapper
          :error="(error as AxiosError) || (fetchProblemError as AxiosError)"
          :is-loading="isInitialLoading"
        >
          <template #loading>
            <skeleton-table :col="9" :row="5" />
          </template>
          <template #data>
            <table class="table w-full">
              <thead>
                <tr>
                  <th>{{ $t("course.submissions.table.id") }}</th>
                  <th>{{ $t("course.submissions.table.pid") }}</th>
                  <th>{{ $t("course.submissions.table.user") }}</th>
                  <th>{{ $t("course.submissions.table.result") }}</th>
                  <th>{{ $t("course.submissions.table.score") }}</th>
                  <th>{{ $t("course.submissions.table.runtime") }}</th>
                  <th>{{ $t("course.submissions.table.memory") }}</th>
                  <th>{{ $t("course.submissions.table.lang") }}</th>
                  <th>{{ $t("course.submissions.table.time") }}</th>
                  <th v-if="session.isAdmin">{{ $t("course.submissions.table.ipAddr") }}</th>
                  <th v-if="session.isTeacher">{{ $t("course.submissions.table.ipAddr") }}</th>
                  <th v-if="session.isTA">{{ $t("course.submissions.table.ipAddr") }}</th>
                  <th v-if="session.isAdmin"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="submission in submissions" :key="submission.submissionId" class="hover">
                  <td class="overflow-visible">
                    <div class="flex items-center">
                      <!-- Tooltip for submission id -->
                      <div class="tooltip tooltip-bottom" data-tip="show details">
                        <router-link
                          :to="`/course/${$route.params.name}/submission/${submission.submissionId}`"
                          class="link"
                        >
                          {{ submission.submissionId.slice(-6) }}
                        </router-link>
                      </div>
                      <div
                        v-if="isSupported"
                        class="tooltip tooltip-bottom"
                        :data-tip="copied ? 'copied!' : 'copy link'"
                      >
                        <i-uil-link
                          class="ml-2 h-4 w-4 cursor-pointer"
                          @click="
                            copySubmissionLink(
                              `/course/${$route.params.name}/submission/${submission.submissionId}`,
                            )
                          "
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div
                      class="tooltip tooltip-bottom"
                      :data-tip="problemId2Meta[submission.problemId.toString()]?.name || 'loading...'"
                    >
                      <router-link
                        :to="`/course/${$route.params.name}/problem/${submission.problemId}`"
                        class="link"
                      >
                        {{ submission.problemId }}
                      </router-link>
                    </div>
                  </td>
                  <td>
                    <div class="tooltip tooltip-bottom" :data-tip="submission.user.displayedName">
                      <span>{{ submission.user.username }}</span>
                    </div>
                  </td>
                  <td><judge-status :status="submission.status" /></td>
                  <td>{{ submission.score }}</td>
                  <td>{{ submission.runTime }} ms</td>
                  <td>{{ submission.memoryUsage }} KB</td>
                  <td>{{ LANG[submission.languageType] }}</td>
                  <td>
                    <div class="tooltip tooltip-bottom" :data-tip="formatTime(submission.timestamp)">
                      <span>{{ timeFromNow(submission.timestamp) }}</span>
                    </div>
                  </td>
                  <td v-if="session.isAdmin">{{ submission.ipAddr }}</td>
                  <td v-if="session.isTeacher">{{ submission.ipAddr }}</td>
                  <td v-if="session.isTA">{{ submission.ipAddr }}</td>
                  <td v-if="session.isAdmin">
                    <div class="tooltip" data-tip="Delete">
                      <button
                        class="btn btn-ghost btn-sm btn-circle text-error"
                        :class="{ loading: deletingIds.has(submission.submissionId) }"
                        :disabled="deletingIds.has(submission.submissionId)"
                        @click="deleteSubmission(submission.submissionId)"
                      >
                        <i-uil-trash-alt
                          v-if="!deletingIds.has(submission.submissionId)"
                          class="lg:h-5 lg:w-5"
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </data-status-wrapper>

        <div class="card-actions mt-5">
          <pagination-buttons
            :modelValue="routeQuery.page"
            :maxPage="maxPage"
            @update:modelValue="(newPage: number) => mutatePage(newPage)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Ensure DaisyUI tooltip is always on top of all layers (z-index only) */
.tooltip:before,
.tooltip:after {
  z-index: 2147483647 !important;
}

/* Make sure table and all parents don't hide overflowing tooltip */
.table,
.table *,
.card,
.card-body,
.card-container {
  overflow: visible !important;
}
</style>
