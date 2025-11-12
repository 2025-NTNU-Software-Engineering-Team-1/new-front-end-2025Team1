<script setup lang="ts">
import { ref, watchEffect, provide, Ref } from "vue";
import { useTitle } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import api, { fetcher } from "@/models/api";
import axios from "axios";
import AdminProblemForm from "@/components/Problem/Admin/AdminProblemForm.vue";

const route = useRoute();
const router = useRouter();
useTitle(`Edit Problem - ${route.params.id} - ${route.params.name} | Normal OJ`);

const formElement = ref<InstanceType<typeof AdminProblemForm>>();

const {
  data: problem,
  error: fetchError,
  isLoading: isFetching,
} = useAxios<Problem>(`/problem/view/${route.params.id}`, fetcher);

const edittingProblem = ref<ProblemForm>();

watchEffect(() => {
  if (!problem.value) return;

  edittingProblem.value = {
    ...problem.value,
    testCaseInfo: {
      language: 0,
      fillInTemplate: "",
      tasks: problem.value.testCase.slice(),
    },
    config: problem.value.config || {
      trialMode: false,
      aiVTuber: false,
      aiVTuberMaxToken: 0,
      aiVTuberMode: "guided",
      acceptedFormat: "code",
      maxStudentZipSizeMB: 50,
      networkAccessRestriction: {
        enabled: false,
        firewallExtranet: { enabled: false, whitelist: [], blacklist: [] },
        connectWithLocal: {
          enabled: false,
          whitelist: [],
          blacklist: [],
          localServiceZip: null,
        },
      },
      artifactCollection: [],
    },
    pipeline: {
      fopen: (problem.value as any)?.pipeline?.fopen ?? false,
      fwrite: (problem.value as any)?.pipeline?.fwrite ?? false,
      executionMode: (problem.value as any)?.pipeline?.executionMode || "general",
      customChecker: (problem.value as any)?.pipeline?.customChecker ?? false,
      teacherFirst: (problem.value as any)?.pipeline?.teacherFirst ?? false,
      staticAnalysis: {
        libraryRestrictions: {
          enabled: (problem.value as any)?.pipeline?.staticAnalysis?.libraryRestrictions?.enabled ?? false,
          whitelist: (problem.value as any)?.pipeline?.staticAnalysis?.libraryRestrictions?.whitelist || [],
          blacklist: (problem.value as any)?.pipeline?.staticAnalysis?.libraryRestrictions?.blacklist || [],
        },
      },
      scoringScript: (problem.value as any)?.pipeline?.scoringScript || { custom: false },
    },
    assets: (problem.value as any).assets || {
      aiVTuberFiles: null,
      checkerPy: null,
      makefileZip: null,
      teacherFile: null,
      scorePy: null,
      localServiceZip: null,
      testdataZip: null,
    },
  } as ProblemForm;
});

function update<K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) {
  if (!edittingProblem.value) return;
  edittingProblem.value[key] = value;
}

provide<Ref<ProblemForm | undefined>>("problem", edittingProblem);

const openPreview = ref(false);
const openJSON = ref(false);

const mockProblemMeta = {
  owner: "",
  highScore: 0,
  submitCount: 0,
  ACUser: 0,
  submitter: 0,
};

async function submit() {
  if (!edittingProblem.value || !formElement.value) return;
  formElement.value.isLoading = true;
  try {
    const pid = Number(route.params.id);

    const cfg = {
      ...edittingProblem.value.config,
      aiVTuber: edittingProblem.value.config.aiVTuber,
      aiVTuberMaxToken: edittingProblem.value.config.aiVTuberMaxToken,
      aiVTuberMode: edittingProblem.value.config.aiVTuberMode,
    };
    const pipe = { ...edittingProblem.value.pipeline };

    const fd = new FormData();
    fd.append(
      "meta",
      JSON.stringify({
        config: cfg,
        pipeline: pipe,
      }),
    );

    const assets = edittingProblem.value.assets;
    if (assets?.aiVTuberACFiles) assets.aiVTuberACFiles.forEach((f) => fd.append("aiVTuberFiles", f));
    if (assets?.testdataZip) fd.append("case", assets.testdataZip);
    if (assets?.checkerPy) fd.append("checker.py", assets.checkerPy);
    if (assets?.makefileZip) fd.append("makefile.zip", assets.makefileZip);
    if (assets?.teacherFile) fd.append("Teacher_file", assets.teacherFile);
    if (assets?.scorePy) fd.append("score.py", assets.scorePy);
    if (assets?.localServiceZip) fd.append("local_service.zip", assets.localServiceZip);

    await api.Problem.modify(pid, edittingProblem.value);
    await api.Problem.uploadAssetsV2(pid, fd);

    router.push(`/course/${route.params.name}/problem/${route.params.id}`);
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

async function discard() {
  if (!confirm("Are u sure?")) return;
  router.push(`/course/${route.params.name}/problems`);
}

async function delete_() {
  if (!formElement.value) return;
  formElement.value.isLoading = true;
  if (!confirm("Are u sure?")) return;
  try {
    await api.Problem.delete(route.params.id as string);
    router.push(`/course/${route.params.name}/problems`);
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
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-3 justify-between">
          Edit Problem: {{ $route.params.id }} - {{ edittingProblem?.problemName }}
          <div class="flex gap-x-3">
            <button
              :class="['btn btn-outline btn-error btn-sm lg:btn-md', formElement?.isLoading && 'loading']"
              @click="delete_"
            >
              <i-uil-trash-alt class="mr-1 lg:h-5 lg:w-5" /> Delete
            </button>
            <button
              :class="['btn btn-warning btn-sm lg:btn-md', formElement?.isLoading && 'loading']"
              @click="discard"
            >
              <i-uil-times-circle class="mr-1 lg:h-5 lg:w-5" /> Discard Changes
            </button>
          </div>
        </div>

        <data-status-wrapper :error="fetchError" :is-loading="isFetching">
          <template #loading><skeleton-card /></template>
          <template #data>
            <template v-if="edittingProblem">
              <admin-problem-form ref="formElement" @update="update" @submit="submit" />

              <div class="divider" />

              <div class="card-title mb-3">
                Preview
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

              <pre v-if="openJSON" class="whitespace-pre-wrap rounded bg-base-200 p-2"
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
