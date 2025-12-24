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
              :class="['btn btn-outline btn-error md:btn-md hover:bg-error hover:border-error hover:text-error-content', isDeleteLoading && 'loading']"
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
                      <td>{{ submission.score }}</td>
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
                  <td>{{ task.score }}</td>
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
                  <td v-if="enableZipArtifact">-</td>
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
      </div>
    </div>
  </div>
</template>
