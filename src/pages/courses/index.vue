<script setup lang="ts">
import { ref, computed } from "vue";
import { useTitle } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { fetcher } from "@/models/api";
import api from "@/models/api";
import { useSession, UserRole } from "@/stores/session";
import { useI18n } from "vue-i18n";
import type { AxiosError } from "axios";

import useInteractions from "@/composables/useInteractions";

const { isDesktop } = useInteractions();
const { t } = useI18n();

useTitle("Courses | Normal OJ");
const { data: courses, error, isLoading, execute: refetchCourses } = useAxios<CourseList>("/course", fetcher);

const displayedCourses = computed(() => [...(courses.value ?? [])].reverse());

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
    joinSuccess.value = t("courses.index.join.success", { course: response.data.course });
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
      <div class="my-4 border-base-300 border rounded-lg p-4 bg-base-200/50">
        <h3 class="font-semibold mb-3">{{ $t("courses.index.join.title") }}</h3>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="courseCode"
            type="text"
            :placeholder="$t('courses.index.join.placeholder')"
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

      <div class="my-2" />

      <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
        <template #loading>
          <skeleton-table :col="2" :row="5" />
        </template>
        <template #data>
          <table class="table w-full">
            <thead>
              <tr>
                <th>{{ $t("courses.index.table.course") }}</th>
                <th>{{ $t("courses.index.table.teacher") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ course, teacher } in displayedCourses" :key="course" class="hover">
                <td
                  :class="{
                    'min-w-[10rem] max-w-[12rem] whitespace-pre-wrap': !isDesktop,
                  }"
                >
                  <router-link :to="`/course/${course}`" class="link link-hover text-lg">{{
                    course
                  }}</router-link>
                </td>
                <td>{{ teacher.username }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </data-status-wrapper>
    </div>
  </div>
</template>
