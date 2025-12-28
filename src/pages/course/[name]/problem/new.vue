<script setup lang="ts">
// ==========================================
// Imports
// ==========================================
import { ref, provide, Ref, onMounted, nextTick } from "vue";
import { useTitle } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import api from "@/models/api";
import AdminProblemForm from "@/components/Problem/Admin/AdminProblemForm.vue";
import AdminManualModal from "@/components/Problem/Admin/AdminManualModal.vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// ==========================================
// [CONFIG] Animation Settings (Ultra-Fast)
// ==========================================
const ANIM_CONFIG = {
  START_DELAY: 100, // Start almost immediately
  FLIGHT_DURATION: 350, // Dash speed (0.35s)
  IMPACT_VISIBLE_MS: 800, // Cracks show for 0.8s
  HINT_DELAY_MS: 100, // Hint appears shortly after landing
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
// Setup & State
// ==========================================
const route = useRoute();
const router = useRouter();
useTitle(`${t("course.problem.new.title")} - ${route.params.name} | Normal OJ`);

const formElement = ref<InstanceType<typeof AdminProblemForm>>();

// Initialize newProblem state with explicit ProblemForm type to avoid 'any'
const newProblem = ref<ProblemForm>({
  problemName: "",
  description: {
    description: "",
    input: "",
    output: "",
    hint: "",
    sampleInput: [""],
    sampleOutput: [""],
  },
  courses: [route.params.name as string],
  tags: [],
  allowedLanguage: 3,
  quota: 10,
  type: 0,
  status: 1,
  testCaseInfo: {
    language: 0,
    fillInTemplate: "",
    tasks: [],
  },
  canViewStdout: true,
  defaultCode: "",
  config: {
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
  },
  pipeline: {
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
  },
  assets: {
    trialModePublicTestDataZip: null,
    trialModeACFiles: null,
    customCheckerPy: null,
    makefileZip: null,
    teacherFile: null,
    scorePy: null,
    dockerfilesZip: null,
    localServiceZip: null,
    testdataZip: null,
    resourceDataZip: null,
    resourceDataTeacherZip: null,
  },
});

function update<K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) {
  newProblem.value[key] = value;
}

provide<Ref<ProblemForm>>("problem", newProblem);

// ==========================================
// [ANIMATION] Superhero Landing Logic
// ==========================================
const manualButtonWrapper = ref<HTMLElement | null>(null);
const animState = ref({
  spotlight: true,
  flying: false,
  hint: false,
  skipped: false,
  style: {
    "--start-x": "0px",
    "--start-y": "0px",
    "--flight-time": `${ANIM_CONFIG.FLIGHT_DURATION}ms`,
  } as Record<string, string>,
});

onMounted(async () => {
  await nextTick();

  // LocalStorage Key
  const COOKIE_KEY = "has_seen_manual_anim";

  // Check if user has seen animation
  if (route.query.reset_anim) {
    localStorage.removeItem(COOKIE_KEY);
  }

  if (localStorage.getItem(COOKIE_KEY)) {
    animState.value.spotlight = false;
    animState.value.skipped = true;
    return;
  }

  // Mark as seen
  localStorage.setItem(COOKIE_KEY, "true");

  // 1. Calculate flight trajectory from screen center to button wrapper
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

  // Step A: Trigger Flying animation
  setTimeout(() => {
    animState.value.flying = true;
  }, ANIM_CONFIG.START_DELAY);

  // Step D: Fade out spotlight and show the hint bubble
  setTimeout(() => {
    animState.value.spotlight = false;
    animState.value.hint = true;
  }, hintStartTime);

  // Step E: Auto-hide the hint bubble
  setTimeout(() => {
    animState.value.hint = false;
  }, hintStartTime + ANIM_CONFIG.HINT_VISIBLE_MS);
});

