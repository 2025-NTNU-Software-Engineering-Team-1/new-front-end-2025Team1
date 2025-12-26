<script setup lang="ts">
import { ref } from "vue";

// Define props with types
const props = defineProps<{
  modelValue: string[];
  placeholder?: string;
  badgeClass?: string;
}>();

// Define emits
const emits = defineEmits<{ (e: "update:modelValue", v: string[]): void }>();

const buf = ref("");

// Add a new item to the list
function add() {
  const v = buf.value.trim();
  if (!v) return;
  // Prevent duplicates
  if (props.modelValue.includes(v)) {
    return;
  }
  emits("update:modelValue", [...props.modelValue, v]);
  buf.value = "";
}

// Remove an item by index
function remove(i: number) {
  const next = props.modelValue.slice();
  next.splice(i, 1);
  emits("update:modelValue", next);
}
</script>

<template>
  <div>
    <div class="flex gap-2">
      <input
        :placeholder="placeholder || 'Add item'"
        class="input-bordered input input-sm w-full"
        :value="buf"
        @input="buf = ($event.target as HTMLInputElement).value"
        @keydown.enter.prevent="add"
      />
      <button class="btn btn-sm" @click="add">Add</button>
    </div>

    <div class="mt-2 flex flex-wrap gap-2">
      <div
        v-for="(s, i) in modelValue"
        :key="`${s}-${i}`"
        class="badge h-auto gap-2 whitespace-normal break-all py-2 text-left"
        :class="badgeClass || 'badge-info'"
      >
        <span>{{ s }}</span>
        <button class="btn btn-ghost btn-xs h-auto min-h-0" @click="remove(i)">
          <i-uil-times />
        </button>
      </div>
    </div>
  </div>
</template>
