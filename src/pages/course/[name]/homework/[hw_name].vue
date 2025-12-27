<script setup lang="ts">
import { useRoute } from "vue-router";
import { useAxios } from "@vueuse/integrations/useAxios";
import { fetcher } from "@/models/api";
import { useTitle } from "@vueuse/core";
import { useProblemSelection } from "@/composables/useProblemSelection";
import type { AxiosError } from "axios";

const route = useRoute();
const courseName = route.params.name as string;
// The route param is named hw_name, but it contains the homework ID when linked from Dashboard/List
const hwId = route.params.hw_name as string;

useTitle(`Homework - ${courseName} | Normal OJ`);

// Fetch single homework by ID
// Backend API: GET /homework/<id> returns { data: Homework } (unwrapped by fetcher typically)
// We use 'any' for now or HomeworkListItem if imported, to avoid type issues until confirmed.
// Assuming fetcher unwraps response.data.data -> Homework object
const { data: homework, error, isLoading } = useAxios<HomeworkListItem>(`/homework/${hwId}`, fetcher);

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
          <h1 class="card-title mt-2 text-2xl">{{ homework?.name }}</h1>
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
