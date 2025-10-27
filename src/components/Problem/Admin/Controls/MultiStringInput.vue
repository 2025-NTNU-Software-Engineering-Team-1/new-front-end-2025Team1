<script setup lang="ts">
const props = defineProps<{
  modelValue: string[];
  placeholder?: string;
}>();
const emits = defineEmits<{ (e: "update:modelValue", v: string[]): void }>();

let buf = "";
function add() {
  const v = buf.trim();
  if (!v) return;
  emits("update:modelValue", [...props.modelValue, v]);
  buf = "";
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
        class="input input-bordered input-sm w-full"
        :value="buf"
        @input="buf = ($event.target as HTMLInputElement).value"
        @keydown.enter.prevent="add"
      />
      <button class="btn btn-sm" @click="add">Add</button>
    </div>
    <div class="mt-2 flex flex-wrap gap-2">
      <div v-for="(s, i) in modelValue" :key="`${s}-${i}`" class="badge badge-info gap-2">
        {{ s }}
        <button class="btn btn-ghost btn-xs" @click="remove(i)">
          <i-uil-times />
        </button>
      </div>
    </div>
  </div>
</template>
