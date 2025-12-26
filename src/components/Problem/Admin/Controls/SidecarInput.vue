<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

interface Sidecar {
  name: string;
  image: string;
  env?: Record<string, string>;
  args?: string[];
}

const props = defineProps<{
  modelValue: Sidecar[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: Sidecar[]): void;
}>();

const newName = ref("");
const newImage = ref("");
const newArgs = ref("");
const newEnv = ref("");
const { t } = useI18n();

// Track which sidecar is being edited
const editingIndex = ref<number | null>(null);

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
  return args.join(", ");
}

function add() {
  const name = newName.value.trim();
  const image = newImage.value.trim();

  if (!name || !image) return;

  if (props.modelValue.some((s) => s.name === name)) {
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
}

function remove(index: number) {
  const newList = [...props.modelValue];
  newList.splice(index, 1);
  emit("update:modelValue", newList);
  if (editingIndex.value === index) {
    editingIndex.value = null;
  }
}

function toggleEdit(index: number) {
  if (editingIndex.value === index) {
    // Commit changes when closing edit
    commitEdit();
    editingIndex.value = null;
  } else {
    // Initialize edit buffers with current values
    const sidecar = props.modelValue[index];
    editArgs.value = argsToString(sidecar.args);
    editEnv.value = envToString(sidecar.env);
    editingIndex.value = index;
  }
}

// Local buffers for editing
const editArgs = ref("");
const editEnv = ref("");

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

const getSidecarArgs = (sidecar: Sidecar) => argsToString(sidecar.args);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getSidecarEnv = (sidecar: Sidecar) => envToString(sidecar.env);
</script>

<template>
  <div>
    <!-- Add New Sidecar Form -->
    <div class="border-base-content/30 bg-base-200 mb-4 rounded-lg border p-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- Left Column: Name & Image -->
        <div class="space-y-3">
          <div class="form-control">
            <label class="label py-0">
              <span class="label-text">{{t("course.problems.sideCarName")}}</span>
            </label>
            <input
              placeholder="e.g. mysql"
              class="input input-bordered input-sm w-full"
              v-model="newName"
              @keydown.enter.prevent="add"
            />
          </div>
          <div class="form-control">
            <label class="label py-0">
              <span class="label-text">{{t("course.problems.sideCarImage")}}</span>
            </label>
            <input
              placeholder="e.g. mysql:8.0"
              class="input input-bordered input-sm w-full"
              v-model="newImage"
              @keydown.enter.prevent="add"
            />
          </div>
        </div>
        <!-- Right Column: Args & Env -->
        <div class="space-y-3">
          <div class="form-control">
            <label class="label py-0">
              <span class="label-text">{{t("course.problems.sideCarArgs")}}</span>
              <span class="label-text-alt opacity-60">{{t("course.problems.sideCarCommaSeparated")}}</span>
            </label>
            <input
              placeholder="--port=3306, --host=0.0.0.0"
              class="input input-bordered input-sm w-full"
              v-model="newArgs"
            />
          </div>
          <div class="form-control">
            <label class="label py-0">
              <span class="label-text">{{t("course.problems.sideCarEnv")}}</span>
              <span class="label-text-alt opacity-60">{{t("course.problems.sideCarKEYVALUEPerLine")}}</span>
            </label>
            <textarea
              placeholder="MYSQL_ROOT_PASSWORD=secret&#10;MYSQL_DATABASE=testdb"
              class="textarea textarea-bordered textarea-sm h-16 w-full text-xs"
              v-model="newEnv"
            />
          </div>
        </div>
      </div>
      <!-- Add Button -->
      <div class="mt-4 flex justify-end">
        <button class="btn btn-sm btn-primary" @click="add">{{t("course.problems.addSidecar")}}</button>
      </div>
    </div>

    <div class="border-base-content/30 overflow-x-auto rounded-lg border">
      <table class="table-sm table w-full">
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
            <tr class="hover">
              <td class="py-1 font-mono text-sm font-bold">{{ sidecar.name }}</td>
              <td class="py-1 font-mono text-sm opacity-80">{{ sidecar.image }}</td>
              <td class="py-1 font-mono text-xs opacity-70">
                {{ getSidecarArgs(sidecar) || "-" }}
              </td>
              <td class="py-1 font-mono text-xs opacity-70">
                <span v-if="sidecar.env && Object.keys(sidecar.env).length > 0">
                  {{ Object.keys(sidecar.env).length }} {{t("course.problems.sideCarvars")}}
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
            <!-- Inline edit row -->
            <tr v-if="editingIndex === idx" class="bg-base-200">
              <td colspan="5" class="p-2">
                <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div class="form-control">
                    <label class="label py-0"><span class="label-text-alt">{{ t("course.problems.sideCarArgs") }}</span></label>
                    <input
                      class="input-bordered input input-sm"
                      v-model="editArgs"
                      placeholder="--port=3306, --host=0.0.0.0"
                    />
                  </div>
                  <div class="form-control">
                    <label class="label py-0"><span class="label-text-alt">{{ t("course.problems.sideCar_EnvKEYVALUE") }}</span></label>
                    <textarea
                      class="textarea-bordered textarea textarea-sm h-16 text-xs"
                      v-model="editEnv"
                      placeholder="KEY=VALUE"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <tr v-if="modelValue.length === 0">
            <td colspan="5" class="py-2 text-center text-sm opacity-70">{{ t("course.problems.noSidecarsConfigured") }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
