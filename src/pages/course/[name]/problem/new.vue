<script setup lang="ts">
import { ref, provide, Ref } from "vue";
import { useTitle } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import api from "@/models/api";
import ProblemForm from "@/components/Problem/ProblemForm.vue";
import ProblemCardV2 from "@/components/Problem/ProblemCardV2.vue";
import type { ProblemDraftV2, LegacyProblemCreateRequest } from "@/types/problem-v2";

const route = useRoute();
const router = useRouter();
useTitle(`New Problem - ${route.params.name} | Normal OJ`);

const formElement = ref<InstanceType<typeof ProblemForm>>();

const newProblem = ref<ProblemDraftV2>({
  courses: [route.params.name as string],
  problemName: "",
  status: 1, // 1 means Visible (isNotHidden)

  description: {
    tags: [""],
    allowedLanguage: 3,
    quota: 10,
    description: "",
    input: "",
    output: "",
    hint: "",
    sampleInput: [""],
    sampleOutput: [""],
  },

  configuration: {
    compilation: false,
    testMode: false,
    aiVTuber: false,
    acceptedFormat: "code",
    artifactCollection: [],
    staticAnalysis: {
      default: false,
      libraryRestrictions: {
        isEnabled: false,
        whitelist: [""],
        blacklist: [""],
      },
      networkAccessRestriction: {
        firewallExtranet: {
          isEnabled: false,
          whitelist: [""],
          blacklist: [""],
        },
        connectWithLocal: {
          isEnabled: false,
          whitelist: [""],
          blacklist: [""],
          localService: { file: "local_service.zip" },
        },
      },
    },
  },

  pipeline: {
    fopen: false,
    fwrite: false,
    executionMode: {
      selectedPipelineType: "general",
      general: {
        checker: {
          isCustom: false,
          customChecker: { file: "checker.py" },
        },
      },
      functionOnly: {
        teacherUpload: { file: "makefile.zip" },
        checker: {
          isCustom: false,
          customChecker: { file: "checker.py" },
        },
      },
      interactive: {
        teacherBinary: { file: "Teacher_file" },
        executionOrder: "studentFirst",
      },
    },
    scoringAndTestcase: {
      testCaseInfo: {
        language: 0,
        fillInTemplate: "",
        tasks: [],
      },
      timeLimit: 10000,
      memoryLimit: 1234567,
      scoringScript: {
        isCustom: false,
        customScoringScript: { file: "score.py" },
        customScoringJson: { file: "score.json" },
      },
    },
  },
});

// Convert new structure -> legacy API payload
function toLegacyPayload(p: ProblemDraftV2): LegacyProblemCreateRequest {
  const type: 0 | 2 = p.configuration.acceptedFormat === "zip" ? 2 : 0;
  // New: 1 means Visible; Legacy: 0 means Visible
  const legacyStatus: 0 | 1 = p.status === 1 ? 0 : 1;

  const timeLimit = Number(p.pipeline.scoringAndTestcase.timeLimit) || 0;
  const memoryLimit = Number(p.pipeline.scoringAndTestcase.memoryLimit) || 0;

  const legacyTasks = p.pipeline.scoringAndTestcase.testCaseInfo.tasks.map((t) => ({
    caseCount: Number(t.caseCount) || 0,
    taskScore: Number(t.taskScore) || 0,
    timeLimit,
    memoryLimit,
  }));

  return {
    problemName: p.problemName,
    description: {
      description: p.description.description,
      input: p.description.input,
      output: p.description.output,
      hint: p.description.hint,
      sampleInput: p.description.sampleInput,
      sampleOutput: p.description.sampleOutput,
    },
    courses: p.courses,
    tags: p.description.tags.filter((s) => s.trim() !== ""),
    allowedLanguage: p.description.allowedLanguage,
    quota: p.description.quota,
    type,
    status: legacyStatus,
    testCaseInfo: {
      language: p.pipeline.scoringAndTestcase.testCaseInfo.language,
      fillInTemplate: p.pipeline.scoringAndTestcase.testCaseInfo.fillInTemplate,
      tasks: legacyTasks,
    },
  };
}

function update<K extends keyof ProblemDraftV2>(
  key: K,
  value: ProblemDraftV2[K] | ((arg: ProblemDraftV2[K]) => ProblemDraftV2[K]),
) {
  if (typeof value === "function") {
    newProblem.value[key] = value(newProblem.value[key]);
  } else {
    newProblem.value[key] = value;
  }
}

provide<Ref<ProblemDraftV2>>("problem", newProblem);

async function submit() {
  if (!formElement.value) return;
  formElement.value.isLoading = true;
  try {
    const legacyPayload = toLegacyPayload(newProblem.value);
    const { problemId } = (await api.Problem.create(legacyPayload)).data;
    // No testdata upload here (removed as requested)
    router.push(`/course/${route.params.name}/problem/${problemId}`);
  } catch (error) {
    formElement.value.errorMsg =
      axios.isAxiosError(error) && error.response?.data?.message
        ? error.response.data.message
        : "Unknown error occurred :(";
    throw error;
  } finally {
    formElement.value.isLoading = false;
  }
}

const openPreview = ref<boolean>(false);
const openJSON = ref<boolean>(false);
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-3 justify-between">New Problem</div>

        <problem-form ref="formElement" @update="update" @submit="submit" />

        <div class="divider" />

        <div class="card-title mb-3">
          Preview
          <input v-model="openPreview" type="checkbox" class="toggle" />
        </div>

        <problem-card-v2 v-if="openPreview" :problem="newProblem" preview />

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