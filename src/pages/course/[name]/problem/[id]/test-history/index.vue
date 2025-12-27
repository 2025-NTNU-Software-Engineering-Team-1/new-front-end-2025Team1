<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTitle, useIntervalFn, useDocumentVisibility } from "@vueuse/core";
import api from "@/models/api";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import type { AxiosError } from "axios";
import { SUBMISSION_STATUS_CODE, LANG } from "@/constants";
import { useSession } from "@/stores/session";

const session = useSession();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useTitle(`Test History - ${route.params.id} - ${route.params.name} | Normal OJ`);

// Determine back button path based on where user came from
const getBackPath = () => {
  const from = String(route.query.from || "");
  // If came from problems list page, return to problems list
  if (from === "problems") {
    return `/course/${route.params.name}/problems`;
  }
  // Default: return to test page (when from problem detail page or test page)
  return `/course/${route.params.name}/problem/${route.params.id}/test`;
};

// Define a typed shape for the history items so TypeScript knows what properties exist
type TestHistoryItem = {
  id: number | string;
  pid: number | string;
  result: SubmissionStatusCodes;
  score: number;
  lang: string;
  timestamp: number;
  type: "public" | "custom";
};

const testHistory = ref<TestHistoryItem[]>([]);
const error = ref<AxiosError | undefined>(undefined);
const isLoading = ref(false);
const canRejudge = ref(false);

