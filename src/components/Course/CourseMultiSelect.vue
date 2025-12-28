<script setup lang="ts">
import { computed, ref } from "vue";
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from "@headlessui/vue";

interface CourseOption {
  text: string;
  value: string;
}

interface Props {
  modelValue: string[];
  courses: CourseOption[];
  placeholder?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "update:model-value", newValue: string[]): void;
}>();

const query = ref("");

const filteredCourses = computed(() =>
  query.value === ""
    ? props.courses
    : props.courses.filter((course) => {
        const q = query.value.toLowerCase();
        return course.text.toLowerCase().includes(q) || course.value.toLowerCase().includes(q);
      }),
);

function handleUpdate(value: string[]) {
  emit("update:model-value", value);
}
</script>

<template>
  <Combobox :model-value="modelValue" multiple @update:model-value="handleUpdate">
    <div class="relative mt-1">
      <div class="relative w-full">
        <ComboboxInput
          class="input-bordered input w-full pr-10 text-left"
          :placeholder="modelValue.length ? modelValue.join(', ') : placeholder || 'Search courses'"
          @change="query = $event.target.value"
          maxlength="80"
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
            v-if="filteredCourses.length === 0 && query !== ''"
            class="relative cursor-default px-4 py-2 text-gray-700 select-none"
          >
            Nothing found.
          </div>

          <ComboboxOption
            v-for="course in filteredCourses"
            :key="course.value"
            :value="course.value"
            as="template"
            v-slot="{ active, selected }"
          >
            <li :class="[active && 'bg-base-300', 'relative cursor-default py-2 pr-4 pl-10 select-none']">
              <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                {{ course.text }}
              </span>
              <span v-if="selected" class="text-base-content absolute inset-y-0 left-0 flex items-center pl-3">
                <i-uil-check class="h-5 w-5" aria-hidden="true" />
              </span>
            </li>
          </ComboboxOption>
        </ComboboxOptions>
      </transition>
    </div>
  </Combobox>
</template>
