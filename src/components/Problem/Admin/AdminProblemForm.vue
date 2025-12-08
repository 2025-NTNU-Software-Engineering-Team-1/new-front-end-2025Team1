<script setup lang="ts">
import { inject, ref, Ref, watchEffect, provide } from "vue";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, between, helpers } from "@vuelidate/validators";

import DescriptionSection from "./Sections/DescriptionSection.vue";
import ConfigurationSection from "./Sections/ConfigurationSection.vue";
import PipelineSection from "./Sections/PipelineSection.vue";
import TestDataSection from "./Sections/TestDataSection.vue";

/* ========================================================
   工具函式
   ======================================================== */
function getAllowedFileExtensions(allowedLanguage: number): string[] {
  const list: string[] = [];
  if (allowedLanguage & 1) list.push(".c");
  if (allowedLanguage & 2) list.push(".cpp");
  if (allowedLanguage & 4) list.push(".py");
  return list;
}

/* ========================================================
   初始化與 Ref
   ======================================================== */
const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;

const emits = defineEmits<{
  (e: "update", key: keyof ProblemForm, value: ProblemForm[typeof key]): void;
  (e: "submit"): void;
}>();

const isLoading = ref(false);
const errorMsg = ref("");

defineExpose({ isLoading, errorMsg });

/* ========================================================
   雙版本相容的 normalize 函式
   ======================================================== */
function normalizeLibraryRestrictions(raw: any) {
  const base = {
    enabled: false,
    whitelist: { syntax: [], imports: [], headers: [], functions: [] },
    blacklist: { syntax: [], imports: [], headers: [], functions: [] },
  };
  if (!raw) return base;

  // 若是新版 (含物件內部 keys)，直接回傳
  const isNewStructure =
    typeof raw.whitelist === "object" &&
    raw.whitelist !== null &&
    Array.isArray(raw.whitelist.syntax) &&
    Array.isArray(raw.blacklist.syntax);

  if (isNewStructure) {
    // 保留全部，但確保 keys 存在
    return {
      enabled: !!raw.enabled,
      whitelist: {
        syntax: raw.whitelist.syntax ?? [],
        imports: raw.whitelist.imports ?? [],
        headers: raw.whitelist.headers ?? [],
        functions: raw.whitelist.functions ?? [],
      },
      blacklist: {
        syntax: raw.blacklist.syntax ?? [],
        imports: raw.blacklist.imports ?? [],
        headers: raw.blacklist.headers ?? [],
        functions: raw.blacklist.functions ?? [],
      },
    };
  }

  // 舊版: whitelist / blacklist 直接是陣列
  const asArr = (v: any) => (Array.isArray(v) ? v : []);
  return {
    enabled: !!raw.enabled,
    whitelist: {
      syntax: asArr(raw.whitelist),
      imports: [],
      headers: [],
      functions: [],
    },
    blacklist: {
      syntax: asArr(raw.blacklist),
      imports: [],
      headers: [],
      functions: [],
    },
  };
}

/* ========================================================
   在表單初始化自動修正結構
   ======================================================== */
watchEffect(() => {
  if (!problem.value) return;

  // 防止 pipeline 或 staticAnalysis 未初始化
  if (!problem.value.pipeline) problem.value.pipeline = {} as any;
  if (!problem.value.pipeline.staticAnalysis) problem.value.pipeline.staticAnalysis = {} as any;

  const staticAnalysis = (problem.value.pipeline.staticAnalysis ??= {} as any);
  const libs = staticAnalysis.libraryRestrictions;

  if (!libs || typeof libs !== "object") {
    staticAnalysis.libraryRestrictions = normalizeLibraryRestrictions(null);
  } else {
    staticAnalysis.libraryRestrictions = normalizeLibraryRestrictions(libs);
  }
});