// API 4: Load trial submission history when component mounts
onMounted(async () => {
  try {
    isLoading.value = true;

    // Check rejudge permission (only for Admin/Teacher/TA)
    if (session.isAdmin || session.isTeacher || session.isTA) {
      try {
        const problemId = Number(route.params.id);
        const permResponse = await api.TrialSubmission.checkRejudgePermission(problemId);
        // API response is wrapped: { status, data: { can_rejudge } }
        canRejudge.value = (permResponse.data as { can_rejudge?: boolean })?.can_rejudge ?? false;
      } catch (err) {
        console.warn("Failed to check rejudge permission:", err);
        canRejudge.value = false;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await api.TrialSubmission.getTrialHistory(Number(route.params.id));

    if (response.status === "ok") {
      error.value = undefined;
      // Convert backend response to frontend format
      testHistory.value =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response.data?.history?.map((item: any) => ({
          id: item.trial_submission_id,
          pid: item.problem_Id,
          result: mapStatusToCode(item.status),
          score: item.score,
          lang: LANG[item.language_type] || "Unknown",
          timestamp: Number(item.timestamp),
          type: item.use_default_case === false ? "custom" : "public",
        })) || [];
      console.log("Loaded trial history:", testHistory.value);
    } else {
      console.error("Failed to load trial history:", response.data.message);
      error.value = new Error(response.message) as AxiosError;
    }
  } catch (err) {
    console.error("Error loading trial history:", err);
    error.value = err as AxiosError;
  } finally {
    isLoading.value = false;
  }
});

// Helper function to map backend status string to status code
function mapStatusToCode(status: string): SubmissionStatusCodes {
  const statusMap: { [key: string]: SubmissionStatusCodes } = {
    AC: SUBMISSION_STATUS_CODE.ACCEPTED,
    WA: SUBMISSION_STATUS_CODE.WRONG_ANSWER,
    CE: SUBMISSION_STATUS_CODE.COMPILE_ERROR,
    AE: SUBMISSION_STATUS_CODE.ANALYSIS_ERROR,
    TLE: SUBMISSION_STATUS_CODE.TIME_LIMIT_EXCEED,
    MLE: SUBMISSION_STATUS_CODE.MEMORY_LIMIT_EXCEED,
    RE: SUBMISSION_STATUS_CODE.RUNTIME_ERROR,
    JE: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
    OLE: SUBMISSION_STATUS_CODE.OUTPUT_LIMIT_EXCEED,
    Pending: SUBMISSION_STATUS_CODE.PENDING,
    Judging: SUBMISSION_STATUS_CODE.PENDING, // 評測中也顯示為 Pending
    err: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
    Error: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
    ERROR: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
  };
  return statusMap[status] ?? SUBMISSION_STATUS_CODE.PENDING; // 預設為 Pending 而非 JE
}

// Auto-refresh: Check if any items are pending
const hasPendingItems = computed(() =>
  testHistory.value.some((item) => item.result === SUBMISSION_STATUS_CODE.PENDING),
);

// Document visibility for pause/resume polling
const visibility = useDocumentVisibility();

// Fetch history data (reusable for polling)
async function fetchHistory() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await api.TrialSubmission.getTrialHistory(Number(route.params.id));
    if (response.status === "ok") {
      testHistory.value =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response.data?.history?.map((item: any) => ({
          id: item.trial_submission_id,
          pid: item.problem_Id,
          result: mapStatusToCode(item.status),
          score: item.score,
          lang: LANG[item.language_type] || "Unknown",
          timestamp: Number(item.timestamp),
          type: item.use_default_case === false ? "custom" : "public",
        })) || [];
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

// Auto-refresh polling (every 3 seconds when there are pending items and page is visible)
const { pause, resume, isActive } = useIntervalFn(
  () => {
    if (hasPendingItems.value && visibility.value === "visible") {
      fetchHistory();
    }
  },
  3000,
  { immediate: false },
);

// Watch for pending items and auto start/stop polling
watchEffect(() => {
  if (hasPendingItems.value && visibility.value === "visible") {
    if (!isActive.value) {
      console.log("Starting polling - pending items detected");
      resume();
    }
  } else {
    if (isActive.value) {
      console.log("Stopping polling - no pending items or page hidden");
      pause();
    }
  }
});

// Cleanup on unmount
onUnmounted(() => {
  pause();
});

function viewTestDetail(testId: string | number) {
  const targetPath = `/course/${route.params.name}/problem/${route.params.id}/test-history/${testId}`;
  console.log("Navigating to:", targetPath);
  router.push(targetPath);
}

// Rejudge All functionality
const isRejudgeAllLoading = ref(false);
async function rejudgeAll() {
  const problemId = Number(route.params.id);
  if (!confirm(t("course.problem.test.trialHistory.rejudgeAllConfirm", { id: String(problemId) }))) {
    return;
  }
  isRejudgeAllLoading.value = true;
  try {
    await api.TrialSubmission.rejudgeAll(problemId);
    testHistory.value = testHistory.value.map((item) => ({
      ...item,
      result: SUBMISSION_STATUS_CODE.PENDING,
    }));
  } catch (err) {
    console.error("Rejudge all failed:", err);
  } finally {
    isRejudgeAllLoading.value = false;
  }
}

// Delete functionality
const deletingIds = ref<Set<string | number>>(new Set());
const deleteErrorModal = ref<HTMLDialogElement | null>(null);
const deleteErrorMessage = ref<string>("");
async function deleteTrialSubmission(id: string | number, event: Event) {
  event.stopPropagation(); // Prevent row click navigation

  if (!confirm(t("course.problem.test.trialHistory.deleteConfirm", { id: String(id) }))) {
    return;
  }

  deletingIds.value.add(id);
  try {
    const response = await api.TrialSubmission.delete(String(id));
    // API response is wrapped: { status, message, data: { ok } }
    const responseData = response.data as { ok?: boolean };
    if (responseData?.ok) {
      // Remove from local list
      testHistory.value = testHistory.value.filter((item) => item.id !== id);
    }
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosErr = err as any;
    console.error("Delete failed:", axiosErr);
    deleteErrorMessage.value =
      axiosErr?.response?.data?.message || axiosErr?.message || "Failed to delete trial submission.";
    deleteErrorModal.value?.showModal();
  } finally {
    deletingIds.value.delete(id);
  }
}

function closeDeleteErrorModal() {
  deleteErrorModal.value?.close();
  deleteErrorMessage.value = "";
}

// Delete all trial submissions
const isDeleteAllLoading = ref(false);
const deleteAllModal = ref<HTMLDialogElement | null>(null);

function prepareDeleteAllTrials() {
  if (testHistory.value.length === 0) {
    alert("No trial submissions to delete.");
    return;
  }
  deleteAllModal.value?.showModal();
}

async function confirmDeleteAllTrials() {
  isDeleteAllLoading.value = true;
  try {
    const result = await api.TrialSubmission.deleteAll(Number(route.params.id));
    alert(`Deleted ${result.data.data.deleted} trial submissions.`);
    deleteAllModal.value?.close();
    testHistory.value = [];
  } catch (err) {
    console.error("Delete all failed:", err);
    alert("Delete all failed.");
  } finally {
    isDeleteAllLoading.value = false;
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="card-title">{{ t("course.problem.test.historyModal.title") }}</div>
          <div class="flex gap-2">
            <!-- Rejudge All Button (only shown if user has permission) -->
            <button
              v-if="canRejudge"
              class="btn btn-warning btn-sm"
              :disabled="isRejudgeAllLoading || testHistory.length === 0"
              @click="rejudgeAll"
            >
              <i-uil-repeat :class="['mr-1', isRejudgeAllLoading && 'animate-spin']" /> Rejudge All
            </button>
            <button
              v-if="canRejudge"
              class="btn btn-outline btn-error btn-sm"
              :disabled="isDeleteAllLoading || testHistory.length === 0"
              @click="prepareDeleteAllTrials"
            >
              <i-uil-trash-alt :class="['mr-1', isDeleteAllLoading && 'animate-spin']" /> Delete All
            </button>
            <router-link :to="getBackPath()" class="btn btn-sm">
              <i-uil-arrow-left class="mr-1" />
              {{ t("course.problem.test.back") }}
            </router-link>
          </div>
        </div>

        <div class="divider"></div>

        <data-status-wrapper :error="error" :is-loading="isLoading">
          <template #loading>
            <skeleton-table />
          </template>
          <template #data>
            <div class="overflow-x-auto">
              <table class="table w-full">
                <thead>
                  <tr>
                    <th>{{ t("course.problem.test.historyModal.table.id") }}</th>
                    <th class="text-center">{{ t("course.problem.test.trialHistory.type") }}</th>
                    <th>PID</th>
                    <th>{{ t("course.problem.test.historyModal.table.result") }}</th>
                    <th>{{ t("course.problem.test.historyModal.table.score") }}</th>
                    <th>{{ t("course.submission.general.lang") }}</th>
                    <th>{{ t("course.problem.test.historyModal.table.time") }}</th>
                    <th v-if="canRejudge"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in testHistory"
                    :key="item.id"
                    class="hover:bg-base-200 cursor-pointer"
                    @click="viewTestDetail(item.id)"
                  >
                    <td>
                      <router-link
                        :to="`/course/${route.params.name}/problem/${route.params.id}/test-history/${item.id}`"
                        class="link"
                      >
                        {{ item.id }}
                      </router-link>
                    </td>
                    <td class="text-center">
                      <span
                        :class="['badge badge-sm', item.type === 'public' ? 'badge-info' : 'badge-warning']"
                      >
                        {{
                          item.type === "public"
                            ? t("course.problem.test.trialHistory.public")
                            : t("course.problem.test.trialHistory.custom")
                        }}
                      </span>
                    </td>
                    <td>{{ item.pid }}</td>
                    <td><judge-status :status="item.result" /></td>
                    <td>{{ item.score }}</td>
                    <td>{{ item.lang }}</td>
                    <td>{{ dayjs(item.timestamp).format("YYYY-MM-DD HH:mm:ss") }}</td>
                    <td v-if="canRejudge">
                      <div class="tooltip" data-tip="Delete">
                        <button
                          class="btn btn-ghost btn-sm btn-circle text-error"
                          :class="{ loading: deletingIds.has(item.id) }"
                          :disabled="deletingIds.has(item.id)"
                          @click="deleteTrialSubmission(item.id, $event)"
                        >
                          <i-uil-trash-alt v-if="!deletingIds.has(item.id)" class="lg:h-5 lg:w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </data-status-wrapper>
      </div>
    </div>
  </div>

  <!-- Delete All Confirmation Modal -->
  <dialog ref="deleteAllModal" class="modal">
    <div class="modal-box">
      <h3 class="text-error text-lg font-bold">
        {{ t("course.problem.test.trialHistory.deleteAllTitle") }}
      </h3>
      <p class="py-4">
        {{ t("course.problem.test.trialHistory.deleteAllConfirm") }}
      </p>
      <div class="modal-action">
        <button class="btn" @click="deleteAllModal?.close()">
          {{ t("common.cancel") }}
        </button>
        <button
          class="btn btn-error"
          :class="{ loading: isDeleteAllLoading }"
          @click="confirmDeleteAllTrials"
        >
          {{ t("common.confirm") }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>

  <!-- Delete Error Modal -->
  <dialog ref="deleteErrorModal" class="modal">
    <div class="modal-box">
      <h3 class="text-error text-lg font-bold">
        <i-uil-exclamation-triangle class="mr-2 inline" />
        {{ t("course.problem.test.trialHistory.deleteFailed") }}
      </h3>
      <p class="py-4">{{ deleteErrorMessage }}</p>
      <div class="modal-action">
        <button class="btn" @click="closeDeleteErrorModal">
          {{ t("course.problem.test.trialHistory.close") }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
