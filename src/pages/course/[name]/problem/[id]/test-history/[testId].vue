<script setup lang="ts">
import { ref, watchEffect, onMounted, computed } from "vue";
import { useClipboard, useIntervalFn } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import { SUBMISSION_STATUS_CODE, LANG } from "@/constants";
import api, { fetcher } from "@/models/api";
import { useSession } from "@/stores/session";
import { useTitle } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import type { AxiosError } from "axios";

const session = useSession();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
useTitle(`Test History - ${route.params.testId} - ${route.params.name} | Normal OJ`);
// const router = useRouter();

// ==========================================
// Status Normalization (string -> code)
// ==========================================
const STATUS_CODE_MAP: Record<string, SubmissionStatusCodes> = {
  AC: SUBMISSION_STATUS_CODE.ACCEPTED,
  WA: SUBMISSION_STATUS_CODE.WRONG_ANSWER,
  CE: SUBMISSION_STATUS_CODE.COMPILE_ERROR,
  AE: SUBMISSION_STATUS_CODE.ANALYSIS_ERROR,
  TLE: SUBMISSION_STATUS_CODE.TIME_LIMIT_EXCEED,
  MLE: SUBMISSION_STATUS_CODE.MEMORY_LIMIT_EXCEED,
  RE: SUBMISSION_STATUS_CODE.RUNTIME_ERROR,
  JE: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
  OLE: SUBMISSION_STATUS_CODE.OUTPUT_LIMIT_EXCEED,
  PENDING: SUBMISSION_STATUS_CODE.PENDING,
  JUDGING: SUBMISSION_STATUS_CODE.PENDING,
  ERR: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
  ERROR: SUBMISSION_STATUS_CODE.JUDGE_ERROR,
  ACCEPTED: SUBMISSION_STATUS_CODE.ACCEPTED,
  "WRONG ANSWER": SUBMISSION_STATUS_CODE.WRONG_ANSWER,
  "COMPILE ERROR": SUBMISSION_STATUS_CODE.COMPILE_ERROR,
  "ANALYSIS ERROR": SUBMISSION_STATUS_CODE.ANALYSIS_ERROR,
  "TIME LIMIT EXCEED": SUBMISSION_STATUS_CODE.TIME_LIMIT_EXCEED,
  "MEMORY LIMIT EXCEED": SUBMISSION_STATUS_CODE.MEMORY_LIMIT_EXCEED,
  "RUNTIME ERROR": SUBMISSION_STATUS_CODE.RUNTIME_ERROR,
  "JUDGE ERROR": SUBMISSION_STATUS_CODE.JUDGE_ERROR,
  "OUTPUT LIMIT EXCEED": SUBMISSION_STATUS_CODE.OUTPUT_LIMIT_EXCEED,
};

function normalizeStatus(rawStatus: unknown): SubmissionStatusCodes {
  if (typeof rawStatus === "number") {
    return rawStatus as SubmissionStatusCodes;
  }
  if (typeof rawStatus === "string") {
    const trimmed = rawStatus.trim();
    if (!trimmed) return SUBMISSION_STATUS_CODE.PENDING;
    if (STATUS_CODE_MAP[trimmed] != null) return STATUS_CODE_MAP[trimmed];
    const upper = trimmed.toUpperCase();
    if (STATUS_CODE_MAP[upper] != null) return STATUS_CODE_MAP[upper];
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) return numeric as SubmissionStatusCodes;
  }
  return SUBMISSION_STATUS_CODE.PENDING;
}

function deriveStatusFromTasks(tasks?: TestTask[]): SubmissionStatusCodes | null {
  if (!tasks || tasks.length === 0) return null;
  let worst: SubmissionStatusCodes | null = null;
  for (const task of tasks) {
    const taskStatus = normalizeStatus(task.status);
    worst = worst == null ? taskStatus : Math.max(worst, taskStatus);
    if (!task.cases) continue;
    for (const taskCase of task.cases) {
      const caseStatus = normalizeStatus(taskCase.status);
      worst = worst == null ? caseStatus : Math.max(worst, caseStatus);
    }
  }
  return worst;
}

