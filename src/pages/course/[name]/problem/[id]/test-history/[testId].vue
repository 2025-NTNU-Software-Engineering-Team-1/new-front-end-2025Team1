<script setup lang="ts">
import { ref, watchEffect, onMounted, computed } from "vue";
import { useClipboard, useIntervalFn } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import { SUBMISSION_STATUS_CODE, LANG } from "@/constants";
import api, { fetcher } from "@/models/api";
import { useSession } from "@/stores/session";
import { useTitle } from "@vueuse/core";
import dayjs from "dayjs";

const session = useSession();
const route = useRoute();
const router = useRouter();
useTitle(`Test History - ${route.params.testId} - ${route.params.name} | Normal OJ`);
// const router = useRouter();

// Define test result type
type TestCase = {
  id: number;
  status: SubmissionStatusCodes;
  exec_time: number;
  memory_usage: number;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
};

type TestTask = {
  taskId: number;
  cases: TestCase[];
  exec_time: number;
  memory_usage: number;
  score: number;
  status: SubmissionStatusCodes;
};

type TestResult = {
  id: string;
  problemId: string | number;
  user: {
    username: string;
    displayedName: string;
  };
  status: SubmissionStatusCodes;
  runTime: number;
  memoryUsage: number;
  score: number;
  languageType: number;
  timestamp: number;
  code: string;
  tasks: TestTask[];
  ipAddr?: string;
};

const testResult = ref<TestResult | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const error = ref<any>(undefined);
const isLoading = ref(false);
const canRejudge = ref(false);

const {
  data: CEOutput,
  error: CEError,
  isLoading: CELoading,
  execute: fetchCEOutput,
} = useAxios<{ stderr: string; stdout: string }>(
  `/test-history/${route.params.id}/${route.params.testId}/output/0/0`,
  fetcher,
  {
    immediate: false,
  },
);

// Fetch trial submission data (used for both initial load and polling)
async function fetchTrialSubmission() {
  const response = await api.TrialSubmission.getTrialSubmission(String(route.params.testId));

  // Convert backend response to frontend format
  testResult.value = {
    id: response.data.trial_submission_id,
    problemId: route.params.id as string,
    user: {
      username: session.username || "Unknown",
      displayedName: session.displayedName || "Unknown",
    },
    status: mapStatusToCode(response.data.status),
    runTime: Math.max(...(response.data.tasks?.map((t) => t.exec_time) ?? [0])),
    memoryUsage: Math.max(...(response.data.tasks?.map((t) => t.memory_usage) ?? [0])),
    score: response.data.score,
    languageType: response.data.language_type ?? 1,
    timestamp: new Date(response.data.timestamp).getTime(),
    code: response.data.code ?? "",
    tasks:
      response.data.tasks?.map((task, idx) => ({
        taskId: idx,
        exec_time: task.exec_time,
        memory_usage: task.memory_usage,
        score: task.score,
        status: mapStatusToCode(task.status),
        cases: [
          {
            id: 0,
            status: mapStatusToCode(task.status),
            exec_time: task.exec_time,
            memory_usage: task.memory_usage,
            input: "",
            expectedOutput: "",
            actualOutput: task.stdout,
          },
        ],
      })) ?? [],
  };
}

// API 5: Load trial submission details when component mounts
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

    await fetchTrialSubmission();
    console.log("Loaded trial submission details:", testResult.value);
  } catch (err) {
    console.error("Error loading trial submission details:", err);
    error.value = err;
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
  };
  return statusMap[status] ?? SUBMISSION_STATUS_CODE.PENDING;
}

const { copy, copied, isSupported } = useClipboard();

// Auto-refresh polling (every 2 seconds while status is Pending)
const { pause, isActive } = useIntervalFn(() => {
  if (testResult.value != null && testResult.value.status === SUBMISSION_STATUS_CODE.PENDING) {
    fetchTrialSubmission().catch((err) => {
      console.error("Polling error:", err);
    });
  }
}, 2000);

const expandTasks = ref<boolean[]>([]);
watchEffect(() => {
  if (testResult.value != null) {
    if (testResult.value.tasks) {
      expandTasks.value = testResult.value.tasks.map(() => false);
    }
    // Stop polling when status is no longer Pending
    if (testResult.value.status !== SUBMISSION_STATUS_CODE.PENDING) {
      if (isActive.value) {
        console.log("Judging finished. Polling stopped.", { finalStatus: testResult.value.status });
        pause();
      }
      // Fetch CE output if compile error
      if (testResult.value.status === SUBMISSION_STATUS_CODE.COMPILE_ERROR) {
        fetchCEOutput();
      }
    }
  }
});

