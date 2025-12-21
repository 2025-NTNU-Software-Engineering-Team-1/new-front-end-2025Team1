<script setup lang="ts">
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute } from "vue-router";
import { fetcher } from "@/models/api";
import { useTitle } from "@vueuse/core";
import { useSession } from "@/stores/session";
import AIChatbot from "@/components/AIChatbot.vue";
import type { AxiosError } from "axios";

const route = useRoute();
const session = useSession();

useTitle(`Problem - ${route.params.id} - ${route.params.name} | Normal OJ`);
const { data: problem, error, isLoading } = useAxios<Problem>(`/problem/view/${route.params.id}`, fetcher);
</script>

<template>
  <div class="card-container pb-40">
    <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
      <template #loading>
        <skeleton-card />
      </template>
      <template #data>
        <problem-card v-if="problem" :problem="problem" />

        <AIChatbot
          v-if="problem && (problem.config?.aiVTuber || true)"
          :course-id="route.params.name as string"
          :course-name="route.params.name as string"
          :problem-id="route.params.id as string"
          :current-code="''"
          :username="session.username"
        />
      </template>
    </data-status-wrapper>
  </div>
</template>
