<script setup lang="ts">
// ==========================================
// Imports
// ==========================================
import { ref, provide, Ref } from "vue";
import { useTitle } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import api from "@/models/api";
import AdminProblemForm from "@/components/Problem/Admin/AdminProblemForm.vue";

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
useTitle(`New Problem - ${route.params.name} | Normal OJ`);

const formElement = ref<InstanceType<typeof AdminProblemForm>>();

// Initialize newProblem state
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
  // === CONFIG ===
  config: {
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
    networkAccessRestriction: {
      sidecars: [],
      external: {
        model: "White",
        ip: [],
        url: [],
      },
    },
    artifactCollection: [],
  },
  // === PIPELINE ===
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
  // === ASSETS ===
  assets: {
    trialModePublicTestDataZip: null,
    trialModeACFiles: null,
    aiVTuberACFiles: null,
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

// Provide state to child components
provide<Ref<ProblemForm>>("problem", newProblem);

// ==========================================
// Submit Logic
// ==========================================
async function submit() {
  if (!formElement.value) return;

  logger.group("Submit New Problem");
  formElement.value.isLoading = true;

  try {
    // Step 1: Create Problem Metadata
    logger.log("Step 1: Creating Problem Metadata...", newProblem.value);
    const res = await api.Problem.create({ ...newProblem.value });
    const { problemId } = res.data;

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

    // Step 3: Append Assets
    const assets = newProblem.value.assets;
    const attachedFiles: string[] = [];

    if (assets?.aiVTuberACFiles) {
      assets.aiVTuberACFiles.forEach((f) => fd.append("aiVTuberACFiles", f));
      attachedFiles.push(`aiVTuberACFiles (${assets.aiVTuberACFiles.length})`);
    }
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

    logger.log("Step 3: Files attached", attachedFiles);

    // Step 4: Upload All Assets
    logger.log("Step 4: Uploading Assets V2...");
    await api.Problem.uploadAssetsV2(problemId, fd);

    logger.success("All assets uploaded successfully");

    // Redirect
    router.push(`/course/${route.params.name}/problem/${problemId}`);
  } catch (error) {
    logger.error("Submission Failed", error);

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
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-3 justify-between">New Problem</div>

        <admin-problem-form ref="formElement" @update="update" @submit="submit" />

        <div class="divider" />

        <div class="card-title mb-3">
          Preview
          <input v-model="openPreview" type="checkbox" class="toggle" />
        </div>
        <problem-card
          v-if="openPreview"
          :problem="{ ...mockProblemMeta, ...newProblem, testCase: newProblem.testCaseInfo.tasks }"
          preview
        />

        <div class="divider my-4" />

        <div class="card-title mb-3">
          JSON
          <input v-model="openJSON" type="checkbox" class="toggle" />
        </div>
        <pre v-if="openJSON">{{ JSON.stringify(newProblem, null, 2) }}</pre>
        <div class="mb-[50%]" />
      </div>
    </div>
  </div>
</template>
