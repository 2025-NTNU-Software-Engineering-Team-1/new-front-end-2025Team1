<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { fetcher } from "@/models/api";

type Testcase = {
  input: string;
  expected_output: string;
  explanation?: string;
};

type TestcaseAssignment = {
  task: number;
  case: number;
  input: string;
  output: string;
};

type ProblemContext = {
  title: string;
  description: string;
  input_format: string;
  output_format: string;
};

const props = withDefaults(
  defineProps<{
    problemId?: number | string;
    courseName: string;
    mode?: "student" | "teacher";
    apiKeyId?: string;
    includeOutput?: boolean;
    problemContext?: ProblemContext;
  }>(),
  {
    mode: "student",
    includeOutput: true,
  },
);

const emit = defineEmits<{
  (e: "useTestcases", inputs: string[], outputs?: string[]): void;
  (e: "useTestcasesAdvanced", assignments: TestcaseAssignment[]): void;
  (e: "close"): void;
}>();

const { t, locale } = useI18n();

// State
const hint = ref("");
const isLoading = ref(false);
const error = ref("");
const testcases = ref<Testcase[]>([]);
const selectedIndices = ref<Set<number>>(new Set());

// Task/Case assignment for teacher mode
const taskAssignments = ref<{ task: number; case: number }[]>([]);

// Check if we should show advanced mode (teacher mode)
const isAdvancedMode = computed(() => props.mode === "teacher");

// Generate test cases
async function generate() {
  if (isLoading.value) return;

  isLoading.value = true;
  error.value = "";
  testcases.value = [];
  selectedIndices.value = new Set();
  taskAssignments.value = [];

  try {
    // Use different endpoint based on mode
    const endpoint = props.mode === "teacher" ? "/ai/generate-testcase/teacher" : "/ai/generate-testcase";

    const response = await fetcher.post(endpoint, {
      problem_id: props.problemId || undefined,
      course_name: props.courseName,
      hint: hint.value,
      language: locale.value,
      ...(props.mode === "teacher" && {
        api_key_id: props.apiKeyId,
        include_output: props.includeOutput,
        problem_context: props.problemContext,
      }),
    });

    // Extract testcases array from response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = response.data?.data ?? response.data ?? (response as any).data;

    if (data?.testcases && Array.isArray(data.testcases)) {
      testcases.value = data.testcases;
      // Select all by default
      testcases.value.forEach((_, i) => selectedIndices.value.add(i));
      // Initialize task/case assignments (each testcase = separate task, case 0)
      taskAssignments.value = testcases.value.map((_, i) => ({
        task: i,
        case: 0,
      }));
    } else if (data?.input) {
      // Fallback for old single format
      testcases.value = [
        {
          input: data.input,
          expected_output: data.expected_output || "",
          explanation: data.explanation,
        },
      ];
      selectedIndices.value.add(0);
      taskAssignments.value = [{ task: 0, case: 0 }];
    } else {
      error.value = t("aiChatbot.testcaseGenerator.noResults");
    }
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (err as any)?.response?.data?.message || (err as any)?.message || "";
    if (message.includes("429") || message.includes("quota")) {
      error.value = t("aiChatbot.testcaseGenerator.quotaExceeded");
    } else if (message) {
      error.value = message;
    } else {
      error.value = t("aiChatbot.testcaseGenerator.error");
    }
  } finally {
    isLoading.value = false;
  }
}

// Toggle selection
function toggleSelect(index: number) {
  if (selectedIndices.value.has(index)) {
    selectedIndices.value.delete(index);
  } else {
    selectedIndices.value.add(index);
  }
  // Force reactivity
  selectedIndices.value = new Set(selectedIndices.value);
}

// Update task assignment
function updateTask(index: number, value: number) {
  if (taskAssignments.value[index]) {
    taskAssignments.value[index].task = Math.max(0, Math.min(99, value));
  }
}

// Update case assignment
function updateCase(index: number, value: number) {
  if (taskAssignments.value[index]) {
    taskAssignments.value[index].case = Math.max(0, Math.min(99, value));
  }
}

// Check for duplicate task/case combinations
const hasDuplicates = computed(() => {
  const selectedAssignments = taskAssignments.value.filter((_, i) => selectedIndices.value.has(i));
  const keys = selectedAssignments.map((a) => `${a.task}-${a.case}`);
  return new Set(keys).size !== keys.length;
});

