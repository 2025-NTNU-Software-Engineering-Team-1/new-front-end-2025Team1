<script setup lang="ts">
import { ref, computed } from "vue";

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
    editingIndex.value = null;
  } else {
    editingIndex.value = index;
  }
}

function updateSidecar(index: number, field: "args" | "env", value: string) {
  const newList = [...props.modelValue];
  if (field === "args") {
    newList[index].args = parseArgsString(value);
  } else {
    newList[index].env = parseEnvString(value);
  }
  emit("update:modelValue", newList);
}

const getSidecarArgs = (sidecar: Sidecar) => argsToString(sidecar.args);
const getSidecarEnv = (sidecar: Sidecar) => envToString(sidecar.env);
</script>

<template>
  <div>
    <div class="border-base-300 bg-base-200 mb-4 rounded-lg border p-3">
      <!-- 上排：Name + Args -->
      <div class="mb-2 flex items-end gap-2">
        <div class="form-control flex-1">
          <label class="label py-1"><span class="label-text-alt">Name</span></label>
          <input
            placeholder="Name (e.g. mysql)"
            class="input-bordered input input-sm"
            v-model="newName"
            @keydown.enter.prevent="add"
          />
        </div>

        <div class="form-control flex-[2]">
          <label class="label py-1"><span class="label-text-alt">Args (comma-separated)</span></label>
          <input
            placeholder="--port=3306, --host=0.0.0.0"
            class="input-bordered input input-sm"
            v-model="newArgs"
          />
        </div>

        <button class="btn btn-sm" @click="add">ADD</button>
      </div>

      <!-- 下排：Image + Env -->
      <div class="flex items-start gap-2">
        <div class="form-control flex-1">
          <label class="label py-1"><span class="label-text-alt">Image</span></label>
          <input
            placeholder="Image (e.g. mysql:8.0)"
            class="input-bordered input input-sm"
            v-model="newImage"
            @keydown.enter.prevent="add"
          />
        </div>

        <div class="form-control flex-[2]">
          <label class="label py-1"><span class="label-text-alt">Env (KEY=VALUE per line)</span></label>
          <textarea
            placeholder="MYSQL_ROOT_PASSWORD=secret&#10;MYSQL_DATABASE=testdb"
            class="textarea-bordered textarea textarea-sm h-16 text-xs"
            v-model="newEnv"
          />
        </div>
      </div>
    </div>

    <div class="border-base-content/20 overflow-x-auto rounded-lg border">
      <table class="table-sm table w-full">
        <thead class="bg-base-200">
          <tr>
            <th class="w-[15%] py-3">Name</th>
            <th class="w-[25%] py-3">Image</th>
            <th class="w-[25%] py-3">Args</th>
            <th class="w-[25%] py-3">Env</th>
            <th class="w-16 py-3 text-center">Action</th>
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
                  {{ Object.keys(sidecar.env).length }} vars
                </span>
                <span v-else>-</span>
              </td>
              <td class="py-1 text-center">
                <button
                  class="btn btn-ghost btn-xs"
                  @click="toggleEdit(idx)"
                  title="Edit"
                >
                  <i-uil-edit v-if="editingIndex !== idx" />
                  <i-uil-times v-else />
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
                    <label class="label py-0"><span class="label-text-alt">Args</span></label>
                    <input
                      class="input-bordered input input-sm"
                      :value="getSidecarArgs(sidecar)"
                      @input="updateSidecar(idx, 'args', ($event.target as HTMLInputElement).value)"
                      placeholder="--port=3306, --host=0.0.0.0"
                    />
                  </div>
                  <div class="form-control">
                    <label class="label py-0"><span class="label-text-alt">Env (KEY=VALUE)</span></label>
                    <textarea
                      class="textarea-bordered textarea textarea-sm h-16 text-xs"
                      :value="getSidecarEnv(sidecar)"
                      @input="updateSidecar(idx, 'env', ($event.target as HTMLTextAreaElement).value)"
                      placeholder="KEY=VALUE"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <tr v-if="modelValue.length === 0">
            <td colspan="3" class="py-2 text-center text-sm opacity-400">No sidecars configured.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
