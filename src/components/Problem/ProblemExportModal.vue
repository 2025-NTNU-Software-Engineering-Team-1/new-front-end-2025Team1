<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  COMPONENT_OPTIONS,
  COMPONENT_SECTIONS,
  CORE_COMPONENTS,
  OPTIONAL_COMPONENTS,
} from "@/utils/problemImportExport";

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  problemCount?: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "confirm", components: string[]): void;
}>();

const { t } = useI18n();

const optionalOptions = COMPONENT_OPTIONS.filter((opt) => !CORE_COMPONENTS.includes(opt.id));
const selectedOptional = ref<Set<string>>(new Set(OPTIONAL_COMPONENTS));

const sectionOptions = computed(() => {
  const optionMap = new Map(COMPONENT_OPTIONS.map((opt) => [opt.id, opt]));
  return COMPONENT_SECTIONS.map((section) => {
    const options = section.componentIds
      .map((id) => optionMap.get(id))
      .filter((opt): opt is ProblemComponentOption => !!opt);
    return { ...section, options };
  }).filter((section) => section.options.length > 0);
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selectedOptional.value = new Set(OPTIONAL_COMPONENTS);
    }
  },
);

const allOptionalSelected = computed(() =>
  optionalOptions.every((opt) => selectedOptional.value.has(opt.id)),
);

function toggleOptional(id: string) {
  if (CORE_COMPONENTS.includes(id)) return;
  if (selectedOptional.value.has(id)) {
    selectedOptional.value.delete(id);
  } else {
    selectedOptional.value.add(id);
  }
  selectedOptional.value = new Set(selectedOptional.value);
}

function toggleAllOptional() {
  if (allOptionalSelected.value) {
    selectedOptional.value = new Set();
  } else {
    selectedOptional.value = new Set(optionalOptions.map((opt) => opt.id));
  }
}

function close() {
  emit("update:modelValue", false);
}

function confirm() {
  emit("confirm", Array.from(selectedOptional.value));
  close();
}
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': modelValue }">
    <div class="modal-box max-w-2xl">
      <h3 class="text-lg font-bold">
        {{ title || t("course.problems.exportOptions") }}
      </h3>
      <p v-if="problemCount" class="text-base-content/70 mt-1 text-sm">
        {{ t("course.problems.exportCount", { count: problemCount }) }}
      </p>

      <div class="mt-5 space-y-4">
        <div>
          <div class="mb-2 flex items-center justify-between">
            <span class="font-semibold">{{ t("course.problems.exportComponents") }}</span>
            <button class="btn btn-xs btn-ghost" type="button" @click="toggleAllOptional">
              {{ allOptionalSelected ? t("course.problems.clearAll") : t("course.problems.selectAll") }}
            </button>
          </div>
          <div class="space-y-3">
            <div
              v-for="section in sectionOptions"
              :key="section.id"
              class="border-base-200 rounded-lg border p-3"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="font-medium">{{ t(section.labelKey) }}</span>
              </div>
              <div class="grid gap-2 md:grid-cols-2">
                <label v-for="opt in section.options" :key="opt.id" class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="CORE_COMPONENTS.includes(opt.id) || selectedOptional.has(opt.id)"
                    :disabled="CORE_COMPONENTS.includes(opt.id)"
                    @change="toggleOptional(opt.id)"
                  />
                  <span>{{ t(opt.labelKey) }}</span>
                  <span v-if="CORE_COMPONENTS.includes(opt.id)" class="badge badge-ghost badge-sm">{{
                    t("course.problems.required")
                  }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <p class="text-base-content/60 text-xs">
          {{ t("course.problems.exportHint") }}
        </p>
      </div>

      <div class="modal-action">
        <button class="btn" type="button" @click="close">
          {{ t("course.problems.cancel") }}
        </button>
        <button class="btn btn-primary" type="button" @click="confirm">
          {{ t("course.problems.export") }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="close">close</button>
    </form>
  </dialog>
</template>