// Check if at least one selected testcase starts from Task 00 Case 00
const hasZeroZero = computed(() => {
  const selectedAssignments = taskAssignments.value.filter((_, i) => selectedIndices.value.has(i));
  return selectedAssignments.some((a) => a.task === 0 && a.case === 0);
});

// Validation: must have 0000.in as starting point
const missingZeroZero = computed(() => {
  if (!isAdvancedMode.value || selectedIndices.value.size === 0) return false;
  return !hasZeroZero.value;
});

// Use selected testcases (simple mode - for student)
function useSelectedSimple() {
  const inputs: string[] = [];
  const outputs: string[] = [];

  testcases.value.forEach((tc, i) => {
    if (selectedIndices.value.has(i)) {
      inputs.push(tc.input);
      if (tc.expected_output) {
        outputs.push(tc.expected_output);
      }
    }
  });

  if (inputs.length > 0) {
    emit("useTestcases", inputs, outputs.length > 0 ? outputs : undefined);
    emit("close");
  }
}

// Use selected testcases (advanced mode - for teacher with task/case assignment)
function useSelectedAdvanced() {
  if (hasDuplicates.value) {
    error.value = t("aiChatbot.testcaseGenerator.duplicateAssignment");
    return;
  }

  if (missingZeroZero.value) {
    error.value = t("aiChatbot.testcaseGenerator.missingZeroZero");
    return;
  }

  const assignments: TestcaseAssignment[] = [];

  testcases.value.forEach((tc, i) => {
    if (selectedIndices.value.has(i) && taskAssignments.value[i]) {
      assignments.push({
        task: taskAssignments.value[i].task,
        case: taskAssignments.value[i].case,
        input: tc.input,
        output: tc.expected_output || "",
      });
    }
  });

  if (assignments.length > 0) {
    emit("useTestcasesAdvanced", assignments);
    emit("close");
  }
}

// Use selected - wrapper that chooses simple or advanced mode
function useSelected() {
  if (isAdvancedMode.value) {
    useSelectedAdvanced();
  } else {
    useSelectedSimple();
  }
}
</script>

