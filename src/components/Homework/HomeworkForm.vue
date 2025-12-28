<script setup lang="ts">
import { toRef, computed, ref } from "vue";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, minValue, helpers } from "@vuelidate/validators";
import { containsInvisible } from "@/utils/validators";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
import dayjs from "dayjs";

interface Props {
  form: HomeworkForm;
  problemSelections: { text: string; value: string }[];
}
const props = defineProps<Props>();
const isLoading = ref(false);
const errorMsg = ref("");
defineExpose({ isLoading, errorMsg });

const noInvisible = helpers.withMessage(
  () => t("components.hw.validation.contains_invisible"),
  (value: unknown) => typeof value !== "string" || !containsInvisible(value),
);

const rules = {
  name: { required, maxLength: maxLength(50), noInvisible },
  markdown: { maxLength: maxLength(350) },
  problemIds: { required },
  start: { required },
  end: {
    required,
    minValue: helpers.withMessage(
      "End time must be greater than Start time",
      minValue(toRef(props.form, "start")),
    ),
  },
};
const v$ = useVuelidate(rules, props.form);

const emit = defineEmits<{
  (e: "update", key: keyof HomeworkForm, value: HomeworkForm[typeof key]): void;
  (e: "submit"): void;
}>();

const startDateTime = computed(() => dayjs(props.form.start * 1000).format("YYYY-MM-DDTHH:mm"));
const endDateTime = computed(() => dayjs(props.form.end * 1000).format("YYYY-MM-DDTHH:mm"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleStartDateTimeInput(event: any) {
  updateForm("start", dayjs(event.target.value).valueOf() / 1000);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleEndDateTimeInput(event: any) {
  updateForm("end", dayjs(event.target.value).valueOf() / 1000);
}

function updateForm(key: keyof HomeworkForm, value: HomeworkForm[typeof key]) {
  emit("update", key, value);
  v$.value[key].$touch();
}
async function submit() {
  const isFormCorrect = await v$.value.$validate();
  if (isFormCorrect) {
    emit("submit");
  }
}
</script>

<template>
  <div v-if="errorMsg" class="alert alert-error shadow-lg">
    <div>
      <i-uil-times-circle />
      <span>{{ errorMsg }}</span>
    </div>
  </div>
  <div class="grid grid-cols-1 gap-y-4 lg:grid-cols-2">
    <div class="form-control w-full max-w-xs">
      <label class="label">
        <span class="label-text">{{ $t("components.hw.form.nameField") }}</span>
      </label>
      <input
        type="text"
        :class="['input-bordered input w-full max-w-xs', v$.name.$error && 'input-error']"
        :value="form.name"
        @input="updateForm('name', ($event.target as HTMLInputElement).value)"
      />
      <label class="label" v-show="v$.name.$error">
        <span class="label-text-alt text-error" v-text="v$.name.$errors[0]?.$message" />
      </label>
    </div>

    <div class="form-control w-full max-w-xs">
      <label class="label">
        <span class="label-text">{{ $t("components.hw.form.problems") }}</span>
        <span class="label-text-alt text-base-content/60"
          >{{ $t("components.hw.form.search") }}</span
        >
      </label>
      <problem-multi-select
        :model-value="form.problemIds"
        :problems="problemSelections"
        @update:model-value="(v) => updateForm('problemIds', v)"
      />
      <label class="label" v-show="v$.problemIds.$error">
        <span class="label-text-alt text-error" v-text="v$.problemIds.$errors[0]?.$message" />
      </label>
    </div>

    <div class="form-control w-full max-w-xs">
      <label class="label">
        <span class="label-text">{{ $t("components.hw.form.fromField") }}</span>
      </label>
      <input
        type="datetime-local"
        class="input-bordered input w-full max-w-xs"
        :value="startDateTime"
        @change="handleStartDateTimeInput"
      />
      <label class="label" v-show="v$.start.$error">
        <span class="label-text-alt text-error" v-text="v$.start.$errors[0]?.$message" />
      </label>
    </div>

    <div class="form-control w-full max-w-xs">
      <label class="label">
        <span class="label-text">{{ $t("components.hw.form.dueField") }}</span>
      </label>
      <input
        type="datetime-local"
        class="input-bordered input w-full max-w-xs"
        :value="endDateTime"
        @change="handleEndDateTimeInput"
      />
      <label class="label" v-show="v$.end.$error">
        <span class="label-text-alt text-error" v-text="v$.end.$errors[0]?.$message" />
      </label>
    </div>

    <div class="form-control w-full lg:col-span-2">
      <label class="label">
        <span class="label-text">{{ $t("components.hw.form.descField") }}</span>
      </label>
      <textarea
        class="textarea-bordered textarea h-24"
        :value="form.markdown"
        @input="updateForm('markdown', ($event.target as HTMLTextAreaElement).value)"
      />
      <label class="label" v-show="v$.markdown.$error">
        <span class="label-text-alt text-error" v-text="v$.markdown.$errors[0]?.$message" />
      </label>
    </div>
  </div>
  <div class="mt-4 flex justify-end">
    <button :class="['btn btn-success', isLoading && 'loading']" @click="submit">
      <i-uil-file-upload-alt class="mr-1 lg:h-5 lg:w-5" /> {{ $t("components.hw.form.submit") }}
    </button>
  </div>
</template>
