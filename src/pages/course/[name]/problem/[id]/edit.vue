<script setup lang="ts">
// ==========================================
// Imports
// ==========================================
import { ref, watch, provide, Ref, onMounted, nextTick } from "vue";
import { useTitle } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import api, { fetcher } from "@/models/api";
import axios, { type AxiosError } from "axios";
import AdminProblemForm from "@/components/Problem/Admin/AdminProblemForm.vue";
import AdminManualModal from "@/components/Problem/Admin/AdminManualModal.vue";
import { useI18n } from "vue-i18n";

// ==========================================
// [CONFIG] Animation Settings (Ultra-Fast)
// ==========================================
const ANIM_CONFIG = {
  START_DELAY: 100, // Start almost immediately
  FLIGHT_DURATION: 350, // Dash speed (0.35s)
  IMPACT_VISIBLE_MS: 800, // Cracks show for 0.8s
  HINT_DELAY_MS: 100, // Hint appearance delay
  HINT_VISIBLE_MS: 3500, // Hint stay duration
};

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

// --- Normalization Helpers (Strictly Typed) ---
function normalizeTestCases(raw: unknown): ProblemTestCase[] {
  if (Array.isArray(raw)) return raw.slice();
  const obj = raw as { tasks?: ProblemTestCase[] };
  if (Array.isArray(obj?.tasks)) return obj.tasks.slice();
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
    aiMaxToken: 500,
    acceptedFormat: "code",
    resourceData: false,
    resourceDataTeacher: false,
    maxStudentZipSizeMB: 50,
    networkAccessEnabled: false,
    networkAccessRestriction: {
      sidecars: [],
      external: { model: "White", ip: [], url: [] },
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
    assetPaths: config?.assetPaths || {},
  };
  const nar = merged.networkAccessRestriction!;
  if (!Array.isArray(nar.sidecars)) nar.sidecars = [];
  if (!nar.external) nar.external = { model: "White", ip: [], url: [] };
  if (!Array.isArray(nar.external.ip)) nar.external.ip = [];
  if (!Array.isArray(nar.external.url)) nar.external.url = [];

  nar.external.model = nar.external.model || "White";
  return merged;
}

function normalizePipeline(raw?: unknown): ProblemPipeline {
  // Use Partial<ProblemPipeline> for safer property access
  const data = (raw || {}) as Partial<ProblemPipeline> & { [key: string]: unknown };

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
    data?.allowRead ??
    (data as { allow_read?: boolean }).allow_read ??
    (data as { fopen?: boolean }).fopen ??
    (data?.config && typeof data.config === "object"
      ? (data.config as Partial<ProblemConfigExtra>).allowRead
      : undefined) ??
    base.allowRead;

  const allowWriteVal =
    data?.allowWrite ??
    (data as { allow_write?: boolean }).allow_write ??
    (data as { fwrite?: boolean }).fwrite ??
    (data?.config && typeof data.config === "object"
      ? (data.config as Partial<ProblemConfigExtra>).allowWrite
      : undefined) ??
    base.allowWrite;

  const pipeline: ProblemPipeline = {
    allowRead: Boolean(allowReadVal),
    allowWrite: Boolean(allowReadVal && allowWriteVal),
    executionMode: data?.executionMode ?? base.executionMode,
    customChecker: data?.customChecker ?? base.customChecker,
    teacherFirst: data?.teacherFirst ?? base.teacherFirst,
    scoringScript: data?.scoringScript ?? base.scoringScript,
    staticAnalysis: {
      ...base.staticAnalysis!,
      ...(data?.staticAnalysis || {}),
      libraryRestrictions: {
        ...base.staticAnalysis!.libraryRestrictions!,
        ...(data?.staticAnalysis?.libraryRestrictions || {}),
        whitelist: {
          ...base.staticAnalysis!.libraryRestrictions!.whitelist,
          ...(data?.staticAnalysis?.libraryRestrictions?.whitelist || {}),
        },
        blacklist: {
          ...base.staticAnalysis!.libraryRestrictions!.blacklist,
          ...(data?.staticAnalysis?.libraryRestrictions?.blacklist || {}),
        },
      },
    },
  };

  pipeline.staticAnalysis!.libraryRestrictions!.enabled ??= false;

  const libs = pipeline.staticAnalysis!.libraryRestrictions!;
  ["whitelist", "blacklist"].forEach((key) => {
    // @ts-expect-error: key is "whitelist" | "blacklist" but TypeScript cannot infer this for object index
    if (!libs[key]) libs[key] = {};
    ["syntax", "imports", "headers", "functions"].forEach((f) => {
      // @ts-expect-error: dynamic property access on library restrictions object
      if (!Array.isArray(libs[key][f])) libs[key][f] = [];
    });
  });
  return pipeline;
}

