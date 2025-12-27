<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { fetcher } from "@/models/api";

type Testcase = {
  input: string;
  expected_output: string;
  explanation?: string;
};

const props = defineProps<{
  problemId: number | string;
  courseName: string;
}>();

const emit = defineEmits<{
  (e: "useTestcases", inputs: string[]): void;
  (e: "close"): void;
}>();

const { t, locale } = useI18n();

// State
const hint = ref("");
const isLoading = ref(false);
const error = ref("");
const testcases = ref<Testcase[]>([]);
const selectedIndices = ref<Set<number>>(new Set());

// Generate test cases
async function generate() {
  if (isLoading.value) return;

  isLoading.value = true;
  error.value = "";
  testcases.value = [];
  selectedIndices.value = new Set();

  try {
    const response = await fetcher.post("/ai/generate-testcase", {
      problem_id: props.problemId,
      course_name: props.courseName,
      hint: hint.value,
      language: locale.value, // Pass user's language setting
    });

    // Extract testcases array from response
    const data = response.data?.data ?? response.data ?? (response as any).data;

    if (data?.testcases && Array.isArray(data.testcases)) {
      testcases.value = data.testcases;
      // Select all by default
      testcases.value.forEach((_, i) => selectedIndices.value.add(i));
    } else if (data?.input) {
      // Fallback for old single format
      testcases.value = [
        {
          input: data.input,
          expected_output: data.expected_output,
          explanation: data.explanation,
        },
      ];
      selectedIndices.value.add(0);
    } else {
      throw new Error("Invalid response");
    }
  } catch (err: any) {
    const message = err?.response?.data?.message || err?.message || "";
    if (message.includes("No API key")) {
      error.value = t("aiChatbot.testcaseGenerator.noApiKey");
    } else if (message.includes("quota")) {
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

// Use selected testcases (only inputs are needed for trial mode)
function useSelected() {
  const inputs: string[] = [];

  testcases.value.forEach((tc, i) => {
    if (selectedIndices.value.has(i)) {
      inputs.push(tc.input);
    }
  });

  if (inputs.length > 0) {
    emit("useTestcases", inputs);
    emit("close");
  }
}
</script>

<template>
  <dialog class="modal modal-open">
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
            <span v-if="tc.explanation" class="text-base-content/60 ml-2 truncate text-sm">
              - {{ tc.explanation }}
            </span>
          </div>
          <div class="collapse-content space-y-3">
            <!-- Input -->
            <div>
              <div class="mb-1 text-sm font-semibold">{{ t("aiChatbot.testcaseGenerator.input") }}</div>
              <pre
                class="bg-base-300 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-sm"
                >{{ tc.input }}</pre
              >
            </div>
            <!-- Expected Output -->
            <div>
              <div class="mb-1 text-sm font-semibold">
                {{ t("aiChatbot.testcaseGenerator.expectedOutput") }}
              </div>
              <pre
                class="bg-base-300 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded p-2 text-sm"
                >{{ tc.expected_output }}</pre
              >
            </div>
          </div>
        </div>

        <!-- Use Selected Button -->
        <div>
          <button class="btn btn-secondary" :disabled="selectedIndices.size === 0" @click="useSelected">
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