// ==========================================
// View Case Output Feature
// ==========================================
type ArtifactFile = {
  type: "text" | "image" | "binary";
  content: string;
  extension: string;
  mimeType?: string;
};

type CaseArtifactData = {
  stdout: string | null; // null means file doesn't exist, '' means empty file
  stderr: string | null;
  files: Record<string, ArtifactFile>;
};

const caseOutputModal = ref<HTMLDialogElement | null>(null);
const caseOutputLoading = ref(false);
const caseOutputError = ref<string | null>(null);
const caseOutputData = ref<CaseArtifactData | null>(null);
const currentViewingCase = ref<{ taskIndex: number; caseIndex: number } | null>(null);

async function viewCaseOutput(taskIndex: number, caseIndex: number) {
  currentViewingCase.value = { taskIndex, caseIndex };
  caseOutputLoading.value = true;
  caseOutputError.value = null;
  caseOutputModal.value?.showModal();

  try {
    const response = await api.TrialSubmission.getTrialCaseArtifactFiles(
      String(route.params.testId),
      taskIndex,
      caseIndex,
    );
    caseOutputData.value = response.data;
  } catch (err: unknown) {
    console.error("Failed to load case artifact files", err);
    const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
    caseOutputError.value =
      axiosErr?.response?.data?.message || axiosErr?.message || "Failed to load artifact files";
  } finally {
    caseOutputLoading.value = false;
  }
}

function closeCaseOutputModal() {
  caseOutputModal.value?.close();
  caseOutputData.value = null;
  caseOutputError.value = null;
  currentViewingCase.value = null;
}

// Case Navigation
const hasNextCase = computed(() => {
  if (!currentViewingCase.value || !testResult.value) return false;
  const { taskIndex, caseIndex } = currentViewingCase.value;
  const tasks = testResult.value.tasks;
  if (caseIndex + 1 < tasks[taskIndex].cases.length) return true;
  return taskIndex + 1 < tasks.length;
});

const hasPrevCase = computed(() => {
  if (!currentViewingCase.value || !testResult.value) return false;
  const { taskIndex, caseIndex } = currentViewingCase.value;
  if (caseIndex > 0) return true;
  return taskIndex > 0;
});

function navigateCase(direction: 1 | -1) {
  if (!currentViewingCase.value || !testResult.value) return;

  const { taskIndex, caseIndex } = currentViewingCase.value;
  const tasks = testResult.value.tasks;

  if (direction === 1) {
    // Next
    if (caseIndex + 1 < tasks[taskIndex].cases.length) {
      viewCaseOutput(taskIndex, caseIndex + 1);
    } else if (taskIndex + 1 < tasks.length) {
      viewCaseOutput(taskIndex + 1, 0);
    }
  } else {
    // Prev
    if (caseIndex - 1 >= 0) {
      viewCaseOutput(taskIndex, caseIndex - 1);
    } else if (taskIndex - 1 >= 0) {
      const prevTaskCases = tasks[taskIndex - 1].cases;
      viewCaseOutput(taskIndex - 1, prevTaskCases.length - 1);
    }
  }
}

// Helper function to get file icon class based on extension
function getFileIconClass(ext: string): string {
  const extLower = ext.toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"].includes(extLower)) {
    return "i-uil-image";
  }
  if ([".md"].includes(extLower)) {
    return "i-uil-file-alt";
  }
  if ([".txt", ".log"].includes(extLower)) {
    return "i-uil-file";
  }
  return "i-uil-file";
}

// Modal state
const isDetailModalOpen = ref(false);
const currentDetailData = ref<{
  title: string;
  jsonData: string;
} | null>(null);

