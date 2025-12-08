<script setup lang="ts">
import { ref } from "vue";

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

function add() {
  const name = newName.value.trim();
  const image = newImage.value.trim();

  if (!name || !image) return;

  if (props.modelValue.some((s) => s.name === name)) {
    return;
  }

  const newList = [
    ...props.modelValue,
    { name, image, env: {}, args: [] },
  ];
  
  emit("update:modelValue", newList);

  newName.value = "";
  newImage.value = "";
}

function remove(index: number) {
  const newList = [...props.modelValue];
  newList.splice(index, 1);
  emit("update:modelValue", newList);
}

function updateItem() {
  emit("update:modelValue", props.modelValue);
}
</script>

<template>
  <div>
    <div class="mb-4 bg-base-200 p-3 rounded-lg border border-base-300">
      <div class="flex gap-2 items-end">
        <div class="form-control flex-1">
            <label class="label py-1"><span class="label-text-alt">Name</span></label>
            <input
            placeholder="Name (e.g. mysql)"
            class="input input-bordered input-sm flex-1"
            v-model="newName"
            @keydown.enter.prevent="add"
            />
        </div>

        <div class="form-control flex-[2]">
          <label class="label py-1"><span class="label-text-alt">Image</span></label>
          <input
            placeholder="Image (e.g. mysql:8.0)"
            class="input input-bordered input-sm flex-[2]"
            v-model="newImage"
            @keydown.enter.prevent="add"
        />
        </div>
        
        <button class="btn btn-sm" @click="add">ADD</button>
      </div>
    </div>

    <div class="overflow-x-auto border border-base-content/20 rounded-lg">
      <table class="table table-sm w-full">
        <thead class="bg-base-200">
          <tr>
            <th class="py-3 w-1/3">Name</th>
            <th class="py-3">Image</th>
            <th class="py-3 w-16 text-center">Action</th>
          </tr>
        </thead>
        
        <tbody>
          <tr v-for="(sidecar, idx) in modelValue" :key="idx" class="hover">
            <td class="py-1 font-mono text-sm font-bold">{{ sidecar.name }}</td>
            <td class="py-1 font-mono text-sm opacity-80">{{ sidecar.image }}</td>
            <td class="py-1 text-center">
              <button 
                class="btn btn-ghost btn-xs text-error" 
                @click="remove(idx)"
                title="Remove"
              >
                <i-uil-trash-alt />
              </button>
            </td>
          </tr>

          <tr v-if="modelValue.length === 0">
            <td colspan="3" class="text-center text-sm opacity-400 py-2">
              No sidecars configured.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>