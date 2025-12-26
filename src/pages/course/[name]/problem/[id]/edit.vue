<script setup lang="ts">
// ==========================================
// Imports
// ==========================================
import { ref, watch, provide, Ref, onMounted } from "vue"; // Added onMounted
import { useTitle } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import api, { fetcher } from "@/models/api";
import axios, { type AxiosError } from "axios";
import AdminProblemForm from "@/components/Problem/Admin/AdminProblemForm.vue";
import AdminManualModal from "@/components/Problem/Admin/AdminManualModal.vue";
import { useI18n } from "vue-i18n";

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
// Setup & Utils
// ==========================================
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useTitle(`Edit Problem - ${route.params.id} - ${route.params.name} | Normal OJ`);

const formElement = ref<InstanceType<typeof AdminProblemForm>>();

type LegacyProblemConfigExtra = ProblemConfigExtra & {
  artifact_collection?: ProblemConfigExtra["artifactCollection"];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTestCases(raw: any): ProblemTestCase[] {
  if (Array.isArray(raw)) return raw.slice();
  if (Array.isArray(raw?.tasks)) return raw.tasks.slice();
  return [];
}

function normalizeConfig(config?: LegacyProblemConfigExtra): ProblemConfigExtra {
  const base: ProblemConfigExtra = {
    trialMode: false,
    maxNumberOfTrial: -1,
    trialResultVisible: false,
    trialResultDownloadable: false,
    aiVTuber: false,
    aiVTuberApiKeys: [],
    aiVTuberMode: "gemini-2.5-flash-lite",
    acceptedFormat: "code",
    resourceData: false,
    resourceDataTeacher: false,
    maxStudentZipSizeMB: 50,
    networkAccessEnabled: false,
    networkAccessRestriction: {
      sidecars: [],
      external: {
        model: "White",
        ip: [],
        url: [],
      },
    },
    artifactCollection: [],
  };
  const merged: ProblemConfigExtra = {
    ...base,
    ...(config || {}),
    trialMode: config?.trialMode ?? base.trialMode,
    maxNumberOfTrial: config?.maxNumberOfTrial ?? -1,
    trialResultVisible: config?.trialResultVisible ?? base.trialResultVisible,
    trialResultDownloadable: config?.trialResultDownloadable ?? base.trialResultDownloadable,
    aiVTuber: config?.aiVTuber ?? base.aiVTuber,
    aiVTuberMode: config?.aiVTuberMode ?? base.aiVTuberMode,
    aiVTuberApiKeys: Array.isArray(config?.aiVTuberApiKeys) ? config!.aiVTuberApiKeys : base.aiVTuberApiKeys,
    acceptedFormat: config?.acceptedFormat ?? base.acceptedFormat,
    maxStudentZipSizeMB: config?.maxStudentZipSizeMB ?? base.maxStudentZipSizeMB,
    artifactCollection: config?.artifactCollection ?? config?.artifact_collection ?? base.artifactCollection,
    resourceDataTeacher: config?.resourceDataTeacher ?? base.resourceDataTeacher,
    networkAccessRestriction: {
      ...base.networkAccessRestriction!,
      ...(config?.networkAccessRestriction || {}),
      external: {
        ...base.networkAccessRestriction!.external,
        ...(config?.networkAccessRestriction?.external || {}),
      },
    },
  };
  const nar = merged.networkAccessRestriction!;
  if (!Array.isArray(nar.sidecars)) nar.sidecars = [];
  if (!nar.external) nar.external = { model: "White", ip: [], url: [] };
  if (!Array.isArray(nar.external.ip)) nar.external.ip = [];
  if (!Array.isArray(nar.external.url)) nar.external.url = [];

  nar.external.model = nar.external.model || "White";
  return merged;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePipeline(raw?: any): ProblemPipeline {
  if (!raw) raw = {};
  const base: ProblemPipeline = {
    allowRead: false,
    allowWrite: false,
    executionMode: "general",
    customChecker: false,
    teacherFirst: false,
    staticAnalysis: {
      libraryRestrictions: {
        enabled: false,
        whitelist: { syntax: [], imports: [], headers: [], functions: [] },
        blacklist: { syntax: [], imports: [], headers: [], functions: [] },
      },
    },
    scoringScript: { custom: false },
  };
  const allowReadVal =
    raw?.allowRead ??
    raw?.allow_read ??
    raw?.fopen ??
    raw?.config?.allowRead ??
    raw?.config?.allow_read ??
    raw?.config?.fopen ??
    base.allowRead;
  const allowWriteVal =
    raw?.allowWrite ??
    raw?.allow_write ??
    raw?.fwrite ??
    raw?.config?.allowWrite ??
    raw?.config?.allow_write ??
    raw?.config?.fwrite ??
    base.allowWrite;
  const pipeline: ProblemPipeline = {
    allowRead: Boolean(allowReadVal),
    allowWrite: Boolean(allowReadVal && allowWriteVal),
    executionMode: raw?.executionMode ?? base.executionMode,
    customChecker: raw?.customChecker ?? base.customChecker,
    teacherFirst: raw?.teacherFirst ?? base.teacherFirst,
    scoringScript: raw?.scoringScript ?? base.scoringScript,
    staticAnalysis: {
      ...base.staticAnalysis!,
      ...(raw?.staticAnalysis || {}),
      libraryRestrictions: {
        ...base.staticAnalysis!.libraryRestrictions!,
        ...(raw?.staticAnalysis?.libraryRestrictions || {}),
        whitelist: {
          ...base.staticAnalysis!.libraryRestrictions!.whitelist,
          ...(raw?.staticAnalysis?.libraryRestrictions?.whitelist || {}),
        },
        blacklist: {
          ...base.staticAnalysis!.libraryRestrictions!.blacklist,
          ...(raw?.staticAnalysis?.libraryRestrictions?.blacklist || {}),
        },
      },
    },
  };
  pipeline.staticAnalysis!.libraryRestrictions!.enabled ??= false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const libs = pipeline.staticAnalysis!.libraryRestrictions! as any;
  ["whitelist", "blacklist"].forEach((key) => {
    if (!libs[key]) libs[key] = {};
    ["syntax", "imports", "headers", "functions"].forEach((f) => {
      if (!Array.isArray(libs[key][f])) libs[key][f] = [];
    });
  });
  return pipeline;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAssets(raw: any): ProblemAssets {
  const base: ProblemAssets = {
    trialModePublicTestDataZip: raw?.trialModePublicTestDataZip ?? null,
    trialModeACFiles: raw?.trialModeACFiles ?? null,
    //aiVTuberACFiles: null,
    customCheckerPy: null,
    makefileZip: null,
    teacherFile: null,
    scorePy: null,
    dockerfilesZip: null,
    localServiceZip: null,
    testdataZip: null,
    resourceDataZip: null,
    resourceDataTeacherZip: null,
  };
  // if (raw?.aiVTuberFiles && !raw.aiVTuberACFiles) raw.aiVTuberACFiles = raw.aiVTuberFiles;
  return { ...base, ...(raw || {}) };
}

// ==========================================
// UX / Animation Logic (New)
// ==========================================
const showManualHint = ref(false);

onMounted(() => {
  // Trigger the hint animation slightly after mount
  setTimeout(() => {
    showManualHint.value = true;
  }, 500);

  // Auto-hide the hint after 6 seconds to avoid annoyance
  setTimeout(() => {
    showManualHint.value = false;
  }, 6500);
});

// ==========================================
// Data Fetching & Initialization
// ==========================================
const {
  data: problem,
  error: fetchError,
  isLoading: isFetching,
} = useAxios<Problem>(`/problem/view/${route.params.id}`, fetcher);

const edittingProblem = ref<ProblemForm>();

// Initialize with logging
watch(
  () => problem.value,
  (newProblem) => {
    if (!newProblem || edittingProblem.value) return;

    logger.group("Initialize Problem Data");
    logger.log("Raw Response", newProblem);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const np = newProblem as any;
    const testCases = normalizeTestCases(np.testCase ?? np.testCaseInfo);

    edittingProblem.value = {
      ...newProblem,
      testCaseInfo: {
        language: 0,
        fillInTemplate: "",
        tasks: testCases,
      },
      config: normalizeConfig(newProblem.config),
      pipeline: normalizePipeline(
        (() => {
          const basePipe = np.pipeline || np.pipelineConf || np.pipeline_conf || np.config?.pipeline;
          const cfg = np.config;
          if (basePipe && cfg) return { ...basePipe, config: cfg };
          if (basePipe) return basePipe;
          if (cfg) return { config: cfg };
          return {};
        })(),
      ),
      assets: normalizeAssets(np.assets),
    } as ProblemForm;

    // Ensure allowRead/allowWrite has a value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = edittingProblem.value.config as any;
    const pipe = edittingProblem.value.pipeline;
    if (pipe) {
      if (pipe.allowRead === undefined || pipe.allowRead === null) {
        pipe.allowRead = Boolean(cfg?.allowRead ?? false);
      }
      if (pipe.allowWrite === undefined || pipe.allowWrite === null) {
        pipe.allowWrite = Boolean(cfg?.allowWrite ?? false);
      }
    }

    logger.success("Normalization Complete", edittingProblem.value);
    logger.groupEnd();
  },
  { immediate: true },
);

function update<K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) {
  if (!edittingProblem.value) return;
  edittingProblem.value[key] = value;
}

provide<Ref<ProblemForm | undefined>>("problem", edittingProblem);

// ==========================================
// Actions: Submit / Discard / Delete
// ==========================================
async function submit() {
  if (!edittingProblem.value || !formElement.value) return;

  logger.group("Submit Edit Problem");
  formElement.value.isLoading = true;

  try {
    const pid = Number(route.params.id);

    // Step 1: Meta
    const cfg = {
      ...edittingProblem.value.config,
      aiVTuber: edittingProblem.value.config.aiVTuber,
      aiVTuberApiKeys: edittingProblem.value.config.aiVTuberApiKeys || [],
      aiVTuberMode: edittingProblem.value.config.aiVTuberMode,
    };
    const pipe = { ...edittingProblem.value.pipeline };

    logger.log("Step 1: Preparing Metadata", { config: cfg, pipeline: pipe });

    const fd = new FormData();
    fd.append(
      "meta",
      JSON.stringify({
        config: cfg,
        pipeline: pipe,
      }),
    );

    // Step 2: Assets
    const assets = edittingProblem.value.assets;
    const attachedFiles: string[] = [];
    /*
    if (assets?.aiVTuberACFiles) {
      assets.aiVTuberACFiles.forEach((f) => fd.append("aiVTuberACFiles", f));
      attachedFiles.push(`aiVTuberACFiles (${assets.aiVTuberACFiles.length})`);
    }
    */
    if (assets?.testdataZip) {
      fd.append("case", assets.testdataZip);
      attachedFiles.push("case");
    }
    if (assets?.customCheckerPy) {
      fd.append("custom_checker.py", assets.customCheckerPy);
      attachedFiles.push("custom_checker.py");
    }
    if (assets?.makefileZip) {
      fd.append("makefile.zip", assets.makefileZip);
      attachedFiles.push("makefile.zip");
    }
    if (assets?.teacherFile) {
      fd.append("Teacher_file", assets.teacherFile);
      attachedFiles.push("Teacher_file");
    }
    if (assets?.scorePy) {
      fd.append("score.py", assets.scorePy);
      attachedFiles.push("score.py");
    }
    if (assets?.dockerfilesZip) {
      fd.append("dockerfiles.zip", assets.dockerfilesZip);
      attachedFiles.push("dockerfiles.zip");
    }
    if (assets?.localServiceZip) {
      fd.append("local_service.zip", assets.localServiceZip);
      attachedFiles.push("local_service.zip");
    }
    if (assets?.resourceDataZip) {
      fd.append("resource_data.zip", assets.resourceDataZip);
      attachedFiles.push("resource_data.zip");
    }
    if (assets?.resourceDataTeacherZip) {
      fd.append("resource_data_teacher.zip", assets.resourceDataTeacherZip);
      attachedFiles.push("resource_data_teacher.zip");
    }

    // [New] Trial Mode Assets Upload Logic
    if (assets?.trialModePublicTestDataZip) {
      fd.append("public_testdata.zip", assets.trialModePublicTestDataZip);
      attachedFiles.push("public_testdata.zip");
    }
    if (assets?.trialModeACFiles) {
      // trialModeACFiles could be File[] or single File depending on upstream logic
      if (Array.isArray(assets.trialModeACFiles)) {
        assets.trialModeACFiles.forEach((f) => {
          const ext = f.name.split(".").pop()?.toLowerCase() || "";
          // Naming convention for backend AC checker
          if (ext === "c") fd.append("ac_code.c", f);
          else if (ext === "cpp") fd.append("ac_code.cpp", f);
          else if (ext === "py") fd.append("ac_code.py", f);
          else fd.append("ac_code", f, f.name); // Fallback
          attachedFiles.push(f.name);
        });
      } else {
        const f = assets.trialModeACFiles as unknown as File;
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        if (ext === "c") fd.append("ac_code.c", f);
        else if (ext === "cpp") fd.append("ac_code.cpp", f);
        else if (ext === "py") fd.append("ac_code.py", f);
        else fd.append("ac_code", f, f.name);
        attachedFiles.push(f.name);
      }
    }

    const assetPaths = cfg.assetPaths || {};
    const hasExistingAssets = Object.values(assetPaths).some((path) => Boolean(path));
    const hasNewAssets = attachedFiles.length > 0;
    const shouldUploadAssets = hasNewAssets || hasExistingAssets;

    logger.log("Step 2: Attaching Assets", attachedFiles);

    // Step 3: API Calls
    logger.log("Step 3: Sending Update Request...");
    await api.Problem.modify(pid, edittingProblem.value);

    if (shouldUploadAssets) {
      logger.log("Step 4: Sending Assets Upload...");
      await api.Problem.uploadAssetsV2(pid, fd);
    } else {
      logger.log("Step 4: Skipping Assets Upload (no files, no existing assets)");
    }

    logger.success("Update Successful. Redirecting...");
    router.push(`/course/${route.params.name}/problem/${route.params.id}`);
  } catch (error) {
    logger.error("Submit Failed", error);
    formElement.value.errorMsg =
      axios.isAxiosError(error) && error.response?.data?.message
        ? error.response.data.message
        : "Unknown error occurred :(";
    throw error;
  } finally {
    formElement.value.isLoading = false;
    logger.groupEnd();
  }
}

async function discard() {
  if (!confirm("Are u sure?")) return;
  logger.log("User Discarded Changes");
  router.push(`/course/${route.params.name}/problems`);
}

async function delete_() {
  if (!formElement.value) return;

  if (!confirm("Are u sure?")) return;

  logger.warn("Deleting Problem...", route.params.id);
  formElement.value.isLoading = true;

  try {
    await api.Problem.delete(route.params.id as string);
    logger.success("Problem Deleted");
    router.push(`/course/${route.params.name}/problems`);
  } catch (error) {
    logger.error("Deletion Failed", error);
    formElement.value.errorMsg =
      axios.isAxiosError(error) && error.response?.data?.message
        ? error.response.data.message
        : "Unknown error occurred :(";
    throw error;
  } finally {
    formElement.value.isLoading = false;
  }
}

// ==========================================
// Misc
// ==========================================
const openPreview = ref(false);
const openJSON = ref(false);

const mockProblemMeta = {
  owner: "",
  highScore: 0,
  submitCount: 0,
  ACUser: 0,
  submitter: 0,
};
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-3 justify-between">
          {{ t("course.problems.editProblem") }}{{ $route.params.id }} - {{ edittingProblem?.problemName }}
          <div class="flex items-center gap-x-3">
            <div class="relative flex items-center">
              <Transition
                enter-active-class="transition ease-out duration-300"
                enter-from-class="opacity-0 translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition ease-in duration-300"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="showManualHint"
                  class="bg-info text-info-content pointer-events-none absolute right-full z-10 mr-3 w-max max-w-[200px] rounded-lg px-3 py-2 text-sm font-bold shadow-lg"
                >
                  <div
                    class="bg-info absolute -right-1 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 transform"
                  ></div>
                  👋 Click here for Manual!
                </div>
              </Transition>

              <div :class="{ 'animate-pulse': showManualHint }">
                <AdminManualModal />
              </div>
            </div>

            <button
              :class="['btn btn-error btn-outline btn-sm lg:btn-md', formElement?.isLoading && 'loading']"
              @click="delete_"
            >
              <i-uil-trash-alt class="mr-1 lg:h-5 lg:w-5" /> {{ t("course.problems.delete") }}
            </button>
            <button
              :class="['btn btn-warning btn-sm lg:btn-md', formElement?.isLoading && 'loading']"
              @click="discard"
            >
              <i-uil-times-circle class="mr-1 lg:h-5 lg:w-5" /> {{ t("course.problems.discardChanges") }}
            </button>
          </div>
        </div>

        <data-status-wrapper :error="fetchError as AxiosError" :is-loading="isFetching">
          <template #loading><skeleton-card /></template>
          <template #data>
            <template v-if="edittingProblem">
              <admin-problem-form ref="formElement" @update="update" @submit="submit" />

              <div class="divider" />

              <div class="card-title mb-3">
                {{ t("course.problems.Preview") }}
                <input v-model="openPreview" type="checkbox" class="toggle" />
              </div>

              <problem-card
                v-if="openPreview"
                :problem="{
                  ...mockProblemMeta,
                  ...edittingProblem,
                  testCase: edittingProblem.testCaseInfo.tasks,
                }"
                preview
              />

              <div class="divider my-4" />

              <div class="card-title mb-3">
                JSON
                <input v-model="openJSON" type="checkbox" class="toggle" />
              </div>

              <pre v-if="openJSON" class="bg-base-200 whitespace-pre-wrap rounded p-2"
                >{{ JSON.stringify(edittingProblem, null, 2) }}
              </pre>

              <div class="mb-[50%]" />
            </template>
          </template>
        </data-status-wrapper>
      </div>
    </div>
  </div>
</template>