// 打開 Task 詳細資訊模態框
function openTaskDetailModal(taskIndex: number) {
  const task = testResult.value?.tasks[taskIndex];
  if (!task) return;

  const data = {
    stage: taskIndex,
    status: task.status,
    exec_time: `${task.exec_time} ms`,
    memory_usage: `${task.memory_usage} KB`,
    score: task.score,
    cases: task.cases.map((c, idx) => ({
      case: idx,
      status: c.status,
      exec_time: `${c.exec_time} ms`,
      memory_usage: `${c.memory_usage} KB`,
      input: c.input || `Input data for case ${idx}`,
      answer: c.expectedOutput || `Expected output for case ${idx}`,
      output: c.actualOutput || `Actual output for case ${idx}`,
    })),
  };

  currentDetailData.value = {
    title: `Task ${taskIndex} Details`,
    jsonData: JSON.stringify(data, null, 2),
  };
  isDetailModalOpen.value = true;
}

// 打開 Case 詳細資訊模態框
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function openCaseDetailModal(taskIndex: number, caseIndex: number) {
  const task = testResult.value?.tasks[taskIndex];
  const testCase = task?.cases[caseIndex];
  if (!testCase) return;

  const data = {
    stage: taskIndex,
    case: caseIndex,
    status: testCase.status,
    exec_time: `${testCase.exec_time} ms`,
    memory_usage: `${testCase.memory_usage} KB`,
    input: testCase.input || `Input data for case ${taskIndex}-${caseIndex}`,
    answer: testCase.expectedOutput || `Expected output for case ${taskIndex}-${caseIndex}`,
    output: testCase.actualOutput || `Actual output for case ${taskIndex}-${caseIndex}`,
  };

  currentDetailData.value = {
    title: `Task ${taskIndex} - Case ${caseIndex} Details`,
    jsonData: JSON.stringify(data, null, 2),
  };
  isDetailModalOpen.value = true;
}

// 下載 Task 結果
function downloadTaskResult(taskIndex: number) {
  // API 6: Download case result
  const trialSubmissionId = String(route.params.testId);
  const downloadUrl = `${fetcher.defaults.baseURL}${api.TrialSubmission.downloadCaseResult(
    trialSubmissionId,
    taskIndex,
  )}`;

  // Trigger download by creating a temporary link
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `trial-${trialSubmissionId}-task-${taskIndex}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 下載 Case 結果
function downloadCaseResult(taskIndex: number, caseIndex: number) {
  const task = testResult.value?.tasks[taskIndex];
  const testCase = task?.cases[caseIndex];
  if (!testCase) return;

  const data = {
    stage: taskIndex,
    case: caseIndex,
    status: testCase.status,
    exec_time: `${testCase.exec_time} ms`,
    memory_usage: `${testCase.memory_usage} KB`,
    input: testCase.input || `Input data for case ${taskIndex}-${caseIndex}`,
    answer: testCase.expectedOutput || `Expected output for case ${taskIndex}-${caseIndex}`,
    output: testCase.actualOutput || `Actual output for case ${taskIndex}-${caseIndex}`,
  };

  const content = JSON.stringify(data, null, 2);
  downloadFile(`case_${taskIndex}_${caseIndex}_result.json`, content, "application/json");
}

// 下載所有結果
function downloadAllResults() {
  if (!testResult.value) return;

  // API 7: Download all results
  const trialSubmissionId = String(route.params.testId);
  const downloadUrl = `${fetcher.defaults.baseURL}${api.TrialSubmission.downloadAllResults(
    trialSubmissionId,
  )}`;

  // Trigger download by creating a temporary link
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `trial-${trialSubmissionId}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 輔助函數：下載文件
function downloadFile(filename: string, content: string, mimeType: string = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// 從模態框下載 JSON
function downloadModalJson() {
  if (currentDetailData.value?.jsonData && currentDetailData.value?.title) {
    const filename =
      currentDetailData.value.title
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_-]/g, "") + ".json";
    downloadFile(filename, currentDetailData.value.jsonData, "application/json");
  }
}

// Rejudge functionality (follows normal submission pattern)
const isRejudgeLoading = ref(false);
async function rejudge() {
  isRejudgeLoading.value = true;
  try {
    await api.TrialSubmission.rejudge(String(route.params.testId));
    router.go(0);
  } catch (err) {
    console.error("Rejudge failed:", err);
  } finally {
    isRejudgeLoading.value = false;
  }
}

