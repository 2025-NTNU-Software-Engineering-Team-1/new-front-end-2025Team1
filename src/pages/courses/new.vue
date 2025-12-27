<script setup lang="ts">
import { ref, reactive } from "vue";
import { useTitle } from "@vueuse/core";
import { useRouter } from "vue-router";
import api from "@/models/api";
import axios from "axios";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, helpers } from "@vuelidate/validators";
import { useI18n } from "vue-i18n";
import { containsInvisible } from "@/utils/validators";
import AppearanceSelector from "@/components/Course/AppearanceSelector.vue";

const router = useRouter();
const { t } = useI18n();
useTitle(`New Course | Normal OJ`);

const newCourse = reactive<CourseForm & { color: string; emoji: string }>({
  course: "",
  teacher: "",
  color: "",
  emoji: "",
});
const isLoading = ref(false);
const errorMsg = ref("");

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
const v$ = useVuelidate(rules, newCourse);

async function submit() {
  if (!(await v$.value.$validate())) return;

  isLoading.value = true;
  try {
    await api.Course.create({ 
      course: newCourse.course,
      teacher: newCourse.teacher,
      color: newCourse.color,
      emoji: newCourse.emoji,
    });
    router.push(`/course/${newCourse.course}`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      errorMsg.value = error.response.data.message;
    } else {
      errorMsg.value = t("courses.new.unknown-error-occurred");
    }
    throw error;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-3">{{ $t("courses.new.title") }}</div>

        <div v-if="errorMsg" class="alert alert-error shadow-lg">
          <div>
            <i-uil-times-circle />
            <span>{{ errorMsg }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Left: Form Fields -->
          <div class="space-y-4">
            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">{{ $t("courses.new.nameField") }}</span>
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
                <span class="label-text">{{ $t("courses.new.teacherField") }}</span>
              </label>
              <input
                v-model="v$.teacher.$model"
                type="text"
                :class="['input-bordered input w-full', v$.teacher.$error && 'input-error']"
              />
              <label class="label" v-show="v$.teacher.$error">
                <span class="label-text-alt text-error" v-text="v$.teacher.$errors[0]?.$message" />
              </label>
            </div>
          </div>

          <!-- Right: Appearance Selector -->
          <div class="pt-2">
             <appearance-selector 
               @update:color="newCourse.color = $event"
               @update:emoji="newCourse.emoji = $event"
             />
          </div>
        </div>

        <div class="mt-8 flex justify-end">
          <button :class="['btn btn-success', isLoading && 'loading']" @click="submit">
            <i-uil-file-upload-alt class="mr-1 lg:h-5 lg:w-5" /> {{ $t("courses.new.submit") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