/* ========================================================
   驗證規則
   ======================================================== */
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

  tags: {
    itemMaxLength: (v: string[]) => v.every((d) => d.length <= 16),
  },

  allowedLanguage: { required, between: between(1, 7) },

  quota: {
    required,
    validRange: helpers.withMessage(
      "Quota must be -1 (unlimited) or between 1 and 500",
      (v: number) => v === -1 || (v >= 1 && v <= 500),
    ),
  },

  testCaseInfo: {
    tasks: {
      scoreSum: helpers.withMessage(
        "The sum of all subtasks score must be 100",
        (tasks: ProblemTestCase[]) => tasks.reduce((a, c) => a + (c?.taskScore || 0), 0) === 100,
      ),
    },
  },

  config: {
    acceptedFormat: {
      required: helpers.withMessage(
        "Accepted format is required",
        () => !!problem.value.config.acceptedFormat,
      ),
    },
    vtuberApiKeyRequired: helpers.withMessage(
      "AI VTuber is enabled: please select at least one API key.",
      () => {
        const cfg = problem.value.config;
        if (!cfg?.aiVTuber) return true;
        return (cfg.aiVTuberApiKeys?.length ?? 0) > 0;
      },
    ),
  },

  pipeline: {
    executionMode: {
      required: helpers.withMessage("Execution mode is required", () =>
        ["general", "functionOnly", "interactive"].includes(problem.value.pipeline.executionMode),
      ),
    },
  },

  assets: {
    aiVTuberACFiles: {
      requiredWhenVtuber: helpers.withMessage(
        "AI VTuber is enabled: please upload at least one AC file.",
        () => {
          const cfg = problem.value.config;
          if (!cfg?.aiVTuber) return true;
          return (problem.value.assets?.aiVTuberACFiles?.length ?? 0) > 0;
        },
      ),
    },

    trialModeACFiles: {
      requiredWhenTrial: helpers.withMessage(
        "Trial Mode is enabled: please upload at least one AC file.",
        () => {
          const cfg = problem.value.config;
          if (!cfg?.trialMode) return true;
          return (problem.value.assets?.trialModeACFiles?.length ?? 0) > 0;
        },
      ),
    },

    trialModePublicTestDataZip: {
      requiredWhenTrial: helpers.withMessage(
        "Trial Mode is enabled: please upload Public Test Data (.zip).",
        () => {
          const cfg = problem.value.config;
          if (!cfg?.trialMode) return true;
          return !!problem.value.assets?.trialModePublicTestDataZip;
        },
      ),
    },

    teacherFile: {
      validExtension: helpers.withMessage(
        (ctx) => {
          const exts = getAllowedFileExtensions(problem.value.allowedLanguage);
          return `Teacher file must have one of the following extensions: ${exts.join(", ")}`;
        },
        () => {
          const file = problem.value.assets?.teacherFile;
          if (!file) return true; // Allow null/undefined
          if (problem.value.pipeline?.executionMode !== "interactive") return true;
          const exts = getAllowedFileExtensions(problem.value.allowedLanguage);
          const fileName = file.name.toLowerCase();
          return exts.some((ext) => fileName.endsWith(ext.toLowerCase()));
        },
      ),
    },

    makefileZip: {
      validExtension: helpers.withMessage("Makefile must be a .zip file", () => {
        const file = problem.value.assets?.makefileZip;
        if (!file) return true;
        if (problem.value.pipeline?.executionMode !== "functionOnly") return true;
        return file.name.toLowerCase().endsWith(".zip");
      }),
    },

    customCheckerPy: {
      validExtension: helpers.withMessage("Custom checker must be a .py file", () => {
        const file = problem.value.assets?.customCheckerPy;
        if (!file) return true;
        if (!problem.value.pipeline?.customChecker) return true;
        return file.name.toLowerCase().endsWith(".py");
      }),
    },

    scorePy: {
      validExtension: helpers.withMessage("Scoring script must be a .py file", () => {
        const file = problem.value.assets?.scorePy;
        if (!file) return true;
        if (!problem.value.pipeline?.scoringScript?.custom) return true;
        return file.name.toLowerCase().endsWith(".py");
      }),
    },

    dockerfilesZip: {
      validExtension: helpers.withMessage("Dockerfiles must be a .zip file", () => {
        const file = problem.value.assets?.dockerfilesZip;
        if (!file) return true;
        return file.name.toLowerCase().endsWith(".zip");
      }),
    },
  },
};

/* ========================================================
   Vuelidate 初始化 & 方法
   ======================================================== */
const v$ = useVuelidate(rules, problem);

// Provide v$ to child components (e.g., PipelineSection)
provide("v$", v$);

function update<K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) {
  emits("update", key, value);
  if ((v$.value as any)[key]) (v$.value as any)[key].$touch?.();
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

  <!-- 第一層：題名與隱藏開關 -->
  <div class="grid grid-cols-2 gap-y-4">
    <div class="form-control w-full max-w-xs">
      <label class="label">
        <span class="label-text">Problem name</span>
      </label>

      <input
        type="text"
        :class="['input input-bordered w-full max-w-xs', v$.problemName.$error && 'input-error']"
        :value="problem.problemName"
        @input="update('problemName', ($event.target as HTMLInputElement).value)"
      />

      <label v-show="v$.problemName.$error" class="label">
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

  <!-- Section fold panels -->
  <div class="mt-4 flex flex-col gap-3">
    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Description</div>
      <div class="collapse-content">
        <DescriptionSection :v$="v$" @update="update" />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Configuration</div>
      <div class="collapse-content">
        <ConfigurationSection />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Pipeline</div>
      <div class="collapse-content">
        <PipelineSection />
      </div>
    </div>

    <div class="collapse collapse-arrow rounded-box bg-base-200">
      <input type="checkbox" class="peer" />
      <div class="collapse-title font-semibold">Set Test Data</div>
      <div class="collapse-content">
        <TestDataSection :v$="v$" />
      </div>
    </div>
  </div>

  <!-- 提交按鈕 -->
  <div class="mt-6 flex justify-end">
    <button :class="['btn btn-success', isLoading && 'loading']" @click="submit">
      <i-uil-file-upload-alt class="mr-1 lg:h-5 lg:w-5" /> Submit
    </button>
  </div>
</template>