// Delete functionality
const isDeleteLoading = ref(false);
async function deleteTrialSubmission() {
  if (!confirm("Are you sure you want to delete this trial submission?")) {
    return;
  }
  isDeleteLoading.value = true;
  try {
    const response = await api.TrialSubmission.delete(String(route.params.testId));
    // API response is wrapped: { status, message, data: { ok } }
    const responseData = response.data as { ok?: boolean };
    if (responseData?.ok) {
      // Navigate back to list
      router.push(`/course/${route.params.name}/problem/${route.params.id}/test-history`);
    }
  } catch (err: unknown) {
    console.error("Delete failed:", err);
  } finally {
    isDeleteLoading.value = false;
  }
}
</script>

<template>
  <div class="card-container pb-40">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="card-title md:text-2xl lg:text-3xl">Test History #{{ $route.params.testId }}</div>
          <div class="flex flex-wrap gap-2">
            <!-- Rejudge Button (only shown if user has permission) -->
            <button
              v-if="canRejudge"
              :class="['btn btn-warning btn-sm', isRejudgeLoading && 'loading']"
              :disabled="isRejudgeLoading"
              @click="rejudge"
            >
              <i-uil-repeat class="mr-1" /> Rejudge
            </button>
            <!-- Delete Button (only shown if user has permission) -->
            <button
              v-if="canRejudge"
              :class="[
                'btn btn-outline btn-error btn-sm hover:bg-error hover:border-error hover:text-error-content',
                isDeleteLoading && 'loading',
              ]"
              :disabled="isDeleteLoading"
              @click="deleteTrialSubmission"
            >
              <i-uil-trash-alt class="mr-1" /> Delete
            </button>
            <router-link
              :to="`/course/${route.params.name}/problem/${route.params.id}/test-history${route.query.from ? `?from=${route.query.from}` : ''}`"
              class="btn btn-sm"
            >
              <i-uil-arrow-left class="mr-1" /> Back to List
            </router-link>
            <router-link
              :to="`/course/${route.params.name}/problem/${route.params.id}`"
              class="btn btn-primary btn-sm"
            >
              <i-uil-file-alt class="mr-1" /> Back to Problem
            </router-link>
          </div>
        </div>

        <div class="divider" />

        <div class="card min-w-full rounded-none">
          <div class="card-body p-0">
            <div class="card-title md:text-xl lg:text-2xl">General Information</div>
            <div class="my-1" />

            <data-status-wrapper :error="error" :is-loading="isLoading">
              <template #loading>
                <skeleton-table :col="8" :row="1" />
              </template>
              <template #data>
                <table v-if="testResult" class="table w-full">
                  <thead>
                    <tr>
                      <th>Problem</th>
                      <th>User</th>
                      <th>Status</th>
                      <th>Runtime</th>
                      <th>Memory</th>
                      <th>Score</th>
                      <th>Language</th>
                      <th>Time</th>
                      <th v-if="session.isAdmin">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <router-link
                          :to="`/course/${$route.params.name}/problem/${testResult.problemId}`"
                          class="link"
                        >
                          {{ testResult.problemId }}
                        </router-link>
                      </td>
                      <td>{{ testResult.user.username }} ({{ testResult.user.displayedName }})</td>
                      <td><judge-status :status="testResult.status" /></td>
                      <td>{{ testResult.runTime }} ms</td>
                      <td>{{ testResult.memoryUsage }} KB</td>
                      <td>{{ testResult.score }}</td>
                      <td>{{ LANG[testResult.languageType] }}</td>
                      <td>{{ dayjs(testResult.timestamp).format("YYYY-MM-DD HH:mm:ss") }}</td>
                      <td v-if="session.isAdmin">{{ testResult.ipAddr }}</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </data-status-wrapper>

            <div class="my-4" />

            <div v-if="testResult?.status === SUBMISSION_STATUS_CODE.COMPILE_ERROR">
              <div class="card-title md:text-xl lg:text-2xl">
                <i-uil-exclamation-circle class="text-error mr-2" />
                Compilation Error
              </div>
              <div class="my-4" />
              <ui-spinner v-if="CELoading" class="mr-3 h-6 w-6" />
              <div v-else-if="CEError">unable to get error messages from server 😢</div>
              <div v-else-if="CEOutput">
                <code-editor v-model="CEOutput.stderr" readonly />
              </div>
            </div>

            <div class="my-4" />

            <div class="flex items-center justify-between">
              <div class="card-title md:text-xl lg:text-2xl">Test Details</div>
              <button
                v-if="testResult"
                class="btn btn-success btn-sm"
                @click="downloadAllResults"
                title="Download All Results"
              >
                <i-uil-download-alt class="mr-1" /> Download All Results
              </button>
            </div>
            <div class="my-1" />
            <skeleton-table v-if="!testResult" :col="5" :row="5" />
            <div v-else-if="isActive" class="flex items-center">
              <ui-spinner class="mr-3 h-6 w-6" /> Loading test results...
            </div>
            <table
              v-else
              class="table-compact table w-full"
              v-for="(task, taskIndex) in testResult.tasks"
              :key="taskIndex"
            >
              <thead>
                <tr>
                  <th>Task {{ taskIndex }}</th>
                  <th>Status</th>
                  <th>Runtime</th>
                  <th>Memory</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Overall</td>
                  <td><judge-status :status="task.status" /></td>
                  <td>{{ task.exec_time }} ms</td>
                  <td>{{ task.memory_usage }} KB</td>
                  <td>{{ task.score }}</td>
                  <td>
                    <div class="flex gap-1">
                      <button
                        class="btn btn-ghost btn-xs"
                        @click="openTaskDetailModal(taskIndex)"
                        title="View Details"
                      >
                        <i-uil-eye />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs"
                        @click="downloadTaskResult(taskIndex)"
                        title="Download Result"
                      >
                        <i-uil-download-alt />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colspan="6">
                    <div
                      class="btn btn-ghost btn-sm btn-block gap-x-3"
                      @click="expandTasks[taskIndex] = !expandTasks[taskIndex]"
                    >
                      <i-uil-angle-down v-if="!expandTasks[taskIndex]" />
                      <i-uil-angle-up v-else />
                      {{ expandTasks[taskIndex] ? "Hide Test Cases" : "Show Test Cases" }}
                    </div>
                  </td>
                </tr>
                <tr v-show="expandTasks[taskIndex]" v-for="(_case, caseIndex) in task.cases" :key="caseIndex">
                  <td>{{ taskIndex }}-{{ caseIndex }}</td>
                  <td><judge-status :status="_case.status" /></td>
                  <td>{{ _case.exec_time }} ms</td>
                  <td>{{ _case.memory_usage }} KB</td>
                  <td>-</td>
                  <td>
                    <div class="flex gap-1">
                      <button
                        class="btn btn-ghost btn-xs"
                        @click="viewCaseOutput(taskIndex, caseIndex)"
                        title="View Detailed Output"
                      >
                        <i-uil-eye />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs"
                        @click="downloadCaseResult(taskIndex, caseIndex)"
                        title="Download Result"
                      >
                        <i-uil-download-alt />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="my-4" />

        <skeleton-card v-if="!testResult" />
        <div v-else class="card min-w-full rounded-none">
          <div class="card-body p-0">
            <div class="card-title md:text-xl lg:text-2xl">
              Source Code
              <button
                v-if="isSupported && testResult"
                class="btn btn-info btn-xs ml-3"
                @click="copy(testResult?.code || '')"
              >
                {{ copied ? "Copied!" : "Copy" }}
              </button>
            </div>
            <div class="my-1" />
            <code-editor v-model="testResult.code" readonly />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Detail Modal -->
  <ui-dialog v-model="isDetailModalOpen">
    <template #title>
      <div class="rounded-t-box bg-primary text-primary-content -m-6 p-6">
        {{ currentDetailData?.title }}
      </div>
    </template>
    <template #content>
      <div v-if="currentDetailData" class="bg-primary text-primary-content -m-6 p-6 pt-0">
        <div class="space-y-4">
          <!-- JSON Display -->
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text text-primary-content font-semibold">JSON Data</span>
            </label>
            <div class="bg-base-200 text-base-content rounded p-4">
              <pre class="whitespace-pre-wrap font-mono text-sm">{{ currentDetailData.jsonData }}</pre>
            </div>
          </div>
        </div>

        <div class="mt-8 flex justify-end gap-2">
          <button class="btn btn-success btn-sm" @click="downloadModalJson">
            <i-uil-download-alt class="mr-1" /> Download JSON
          </button>
          <button class="btn btn-link text-primary-content" @click="isDetailModalOpen = false">Close</button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <!-- Case Output Modal -->
  <dialog ref="caseOutputModal" class="modal">
    <div class="modal-box max-h-[90vh] max-w-5xl overflow-y-auto">
      <h3 class="text-lg font-bold">
        Case Output
        <span v-if="currentViewingCase" class="text-base font-normal opacity-70">
          ({{ currentViewingCase.taskIndex }}-{{ currentViewingCase.caseIndex }})
        </span>
      </h3>

      <div class="relative min-h-[200px] py-4">
        <!-- Loading Overlay -->
        <div
          v-if="caseOutputLoading"
          class="bg-base-100/50 absolute inset-0 z-10 flex items-center justify-center"
        >
          <ui-spinner class="h-8 w-8" />
        </div>

        <!-- Error State -->
        <div v-if="caseOutputError" class="alert alert-error mb-4">
          <i-uil-exclamation-circle />
          <span>{{ caseOutputError }}</span>
        </div>

        <!-- Content -->
        <div
          v-if="caseOutputData"
          :class="{ 'pointer-events-none opacity-50': caseOutputLoading }"
          class="space-y-6"
        >
          <!-- Stdout Section -->
          <div>
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">Standard Output (stdout)</span>
            </label>
            <div v-if="caseOutputData.stdout === null">
              <!-- File doesn't exist -->
              <div class="text-base-content/60 py-2 italic">Stdout file does not exist.</div>
            </div>
            <div v-else class="mt-2">
              <!-- File exists (could be empty string) -->
              <div v-if="caseOutputData.stdout.trim()">
                <code-editor v-model="caseOutputData.stdout" readonly />
              </div>
              <div v-else class="text-base-content/60 py-2 italic">Empty</div>
            </div>
          </div>

          <!-- Stderr Section -->
          <div class="mt-6">
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">Standard Error (stderr)</span>
            </label>
            <div v-if="caseOutputData.stderr === null">
              <!-- File doesn't exist -->
              <div class="text-base-content/60 py-2 italic">Stderr file does not exist.</div>
            </div>
            <div v-else class="mt-2">
              <!-- File exists (could be empty string) -->
              <div v-if="caseOutputData.stderr.trim()">
                <code-editor v-model="caseOutputData.stderr" readonly />
              </div>
              <div v-else class="text-base-content/60 py-2 italic">Empty</div>
            </div>
          </div>

          <!-- Artifact Files Section -->
          <div v-if="caseOutputData.files && Object.keys(caseOutputData.files).length > 0" class="mt-6">
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">Artifact Files</span>
            </label>
            <div class="mt-2 space-y-4">
              <div
                v-for="(file, fileName) in caseOutputData.files"
                :key="fileName"
                class="border-base-300 rounded-lg border p-4"
              >
                <!-- File Header -->
                <div class="mb-3 flex items-center gap-2">
                  <i :class="getFileIconClass(file.extension)" class="h-5 w-5" />
                  <span class="font-medium">{{ fileName }}</span>
                  <span class="badge badge-sm">{{ file.extension || "no ext" }}</span>
                </div>

                <!-- Image Files -->
                <div v-if="file.type === 'image'" class="bg-base-100 flex justify-center rounded p-4">
                  <img
                    :src="`data:${file.mimeType || 'image/png'};base64,${file.content}`"
                    :alt="String(fileName)"
                    style="max-width: 100%; max-height: 70vh; min-width: 200px; min-height: 200px"
                    class="border-base-300 rounded border object-contain shadow-sm"
                  />
                </div>

                <!-- Markdown Files -->
                <div v-else-if="file.extension === '.md' && file.type === 'text'" class="mt-2">
                  <!-- Fallback to code editor or assumes markdown renderer exists -->
                  <markdown-renderer :content="file.content" />
                </div>

                <!-- Text Files (including code files) -->
                <div v-else-if="file.type === 'text'" class="mt-2">
                  <code-editor v-model="file.content" readonly />
                </div>

                <!-- Binary Files (not images) -->
                <div v-else class="text-base-content/60 py-2 italic">
                  Binary file content cannot be previewed.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Buttons -->
      <div class="modal-action justify-between">
        <div class="flex gap-2">
          <button class="btn" :disabled="!hasPrevCase" @click="navigateCase(-1)">
            <i-uil-angle-left class="mr-1" /> Previous Case
          </button>
          <button class="btn" :disabled="!hasNextCase" @click="navigateCase(1)">
            Next Case <i-uil-angle-right class="ml-1" />
          </button>
        </div>
        <button class="btn" @click="closeCaseOutputModal">Close</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
