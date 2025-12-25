<script setup lang="ts">
import { ref, watchEffect, computed, watch } from "vue";
import { useClipboard, useIntervalFn } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import { SUBMISSION_STATUS_CODE, LANG } from "@/constants";
import { formatTime } from "@/utils/formatTime";
import api, { fetcher } from "@/models/api";
import { useSession } from "@/stores/session";
import { useTitle } from "@vueuse/core";
import type { AxiosError } from "axios";

// ==========================================
// [CONFIG] Console Debug Mode
// ==========================================
const DEBUG_MODE = 1;

// ==========================================
// Logger Utility
// ==========================================
const logger = {
  log: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Log] ${label}`, "color: #3b82f6; font-weight: bold;", data || "");
  },
  success: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Success] ${label}`, "color: #10b981; font-weight: bold;", data || "");
  },
  error: (label: string, error?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Error] ${label}`, "color: #ef4444; font-weight: bold;", error || "");
  },
  warn: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Warn] ${label}`, "color: #f59e0b; font-weight: bold;", data || "");
  },
  group: (label: string) => {
    if (!DEBUG_MODE) return;
    console.group(`%c[Group] ${label}`, "color: #8b5cf6; font-weight: bold;");
  },
  groupEnd: () => {
    if (!DEBUG_MODE) return;
    console.groupEnd();
  },
};

// ==========================================
// Setup & State
// ==========================================
const session = useSession();
const route = useRoute();
useTitle(`Submission - ${route.params.id} - ${route.params.name} | Normal OJ`);
const router = useRouter();

// Main Submission Data
const {
  data: submission,
  error,
  isLoading,
  execute,
} = useAxios<Submission>(`/submission/${route.params.id}`, fetcher);

// Compile Error Output
const {
  data: CEOutput,
  error: CEError,
  isLoading: CELoading,
  execute: fetchCEOutput,
  // If the submission CE, then all test cases are CE, thus set /output/0/0
} = useAxios<{ stderr: string; stdout: string }>(`/submission/${route.params.id}/output/0/0`, fetcher, {
  immediate: false,
});

// === Static Analysis Report ===
const {
  data: SAReport,
  error: SAError,
  isLoading: SALoading,
  execute: fetchSAReport,
} = useAxios<{ report: string; reportUrl?: string }>("", fetcher, { immediate: false });

// Problem data, used to determine artifactCollection
const {
  data: problem,
  error: problemError,
  isLoading: isProblemLoading,
  execute: fetchProblem,
} = useAxios<Problem>("", fetcher, { immediate: false });

// ==========================================
// Logic & Watchers
// ==========================================

// Log initial submission load
watch(submission, (val) => {
  if (val) logger.log("Submission Data Loaded", { id: val.submissionId, status: val.status });
});

