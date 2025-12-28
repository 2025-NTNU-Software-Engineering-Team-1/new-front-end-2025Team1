<script setup lang="ts">
import { ref, computed } from "vue";
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from "@headlessui/vue";

interface Props {
  modelValue: number[];
  problems: { text: string; value: string }[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:model-value", newValue: number[]): void;
}>();

const query = ref("");

const filteredProblems = computed(() =>
  query.value === ""
    ? props.problems
    : props.problems.filter((problem) => {
        const q = query.value.toLowerCase();
        return problem.text.toLowerCase().includes(q) || problem.value.toLowerCase().includes(q);
      }),
);

function handleUpdate(value: number[]) {
  emit("update:model-value", value);
  // Clear query after selection if desired, or keep it.
  // Usually for multi-select with a single input acting as filter, we might want to keep it or clear it.
  // Given the UI style, clearing it might cause the placeholder to show again.
  // query.value = "";
}
</script>

<template>
  <Combobox :model-value="modelValue" multiple @update:model-value="handleUpdate">
    <div class="relative mt-1">
      <div class="relative w-full max-w-xs">
        <ComboboxInput
          class="input-bordered input w-full pr-10 text-left"
          :placeholder="modelValue.length ? modelValue.join(', ') : '可輸入 ID 或名稱搜尋'"
          @change="query = $event.target.value"
          maxlength="50"
        />
        <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
          <i-uil-angle-down class="h-5 w-5 text-gray-400" aria-hidden="true" />
        </ComboboxButton>
      </div>

      <transition
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
        after-leave="query = ''"
      >
        <ComboboxOptions
          class="bg-base-100 absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md py-1 text-base shadow-lg sm:text-sm"
        >
          <div
            v-if="filteredProblems.length === 0 && query !== ''"
            class="relative cursor-default px-4 py-2 text-gray-700 select-none"
          >
            Nothing found.
          </div>

          <ComboboxOption
            v-slot="{ active, selected }"
            v-for="problem in filteredProblems"
            :key="problem.value"
            :value="Number(problem.value)"
            as="template"
          >
            <li :class="[active && 'bg-base-300', 'relative cursor-default py-2 pr-4 pl-10 select-none']">
              <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                {{ problem.text }}
              </span>
              <span
                v-if="selected"
                class="text-base-content absolute inset-y-0 left-0 flex items-center pl-3"
              >
                <i-uil-check class="h-5 w-5" aria-hidden="true" />
              </span>
            </li>
          </ComboboxOption>
        </ComboboxOptions>
      </transition>
    </div>
  </Combobox>
</template>