// Define test result type
type TestCase = {
  id: number;
  status: SubmissionStatusCodes;
  exec_time: number;
  memory_usage: number;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  // Store original backend indices for artifact file requests
  originalTaskIndex: number;
  originalCaseIndex: number;
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
  saStatus?: number | null;
  saMessage?: string | null;
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
  data: errorOutput,
  error: errorOutputError,
  isLoading: errorOutputLoading,
  execute: fetchErrorOutput,
} = useAxios<{ stderr: string; stdout: string }>(
  `/trial-submission/${route.params.testId}/output/0/0`,
  fetcher,
  {
    immediate: false,
  },
);

// Static Analysis Report
const {
  data: SAReport,
  error: SAError,
  isLoading: SALoading,
  execute: fetchSAReport,
} = useAxios<{ report: string; reportUrl?: string }>("", fetcher, { immediate: false });

// Problem data, used to determine static analysis config
const { data: problem, execute: fetchProblem } = useAxios<Problem>("", fetcher, { immediate: false });

// Flag to prevent multiple error output fetch calls
const errorOutputFetched = ref(false);

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
    status: normalizeStatus(response.data.status),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saStatus: (response.data as any).sa_status ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saMessage: (response.data as any).sa_message ?? null,
    runTime: Math.max(...(response.data.tasks?.map((t) => t.exec_time) ?? [0])),
    memoryUsage: Math.max(...(response.data.tasks?.map((t) => t.memory_usage) ?? [0])),
    score: response.data.score,
    languageType: response.data.language_type ?? 1,
    timestamp: new Date(response.data.timestamp).getTime(),
    code: response.data.code ?? "",
    tasks:
      response.data.tasks?.map((task, idx) => {
        // Define backend task type with cases
        const backendTask = task as {
          status: string;
          exec_time: number;
          memory_usage: number;
          score: number;
          stdout?: string;
          stderr?: string;
          cases?: Array<{
            status: string;
            exec_time: number;
            memory_usage: number;
            input?: string;
            answer?: string;
            stdout?: string;
          }>;
        };
        return {
          taskId: idx,
          exec_time: backendTask.exec_time,
          memory_usage: backendTask.memory_usage,
          score: backendTask.score,
          status: normalizeStatus(backendTask.status),
          cases:
            backendTask.cases?.map((caseData, caseIdx) => ({
              id: caseIdx,
              status: normalizeStatus(caseData.status),
              exec_time: caseData.exec_time,
              memory_usage: caseData.memory_usage,
              input: caseData.input || "",
              expectedOutput: caseData.answer || "",
              actualOutput: caseData.stdout || "",
              // Store backend's original indices
              originalTaskIndex: idx,
              originalCaseIndex: caseIdx,
            })) ?? [],
        };
      }) ?? [],
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

const { copy, copied, isSupported } = useClipboard();

const effectiveStatus = computed(() => {
  if (!testResult.value) return SUBMISSION_STATUS_CODE.PENDING;
  const normalized = normalizeStatus(testResult.value.status);
  if (normalized !== SUBMISSION_STATUS_CODE.PENDING) return normalized;
  return deriveStatusFromTasks(testResult.value.tasks) ?? normalized;
});
// Check if the problem accepts zip submissions (hide source code section for zip problems)
const isZipSubmission = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (problem.value as any)?.config?.acceptedFormat === "zip";
});

// Auto-refresh polling (every 2 seconds while status is Pending)
const { pause, resume, isActive } = useIntervalFn(() => {
  if (testResult.value != null && effectiveStatus.value === SUBMISSION_STATUS_CODE.PENDING) {
    fetchTrialSubmission().catch((err) => {
      console.error("Polling error:", err);
    });
  }
}, 2000);