watchEffect(() => {
  if (submission.value && !problem.value) {
    logger.log("Fetching linked Problem Config...", submission.value.problemId);
    fetchProblem(`/problem/view/${submission.value.problemId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prob = problem.value as any;
  const hasStaticAnalysis = prob?.pipeline?.staticAnalysis?.libraryRestrictions?.enabled === true;

  if (hasStaticAnalysis && submission.value) {
    // Prevent duplicate logs if already loading
    if (!SALoading.value && !SAReport.value) {
      logger.log("Static Analysis Enabled. Fetching Report...");
      fetchSAReport(`/submission/${submission.value.submissionId}/static-analysis`);
    }
  }
});

const enableCompiledBinary = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(problem.value as any)?.config?.artifactCollection?.includes("compiledBinary");
});
const enableZipArtifact = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(problem.value as any)?.config?.artifactCollection?.includes("zip");
});
const saStatusBadge = computed(() => {
  if (!submission.value || submission.value.status === SUBMISSION_STATUS_CODE.PENDING) return null;
  const status = submission.value.saStatus;
  if (status === 0) return { label: "SA Passed", className: "badge-success" };
  if (status === 1) return { label: "SA Failed", className: "badge-error" };
  if (status === null) return { label: "SA Skipped", className: "badge-ghost" };
  return null;
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const saMessage = computed(() => submission.value?.saMessage || "");

const { copy, copied, isSupported } = useClipboard();

// Polling Logic
const { pause, isActive } = useIntervalFn(() => {
  if (submission.value != null) {
    // Optional: Log polling tick (can be noisy)
    // logger.log("Polling submission status...");
    execute();
  }
}, 2000);

const expandTasks = ref<boolean[]>([]);

watchEffect(() => {
  if (submission.value != null) {
    if (submission.value.tasks) {
      expandTasks.value = submission.value.tasks.map(() => false);
    }
    if (submission.value.status !== SUBMISSION_STATUS_CODE.PENDING) {
      if (isActive.value) {
        logger.success("Judging Finished. Polling Stopped.", { finalStatus: submission.value.status });
        pause();
      }

      if (submission.value.status === SUBMISSION_STATUS_CODE.COMPILE_ERROR) {
        logger.warn("Compile Error Detected. Fetching Output...");
        fetchCEOutput();
      }
    }
  }
});

const isRejudgeLoading = ref(false);
async function rejudge() {
  logger.group("Rejudge Process");
  isRejudgeLoading.value = true;
  try {
    logger.log("Sending Rejudge Request...", route.params.id);
    await api.Submission.rejudge(route.params.id as string);
    logger.success("Rejudge request sent. Reloading page...");
    router.go(0);
  } catch (error) {
    logger.error("Rejudge Failed", error);
  } finally {
    isRejudgeLoading.value = false;
    logger.groupEnd();
  }
}

const isDeleteLoading = ref(false);
async function deleteSubmission() {
  if (!confirm("Are you sure you want to delete this submission?")) {
    return;
  }
  isDeleteLoading.value = true;
  try {
    const response = await api.Submission.delete(route.params.id as string);
    if (response.data?.ok) {
      // Navigate back to submissions list
      router.push(`/course/${route.params.name}/submissions`);
    }
  } catch (error) {
    console.error("Delete failed:", error);
  } finally {
    isDeleteLoading.value = false;
  }
}

// Download artifact (files provided by backend)
function downloadCompiledBinary() {
  logger.log("Action: Download Compiled Binary");
  const url = api.Submission.getArtifactUrl(route.params.id as string, "compiledBinary");
  window.open(url, "_blank");
}

function downloadTaskZip(taskIndex: number) {
  logger.log(`Action: Download Task Zip (Index: ${taskIndex})`);
  const url = api.Submission.getArtifactUrl(route.params.id as string, "zip", taskIndex);
  window.open(url, "_blank");
}

// ==========================================
// Score Edit Feature
// ==========================================

// Check if user can edit scores (Admin, Teacher, or TA)
const canEditScore = computed(() => {
  return session.isAdmin || session.isTeacher || session.isTA;
});

// Score Edit Modal State
const scoreEditModal = ref<HTMLDialogElement | null>(null);
const editScore = ref<number>(0);
const editReason = ref<string>("");
const editTaskIndex = ref<number | null>(null); // null = total score
const isScoreSubmitting = ref(false);

// Get max score for a task (from problem config)
const getTaskMaxScore = (taskIndex: number): number | undefined => {
  if (!problem.value || !submission.value) {
    logger.warn("getTaskMaxScore: problem or submission not loaded");
    return undefined;
  }

  // The API returns testCase as the tasks ARRAY directly (not {tasks: [...]})
  // See model/problem.py line 132: testCase='testCase__tasks'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prob = problem.value as any;
  try {
    // testCase IS the tasks array directly
    let tasks = prob?.testCase;
    logger.log("getTaskMaxScore: raw testCase", { testCase: tasks, taskIndex });

    // Fallback: if testCase is an object with tasks property
    if (tasks && !Array.isArray(tasks) && tasks.tasks) {
      tasks = tasks.tasks;
      logger.log("getTaskMaxScore: using nested tasks property");
    }

    if (tasks && Array.isArray(tasks) && taskIndex >= 0 && taskIndex < tasks.length) {
      const task = tasks[taskIndex];
      logger.log("getTaskMaxScore: task found", task);
      // Try both camelCase (from db_field) and snake_case
      const taskScore = task?.taskScore ?? task?.task_score;
      logger.log("getTaskMaxScore: taskScore", taskScore);
      if (taskScore != null && typeof taskScore === "number" && taskScore > 0) {
        return taskScore;
      }
    } else {
      logger.warn("getTaskMaxScore: tasks not array or invalid index", { tasks, taskIndex });
    }
  } catch (e) {
    // Fallback: no max limit
    logger.error("Failed to get task score limit:", e);
  }
  return undefined; // No limit
};

function openScoreEditModal(taskIndex: number | null = null) {
  if (!submission.value) return;

  editTaskIndex.value = taskIndex;
  if (taskIndex === null) {
    // Edit total score
    editScore.value = submission.value.score ?? 0;
  } else {
    // Edit task score
    editScore.value = submission.value.tasks?.[taskIndex]?.score ?? 0;
  }
  editReason.value = "";
  scoreEditModal.value?.showModal();
}

function closeScoreEditModal() {
  scoreEditModal.value?.close();
}

async function submitScoreEdit() {
  if (!submission.value) return;

  isScoreSubmitting.value = true;
  try {
    const submissionId = route.params.id as string;
    const reason = editReason.value.trim() || undefined;

    if (editTaskIndex.value === null) {
      // Edit total score
      await api.Submission.manualGrade(submissionId, editScore.value, reason);
      logger.success("Total score updated successfully");
    } else {
      // Edit task score
      await api.Submission.manualGradeTask(submissionId, editTaskIndex.value, editScore.value, reason);
      logger.success(`Task ${editTaskIndex.value} score updated successfully`);
    }

    closeScoreEditModal();

    // Refresh submission data (only once, don't trigger polling)
    // Ensure polling stays paused if submission is not pending
    const wasPending = submission.value.status === SUBMISSION_STATUS_CODE.PENDING;
    await execute();

    // If submission was not pending before, ensure polling stays paused
    if (!wasPending && submission.value && submission.value.status !== SUBMISSION_STATUS_CODE.PENDING) {
      if (isActive.value) {
        pause();
      }
    }

    // Refresh score history
    fetchScoreHistory();
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosErr = err as any;
    logger.error("Score edit failed", axiosErr);
    const errorMessage =
      axiosErr?.response?.data?.message || axiosErr?.message || "Failed to update score. Please try again.";
    alert(errorMessage);
  } finally {
    isScoreSubmitting.value = false;
  }
}

// Score History
type ScoreHistoryItem = {
  modifier: string;
  timestamp: number;
  beforeScore: number;
  afterScore: number;
  taskIndex: number | null;
  reason: string | null;
};

const scoreHistory = ref<ScoreHistoryItem[]>([]);
const isHistoryLoading = ref(false);
const showScoreHistory = ref(false);

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
  caseOutputData.value = null;
  caseOutputModal.value?.showModal();

  try {
    const response = await api.Submission.getCaseArtifactFiles(
      route.params.id as string,
      taskIndex,
      caseIndex,
    );
    caseOutputData.value = response.data;
    logger.success(`Case artifact files loaded for task ${taskIndex}, case ${caseIndex}`);
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosErr = err as any;
    logger.error("Failed to load case artifact files", axiosErr);
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

async function fetchScoreHistory() {
  if (!canEditScore.value) return;

  isHistoryLoading.value = true;
  try {
    const response = await api.Submission.getScoreHistory(route.params.id as string);
    scoreHistory.value = response.data?.history || [];
  } catch (err) {
    logger.error("Failed to fetch score history", err);
    scoreHistory.value = [];
  } finally {
    isHistoryLoading.value = false;
  }
}

function toggleScoreHistory() {
  showScoreHistory.value = !showScoreHistory.value;
  if (showScoreHistory.value && scoreHistory.value.length === 0) {
    fetchScoreHistory();
  }
}

// Fetch score history when submission loads (for users with permission)
watch(submission, (val) => {
  if (val && canEditScore.value) {
    fetchScoreHistory();
  }
});
</script>

<template>
  <div class="card-container pb-40">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-start justify-between">
          <div class="flex flex-col gap-4">
            <div class="card-title md:text-2xl lg:text-3xl">
              {{ $t("course.submission.title") }}{{ $route.params.id }}
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div v-if="enableCompiledBinary" class="btn md:btn-md" @click="downloadCompiledBinary">
              <i-uil-folder-download class="mr-1" /> Download binary
            </div>
            <button
              v-if="session.isAdmin"
              :class="['btn btn-warning md:btn-md', isRejudgeLoading && 'loading']"
              :disabled="isRejudgeLoading"
              @click="rejudge"
            >
              <i-uil-repeat class="mr-1" /> Rejudge
            </button>
            <button
              v-if="session.isAdmin"
              :class="[
                'btn btn-outline btn-error md:btn-md hover:bg-error hover:border-error hover:text-error-content',
                isDeleteLoading && 'loading',
              ]"
              :disabled="isDeleteLoading"
              @click="deleteSubmission"
            >
              <i-uil-trash-alt class="mr-1" /> Delete
            </button>
          </div>
        </div>

        <div class="divider" />

        <div class="card min-w-full rounded-none">
          <div class="card-body p-0">
            <div class="card-title md:text-xl lg:text-2xl">{{ $t("course.submission.general.title") }}</div>
            <div class="my-1" />

            <data-status-wrapper
              :error="(error || problemError) as AxiosError"
              :is-loading="isLoading || isProblemLoading"
            >
              <template #loading>
                <skeleton-table :col="8" :row="1" />
              </template>
              <template #data>
                <table v-if="submission" class="table w-full">
                  <thead>
                    <tr>
                      <th>{{ $t("course.submission.general.problem") }}</th>
                      <th>{{ $t("course.submission.general.user") }}</th>
                      <th>{{ $t("course.submission.general.status") }}</th>
                      <th>{{ $t("course.submission.general.runtime") }}</th>
                      <th>{{ $t("course.submission.general.memory") }}</th>
                      <th>{{ $t("course.submission.general.score") }}</th>
                      <th>{{ $t("course.submission.general.lang") }}</th>
                      <th>{{ $t("course.submission.general.time") }}</th>
                      <th v-if="session.isAdmin">{{ $t("course.submission.general.ipAddr") }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <router-link
                          :to="`/course/${$route.params.name}/problem/${submission.problemId}`"
                          class="link"
                        >
                          {{ submission.problemId }}
                        </router-link>
                      </td>
                      <td>{{ submission.user.username }} ({{ submission.user.displayedName }})</td>
                      <td><judge-status :status="submission.status" /></td>
                      <td>{{ submission.runTime }} ms</td>
                      <td>{{ submission.memoryUsage }} KB</td>
                      <td>
                        <span>{{ submission.score }}</span>
                        <button
                          v-if="canEditScore"
                          class="btn btn-ghost btn-xs ml-1"
                          @click="openScoreEditModal(null)"
                          title="Edit Score"
                        >
                          <i-uil-edit class="h-4 w-4" />
                        </button>
                      </td>
                      <td>{{ LANG[submission.languageType] }}</td>
                      <td>{{ formatTime(submission.timestamp) }}</td>
                      <td v-if="session.isAdmin">{{ submission.ipAddr }}</td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </data-status-wrapper>

            <div class="my-4" />

            <div v-if="submission?.status === SUBMISSION_STATUS_CODE.COMPILE_ERROR">
              <div class="card-title md:text-xl lg:text-2xl">
                <i-uil-exclamation-circle class="text-error mr-2" />
                {{ $t("course.submission.compile_error.title") }}
              </div>
              <div class="my-4" />
              <ui-spinner v-if="CELoading" class="mr-3 h-6 w-6" />
              <div v-else-if="CEError">unable to get error messages from server 😢</div>
              <div v-else>
                <code-editor v-model="CEOutput!.stderr" readonly />
              </div>
            </div>

            <div class="my-4" />

            <div class="card-title md:text-xl lg:text-2xl">{{ $t("course.submission.detail.title") }}</div>
            <div class="my-1" />
            <skeleton-table v-if="!submission" :col="5" :row="5" />
            <div v-else-if="isActive" class="flex items-center">
              <ui-spinner class="mr-3 h-6 w-6" /> {{ $t("course.submission.detail.desc") }}
            </div>

            <table
              v-else
              class="table-compact table w-full"
              v-for="(task, taskIndex) in submission.tasks"
              :key="`task-${taskIndex}`"
            >
              <thead>
                <tr>
                  <th>{{ $t("course.submission.detail.id") }} {{ taskIndex }}</th>
                  <th>{{ $t("course.submission.detail.status") }}</th>
                  <th>{{ $t("course.submission.detail.runtime") }}</th>
                  <th>{{ $t("course.submission.detail.memory") }}</th>
                  <th>{{ $t("course.submission.detail.score") }}</th>
                  <th v-if="enableZipArtifact">Artifact</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{{ $t("course.submission.detail.overall") }}</td>
                  <td><judge-status :status="task.status" /></td>
                  <td>{{ task.execTime }} ms</td>
                  <td>{{ task.memoryUsage }} KB</td>
                  <td>
                    <span>{{ task.score }}</span>
                    <button
                      v-if="canEditScore"
                      class="btn btn-ghost btn-xs ml-1"
                      @click="openScoreEditModal(taskIndex)"
                      title="Edit Task Score"
                    >
                      <i-uil-edit class="h-4 w-4" />
                    </button>
                  </td>
                  <td v-if="enableZipArtifact">
                    <button class="btn btn-ghost btn-xs" @click="downloadTaskZip(taskIndex)">
                      <i-uil-import class="mr-1" /> zip
                    </button>
                  </td>
                </tr>
                <tr>
                  <td :colspan="enableZipArtifact ? 6 : 5">
                    <div
                      class="btn btn-ghost btn-sm btn-block gap-x-3"
                      @click="expandTasks[taskIndex] = !expandTasks[taskIndex]"
                    >
                      <i-uil-angle-down v-if="!expandTasks[taskIndex]" />
                      <i-uil-angle-up v-else />
                      {{
                        expandTasks[taskIndex]
                          ? $t("course.submission.detail.result.hide")
                          : $t("course.submission.detail.result.show")
                      }}
                    </div>
                  </td>
                </tr>
                <tr
                  v-show="expandTasks[taskIndex]"
                  v-for="(_case, caseIndex) in task.cases"
                  :key="`case-${taskIndex}-${caseIndex}`"
                >
                  <td>{{ taskIndex }}-{{ caseIndex }}</td>
                  <td><judge-status :status="_case.status" /></td>
                  <td>{{ _case.execTime }} ms</td>
                  <td>{{ _case.memoryUsage }} KB</td>
                  <td>-</td>
                  <td v-if="enableZipArtifact">
                    <button
                      class="btn btn-ghost btn-xs"
                      @click="viewCaseOutput(taskIndex, caseIndex)"
                      :title="$t('course.submission.caseOutput.viewTitle')"
                    >
                      <i-uil-eye class="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="my-4" />

        <skeleton-card v-if="!submission" />
        <div v-else class="card min-w-full rounded-none">
          <div class="card-body p-0">
            <div class="card-title md:text-xl lg:text-2xl">
              {{ $t("course.submission.source.text") }}
              <button
                v-if="isSupported && submission"
                class="btn btn-info btn-xs ml-3"
                @click="copy(submission?.code || '')"
              >
                {{ copied ? $t("course.submission.source.copied") : $t("course.submission.source.copy") }}
              </button>
            </div>
            <div class="my-1" />
            <code-editor v-model="submission.code" readonly />
          </div>
        </div>

        <div class="my-6" />

        <div class="card min-w-full rounded-none">
          <div class="card-body p-0">
            <div class="flex items-center gap-3">
              <div class="card-title md:text-xl lg:text-2xl">Static Analysis Report</div>
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
                      <i-uil-file-download class="mr-1" /> Download report
                    </a>
                  </div>
                  <div v-if="SAReport?.report && SAReport.report.trim()">
                    <code-editor v-model="SAReport!.report" readonly />
                  </div>
                  <div v-else>
                    <span class="italic opacity-70">Empty</span>
                  </div>
                </div>
              </template>
            </data-status-wrapper>
          </div>
        </div>

        <!-- Score Modification History (only visible to Admin/Teacher/TA) -->
        <div v-if="canEditScore" class="my-6">
          <div class="card min-w-full rounded-none">
            <div class="card-body p-0">
              <div class="flex items-center gap-3">
                <div class="card-title md:text-xl lg:text-2xl">
                  {{ $t("course.submission.scoreHistory.title") }}
                </div>
                <button class="btn btn-ghost btn-sm" @click="toggleScoreHistory">
                  <i-uil-angle-down v-if="!showScoreHistory" />
                  <i-uil-angle-up v-else />
                  {{
                    showScoreHistory
                      ? $t("course.submission.scoreHistory.hide")
                      : $t("course.submission.scoreHistory.show")
                  }}
                </button>
                <span v-if="scoreHistory.length > 0" class="badge badge-info">
                  {{ $t("course.submission.scoreHistory.records", { count: scoreHistory.length }) }}
                </span>
              </div>

              <div v-if="showScoreHistory" class="mt-4">
                <ui-spinner v-if="isHistoryLoading" class="h-6 w-6" />
                <div v-else-if="scoreHistory.length === 0" class="italic opacity-70">
                  {{ $t("course.submission.scoreHistory.noRecords") }}
                </div>
                <table v-else class="table-compact table w-full">
                  <thead>
                    <tr>
                      <th>{{ $t("course.submission.scoreHistory.modifier") }}</th>
                      <th>{{ $t("course.submission.scoreHistory.time") }}</th>
                      <th>{{ $t("course.submission.scoreHistory.target") }}</th>
                      <th>{{ $t("course.submission.scoreHistory.before") }}</th>
                      <th>{{ $t("course.submission.scoreHistory.after") }}</th>
                      <th>{{ $t("course.submission.scoreHistory.reason") }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(record, idx) in scoreHistory" :key="idx">
                      <td>{{ record.modifier }}</td>
                      <td>{{ formatTime(record.timestamp) }}</td>
                      <td>
                        {{
                          record.taskIndex === null
                            ? $t("course.submission.scoreHistory.totalScore")
                            : $t("course.submission.scoreHistory.task", { index: record.taskIndex })
                        }}
                      </td>
                      <td>{{ record.beforeScore }}</td>
                      <td>{{ record.afterScore }}</td>
                      <td>{{ record.reason || "-" }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Score Edit Modal -->
  <dialog ref="scoreEditModal" class="modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold">
        {{
          editTaskIndex === null
            ? $t("course.submission.scoreEdit.titleTotal")
            : $t("course.submission.scoreEdit.titleTask", { index: editTaskIndex })
        }}
      </h3>

      <!-- Description -->
      <p class="py-2">{{ $t("course.submission.scoreEdit.description") }}</p>
      <ul class="mb-4 list-inside list-disc text-sm opacity-70">
        <li v-if="editTaskIndex === null">{{ $t("course.submission.scoreEdit.scoreRangeTotal") }}</li>
        <li v-else>
          {{
            getTaskMaxScore(editTaskIndex)
              ? $t("course.submission.scoreEdit.scoreRangeTask", { max: getTaskMaxScore(editTaskIndex) })
              : $t("course.submission.scoreEdit.scoreRangeTaskNoLimit")
          }}
        </li>
        <li>{{ $t("course.submission.scoreEdit.autoUpdate") }}</li>
        <li>{{ $t("course.submission.scoreEdit.recordSaved") }}</li>
        <li v-if="editTaskIndex === null" class="text-warning">
          {{ $t("course.submission.scoreEdit.totalScoreWarning") }}
        </li>
      </ul>

      <!-- Form -->
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text">{{ $t("course.submission.scoreEdit.newScore") }}</span>
        </label>
        <input
          type="number"
          v-model.number="editScore"
          min="0"
          :max="editTaskIndex === null ? 100 : getTaskMaxScore(editTaskIndex)"
          class="input input-bordered w-full"
        />
      </div>

      <div class="form-control mt-3 w-full">
        <label class="label">
          <span class="label-text">{{ $t("course.submission.scoreEdit.reason") }}</span>
        </label>
        <textarea
          v-model="editReason"
          class="textarea textarea-bordered"
          :placeholder="$t('course.submission.scoreEdit.reasonPlaceholder')"
          rows="3"
        ></textarea>
      </div>

      <!-- Buttons -->
      <div class="modal-action">
        <button class="btn" @click="closeScoreEditModal">
          {{ $t("course.submission.scoreEdit.cancel") }}
        </button>
        <button class="btn btn-success" @click="submitScoreEdit" :disabled="isScoreSubmitting">
          {{ $t("course.submission.scoreEdit.submit") }}
        </button>
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
        {{ $t("course.submission.caseOutput.title") }}
        <span v-if="currentViewingCase" class="text-base font-normal opacity-70">
          ({{ currentViewingCase.taskIndex }}-{{ currentViewingCase.caseIndex }})
        </span>
      </h3>

      <div class="py-4">
        <!-- Loading State -->
        <div v-if="caseOutputLoading" class="flex items-center justify-center py-8">
          <ui-spinner class="h-8 w-8" />
        </div>

        <!-- Error State -->
        <div v-else-if="caseOutputError" class="alert alert-error">
          <i-uil-exclamation-circle />
          <span>{{ caseOutputError }}</span>
        </div>

        <!-- Content -->
        <div v-else-if="caseOutputData" class="space-y-6">
          <!-- Stdout Section -->
          <div>
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">{{
                $t("course.submission.caseOutput.stdout")
              }}</span>
            </label>
            <div v-if="caseOutputData.stdout === null">
              <!-- File doesn't exist -->
              <div class="text-base-content/60 py-2 italic">
                {{ $t("course.submission.caseOutput.noStdout") }}
              </div>
            </div>
            <div v-else class="mt-2">
              <!-- File exists (could be empty string) -->
              <div v-if="caseOutputData.stdout.trim()">
                <code-editor v-model="caseOutputData.stdout" readonly />
              </div>
              <div v-else class="text-base-content/60 py-2 italic">
                {{ $t("course.submission.caseOutput.emptyStdout") }}
              </div>
            </div>
          </div>

          <!-- Stderr Section -->
          <div class="mt-6">
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">{{
                $t("course.submission.caseOutput.stderr")
              }}</span>
            </label>
            <div v-if="caseOutputData.stderr === null">
              <!-- File doesn't exist -->
              <div class="text-base-content/60 py-2 italic">
                {{ $t("course.submission.caseOutput.noStderr") }}
              </div>
            </div>
            <div v-else class="mt-2">
              <!-- File exists (could be empty string) -->
              <div v-if="caseOutputData.stderr.trim()">
                <code-editor v-model="caseOutputData.stderr" readonly />
              </div>
              <div v-else class="text-base-content/60 py-2 italic">
                {{ $t("course.submission.caseOutput.emptyStderr") }}
              </div>
            </div>
          </div>

          <!-- Artifact Files Section -->
          <div v-if="caseOutputData.files && Object.keys(caseOutputData.files).length > 0" class="mt-6">
            <label class="label pb-2">
              <span class="label-text text-base font-semibold">{{
                $t("course.submission.caseOutput.artifactFiles")
              }}</span>
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
                  <markdown-renderer :content="file.content" />
                </div>

                <!-- Text Files (including code files) -->
                <div v-else-if="file.type === 'text'" class="mt-2">
                  <code-editor v-model="file.content" readonly />
                </div>

                <!-- Binary Files (not images) -->
                <div v-else class="text-base-content/60 py-2 italic">
                  {{ $t("course.submission.caseOutput.binaryFile", { fileName }) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Buttons -->
      <div class="modal-action">
        <button class="btn" @click="closeCaseOutputModal">
          {{ $t("course.submission.caseOutput.close") }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