// ==========================================
// Submit Logic
// ==========================================
async function submit() {
  if (!formElement.value) return;

  logger.group("Submit New Problem");
  formElement.value.isLoading = true;
  
  // 最小延迟1.5秒防止二次点击，但不会让用户等太久
  const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 1500));

  try {
    // Step 1: Create Problem Metadata
    logger.log("Step 1: Creating Problem Metadata...", newProblem.value);
    const res = await api.Problem.create({ ...newProblem.value });
    const { problemId } = res.data as { problemId: number };

    if (!problemId) throw new Error("API did not return a problemId");
    logger.success("Problem Created", problemId);

    // Step 2: Prepare config/pipeline for upload
    const cfg = {
      ...newProblem.value.config,
      aiVTuber: newProblem.value.config.aiVTuber,
      aiVTuberApiKeys: newProblem.value.config.aiVTuberApiKeys || [],
      aiVTuberMode: newProblem.value.config.aiVTuberMode,
    };
    const pipe = { ...newProblem.value.pipeline };

    const fd = new FormData();
    fd.append(
      "meta",
      JSON.stringify({
        config: cfg,
        pipeline: pipe,
      }),
    );
    logger.log("Step 2: Metadata prepared", { config: cfg, pipeline: pipe });

    // Step 3: Append Assets (Strict null/undefined checks)
    const assets = newProblem.value.assets;
    const attachedFiles: string[] = [];

    if (assets) {
      if (assets.trialModePublicTestDataZip) {
        fd.append("public_testdata.zip", assets.trialModePublicTestDataZip);
        attachedFiles.push("public_testdata.zip");
      }
      if (assets.trialModeACFiles && assets.trialModeACFiles.length > 0) {
        assets.trialModeACFiles.forEach((f) => fd.append("ac_code", f));
        attachedFiles.push(`ac_code (${assets.trialModeACFiles.length})`);
      }
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
    }

    logger.log("Step 3: Files attached", attachedFiles);

    // Step 4: Upload All Assets
    logger.log("Step 4: Uploading Assets V2...");
    await api.Problem.uploadAssetsV2(problemId, fd);
    logger.success("All assets uploaded successfully");

    // 等待最小延迟，防止二次点击
    await minDelayPromise;

    router.push(`/course/${route.params.name}/problem/${problemId}`);
  } catch (error) {
    logger.error("Submission Failed", error);
    if (formElement.value) {
      formElement.value.errorMsg =
        axios.isAxiosError(error) && error.response?.data?.message
          ? (error.response.data.message as string)
          : "Unknown error occurred :(";
    }
    // 失败时也等待最小延迟，防止二次点击
    await minDelayPromise;
    throw error;
  } finally {
    if (formElement.value) formElement.value.isLoading = false;
    logger.groupEnd();
  }
}

// ==========================================
// Misc
// ==========================================
const openPreview = ref(false);
const mockProblemMeta = {
  owner: "",
  highScore: 0,
  submitCount: 0,
  ACUser: 0,
  submitter: 0,
};
const openJSON = ref(false);
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
          {{ t("course.problem.new.title") }}

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
                class="animate-bounce-horizontal absolute right-full z-50 mr-4 w-max rounded bg-black px-3 py-2 text-sm font-bold text-white shadow-lg dark:bg-white dark:text-black"
              >
                <div
                  class="bg-info absolute top-1/2 -right-1 h-3 w-3 -translate-y-1/2 rotate-45 transform"
                ></div>
                👋 Click here for Manual!
              </div>
            </Transition>

            <div
              :class="[
                animState.skipped ? 'opacity-100' : 'opacity-0',
                { 'dash-fly-anim': animState.flying },
              ]"
            >
              <AdminManualModal />
            </div>
          </div>
        </div>

        <admin-problem-form ref="formElement" @update="update" @submit="submit" />

        <div class="divider" />
        <div class="card-title mb-3">
          {{ t("course.problem.new.preview") }}
          <input v-model="openPreview" type="checkbox" class="toggle" />
        </div>
        <problem-card
          v-if="openPreview"
          :problem="{ ...mockProblemMeta, ...newProblem, testCase: newProblem.testCaseInfo.tasks }"
          preview
        />

        <div class="divider my-4" />

        <div class="card-title mb-3">
          {{ t("course.problem.new.json") }}
          <input v-model="openJSON" type="checkbox" class="toggle" />
        </div>
        <pre v-if="openJSON" class="bg-base-200 rounded p-2">{{ JSON.stringify(newProblem, null, 2) }}</pre>
        <div class="mb-[50%]" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* High-Speed Dash Animation */
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

/* Horizontal bouncing for tooltip */
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
