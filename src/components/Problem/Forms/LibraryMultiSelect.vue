<script setup lang="ts">
import { ref, computed, watchEffect } from "vue";
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from "@headlessui/vue";

interface Props {
  modelValue: string[];     // 綁定選到的項目
  options: string[];        // 下拉候選
}
const props = defineProps<Props>();
const emits = defineEmits<{
  (e: "update:model-value", newValue: string[]): void;
}>();

const selected = ref<string[]>([...props.modelValue || []]);

// 外部選單內容同步進來時要跟進
watchEffect(() => {
  if (JSON.stringify(selected.value) !== JSON.stringify(props.modelValue)) {
    selected.value = [...props.modelValue];
  }
});
watchEffect(() => {
  // 輸出新的 model-value
  emits("update:model-value", selected.value);
});

const getOptionLabel = (val: string) => val;
</script>

<template>
  <Listbox v-model="selected" multiple>
    <div class="relative mt-1">
      <ListboxButton class="input input-bordered w-full max-w-xs text-left min-h-[2.4em]">
        <!-- 顯示所有已選項目 -->
        <div
          v-if="selected.length"
          class="flex flex-wrap gap-1"
        >
          <span
            v-for="opt in selected"
            :key="opt"
            class="badge badge-primary"
          >
            {{ getOptionLabel(opt) }}
          </span>
        </div>
        <span v-else class="block truncate text-gray-400">請選擇...</span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <i-uil-angle-down class="h-5 w-5 text-gray-400" aria-hidden="true" />
        </span>
      </ListboxButton>
      <transition
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <ListboxOptions
          class="absolute mt-1 max-h-80 w-full overflow-auto rounded-md bg-base-100 py-1 text-base shadow-lg sm:text-sm"
        >
          <ListboxOption
            v-for="opt in options"
            :key="opt"
            :value="opt"
            v-slot="{ active, selected: isSelected }"
            as="template"
          >
            <li :class="[active && 'bg-base-300', 'cursor-default select-none relative py-2 pl-10 pr-4']">
              <span :class="[isSelected ? 'font-medium' : 'font-normal', 'block truncate']">
                {{ getOptionLabel(opt) }}
              </span>
              <span
                v-if="isSelected"
                class="absolute inset-y-0 left-0 flex items-center pl-3 text-base-content"
              >
                <i-uil-check class="h-5 w-5" aria-hidden="true" />
              </span>
            </li>
          </ListboxOption>
        </ListboxOptions>
      </transition>
    </div>
  </Listbox>
</template>