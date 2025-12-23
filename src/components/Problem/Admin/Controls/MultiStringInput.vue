<script setup lang="ts">
import { ref } from "vue";
const props = defineProps<{
  modelValue: string[];
  placeholder?: string;
  badgeClass?: string;
}>();
const emits = defineEmits<{ (e: "update:modelValue", v: string[]): void }>();

const buf = ref("");

function add() {
  const v = buf.value.trim();
  if (!v) return;
  if (props.modelValue.includes(v)) {
    return;
  }
  emits("update:modelValue", [...props.modelValue, v]);
  buf.value = "";
}
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
        class="badge gap-2"
        :class="badgeClass || 'badge-info'"
      >
        {{ s }}
        <button class="btn btn-ghost btn-xs" @click="remove(i)">
          <i-uil-times />
        </button>
      </div>
    </div>
  </div>
</template>
