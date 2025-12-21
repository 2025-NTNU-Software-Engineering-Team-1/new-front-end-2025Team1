<script setup lang="ts">
import { ref, watchEffect, onMounted } from "vue";
import { useClipboard, useIntervalFn } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute } from "vue-router";
import { SUBMISSION_STATUS_CODE, LANG } from "@/constants";
import api, { fetcher } from "@/models/api";
import { useSession } from "@/stores/session";
import { useTitle } from "@vueuse/core";
import dayjs from "dayjs";

const session = useSession();
const route = useRoute();
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

// API 5: Load trial submission details when component mounts
onMounted(async () => {
  try {
    isLoading.value = true;
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
      languageType: 1, // TODO: Get from backend
      timestamp: new Date(response.data.timestamp).getTime(),
      code: "", // TODO: Get code from backend
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

const { pause, isActive } = useIntervalFn(() => {
  // if (testResult.value != null) {
  //   execute();
  // }
}, 2000);

const expandTasks = ref<boolean[]>([]);
watchEffect(() => {
  if (testResult.value != null) {
    if (testResult.value.tasks) {
      expandTasks.value = testResult.value.tasks.map(() => false);
    }
    if (testResult.value.status !== SUBMISSION_STATUS_CODE.PENDING) {
      pause();
      if (testResult.value.status === SUBMISSION_STATUS_CODE.COMPILE_ERROR) {
        fetchCEOutput();
      }
    }
  }
});

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
</script>

<template>
  <div class="card-container pb-40">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="card-title md:text-2xl lg:text-3xl">Test History #{{ $route.params.testId }}</div>
          <div class="flex flex-wrap gap-2">
            <router-link
              :to="`/course/${route.params.name}/problem/${route.params.id}/test-history`"
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
                        @click="openCaseDetailModal(taskIndex, caseIndex)"
                        title="View Details"
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
            <div class="rounded bg-base-200 p-4 text-base-content">
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
</template>
