<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { hover_zh } from "../../Hovers/hover-zh-tw";
import { hover_en } from "../../Hovers/hover-en";

// ==========================================
// Type Definitions
// ==========================================
interface Sidecar {
  name: string;
  image: string;
  env?: Record<string, string>;
  args?: string[];
}

// ==========================================
// Constants & Props
// ==========================================
const MAX_SIDECARS = 10;
const tooManyError = ref("");

const props = defineProps<{
  modelValue: Sidecar[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: Sidecar[]): void;
}>();

// ==========================================
// State: New Sidecar Form
// ==========================================
const newName = ref("");
const newImage = ref("");
const newArgs = ref("");
const newEnv = ref("");
const errorMessage = ref("");

// ==========================================
// Localization
// ==========================================
const { t, locale } = useI18n();
const hover = computed(() => {
  return locale.value === "english" ? hover_en : hover_zh;
});

// ==========================================
// State: Editing
// ==========================================
// Track which sidecar is being edited
const editingIndex = ref<number | null>(null);
const editArgs = ref("");
const editEnv = ref("");

// ==========================================
// Helper: Auto Resize Textarea
// ==========================================
/**
 * Automatically adjusts the height of a textarea based on its content (scrollHeight).
 * Used for Args and Env inputs to allow wrapping and expansion.
 */
const autoResize = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  target.style.height = "auto"; // Reset height to recalculate
  target.style.height = `${target.scrollHeight}px`; // Set to scroll height
};

/**
 * Trigger resize programmatically (e.g., when entering edit mode)
 */
const triggerResizeOnEdit = async () => {
  await nextTick();
  const textareas = document.querySelectorAll(".auto-resize-textarea");
  textareas.forEach((el) => {
    const target = el as HTMLTextAreaElement;
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  });
};

// ==========================================
// Logic: Parsing & Formatting
// ==========================================
function parseEnvString(envStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!envStr.trim()) return result;
  const lines = envStr.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

