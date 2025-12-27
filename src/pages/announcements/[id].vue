<script setup lang="ts">
import { useTitle } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute } from "vue-router";
import { fetcher } from "@/models/api";
import type { AxiosError } from "axios";

const route = useRoute();

useTitle(`Announcement - ${route.params.id} | Normal OJ`);
const {
  data: announcements,
  error,
  isLoading,
} = useAxios<AnnouncementList>(`/ann/${route.params.id}`, fetcher);
</script>

<template>
  <div class="mx-auto flex max-w-7xl gap-8 p-4">
    <router-link class="btn btn-sm mb-10" to="/">
      <i-uil-left-arrow-to-left class="mr-1" /> {{ $t("ann.id.back") }}
    </router-link>

    <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
      <template #loading>
        <skeleton-card />
      </template>
      <template #data>
        <announcement-card v-if="announcements" :announcement="announcements[0]" />
      </template>
    </data-status-wrapper>
  </div>
</template>
