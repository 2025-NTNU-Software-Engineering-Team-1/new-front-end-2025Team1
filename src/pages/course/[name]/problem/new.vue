<script setup lang="ts">
import { ref, provide, Ref } from "vue";
import { useTitle } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import api from "@/models/api";
import AdminProblemForm from "@/components/Problem/Admin/AdminProblemForm.vue";

const route = useRoute();
const router = useRouter();
useTitle(`New Problem - ${route.params.name} | Normal OJ`);

const formElement = ref<InstanceType<typeof AdminProblemForm>>();

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
  defaultCode: "",
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
  canViewStdout: false,

  // NEW sections
  config: {
    compilation: false,
    trialMode: false,
    aiVTuber: false,
    acceptedFormat: "code",
    staticAnalysis: {
      custom: false,
      libraryRestrictions: { enabled: false, whitelist: [], blacklist: [] },
      networkAccessRestriction: {
        enabled: false,
        firewallExtranet: { enabled: false, whitelist: [], blacklist: [] },
        connectWithLocal: { enabled: false, whitelist: [], blacklist: [], localServiceZip: null },
      },
    },
    artifactCollection: [],
  },
  pipeline: {
    fopen: false,
    fwrite: false,
    executionMode: "general",
    customChecker: false,
    teacherFirst: false,
    // optional scoring flag structure
    scoringScript: { custom: false } as any,
  },
  assets: {
    checkerPy: null,
    makefileZip: null,
    teacherFile: null,
    scorePy: null,
    scoreJson: null,
    localServiceZip: null,
    testdataZip: null,
  },
});

function update<K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) {
  newProblem.value[key] = value;
}
provide<Ref<ProblemForm>>("problem", newProblem);

async function submit() {
  console.log("submit 時的 testdataZip：", newProblem.value.assets?.testdataZip);
  if (!formElement.value) return;
  formElement.value.isLoading = true;
  try {
    // 1) create (same body shape as before; backend ignores unknown optional fields)
    const { problemId } = (await api.Problem.create({ ...newProblem.value })).data;

    // 2) upload assets + meta
    const fd = new FormData();
    fd.append(
      "meta",
      JSON.stringify({
        config: newProblem.value.config,
        pipeline: newProblem.value.pipeline,
      }),
    );
    if (newProblem.value.assets?.testdataZip) fd.append("case", newProblem.value.assets.testdataZip);
    if (newProblem.value.assets?.checkerPy) fd.append("checker.py", newProblem.value.assets.checkerPy);
    if (newProblem.value.assets?.makefileZip) fd.append("makefile.zip", newProblem.value.assets.makefileZip);
    if (newProblem.value.assets?.teacherFile) fd.append("Teacher_file", newProblem.value.assets.teacherFile);
    if (newProblem.value.assets?.scorePy) fd.append("score.py", newProblem.value.assets.scorePy);
    if (newProblem.value.assets?.scoreJson) fd.append("score.json", newProblem.value.assets.scoreJson);
    if (newProblem.value.assets?.localServiceZip)
      fd.append("local_service.zip", newProblem.value.assets.localServiceZip);

    await api.Problem.uploadAssetsV2(problemId, fd);

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
const mockProblemMeta = {
  owner: "",
  highScore: 0,
  submitCount: 0,
  ACUser: 0,
  submitter: 0,
};

const openJSON = ref<boolean>(false);
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-3 justify-between">New Problem</div>

        <!-- Level 1: Admin form (name/hidden + collapses) -->
        <admin-problem-form ref="formElement" @update="update" @submit="submit" />

        <div class="divider" />

        <!-- Preview (Level 1) -->
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

        <!-- JSON (Level 1) -->
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