function envToString(env: Record<string, string> | undefined): string {
  if (!env) return "";
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

function parseArgsString(argsStr: string): string[] {
  if (!argsStr.trim()) return [];
  return argsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function argsToString(args: string[] | undefined): string {
  if (!args) return "";
  return args.join(",\n");
}

const getSidecarArgs = (sidecar: Sidecar) => argsToString(sidecar.args);

// ==========================================
// Logic: Watchers & Validation
// ==========================================
watch([newName, newImage, newArgs, newEnv], () => {
  const hasAny = !!newArgs.value.trim() || !!newEnv.value.trim();

  if (hasAny && (!newName.value.trim() || !newImage.value.trim())) {
    errorMessage.value = "If you enter Args or Env, Name and Image are required fields.";
  } else {
    errorMessage.value = "";
  }
});

// ==========================================
// Logic: CRUD Operations
// ==========================================
function add() {
  const name = newName.value.trim();
  const image = newImage.value.trim();

  tooManyError.value = "";

  if (props.modelValue.length >= MAX_SIDECARS) {
    tooManyError.value = `A maximum of ${MAX_SIDECARS} Sidecars can be set.`;
    return;
  }

  if (!name || !image) return;

  if (props.modelValue.some((s) => s.name === name)) {
    tooManyError.value = `Sidecar "${name}" Existing`;
    return;
  }

  const env = parseEnvString(newEnv.value);
  const args = parseArgsString(newArgs.value);

  const newList = [...props.modelValue, { name, image, env, args }];
  emit("update:modelValue", newList);

  newName.value = "";
  newImage.value = "";
  newArgs.value = "";
  newEnv.value = "";

  // Reset heights of add form textareas
  const addFormTextareas = document.querySelectorAll(".add-form-textarea");
  addFormTextareas.forEach((el) => ((el as HTMLElement).style.height = "auto"));
}

function remove(index: number) {
  const newList = [...props.modelValue];
  newList.splice(index, 1);
  emit("update:modelValue", newList);
  if (editingIndex.value === index) editingIndex.value = null;
}

function toggleEdit(index: number) {
  if (editingIndex.value === index) {
    commitEdit();
    editingIndex.value = null;
  } else {
    const sidecar = props.modelValue[index];
    editArgs.value = argsToString(sidecar.args);
    editEnv.value = envToString(sidecar.env);
    editingIndex.value = index;
    triggerResizeOnEdit();
  }
}

function commitEdit() {
  if (editingIndex.value === null) return;
  const index = editingIndex.value;
  const newList = [...props.modelValue];
  newList[index] = {
    ...newList[index],
    args: parseArgsString(editArgs.value),
    env: parseEnvString(editEnv.value),
  };
  emit("update:modelValue", newList);
}
</script>

<template>
  <div>
    <div class="border-base-content/30 bg-base-200 mb-4 rounded-lg border p-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-3">
          <div class="form-control">
            <label class="label py-0">
              <span
                class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                :data-tip="hover.sideCarName"
                >{{ t("course.problems.sideCarName") }}</span
              >
            </label>
            <input
              placeholder="e.g. mysql"
              class="input input-bordered input-sm w-full"
              v-model="newName"
              maxlength="2048"
              @keydown.enter.prevent="add"
            />
          </div>
          <div class="form-control">
            <label class="label py-0">
              <span
                class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                :data-tip="hover.sideCarArgs"
                >{{ t("course.problems.sideCarArgs") }}</span
              >
              <span class="label-text-alt opacity-60">
                {{ t("course.problems.sideCarCommaSeparated") }}
              </span>
            </label>
            <textarea
              rows="1"
              placeholder="--port=3306, --host=0.0.0.0"
              class="add-form-textarea textarea textarea-bordered textarea-sm w-full resize-none overflow-hidden break-all text-xs leading-normal"
              v-model="newArgs"
              @input="autoResize"
              @focus="autoResize"
            />
          </div>
        </div>

        <div class="space-y-3">
          <div class="form-control">
            <label class="label py-0">
              <span
                class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                :data-tip="hover.sideCarImage"
                >{{ t("course.problems.sideCarImage") }}</span
              >
            </label>
            <input
              placeholder="e.g. mysql:8.0"
              class="input input-bordered input-sm w-full"
              v-model="newImage"
              maxlength="2048"
              @keydown.enter.prevent="add"
            />
          </div>

          <div class="form-control">
            <label class="label py-0">
              <span
                class="label-text tooltip tooltip-right flex cursor-help items-center gap-1"
                :data-tip="hover.sideCarEnv"
                >{{ t("course.problems.sideCarEnv") }}</span
              >
              <span class="label-text-alt opacity-60">
                {{ t("course.problems.sideCarKEYVALUEPerLine") }}
              </span>
            </label>
            <textarea
              rows="1"
              placeholder="MYSQL_ROOT_PASSWORD=secret&#10;MYSQL_DATABASE=testdb"
              class="add-form-textarea textarea textarea-bordered textarea-sm w-full resize-none overflow-hidden break-all text-xs leading-normal"
              v-model="newEnv"
              @input="autoResize"
              @focus="autoResize"
            />
          </div>
        </div>
      </div>

      <transition name="fade">
        <div
          v-if="errorMessage"
          class="bg-error/10 text-error mt-2 flex items-center gap-2 rounded p-2 text-sm"
        >
          <i-uil-exclamation-circle class="h-4 w-4" />
          <span>{{ errorMessage }}</span>
        </div>
      </transition>

      <div class="mt-4 flex flex-col items-end gap-2">
        <transition name="fade">
          <div v-if="tooManyError" class="bg-error/10 text-error flex items-center gap-1 rounded p-2 text-sm">
            <i-uil-exclamation-circle class="h-4 w-4" />
            <span>{{ tooManyError }}</span>
          </div>
        </transition>

        <button
          class="btn btn-sm btn-primary"
          :disabled="props.modelValue.length >= MAX_SIDECARS"
          @click="add"
        >
          {{ t("course.problems.addSidecar") }}
        </button>
      </div>
    </div>

    <div class="border-base-content/30 overflow-x-auto rounded-lg border">
      <table class="table-sm table w-full table-fixed">
        <thead class="bg-base-200">
          <tr>
            <th class="w-[15%] py-3">{{ t("course.problems.sideCarName") }}</th>
            <th class="w-[25%] py-3">{{ t("course.problems.sideCarImage") }}</th>
            <th class="w-[25%] py-3">{{ t("course.problems.sideCarArgs") }}</th>
            <th class="w-[25%] py-3">{{ t("course.problems.sideCarEnv") }}</th>
            <th class="w-16 py-3 text-center">{{ t("course.problems.sideCarAction") }}</th>
          </tr>
        </thead>

        <tbody>
          <template v-for="(sidecar, idx) in modelValue" :key="idx">
            <tr class="hover align-top">
              <td class="whitespace-normal break-all py-1 font-mono text-sm font-bold">
                {{ sidecar.name }}
              </td>
              <td class="whitespace-normal break-all py-1 font-mono text-sm opacity-80">
                {{ sidecar.image }}
              </td>
              <td class="whitespace-pre-wrap break-all py-1 font-mono text-xs opacity-70">
                {{ getSidecarArgs(sidecar) || "-" }}
              </td>
              <td class="whitespace-normal break-all py-1 font-mono text-xs opacity-70">
                <span v-if="sidecar.env && Object.keys(sidecar.env).length > 0">
                  {{ Object.keys(sidecar.env).length }}
                  {{ t("course.problems.sideCarvars") }}
                </span>
                <span v-else>-</span>
              </td>
              <td class="py-1 text-center">
                <button
                  class="btn btn-ghost btn-xs"
                  :class="{ 'text-success': editingIndex === idx }"
                  @click="toggleEdit(idx)"
                  :title="editingIndex === idx ? 'Save' : 'Edit'"
                >
                  <i-uil-edit v-if="editingIndex !== idx" />
                  <i-uil-check v-else />
                </button>
                <button class="btn btn-ghost btn-xs text-error" @click="remove(idx)" title="Remove">
                  <i-uil-trash-alt />
                </button>
              </td>
            </tr>

            <tr v-if="editingIndex === idx" class="bg-base-200">
              <td colspan="5" class="p-2">
                <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div class="form-control">
                    <label class="label py-0">
                      <span class="label-text-alt">{{ t("course.problems.sideCarArgs") }}</span>
                    </label>
                    <textarea
                      rows="1"
                      class="auto-resize-textarea textarea textarea-bordered textarea-sm w-full resize-none overflow-hidden break-all leading-normal"
                      v-model="editArgs"
                      maxlength="2048"
                      placeholder="--port=3306, --host=0.0.0.0"
                      @input="autoResize"
                      @focus="autoResize"
                    />
                  </div>
                  <div class="form-control">
                    <label class="label py-0">
                      <span class="label-text-alt">{{ t("course.problems.sideCar_EnvKEYVALUE") }}</span>
                    </label>
                    <textarea
                      rows="1"
                      class="auto-resize-textarea textarea textarea-bordered textarea-sm w-full resize-none overflow-hidden break-all leading-normal"
                      v-model="editEnv"
                      maxlength="2048"
                      placeholder="KEY=VALUE"
                      @input="autoResize"
                      @focus="autoResize"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <tr v-if="modelValue.length === 0">
            <td colspan="5" class="py-2 text-center text-sm opacity-70">
              {{ t("course.problems.noSidecarsConfigured") }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