function normalizeAssets(raw: unknown): ProblemAssets {
  const data = (raw || {}) as ProblemAssets;
  const base: ProblemAssets = {
    trialModePublicTestDataZip: data.trialModePublicTestDataZip ?? null,
    trialModeACFiles: data.trialModeACFiles ?? null,
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
  return { ...base, ...data };
}

// ==========================================
// [ANIMATION] Superhero Landing Logic
// ==========================================
const manualButtonWrapper = ref<HTMLElement | null>(null);
const animState = ref({
  spotlight: true,
  flying: false,
  hint: false,
  style: {
    "--start-x": "0px",
    "--start-y": "0px",
    "--flight-time": `${ANIM_CONFIG.FLIGHT_DURATION}ms`,
  } as Record<string, string>,
});

onMounted(async () => {
  await nextTick();

  // 1. Calculate Dash Trajectory
  if (manualButtonWrapper.value) {
    const rect = manualButtonWrapper.value.getBoundingClientRect();
    const deltaX = window.innerWidth / 2 - (rect.left + rect.width / 2);
    const deltaY = window.innerHeight / 2 - (rect.top + rect.height / 2);
    animState.value.style["--start-x"] = `${deltaX}px`;
    animState.value.style["--start-y"] = `${deltaY}px`;
  }

  // 2. Timeline Logic
  const landTime = ANIM_CONFIG.START_DELAY + ANIM_CONFIG.FLIGHT_DURATION * 0.95;
  const hintStartTime = landTime + ANIM_CONFIG.HINT_DELAY_MS;

  setTimeout(() => {
    animState.value.flying = true;
  }, ANIM_CONFIG.START_DELAY);
  setTimeout(() => {
    animState.value.spotlight = false;
    animState.value.hint = true;
  }, hintStartTime);
  setTimeout(() => {
    animState.value.hint = false;
  }, hintStartTime + ANIM_CONFIG.HINT_VISIBLE_MS);
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

provide<Ref<ProblemForm | undefined>>("problem", edittingProblem);

// Define a temporary interface for the raw API response
interface RawProblemResponse extends Problem {
  testCase?: ProblemTestCase[];
  testCaseInfo?: { tasks: ProblemTestCase[] };
  pipeline_conf?: Partial<ProblemPipeline>;
  pipelineConf?: Partial<ProblemPipeline>;
  config: ProblemConfigExtra & { assetPaths?: Record<string, string> };
}

watch(
  () => problem.value,
  (newProblem) => {
    if (!newProblem || edittingProblem.value) return;

    logger.group("Initialize Problem Data");
    // Cast to the temporary interface instead of 'any'
    const np: RawProblemResponse = newProblem as RawProblemResponse;

    console.log("[DEBUG] API response (problem):", newProblem);

    console.log("[DEBUG] API config:", np.config);
    console.log("[DEBUG] API config.assetPaths:", np.config?.assetPaths);

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
          const basePipe = np.pipeline || np.pipelineConf || np.pipeline_conf;
          const cfg = np.config;
          if (basePipe && cfg) return { ...basePipe, config: cfg };
          return basePipe || { config: cfg };
        })(),
      ),
      assets: normalizeAssets(np.assets),
    } as ProblemForm;

    console.log("[DEBUG] normalizeConfig(newProblem.config):", normalizeConfig(newProblem.config));
    console.log("[DEBUG] edittingProblem.value.config.assetPaths:", edittingProblem.value.config.assetPaths);

    // Safety fallback for allowRead/Write
    const cfg = edittingProblem.value.config;
    const pipe = edittingProblem.value.pipeline;
    if (pipe) {
      if (pipe.allowRead === undefined || pipe.allowRead === null) {
        pipe.allowRead = Boolean(cfg.allowRead ?? false);
      }
      if (pipe.allowWrite === undefined || pipe.allowWrite === null) {
        pipe.allowWrite = Boolean(cfg.allowWrite ?? false);
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

// ==========================================
// Actions: Submit / Discard / Delete
// ==========================================
async function submit() {
  if (!edittingProblem.value || !formElement.value) return;

  logger.group("Submit Edit Problem");
  formElement.value.isLoading = true;

  try {
    const pid = Number(route.params.id);

    // Step 1: Prepare Meta
    const cfg = {
      ...edittingProblem.value.config,
      aiVTuber: edittingProblem.value.config.aiVTuber,
      aiVTuberApiKeys: edittingProblem.value.config.aiVTuberApiKeys || [],
      aiVTuberMode: edittingProblem.value.config.aiVTuberMode,
    };
    const pipe = { ...edittingProblem.value.pipeline };

    const fd = new FormData();
    fd.append("meta", JSON.stringify({ config: cfg, pipeline: pipe }));

    // Step 2: Assets Processing
    const assets = edittingProblem.value.assets;
    const attachedFiles: string[] = [];

    if (assets) {
      if (assets.testdataZip) {
        fd.append("case", assets.testdataZip);
        attachedFiles.push("case");
      }
      if (assets.customCheckerPy) {
        fd.append("custom_checker.py", assets.customCheckerPy);
        attachedFiles.push("custom_checker.py");
      }
      if (assets.makefileZip) {
        fd.append("makefile.zip", assets.makefileZip);
        attachedFiles.push("makefile.zip");
      }
      if (assets.teacherFile) {
        fd.append("Teacher_file", assets.teacherFile);
        attachedFiles.push("Teacher_file");
      }
      if (assets.scorePy) {
        fd.append("score.py", assets.scorePy);
        attachedFiles.push("score.py");
      }
      if (assets.dockerfilesZip) {
        fd.append("dockerfiles.zip", assets.dockerfilesZip);
        attachedFiles.push("dockerfiles.zip");
      }
      if (assets.localServiceZip) {
        fd.append("local_service.zip", assets.localServiceZip);
        attachedFiles.push("local_service.zip");
      }
      if (assets.resourceDataZip) {
        fd.append("resource_data.zip", assets.resourceDataZip);
        attachedFiles.push("resource_data.zip");
      }
      if (assets.resourceDataTeacherZip) {
        fd.append("resource_data_teacher.zip", assets.resourceDataTeacherZip);
        attachedFiles.push("resource_data_teacher.zip");
      }

      // Trial Mode Assets Logic
      if (assets.trialModePublicTestDataZip) {
        fd.append("public_testdata.zip", assets.trialModePublicTestDataZip);
        attachedFiles.push("public_testdata.zip");
      }
      if (assets.trialModeACFiles) {
        if (Array.isArray(assets.trialModeACFiles)) {
          assets.trialModeACFiles.forEach((f) => {
            const ext = f.name.split(".").pop()?.toLowerCase() || "";
            const key = ext === "c" || ext === "cpp" || ext === "py" ? `ac_code.${ext}` : "ac_code";
            fd.append(key, f, f.name);
            attachedFiles.push(f.name);
          });
        } else {
          const f = assets.trialModeACFiles as File;
          const ext = f.name.split(".").pop()?.toLowerCase() || "";
          const key = ext === "c" || ext === "cpp" || ext === "py" ? `ac_code.${ext}` : "ac_code";
          fd.append(key, f, f.name);
          attachedFiles.push(f.name);
        }
      }
    }

    const assetPaths = (cfg as { assetPaths?: Record<string, string> }).assetPaths || {};
    const hasExistingAssets = Object.values(assetPaths).some((path) => Boolean(path));
    const shouldUploadAssets = attachedFiles.length > 0 || hasExistingAssets;

    logger.log("Attaching Assets", attachedFiles);

    // Step 3: API Execution
    await api.Problem.modify(pid, edittingProblem.value);

    if (shouldUploadAssets) {
      logger.log("Sending Assets Upload...");
      await api.Problem.uploadAssetsV2(pid, fd);
    }

    logger.success("Update Successful. Redirecting...");
    router.push(`/course/${route.params.name}/problem/${route.params.id}`);
  } catch (error) {
    logger.error("Submit Failed", error);
    if (formElement.value) {
      formElement.value.errorMsg =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Unknown error occurred :(";
    }
    throw error;
  } finally {
    if (formElement.value) formElement.value.isLoading = false;
    logger.groupEnd();
  }
}

async function discard() {
  if (confirm("Are u sure?")) router.push(`/course/${route.params.name}/problems`);
}

async function delete_() {
  if (!formElement.value || !confirm("Are u sure?")) return;

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
const mockProblemMeta = { owner: "", highScore: 0, submitCount: 0, ACUser: 0, submitter: 0 };
// ==========================================
// [HELPER] JSON Display Cleanup
// ==========================================
function cleanupForDisplay(data?: ProblemForm) {
  if (!data) return {};

  // Shallow copy to avoid modifying original
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const { pipeline_conf, pipelineConf, testCase, test_case, config, ...rest } = data as any;

  // Clean nested config if needed
  let cleanConfig = config;
  if (config) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { artifact_collection, ...restConfig } = config;
    cleanConfig = restConfig;
  }

  return { ...rest, config: cleanConfig };
}
</script>

<template>
  <div class="card-container relative isolate">
    <div
      class="pointer-events-none fixed inset-0 z-40 bg-black/80 transition-opacity duration-300"
      :class="animState.spotlight ? 'opacity-100' : 'opacity-0'"
    />

    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-3 justify-between">
          {{ t("course.problems.editProblem") }}{{ $route.params.id }} - {{ edittingProblem?.problemName }}

          <div class="flex items-center gap-x-3">
            <div
              ref="manualButtonWrapper"
              class="relative z-50 flex items-center justify-center"
              :style="animState.style"
            >
              <Transition
                enter-active-class="transition duration-200"
                enter-from-class="opacity-0 scale-90"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition duration-150"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="animState.hint"
                  class="animate-bounce-horizontal absolute right-full z-50 mr-4 w-max bg-black px-3 py-2 text-sm font-bold text-white shadow-lg"
                >
                  <div
                    class="bg-info absolute top-1/2 -right-1 h-3 w-3 -translate-y-1/2 rotate-45 transform"
                  ></div>
                  👋 Click here for Manual!
                </div>
              </Transition>

              <div
                class="opacity-0 transition-opacity duration-300"
                :class="{ 'dash-fly-anim': animState.flying }"
              >
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
                >{{ JSON.stringify(cleanupForDisplay(edittingProblem), null, 2) }}
              </pre>

              <div class="mb-[50%]" />
            </template>
          </template>
        </data-status-wrapper>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes dash-fly {
  0% {
    transform: translate(var(--start-x), var(--start-y)) scale(2.5);
    opacity: 0;
  }
  100% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
}

.dash-fly-anim {
  animation: dash-fly var(--flight-time) cubic-bezier(0.16, 1, 0.3, 1) forwards;
  position: relative;
  z-index: 60;
}

@keyframes bounce-h {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-4px);
  }
}
.animate-bounce-horizontal {
  animation: bounce-h 0.6s infinite;
}
</style>