const expandTasks = ref<boolean[]>([]);
const showErrorOutput = computed(() => {
  const status = effectiveStatus.value;
  return (
    status === SUBMISSION_STATUS_CODE.COMPILE_ERROR ||
    status === SUBMISSION_STATUS_CODE.ANALYSIS_ERROR ||
    status === SUBMISSION_STATUS_CODE.JUDGE_ERROR
  );
});
const saStatusBadge = computed(() => {
  if (!testResult.value || effectiveStatus.value === SUBMISSION_STATUS_CODE.PENDING) return null;
  const status = testResult.value.saStatus;
  if (status === 0) return { label: t("course.problem.test.trialHistory.saPassed"), className: "badge-success" };
  if (status === 1) return { label: t("course.problem.test.trialHistory.saFailed"), className: "badge-error" };
  if (status === null) return { label: t("course.problem.test.trialHistory.saSkipped"), className: "badge-ghost" };
  return null;
});
const errorTitle = computed(() =>
  effectiveStatus.value === SUBMISSION_STATUS_CODE.JUDGE_ERROR
    ? "Judge Error"
    : effectiveStatus.value === SUBMISSION_STATUS_CODE.ANALYSIS_ERROR
      ? "Analysis Error"
      : "Compilation Error",
);
watchEffect(() => {
  if (testResult.value != null) {
    if (testResult.value.tasks) {
      expandTasks.value = testResult.value.tasks.map(() => false);
    }
    // Stop polling when status is no longer Pending
    if (effectiveStatus.value !== SUBMISSION_STATUS_CODE.PENDING) {
      if (isActive.value) {
        console.log("Judging finished. Polling stopped.", { finalStatus: effectiveStatus.value });
        pause();
      }
      // Fetch error output for CE/JE (only once)
      if (
        (effectiveStatus.value === SUBMISSION_STATUS_CODE.COMPILE_ERROR ||
          effectiveStatus.value === SUBMISSION_STATUS_CODE.ANALYSIS_ERROR ||
          effectiveStatus.value === SUBMISSION_STATUS_CODE.JUDGE_ERROR) &&
        !errorOutputFetched.value
      ) {
        errorOutputFetched.value = true;
        fetchErrorOutput();
      }
    }
  }
});

