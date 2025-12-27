<script setup lang="ts">
import { useRoute } from "vue-router";
import { useAxios } from "@vueuse/integrations/useAxios";
import { fetcher } from "@/models/api";
import { computed } from "vue";
import { useTitle } from "@vueuse/core";
import { useProblemSelection } from "@/composables/useProblemSelection";
import type { AxiosError } from "axios";

const route = useRoute();
const courseName = route.params.name as string;
const hwName = route.params.hw_name as string;

useTitle(`${hwName} - ${courseName} | Normal OJ`);

// Fetch data
// Note: We fetch ALL homeworks and filter because there isn't a single homework API yet?
// Wait, user just said "HW沒有homework/<homework>這個路由".
// So I should probably use the list API or check if there is a way to get one.
// The list API `/course/{name}/homework` returns all. It's efficient enough for now (~10-20 HWs).
const { data, error, isLoading } = useAxios<HomeworkList>(`/course/${courseName}/homework`, fetcher);

const homework = computed(() => {
  if (!data.value) return null;
  return data.value.find((h) => h.name === hwName);
});

const {
  problemId2Meta,
  error: fetchProblemError,
  isLoading: isFetchingProblem,
} = useProblemSelection(courseName);
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="mb-4">
          <router-link :to="`/course/${courseName}/homeworks`" class="btn btn-sm btn-ghost gap-2 pl-0">
            <i-uil-arrow-left />
            {{ $t("course.hw.index.title") }}
          </router-link>
          <h1 class="card-title mt-2 text-2xl">{{ hwName }}</h1>
        </div>

        <data-status-wrapper
          :error="(error || fetchProblemError) as AxiosError"
          :is-loading="isLoading || isFetchingProblem"
        >
          <template #loading>
            <skeleton-card />
          </template>

          <template #data>
            <div v-if="homework">
              <homework-card :homework="homework" :problems="problemId2Meta" class="mb-2" />
            </div>
            <div v-else class="alert alert-error">Homework not found.</div>
          </template>
        </data-status-wrapper>
      </div>
    </div>
  </div>
</template>
