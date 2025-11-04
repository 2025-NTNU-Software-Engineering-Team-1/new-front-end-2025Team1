<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { useClipboard, useIntervalFn } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import { SUBMISSION_STATUS_CODE, LANG } from "@/constants";
import { formatTime } from "@/utils/formatTime";
import api, { fetcher } from "@/models/api";
import { useSession } from "@/stores/session";
import { useTitle } from "@vueuse/core";
import dayjs from "dayjs";

const session = useSession();
const route = useRoute();
useTitle(`Test History - ${route.params.testId} - ${route.params.name} | Normal OJ`);
const router = useRouter();

// ToDo: Replace with real API call
// const {
//   data: testResult,
//   error,
//   isLoading,
//   execute,
// } = useAxios<TestResult>(`/test-history/${route.params.id}/${route.params.testId}`, fetcher);

// Define test result type
type TestCase = {
  id: number;
  status: SubmissionStatusCodes;
  execTime: number;
  memoryUsage: number;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
};

type TestTask = {
  taskId: number;
  cases: TestCase[];
  execTime: number;
  memoryUsage: number;
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

// 假資料用於預覽
const testResult = ref<TestResult>({
  id: String(route.params.testId),
  problemId: String(route.params.id),
  user: {
    username: "student01",
    displayedName: "John Doe",
  },
  status: SUBMISSION_STATUS_CODE.WRONG_ANSWER,
  runTime: 125,
  memoryUsage: 2048,
  score: 60,
  languageType: 1, // C++
  timestamp: Date.now(),
  ipAddr: "192.168.1.100",
  code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;
    
    vector<int> arr(n);
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    
    // Find the maximum element
    int maxVal = arr[0];
    for (int i = 1; i < n; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
        }
    }
    
    cout << maxVal << endl;
    return 0;
}`,
  tasks: [
    {
      taskId: 0,
      execTime: 45,
      memoryUsage: 1024,
      score: 100,
      status: SUBMISSION_STATUS_CODE.ACCEPTED,
      cases: [
        {
          id: 0,
          status: SUBMISSION_STATUS_CODE.ACCEPTED,
          execTime: 15,
          memoryUsage: 512,
        },
        {
          id: 1,
          status: SUBMISSION_STATUS_CODE.ACCEPTED,
          execTime: 30,
          memoryUsage: 512,
        },
      ],
    },
    {
      taskId: 1,
      execTime: 80,
      memoryUsage: 1024,
      score: 20,
      status: SUBMISSION_STATUS_CODE.WRONG_ANSWER,
      cases: [
        {
          id: 0,
          status: SUBMISSION_STATUS_CODE.ACCEPTED,
          execTime: 25,
          memoryUsage: 512,
        },
        {
          id: 1,
          status: SUBMISSION_STATUS_CODE.WRONG_ANSWER,
          execTime: 55,
          memoryUsage: 512,
        },
      ],
    },
  ],
});

const error = ref(undefined);
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
  }
);

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
    execTime: `${task.execTime} ms`,
    memoryUsage: `${task.memoryUsage} KB`,
    score: task.score,
    cases: task.cases.map((c, idx) => ({
      case: idx,
      status: c.status,
      execTime: `${c.execTime} ms`,
      memoryUsage: `${c.memoryUsage} KB`,
      input: c.input || `Input data for case ${idx}`,
      answer: c.expectedOutput || `Expected output for case ${idx}`,
      output: c.actualOutput || `Actual output for case ${idx}`,
    }))
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
    execTime: `${testCase.execTime} ms`,
    memoryUsage: `${testCase.memoryUsage} KB`,
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
  const task = testResult.value?.tasks[taskIndex];
  if (!task) return;
  
  const data = {
    stage: taskIndex,
    status: task.status,
    execTime: `${task.execTime} ms`,
    memoryUsage: `${task.memoryUsage} KB`,
    score: task.score,
    cases: task.cases.map((c, idx) => ({
      case: idx,
      status: c.status,
      execTime: `${c.execTime} ms`,
      memoryUsage: `${c.memoryUsage} KB`,
      input: c.input || `Input data for case ${idx}`,
      answer: c.expectedOutput || `Expected output for case ${idx}`,
      output: c.actualOutput || `Actual output for case ${idx}`,
    }))
  };
  
  const content = JSON.stringify(data, null, 2);
  downloadFile(`task_${taskIndex}_result.json`, content, 'application/json');
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
    execTime: `${testCase.execTime} ms`,
    memoryUsage: `${testCase.memoryUsage} KB`,
    input: testCase.input || `Input data for case ${taskIndex}-${caseIndex}`,
    answer: testCase.expectedOutput || `Expected output for case ${taskIndex}-${caseIndex}`,
    output: testCase.actualOutput || `Actual output for case ${taskIndex}-${caseIndex}`,
  };
  
  const content = JSON.stringify(data, null, 2);
  downloadFile(`case_${taskIndex}_${caseIndex}_result.json`, content, 'application/json');
}

// 下載所有結果
function downloadAllResults() {
  if (!testResult.value) return;
  
  const data = {
    testId: testResult.value.id,
    problemId: testResult.value.problemId,
    user: {
      username: testResult.value.user.username,
      displayedName: testResult.value.user.displayedName,
    },
    status: testResult.value.status,
    score: testResult.value.score,
    runTime: `${testResult.value.runTime} ms`,
    memoryUsage: `${testResult.value.memoryUsage} KB`,
    language: LANG[testResult.value.languageType],
    timestamp: dayjs(testResult.value.timestamp).format('YYYY-MM-DD HH:mm:ss'),
    sourceCode: testResult.value.code,
    tasks: testResult.value.tasks.map((task, taskIdx) => ({
      stage: taskIdx,
      status: task.status,
      execTime: `${task.execTime} ms`,
      memoryUsage: `${task.memoryUsage} KB`,
      score: task.score,
      cases: task.cases.map((c, caseIdx) => ({
        case: caseIdx,
        status: c.status,
        execTime: `${c.execTime} ms`,
        memoryUsage: `${c.memoryUsage} KB`,
        input: c.input || `Input data for case ${caseIdx}`,
        answer: c.expectedOutput || `Expected output for case ${caseIdx}`,
        output: c.actualOutput || `Actual output for case ${caseIdx}`,
      }))
    }))
  };
  
  const content = JSON.stringify(data, null, 2);
  downloadFile(`test_history_${testResult.value.id}_complete.json`, content, 'application/json');
}

// 輔助函數：下載文件
function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
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
    const filename = currentDetailData.value.title
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '') + '.json';
    downloadFile(filename, currentDetailData.value.jsonData, 'application/json');
  }
}
</script>

<template>
  <div class="card-container pb-40">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="card-title md:text-2xl lg:text-3xl">
            Test History #{{ $route.params.testId }}
          </div>
          <div class="flex flex-wrap gap-2">
            <router-link
              :to="`/course/${route.params.name}/problem/${route.params.id}/test-history`"
              class="btn btn-sm"
            >
              <i-uil-arrow-left class="mr-1" /> Back to List
            </router-link>
            <router-link
              :to="`/course/${route.params.name}/problem/${route.params.id}`"
              class="btn btn-sm btn-primary"
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
                      <td>{{ dayjs(testResult.timestamp).format('YYYY-MM-DD HH:mm:ss') }}</td>
                      <td v-if="session.isAdmin">{{ testResult.ipAddr }}</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </data-status-wrapper>

            <div class="my-4" />

            <div v-if="testResult?.status === SUBMISSION_STATUS_CODE.COMPILE_ERROR">
              <div class="card-title md:text-xl lg:text-2xl">
                <i-uil-exclamation-circle class="mr-2 text-error" />
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
                class="btn btn-sm btn-success"
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
            <table v-else class="table table-compact w-full" v-for="(task, taskIndex) in testResult.tasks" :key="taskIndex">
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
                  <td>{{ task.execTime }} ms</td>
                  <td>{{ task.memoryUsage }} KB</td>
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
                      {{
                        expandTasks[taskIndex]
                          ? "Hide Test Cases"
                          : "Show Test Cases"
                      }}
                    </div>
                  </td>
                </tr>
                <tr v-show="expandTasks[taskIndex]" v-for="(_case, caseIndex) in task.cases" :key="caseIndex">
                  <td>{{ taskIndex }}-{{ caseIndex }}</td>
                  <td><judge-status :status="_case.status" /></td>
                  <td>{{ _case.execTime }} ms</td>
                  <td>{{ _case.memoryUsage }} KB</td>
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
      <div class="rounded-t-box -m-6 bg-primary p-6 text-primary-content">
        {{ currentDetailData?.title }}
      </div>
    </template>
    <template #content>
      <div v-if="currentDetailData" class="-m-6 bg-primary p-6 pt-0 text-primary-content">
        <div class="space-y-4">
          <!-- JSON Display -->
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text text-primary-content font-semibold">JSON Data</span>
            </label>
            <div class="rounded bg-base-200 p-4 text-base-content">
              <pre class="whitespace-pre-wrap text-sm font-mono">{{ currentDetailData.jsonData }}</pre>
            </div>
          </div>
        </div>

        <div class="mt-8 flex justify-end gap-2">
          <button 
            class="btn btn-sm btn-success"
            @click="downloadModalJson"
          >
            <i-uil-download-alt class="mr-1" /> Download JSON
          </button>
          <button class="btn btn-link text-primary-content" @click="isDetailModalOpen = false">
            Close
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>
</template>