watchEffect(() => {
  if (!problem.value) {
    fetchProblem(`/problem/view/${route.params.id}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prob = problem.value as any;
  const hasStaticAnalysis = prob?.pipeline?.staticAnalysis?.libraryRestrictions?.enabled === true;

  if (hasStaticAnalysis && testResult.value) {
    if (!SALoading.value && !SAReport.value) {
      fetchSAReport(`/trial-submission/${route.params.testId}/static-analysis`);
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
  input?: string | null; // Input from custom testcases
  expectedOutput?: string | null; // Expected output from custom testcases
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
    // Get the case to retrieve original backend indices and case data
    const task = testResult.value?.tasks[taskIndex];
    const testCase = task?.cases[caseIndex];
    const backendTaskIndex = testCase?.originalTaskIndex ?? taskIndex;
    const backendCaseIndex = testCase?.originalCaseIndex ?? caseIndex;

    const response = await api.TrialSubmission.getTrialCaseArtifactFiles(
      String(route.params.testId),
      backendTaskIndex,
      backendCaseIndex,
    );
    // Use input/answer from API response (artifact), fallback to testCase data
    // Cast response.data to include optional input/answer fields
    const artifactData = response.data as typeof response.data & {
      input?: string | null;
      answer?: string | null;
    };
    caseOutputData.value = {
      ...response.data,
      // Prefer artifact's input/answer, fallback to testCase's data
      input: artifactData.input || testCase?.input || null,
      expectedOutput: artifactData.answer || testCase?.expectedOutput || null,
    };
  } catch (err: unknown) {
    console.error("Failed to load case artifact files", err);
    const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
    caseOutputError.value =
      axiosErr?.response?.data?.message || axiosErr?.message || t("course.problem.test.trialHistory.loadArtifactError");
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
const detailModal = ref<HTMLDialogElement | null>(null);
const currentDetailData = ref<{
  title: string;
  jsonData: string;
} | null>(null);

// Close detail modal
function closeDetailModal() {
  detailModal.value?.close();
  currentDetailData.value = null;
}

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
      input: c.input || "(N/A)",
      answer: c.expectedOutput || "(N/A)",
      output: c.actualOutput || "(N/A)",
    })),
  };

  currentDetailData.value = {
    title: `Task ${taskIndex} Details`,
    jsonData: JSON.stringify(data, null, 2),
  };
  detailModal.value?.showModal();
}

// 下載 Task 結果
function downloadTaskResult(taskIndex: number) {
  // Use the task's original index from backend
  const task = testResult.value?.tasks[taskIndex];
  // For trial submissions, each frontend task maps 1:1 to backend task
  const backendTaskIndex = task?.cases[0]?.originalTaskIndex ?? taskIndex;

  // API 6a: Download entire task artifact (all cases combined)
  const trialSubmissionId = String(route.params.testId);
  const downloadUrl = `${fetcher.defaults.baseURL}${api.TrialSubmission.downloadTaskResult(
    trialSubmissionId,
    backendTaskIndex,
  )}`;

  // Trigger download by creating a temporary link
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `trial-${trialSubmissionId}-task-${taskIndex}-artifact.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 下載 Case 結果 (artifact zip)
function downloadCaseResult(taskIndex: number, caseIndex: number) {
  const task = testResult.value?.tasks[taskIndex];
  const testCase = task?.cases[caseIndex];
  if (!testCase) return;

  // Get backend indices
  const backendTaskIndex = testCase.originalTaskIndex ?? taskIndex;
  const backendCaseIndex = testCase.originalCaseIndex ?? caseIndex;

  // API 6b: Download case artifact
  const trialSubmissionId = String(route.params.testId);
  const downloadUrl = `${fetcher.defaults.baseURL}${api.TrialSubmission.downloadCaseResult(
    trialSubmissionId,
    backendTaskIndex,
    backendCaseIndex,
  )}`;

  // Trigger download by creating a temporary link
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `trial-${trialSubmissionId}-task${taskIndex}-case${caseIndex}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
const rejudgeErrorModal = ref<HTMLDialogElement | null>(null);
const rejudgeErrorMessage = ref<string>("");

async function rejudge() {
  isRejudgeLoading.value = true;
  try {
    await api.TrialSubmission.rejudge(String(route.params.testId));
    if (testResult.value) {
      testResult.value.status = SUBMISSION_STATUS_CODE.PENDING;
      testResult.value.tasks = [];
    }
    errorOutputFetched.value = false;
    if (!isActive.value) {
      resume();
    }
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosErr = err as any;
    console.error("Rejudge failed:", axiosErr);

    // Extract error message and show modal
    const statusCode = axiosErr?.response?.status;
    if (statusCode === 403) {
      rejudgeErrorMessage.value =
        axiosErr?.response?.data?.message || t("course.problem.test.trialHistory.rejudgePermissionDenied");
    } else {
      rejudgeErrorMessage.value =
        axiosErr?.response?.data?.message || axiosErr?.message || t("course.problem.test.trialHistory.rejudgeError");
    }
    rejudgeErrorModal.value?.showModal();
  } finally {
    isRejudgeLoading.value = false;
  }
}

function closeRejudgeErrorModal() {
  rejudgeErrorModal.value?.close();
  rejudgeErrorMessage.value = "";
}

// Delete functionality
const isDeleteLoading = ref(false);
const deleteErrorModal = ref<HTMLDialogElement | null>(null);
const deleteErrorMessage = ref<string>("");

async function deleteTrialSubmission() {
  if (!confirm(t("course.problem.test.trialHistory.deleteConfirmCurrent"))) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosErr = err as any;
    console.error("Delete failed:", axiosErr);

    // Extract error message and show modal
    deleteErrorMessage.value =
      axiosErr?.response?.data?.message || axiosErr?.message || t("course.problem.test.trialHistory.deleteFailed");
    deleteErrorModal.value?.showModal();
  } finally {
    isDeleteLoading.value = false;
  }
}

function closeDeleteErrorModal() {
  deleteErrorModal.value?.close();
  deleteErrorMessage.value = "";
}
</script>

<template>
  <div class="card-container pb-40">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="card-title md:text-2xl lg:text-3xl">{{ t("course.problem.test.historyModal.title") }} #{{ $route.params.testId }}</div>
          <div class="flex flex-wrap gap-2">
            <!-- Rejudge Button (only shown if user has permission) -->
            <button
              v-if="canRejudge"
              class="btn btn-warning btn-sm"
              :disabled="isRejudgeLoading"
              @click="rejudge"
            >
              <i-uil-repeat :class="['mr-1', isRejudgeLoading && 'animate-spin']" /> Rejudge
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
              <i-uil-trash-alt class="mr-1" /> {{ t("course.problem.test.trialHistory.delete") }}
            </button>
            <router-link
              :to="`/course/${route.params.name}/problem/${route.params.id}/test-history${route.query.from ? `?from=${route.query.from}` : ''}`"
              class="btn btn-sm"
            >
              <i-uil-arrow-left class="mr-1" /> {{ t("course.problem.test.trialHistory.backToList") }}
            </router-link>
            <router-link
              :to="`/course/${route.params.name}/problem/${route.params.id}`"
              class="btn btn-primary btn-sm"
            >
              <i-uil-file-alt class="mr-1" /> {{ t("course.problem.test.trialHistory.backToProblem") }}
            </router-link>
          </div>
        </div>

        <div class="divider" />

        <div class="card min-w-full rounded-none">
          <div class="card-body p-0">
            <div class="card-title md:text-xl lg:text-2xl">{{ t("course.problem.test.trialHistory.generalInfo") }}</div>
            <div class="my-1" />

            <data-status-wrapper :error="error" :is-loading="isLoading">
              <template #loading>
                <skeleton-table :col="8" :row="1" />
              </template>
              <template #data>
                <table v-if="testResult" class="table w-full">
                  <thead>
                    <tr>
                      <th>{{ t("course.problem.test.trialHistory.problem") }}</th>
                      <th>{{ t("course.problem.test.trialHistory.user") }}</th>
                      <th>{{ t("course.problem.test.trialHistory.status") }}</th>
                      <th>{{ t("course.problem.test.trialHistory.runtime") }}</th>
                      <th>{{ t("course.problem.test.trialHistory.memory") }}</th>
                      <th>{{ t("course.problem.test.trialHistory.score") }}</th>
                      <th>{{ t("course.submission.general.lang") }}</th>
                      <th>{{ t("course.problem.test.trialHistory.time") }}</th>
                      <th v-if="session.isAdmin">{{ t("course.problem.test.trialHistory.ip") }}</th>
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
                      <td><judge-status :status="effectiveStatus" /></td>
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

            <div v-if="showErrorOutput">
              <div class="card-title md:text-xl lg:text-2xl">
                <i-uil-exclamation-circle class="text-error mr-2" />
                {{ errorTitle }}
              </div>
              <div class="my-4" />
              <ui-spinner v-if="errorOutputLoading" class="mr-3 h-6 w-6" />
              <div v-else-if="errorOutputError">{{ t("course.problem.test.trialHistory.fetchErrorMessagesFailed") }}</div>
              <div v-else-if="errorOutput">
                <code-editor v-model="errorOutput.stderr" readonly />
              </div>
            </div>

            <div class="my-4" />

            <div class="flex items-center justify-between">
              <div class="card-title md:text-xl lg:text-2xl">{{ t("course.problem.test.trialHistory.testDetails") }}</div>
              <button
                v-if="testResult"
                class="btn btn-success btn-sm"
                @click="downloadAllResults"
                :title="t('course.problem.test.trialHistory.downloadAllResults')"
              >
                <i-uil-download-alt class="mr-1" /> {{ t("course.problem.test.trialHistory.downloadAllResults") }}
              </button>
            </div>
            <div class="my-1" />
            <skeleton-table v-if="!testResult" :col="5" :row="5" />
            <div v-else-if="isActive" class="flex items-center">
              <ui-spinner class="mr-3 h-6 w-6" /> {{ t("course.problem.test.trialHistory.loading") }}
            </div>
            <table
              v-else
              class="table-compact table w-full"
              v-for="(task, taskIndex) in testResult.tasks"
              :key="taskIndex"
            >
              <thead>
                <tr>
                  <th>{{ t("course.problem.test.trialHistory.task", { index: taskIndex }) }}</th>
                  <th>{{ t("course.problem.test.trialHistory.status") }}</th>
                  <th>{{ t("course.problem.test.trialHistory.runtime") }}</th>
                  <th>{{ t("course.problem.test.trialHistory.memory") }}</th>
                  <th>{{ t("course.problem.test.trialHistory.score") }}</th>
                  <th>{{ t("course.problem.test.trialHistory.actions") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{{ t("course.problem.test.trialHistory.overall") }}</td>
                  <td><judge-status :status="normalizeStatus(task.status)" /></td>
                  <td>{{ task.exec_time }} ms</td>
                  <td>{{ task.memory_usage }} KB</td>
                  <td>{{ task.score }}</td>
                  <td>
                    <div class="flex gap-1">
                      <button
                        class="btn btn-ghost btn-xs"
                        @click="openTaskDetailModal(taskIndex)"
                        :title="t('course.problem.test.trialHistory.viewDetails')"
                      >
                        <i-uil-eye />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs"
                        @click="downloadTaskResult(taskIndex)"
                        :title="t('course.problem.test.trialHistory.downloadResult')"
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
                      {{ expandTasks[taskIndex] ? t("course.problem.test.trialHistory.hideTestCases") : t("course.problem.test.trialHistory.showTestCases") }}
                    </div>
                  </td>
                </tr>
                <tr v-show="expandTasks[taskIndex]" v-for="(_case, caseIndex) in task.cases" :key="caseIndex">
                  <td>{{ taskIndex }}-{{ caseIndex }}</td>
                  <td><judge-status :status="normalizeStatus(_case.status)" /></td>
                  <td>{{ _case.exec_time }} ms</td>
                  <td>{{ _case.memory_usage }} KB</td>
                  <td>-</td>
                  <td>
                    <div class="flex gap-1">
                      <button
                        class="btn btn-ghost btn-xs"
                        @click="viewCaseOutput(taskIndex, caseIndex)"
                        :title="t('course.problem.test.trialHistory.viewDetailedOutput')"
                      >
                        <i-uil-eye />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs"
                        @click="downloadCaseResult(taskIndex, caseIndex)"
                        :title="t('course.problem.test.trialHistory.downloadResult')"
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

        <!-- Hide source section for zip submissions since they don't have meaningful source code -->
        <template v-if="!isZipSubmission">
          <skeleton-card v-if="!testResult" />
          <div v-else class="card min-w-full rounded-none">
            <div class="card-body p-0">
              <div class="card-title md:text-xl lg:text-2xl">
                {{ t("course.problem.test.trialHistory.sourceCode") }}
                <button
                  v-if="isSupported && testResult"
                  class="btn btn-info btn-xs ml-3"
                  @click="copy(testResult?.code || '')"
                >
                  {{ copied ? t("course.problem.test.trialHistory.copied") : t("course.problem.test.trialHistory.copy") }}
                </button>
              </div>
              <div class="my-1" />
              <code-editor v-model="testResult.code" readonly />
            </div>
          </div>
        </template>

        <div class="my-6" />

        <div class="card min-w-full rounded-none">
          <div class="card-body p-0">
            <div class="flex items-center gap-3">
              <div class="card-title md:text-xl lg:text-2xl">{{ t("course.problem.test.trialHistory.saReport") }}</div>
              <span v-if="saStatusBadge" :class="['badge', saStatusBadge.className]">
                {{ saStatusBadge.label }}
              </span>
            </div>
            <div class="my-1" />

            <data-status-wrapper :error="SAError as AxiosError" :is-loading="SALoading">
              <template #loading>
                <ui-spinner />
              </template>
              <template #data>
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2" v-if="SAReport?.reportUrl">
                    <a class="btn btn-sm" :href="SAReport.reportUrl" target="_blank" rel="noopener">
                      <i-uil-file-download class="mr-1" /> {{ t("course.problem.test.trialHistory.downloadReport") }}
                    </a>
                  </div>
                  <div v-if="SAReport?.report && SAReport.report.trim()">
                    <code-editor v-model="SAReport!.report" readonly />
                  </div>
                  <div v-else>
                    <span class="italic opacity-70">{{ t("course.problem.test.trialHistory.empty") }}</span>
                  </div>
                </div>
              </template>
            </data-status-wrapper>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Detail Modal -->
  <dialog ref="detailModal" class="modal">
    <div class="modal-box max-h-[90vh] max-w-5xl overflow-y-auto">
      <h3 class="text-lg font-bold">
        {{ currentDetailData?.title }}
      </h3>

      <div v-if="currentDetailData" class="py-4">
        <div class="space-y-4">
          <!-- JSON Display -->
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-semibold">JSON Data</span>
            </label>
            <div class="bg-base-200 rounded p-4">
              <pre class="font-mono text-sm whitespace-pre-wrap">{{ currentDetailData.jsonData }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Buttons -->
      <div class="modal-action justify-end gap-2">
        <button class="btn btn-success btn-sm" @click="downloadModalJson">
          <i-uil-download-alt class="mr-1" /> {{ t("course.problem.test.trialHistory.downloadJson") }}
        </button>
        <button class="btn btn-sm" @click="closeDetailModal">{{ t("course.problem.test.trialHistory.close") }}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>

  <!-- Case Output Modal -->
  <dialog ref="caseOutputModal" class="modal">
    <div class="modal-box max-h-[90vh] max-w-5xl overflow-y-auto">
      <h3 class="text-lg font-bold">
        {{ t("course.problem.test.trialHistory.caseOutput") }}
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
          <!-- Input Section -->
          <div>
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">{{ t("course.problem.test.trialHistory.input") }}</span>
            </label>
            <div v-if="caseOutputData.input === null || caseOutputData.input === undefined">
              <div class="text-base-content/60 py-2 italic">{{ t("course.problem.test.trialHistory.inputNotAvailable") }}</div>
            </div>
            <div v-else class="mt-2">
              <div v-if="caseOutputData.input.trim()">
                <code-editor v-model="caseOutputData.input" readonly />
              </div>
              <div v-else class="text-base-content/60 py-2 italic">{{ t("course.problem.test.trialHistory.empty") }}</div>
            </div>
          </div>

          <!-- Expected Output Section -->
          <div>
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">{{ t("course.problem.test.trialHistory.expectedOutput") }}</span>
            </label>
            <div v-if="caseOutputData.expectedOutput === null || caseOutputData.expectedOutput === undefined">
              <div class="text-base-content/60 py-2 italic">{{ t("course.problem.test.trialHistory.expectedNotAvailable") }}</div>
            </div>
            <div v-else class="mt-2">
              <div v-if="caseOutputData.expectedOutput.trim()">
                <code-editor v-model="caseOutputData.expectedOutput" readonly />
              </div>
              <div v-else class="text-base-content/60 py-2 italic">{{ t("course.problem.test.trialHistory.empty") }}</div>
            </div>
          </div>

          <!-- Stdout Section -->
          <div>
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">{{ t("course.problem.test.trialHistory.stdout") }}</span>
            </label>
            <div v-if="caseOutputData.stdout === null">
              <!-- File doesn't exist -->
              <div class="text-base-content/60 py-2 italic">{{ t("course.problem.test.trialHistory.fileNotExist", { file: "Stdout" }) }}</div>
            </div>
            <div v-else class="mt-2">
              <!-- File exists (could be empty string) -->
              <div v-if="caseOutputData.stdout.trim()">
                <code-editor v-model="caseOutputData.stdout" readonly />
              </div>
              <div v-else class="text-base-content/60 py-2 italic">{{ t("course.problem.test.trialHistory.empty") }}</div>
            </div>
          </div>

          <!-- Stderr Section -->
          <div class="mt-6">
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">{{ t("course.problem.test.trialHistory.stderr") }}</span>
            </label>
            <div v-if="caseOutputData.stderr === null">
              <!-- File doesn't exist -->
              <div class="text-base-content/60 py-2 italic">{{ t("course.problem.test.trialHistory.fileNotExist", { file: "Stderr" }) }}</div>
            </div>
            <div v-else class="mt-2">
              <!-- File exists (could be empty string) -->
              <div v-if="caseOutputData.stderr.trim()">
                <code-editor v-model="caseOutputData.stderr" readonly />
              </div>
              <div v-else class="text-base-content/60 py-2 italic">{{ t("course.problem.test.trialHistory.empty") }}</div>
            </div>
          </div>

          <!-- Artifact Files Section -->
          <div v-if="caseOutputData.files && Object.keys(caseOutputData.files).length > 0" class="mt-6">
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">{{ t("course.problem.test.trialHistory.artifactFiles") }}</span>
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
                  {{ t("course.problem.test.trialHistory.binaryNoPreview") }}
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
            <i-uil-angle-left class="mr-1" /> {{ t("course.problem.test.trialHistory.prevCase") }}
          </button>
          <button class="btn" :disabled="!hasNextCase" @click="navigateCase(1)">
            {{ t("course.problem.test.trialHistory.nextCase") }} <i-uil-angle-right class="ml-1" />
          </button>
        </div>
        <button class="btn" @click="closeCaseOutputModal">{{ t("course.problem.test.trialHistory.close") }}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>

  <!-- Rejudge Error Modal -->
  <dialog ref="rejudgeErrorModal" class="modal">
    <div class="modal-box">
      <h3 class="text-error text-lg font-bold">
        <i-uil-exclamation-triangle class="mr-2 inline" />
        {{ t("course.problem.test.trialHistory.rejudgeFailed") }}
      </h3>
      <p class="py-4">{{ rejudgeErrorMessage }}</p>
      <div class="modal-action">
        <button class="btn" @click="closeRejudgeErrorModal">{{ t("course.problem.test.trialHistory.close") }}</button>
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
        <button class="btn" @click="closeDeleteErrorModal">{{ t("course.problem.test.trialHistory.close") }}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>