<template>
  <dialog class="modal modal-open z-[9999]">
    <div class="modal-box max-h-[80vh] max-w-3xl overflow-y-auto">
      <h3 class="text-lg font-bold">
        {{ t("aiChatbot.testcaseGenerator.title") }}
      </h3>

      <!-- Hint Input -->
      <div class="form-control mt-4">
        <label class="label">
          <span class="label-text">{{ t("aiChatbot.testcaseGenerator.hint") }}</span>
        </label>
        <input
          v-model="hint"
          type="text"
          class="input input-bordered w-full"
          :placeholder="t('aiChatbot.testcaseGenerator.hintPlaceholder')"
          :disabled="isLoading"
          @keyup.enter="generate"
        />
      </div>

      <!-- Generate Button -->
      <div class="mt-4">
        <button
          class="btn btn-primary"
          :class="{ loading: isLoading }"
          :disabled="isLoading"
          @click="generate"
        >
          {{
            isLoading
              ? t("aiChatbot.testcaseGenerator.generating")
              : t("aiChatbot.testcaseGenerator.generate")
          }}
        </button>
      </div>

      <!-- Error -->
      <div v-if="error" class="alert alert-error mt-4">
        <span>{{ error }}</span>
      </div>

      <!-- Multiple Testcases -->
      <div v-if="testcases.length > 0" class="mt-4 space-y-4">
        <div class="flex items-center justify-between">
          <span class="font-semibold">{{
            t("aiChatbot.testcaseGenerator.generated", { count: testcases.length })
          }}</span>
          <span class="text-base-content/70 text-sm">{{ t("aiChatbot.testcaseGenerator.selectToUse") }}</span>
        </div>

        <!-- Advanced Mode Info -->
        <div v-if="isAdvancedMode" class="alert alert-info text-sm">
          <i-uil-info-circle class="h-5 w-5" />
          <span>{{ t("aiChatbot.testcaseGenerator.assignInfo") }}</span>
        </div>

        <!-- Duplicate Warning -->
        <div v-if="hasDuplicates && isAdvancedMode" class="alert alert-warning text-sm">
          <i-uil-exclamation-triangle class="h-5 w-5" />
          <span>{{ t("aiChatbot.testcaseGenerator.duplicateWarning") }}</span>
        </div>

        <!-- Missing 0000 Warning -->
        <div v-if="missingZeroZero && isAdvancedMode" class="alert alert-warning text-sm">
          <i-uil-exclamation-triangle class="h-5 w-5" />
          <span>{{ t("aiChatbot.testcaseGenerator.missingZeroZeroWarning") }}</span>
        </div>

        <div
          v-for="(tc, index) in testcases"
          :key="index"
          class="collapse-arrow bg-base-200 collapse rounded-lg"
        >
          <input type="checkbox" :checked="selectedIndices.has(index)" @change="toggleSelect(index)" />
          <div class="collapse-title flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              :checked="selectedIndices.has(index)"
              @click.stop="toggleSelect(index)"
            />
            <span>{{ t("aiChatbot.testcaseGenerator.testcase") }} #{{ index + 1 }}</span>

            <!-- Show assignment preview in title (teacher mode) -->
            <span v-if="isAdvancedMode && taskAssignments[index]" class="badge badge-outline badge-sm ml-2">
              {{ String(taskAssignments[index].task).padStart(2, "0")
              }}{{ String(taskAssignments[index].case).padStart(2, "0") }}.in
            </span>

            <span v-if="tc.explanation && !isAdvancedMode" class="text-base-content/60 ml-2 truncate text-sm">
              - {{ tc.explanation }}
            </span>
          </div>
          <div class="collapse-content space-y-3">
            <!-- Task/Case Assignment (Teacher Mode) - inside collapse content -->
            <div
              v-if="isAdvancedMode && taskAssignments[index]"
              class="bg-base-300 flex items-center gap-3 rounded-lg p-3"
            >
              <span class="text-sm font-medium">{{ t("aiChatbot.testcaseGenerator.assign") }}:</span>
              <div class="flex items-center gap-2">
                <span class="text-sm">Task:</span>
                <input
                  type="number"
                  class="input input-bordered input-sm w-20"
                  :value="taskAssignments[index].task"
                  min="0"
                  max="99"
                  @input="updateTask(index, parseInt(($event.target as HTMLInputElement).value) || 0)"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm">Case:</span>
                <input
                  type="number"
                  class="input input-bordered input-sm w-20"
                  :value="taskAssignments[index].case"
                  min="0"
                  max="99"
                  @input="updateCase(index, parseInt(($event.target as HTMLInputElement).value) || 0)"
                />
              </div>
              <span class="badge badge-primary">
                → {{ String(taskAssignments[index].task).padStart(2, "0")
                }}{{ String(taskAssignments[index].case).padStart(2, "0") }}.in/out
              </span>
            </div>

            <!-- Explanation (in advanced mode, show inside) -->
            <div v-if="tc.explanation && isAdvancedMode" class="text-sm italic opacity-70">
              {{ tc.explanation }}
            </div>
            <!-- Input -->
            <div>
              <div class="mb-1 text-sm font-semibold">{{ t("aiChatbot.testcaseGenerator.input") }}</div>
              <pre
                class="bg-base-300 max-h-40 overflow-auto rounded p-2 text-sm break-words whitespace-pre-wrap"
                >{{ tc.input }}</pre
              >
            </div>
            <!-- Expected Output -->
            <div>
              <div class="mb-1 text-sm font-semibold">
                {{ t("aiChatbot.testcaseGenerator.expectedOutput") }}
              </div>
              <pre
                class="bg-base-300 max-h-40 overflow-auto rounded p-2 text-sm break-words whitespace-pre-wrap"
                >{{ tc.expected_output }}</pre
              >
            </div>
          </div>
        </div>

        <!-- Use Selected Button -->
        <div>
          <button
            class="btn btn-secondary"
            :disabled="selectedIndices.size === 0 || (isAdvancedMode && (hasDuplicates || missingZeroZero))"
            @click="useSelected"
          >
            {{ t("aiChatbot.testcaseGenerator.useSelected", { count: selectedIndices.size }) }}
          </button>
        </div>
      </div>

      <!-- Modal Actions -->
      <div class="modal-action">
        <button class="btn" @click="emit('close')">
          {{ t("common.close") }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="emit('close')">close</button>
    </form>
  </dialog>
</template>
