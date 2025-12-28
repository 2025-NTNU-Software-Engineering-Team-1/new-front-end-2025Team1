<script setup lang="ts">
import { ref, computed } from "vue";
import { useTitle } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { fetcher } from "@/models/api";
import api from "@/models/api";
import { useSession, UserRole } from "@/stores/session";
import { useI18n } from "vue-i18n";
import type { AxiosError } from "axios";
import CourseAvatar from "@/components/Course/CourseAvatar.vue";

import useInteractions from "@/composables/useInteractions";

const { isDesktop } = useInteractions();
const { t } = useI18n();

useTitle("Courses | Normal OJ");
const { data: courses, error, isLoading, execute: refetchCourses } = useAxios<CourseList>("/course", fetcher);
const searchQuery = ref("");

const displayedCourses = computed(() => {
  const list = courses.value ?? [];
  const query = searchQuery.value.toLowerCase().trim();

  if (!query) {
    return [...list].reverse();
  }

  return list.filter((c) => c.course.toLowerCase().includes(query)).reverse();
});

const session = useSession();
const rolesCanCreateCourse = [UserRole.Admin, UserRole.Teacher];

// Join by course code
const courseCode = ref("");
const joinLoading = ref(false);
const joinError = ref("");
const joinSuccess = ref("");

async function handleJoinCourse() {
  if (!courseCode.value.trim()) {
    joinError.value = t("courses.index.join.errorEmpty");
    return;
  }

  joinLoading.value = true;
  joinError.value = "";
  joinSuccess.value = "";

  try {
    const response = await api.Course.join({ course_code: courseCode.value.trim() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseName = (response as any).data.data.course;
    joinSuccess.value = t("courses.index.join.success", { course: courseName });
    courseCode.value = "";
    // Refetch courses list
    await refetchCourses();
  } catch (err: unknown) {
    const axiosError = err as AxiosError<{ message: string }>;
    if (axiosError.response?.status === 404) {
      joinError.value = t("courses.index.join.errorInvalid");
    } else if (axiosError.response?.status === 400) {
      joinError.value = t("courses.index.join.errorAlreadyIn");
    } else if (axiosError.response?.status === 403) {
      joinError.value = t("courses.index.join.errorForbidden");
    } else {
      joinError.value = axiosError.response?.data?.message || t("courses.index.join.errorGeneric");
    }
  } finally {
    joinLoading.value = false;
  }
}
</script>

<template>
  <div class="card mx-auto max-w-5xl shadow-xl">
    <div class="card-body">
      <div class="card-title justify-between">
        {{ $t("courses.index.list") }}
        <router-link
          v-if="rolesCanCreateCourse.includes(session.role)"
          class="btn btn-success"
          to="/courses/new"
        >
          <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("courses.index.new") }}
        </router-link>
      </div>

      <!-- Join by Course Code Section -->
      <div class="border-base-300 bg-base-200/50 my-4 rounded-lg border p-4">
        <h3 class="mb-3 font-semibold">{{ $t("courses.index.join.title") }}</h3>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            v-model="courseCode"
            type="text"
            :placeholder="$t('courses.index.join.placeholder')"
            maxlength="50"
            class="input input-bordered flex-1"
            :disabled="joinLoading"
            @keyup.enter="handleJoinCourse"
          />
          <button
            class="btn btn-primary"
            :disabled="joinLoading || !courseCode.trim()"
            @click="handleJoinCourse"
          >
            <span v-if="joinLoading" class="loading loading-spinner loading-sm"></span>
            <i-uil-sign-in-alt v-else class="mr-1" />
            {{ $t("courses.index.join.button") }}
          </button>
        </div>
        <div v-if="joinError" class="alert alert-error mt-2 py-2">
          <i-uil-exclamation-triangle />
          <span>{{ joinError }}</span>
        </div>
        <div v-if="joinSuccess" class="alert alert-success mt-2 py-2">
          <i-uil-check-circle />
          <span>{{ joinSuccess }}</span>
        </div>
      </div>

      <div class="mb-4 flex items-center gap-2">
        <label class="input input-bordered flex w-full items-center gap-2">
          <i-uil-search class="text-base-content/50" />
          <input
            type="text"
            class="grow"
            :placeholder="$t('courses.index.searchPlaceholder') || 'Search Course'"
            v-model="searchQuery"
          />
        </label>
      </div>

      <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
        <template #loading>
          <skeleton-table :col="2" :row="5" />
        </template>
        <template #data>
          <div class="scrollbar-hide border-base-200 max-h-[60vh] overflow-y-auto rounded-lg border">
            <table class="table w-full">
              <thead class="bg-base-100 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th>{{ $t("courses.index.table.course") }}</th>
                  <th>{{ $t("courses.index.table.teacher") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="{ course, teacher, color, emoji } in displayedCourses"
                  :key="course"
                  class="hover transition-colors"
                >
                  <td
                    :class="{
                      'max-w-[16rem] min-w-[14rem] whitespace-pre-wrap': !isDesktop,
                    }"
                  >
                    <div class="flex items-center gap-3">
                      <course-avatar
                        :course-name="course"
                        :course-color="color"
                        :course-emoji="emoji"
                        size="md"
                      />
                      <router-link
                        :to="`/course/${course}`"
                        class="link link-hover text-base-content text-lg font-bold"
                      >
                        {{ course }}
                      </router-link>
                    </div>
                  </td>
                  <td class="text-base-content/80 align-middle">{{ teacher.username }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </data-status-wrapper>
    </div>
  </div>
</template>
