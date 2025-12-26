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

// --- CONFIGURATION ---
// Global variable to control badge appearance (Padding & Font Size).
// Options for size:
// - 'text-xs': Extra small text (12px)
// - 'text-sm': Small text (14px)
// - 'text-base': Normal text (16px)
// Current setting: tight padding + extra small text
const badgeStyle = "px-1.5 py-0.5 text-xs";
// ---------------------

// Add a new item to the list
function add() {
  const v = buf.value.trim();
  if (!v) return;
  if (props.modelValue.includes(v)) {
    return;
  }
  emits("update:modelValue", [...props.modelValue, v]);
  buf.value = "";
}

// Remove an item by index
function remove(i: number) {
  const next = [...props.modelValue];
  next.splice(i, 1);
  emits("update:modelValue", next);
}
</script>

<template>
  <div>
    <div class="flex gap-2">
      <input
        v-model="buf"
        :placeholder="placeholder || 'Add item'"
        class="input-bordered input input-sm w-full"
        @keydown.enter.prevent="add"
      />
      <button class="btn btn-sm" @click="add">Add</button>
    </div>

    <div class="mt-2 flex flex-wrap gap-1">
      <div
        v-for="(s, i) in modelValue"
        :key="s"
        class="badge h-auto min-h-0 gap-1 whitespace-normal break-all text-left"
        :class="[badgeClass || 'badge-info', badgeStyle]"
      >
        <span>{{ s }}</span>
        <button class="btn btn-ghost btn-xs h-auto min-h-0" @click="remove(i)">
          <i-uil-times />
        </button>
      </div>
    </div>
  </div>
</template>
