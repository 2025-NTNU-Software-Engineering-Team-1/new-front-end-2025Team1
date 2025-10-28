<script setup lang="ts">
import { inject, ref, Ref, computed } from "vue";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, minValue, between, helpers } from "@vuelidate/validators";
import DescriptionSection from "./Sections/DescriptionSection.vue";
import ConfigurationSection from "./Sections/ConfigurationSection.vue";
import PipelineSection from "./Sections/PipelineSection.vue";

const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;

const emits = defineEmits<{
  (e: "update", key: keyof ProblemForm, value: ProblemForm[typeof key]): void;
  (e: "submit"): void;
}>();

const modelForVuelidate = computed(() => ({
  problemName: problem.value.problemName,
  description: problem.value.description,
  tags: problem.value.tags,
  allowedLanguage: problem.value.allowedLanguage,
  quota: problem.value.quota,
  testCaseInfo: problem.value.testCaseInfo,
  // 讓 key 一定存在
  config: problem.value.config,
  pipeline: problem.value.pipeline,
  assets: problem.value.assets,
}));

const isLoading = ref(false);
const errorMsg = ref("");
defineExpose({ isLoading, errorMsg });

const rules = {
  problemName: { required, maxLength: maxLength(64) },
  description: {
    description: { maxLength: maxLength(10000) },
    input: { maxLength: maxLength(10000) },
    output: { maxLength: maxLength(10000) },
    hint: { maxLength: maxLength(10000) },
    sampleInput: {
      itemMaxLength: helpers.withMessage("Each sample input must be <= 1024 chars", (v: string[]) =>
        v.every((d) => d.length <= 1024),
      ),
    },
    sampleOutput: {
      itemMaxLength: helpers.withMessage("Each sample output must be <= 1024 chars", (v: string[]) =>
        v.every((d) => d.length <= 1024),
      ),
    },
  },
  tags: { itemMaxLength: (v: string[]) => v.every((d) => d.length <= 16) },
  allowedLanguage: { required, between: between(1, 7) },
  quota: { required, minValue: minValue(-1) },
  testCaseInfo: {
    tasks: {
      scoreSum: helpers.withMessage(
        "The sum of all subtasks score must be 100",
        (tasks: ProblemTestCase[]) => tasks.reduce((a, c) => a + (c?.taskScore || 0), 0) === 100,
      ),
    },
  },
  // new validations
  config: {
    acceptedFormat: {
      required: helpers.withMessage(
        "Accepted format is required",
        (v: any, p: any) => !!p?.config?.acceptedFormat,
      ),
    },
  },
  pipeline: {
    executionMode: {
      required: helpers.withMessage("Execution mode is required", (v: any, p: any) =>
        ["general", "functionOnly", "interactive"].includes(p?.pipeline?.executionMode || ""),
      ),
    },
  },
  assets: {
    checkerPyRequired: helpers.withMessage(
      "checker.py is required when Custom Checker is enabled",
      (_: any, p: any) => {
        const mode = p?.pipeline?.executionMode;
        const cc = !!p?.pipeline?.customChecker;
        if (!cc) return true;
        if (mode === "general" || mode === "functionOnly") {
          return !!p?.assets?.checkerPy;
        }
        return true;
      },
    ),
    makefileZipRequired: helpers.withMessage(
      "makefile.zip is required when Execution Mode is functionOnly",
      (_: any, p: any) => (p?.pipeline?.executionMode === "functionOnly" ? !!p?.assets?.makefileZip : true),
    ),
    teacherFileRequired: helpers.withMessage(
      "Teacher_file is required when Execution Mode is interactive",
      (_: any, p: any) => (p?.pipeline?.executionMode === "interactive" ? !!p?.assets?.teacherFile : true),
    ),
    localServiceZipRequired: helpers.withMessage(
      "local_service.zip is required when Connect With Local is enabled",
      (_: any, p: any) =>
        p?.config?.staticAnalysis?.custom &&
        p?.config?.staticAnalysis?.networkAccessRestriction?.connectWithLocal?.enabled
          ? !!p?.assets?.localServiceZip
          : true,
    ),
    scoringFilesRequired: helpers.withMessage(
      "score.py and score.json are required when Scoring Script Custom is enabled",
      (_: any, p: any) => {
        const custom = (p as any)?.pipeline?.scoringScript?.custom === true;
        return custom ? !!p?.assets?.scorePy && !!p?.assets?.scoreJson : true;
      },
    ),
  },
};

const v$ = useVuelidate(rules, modelForVuelidate);

function update<K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) {
  emits("update", key, value);
  // touch top-level fields when updated
  if ((v$.value as any)[key]) {
    (v$.value as any)[key].$touch?.();
  }
}

async function submit() {
  const ok = await v$.value.$validate();
  if (ok) emits("submit");
}
</script>

<template>
  <div v-if="errorMsg" class="alert alert-error shadow-lg">
    <div>
      <i-uil-times-circle />
      <span>{{ errorMsg }}</span>
    </div>
  </div>

  <!-- Level 1: name + hidden -->
  <div class="grid grid-cols-2 gap-y-4">
    <div class="form-control w-full max-w-xs">
      <label class="label">
        <span class="label-text">Problem name</span>
      </label>
      <input
        type="text"
        :class="['input input-bordered w-full max-w-xs', v$.problemName.$error && 'input-error']"
        :value="problem.problemName"
        @input="update('problemName', ($event.target as HTMLInputElement).value)"
      />
      <label class="label" v-show="v$.problemName.$error">
        <span class="label-text-alt text-error" v-text="v$.problemName.$errors[0]?.$message" />
      </label>
    </div>

    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Hidden</span>
        <input
          type="checkbox"
          class="toggle toggle-success"
          :checked="problem.status === 1"
          @change="update('status', (problem.status ^ 1) as 0 | 1)"
        />
      </label>
    </div>
  </div>

  <!-- Level 1: collapsible sections -->
  <div class="mt-4 flex flex-col gap-3">
    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title">Set Description</div>
      <div class="collapse-content">
        <DescriptionSection :v$="v$" @update="update" />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title">Set Configuration</div>
      <div class="collapse-content">
        <ConfigurationSection />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title">Set Pipeline</div>
      <div class="collapse-content">
        <PipelineSection :v$="v$" />
      </div>
    </div>
  </div>

  <div class="mt-6 flex justify-end">
    <button :class="['btn btn-success', isLoading && 'loading']" @click="submit">
      <i-uil-file-upload-alt class="mr-1 lg:h-5 lg:w-5" /> Submit
    </button>
  </div>
</template>
