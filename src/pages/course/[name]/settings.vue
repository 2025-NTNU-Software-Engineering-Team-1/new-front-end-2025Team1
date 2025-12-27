<script setup lang="ts">
import { ref, reactive, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTitle } from "@vueuse/core";
import api, { fetcher } from "@/models/api";
import axios from "axios";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, helpers } from "@vuelidate/validators";
import { useI18n } from "vue-i18n";
import { containsInvisible } from "@/utils/validators";
import AppearanceSelector from "@/components/Course/AppearanceSelector.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const courseName = route.params.name as string;

useTitle(`Settings - ${courseName} | Normal OJ`);

const form = reactive({
  course: "", // new name
  teacher: "",
  color: "",
  emoji: "",
});

const isLoading = ref(true);
const isSaving = ref(false);
const errorMsg = ref("");
const successMsg = ref("");

// Auto-dismiss success/error messages after 3 seconds
watch(successMsg, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      successMsg.value = "";
    }, 3000);
  }
});

watch(errorMsg, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      errorMsg.value = "";
    }, 5000);
  }
});

const noInvisible = helpers.withMessage(
  () => t("components.validation.contains_invisible"),
  (value: unknown) => typeof value !== "string" || !containsInvisible(value),
);

const notBlank = helpers.withMessage(
  () => t("components.validation.not_blank"),
  (value: unknown) => typeof value === "string" && value.trim().length > 0,
);

const rules = {
  course: { required, notBlank, maxLength: maxLength(64), noInvisible },
  teacher: { required, noInvisible },
};
const v$ = useVuelidate(rules, form);

// Helper for fetching
async function fetchCourse() {
  isLoading.value = true;
  try {
    const { data } = await fetcher.get(`/course/${courseName}`);
    form.course = courseName;
    form.teacher = data.teacher.username;
    form.color = data.color || "";
    form.emoji = data.emoji || "";
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : "Failed to load course settings";
  } finally {
    isLoading.value = false;
  }
}

async function submit() {
  if (!(await v$.value.$validate())) return;

  isSaving.value = true;
  errorMsg.value = "";
  successMsg.value = "";

  try {
    await api.Course.modify({
      course: courseName,
      new_course: form.course,
      teacher: form.teacher,
      color: form.color,
      emoji: form.emoji,
    });

    successMsg.value = t("course.settings.saved");

    // If name changed, redirect
    if (form.course !== courseName) {
      router.push(`/course/${form.course}/settings`);
    } else {
      // Refresh to ensure sync
      fetchCourse();
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      errorMsg.value = error.response.data.message;
    } else {
      errorMsg.value = t("courses.new.unknown-error-occurred");
    }
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  fetchCourse();
});
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <!-- Toast Notification -->
        <div class="toast toast-end toast-bottom z-50">
          <div v-if="errorMsg" class="alert alert-error px-4 py-2 text-sm">
            <i-uil-times-circle class="h-4 w-4" />
            <span>{{ errorMsg }}</span>
          </div>
          <div v-if="successMsg" class="alert alert-success px-4 py-2 text-sm">
            <i-uil-check-circle class="h-4 w-4" />
            <span>{{ successMsg }}</span>
          </div>
        </div>

        <div v-if="isLoading" class="flex justify-center p-8">
          <button class="btn btn-ghost loading">Loading...</button>
        </div>

        <div v-else class="space-y-6">
          <div class="grid grid-cols-1 gap-8 md:grid-cols-12">
            <!-- General Info -->
            <div class="space-y-4 md:col-span-4">
              <h4 class="mb-4 border-b pb-2 text-lg font-bold">{{ $t("course.settings.generalInfo") }}</h4>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">{{ $t("course.settings.courseName") }}</span>
                </label>
                <input
                  v-model="v$.course.$model"
                  type="text"
                  :class="['input-bordered input w-full', v$.course.$error && 'input-error']"
                />
                <label class="label" v-show="v$.course.$error">
                  <span class="label-text-alt text-error" v-text="v$.course.$errors[0]?.$message" />
                </label>
              </div>

              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">{{ $t("course.settings.teacher") }}</span>
                  <span class="label-text-alt text-warning" v-if="false">Read Only</span>
                </label>
                <input
                  v-model="v$.teacher.$model"
                  type="text"
                  disabled
                  class="input-bordered input bg-base-200 w-full cursor-not-allowed opacity-75"
                />
                <label class="label">
                  <span class="label-text-alt opacity-50">{{ $t("course.settings.teacherReadOnly") }}</span>
                </label>
              </div>
            </div>

            <!-- Appearance -->
            <div class="space-y-4 md:col-span-8">
              <h4 class="mb-4 border-b pb-2 text-lg font-bold">{{ $t("course.settings.appearance") }}</h4>
              <appearance-selector
                :initial-color="form.color"
                :initial-emoji="form.emoji"
                @update:color="form.color = $event"
                @update:emoji="form.emoji = $event"
              />
            </div>
          </div>

          <div class="divider"></div>

          <div class="flex justify-end">
            <button class="btn btn-primary" :class="{ loading: isSaving }" @click="submit">
              {{ $t("course.settings.save") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
