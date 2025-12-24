<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTitle } from "@vueuse/core";
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

// Define a typed shape for the history items so TypeScript knows what properties exist
type TestHistoryItem = {
  id: number | string;
  pid: number | string;
  result: SubmissionStatusCodes;
  score: number;
  lang: string;
  timestamp: number;
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
        canRejudge.value = permResponse.data?.can_rejudge ?? false;
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
    TLE: SUBMISSION_STATUS_CODE.TIME_LIMIT_EXCEED,
    MLE: SUBMISSION_STATUS_CODE.MEMORY_LIMIT_EXCEED,
    RE: SUBMISSION_STATUS_CODE.RUNTIME_ERROR,
    JE: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
    OLE: SUBMISSION_STATUS_CODE.OUTPUT_LIMIT_EXCEED,
    Pending: SUBMISSION_STATUS_CODE.PENDING,
    err: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
    Error: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
    ERROR: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
  };
  return statusMap[status] ?? SUBMISSION_STATUS_CODE.JUDGE_ERROR;
}

function viewTestDetail(testId: string | number) {
  const targetPath = `/course/${route.params.name}/problem/${route.params.id}/test-history/${testId}`;
  console.log("Navigating to:", targetPath);
  router.push(targetPath);
}

// Rejudge All functionality
const isRejudgeAllLoading = ref(false);
async function rejudgeAll() {
  const problemId = Number(route.params.id);
  if (!confirm(`Are you sure you want to rejudge ALL trial submissions for problem ${problemId}?`)) {
    return;
  }
  isRejudgeAllLoading.value = true;
  try {
    await api.TrialSubmission.rejudgeAll(problemId);
    // Reload the list
    router.go(0);
  } catch (err) {
    console.error("Rejudge all failed:", err);
  } finally {
    isRejudgeAllLoading.value = false;
  }
}

// Delete functionality
const deletingIds = ref<Set<string | number>>(new Set());
async function deleteTrialSubmission(id: string | number, event: Event) {
  event.stopPropagation(); // Prevent row click navigation
  
  if (!confirm(`Are you sure you want to delete trial submission ${id}?`)) {
    return;
  }
  
  deletingIds.value.add(id);
  try {
    const response = await api.TrialSubmission.delete(String(id));
    if (response.data?.ok) {
      // Remove from local list
      testHistory.value = testHistory.value.filter((item) => item.id !== id);
    }
  } catch (err: unknown) {
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
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="card-title">{{ t("course.problem.test.historyModal.title") }}</div>
          <div class="flex gap-2">
            <!-- Rejudge All Button (only shown if user has permission) -->
            <button
              v-if="canRejudge"
              :class="['btn btn-warning btn-sm', isRejudgeAllLoading && 'loading']"
              :disabled="isRejudgeAllLoading || testHistory.length === 0"
              @click="rejudgeAll"
            >
              <i-uil-repeat class="mr-1" /> Rejudge All
            </button>
            <router-link
              :to="backPath"
              class="btn btn-sm"
            >
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
                    <th>PID</th>
                    <th>{{ t("course.problem.test.historyModal.table.result") }}</th>
                    <th>{{ t("course.problem.test.historyModal.table.score") }}</th>
                    <th>{{ t("course.submission.general.lang") }}</th>
                    <th>{{ t("course.problem.test.historyModal.table.time") }}</th>
                    <th v-if="canRejudge">Action</th>
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
                    <td>{{ item.pid }}</td>
                    <td><judge-status :status="item.result" /></td>
                    <td>{{ item.score }}</td>
                    <td>{{ item.lang }}</td>
                    <td>{{ dayjs(item.timestamp).format("YYYY-MM-DD HH:mm:ss") }}</td>
                    <td v-if="canRejudge">
                      <button
                        class="btn btn-ghost btn-xs text-error"
                        :class="{ loading: deletingIds.has(item.id) }"
                        :disabled="deletingIds.has(item.id)"
                        @click="deleteTrialSubmission(item.id, $event)"
                        title="Delete this trial submission"
                      >
                        <i-uil-trash-alt v-if="!deletingIds.has(item.id)" />
                      </button>
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
</template>
