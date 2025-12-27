<script setup lang="ts">
import { useSession } from "@/stores/session";
import { formatTime } from "@/utils/formatTime";
import { useAxios } from "@vueuse/integrations/useAxios";
import { fetcher } from "@/models/api";
import { AxiosError } from "axios";

import useInteractions from "@/composables/useInteractions";

const { isDesktop } = useInteractions();

const session = useSession();

const { data: announcements, error, isLoading } = useAxios<AnnouncementList>("/ann", fetcher);
</script>

<template>
  <div v-if="isDesktop" class="card min-w-full">
    <div class="card-body">
      <div class="card-title mb-3 flex items-center gap-2">
        <i-uil-megaphone />
        {{ $t("components.systemAnn.ann") }}
      </div>
      <div class="my-2" />

      <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
        <template #loading>
          <skeleton-table :col="3" :row="5" />
        </template>
        <template #data>
          <table class="table w-full">
            <thead>
              <tr>
                <th>{{ $t("components.systemAnn.title") }}</th>
                <th>{{ $t("components.systemAnn.createTime") }}</th>
                <th v-if="session.isAdmin"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ title, createTime, annId } in announcements" :key="annId" class="hover">
                <td>
                  <router-link
                    :to="`/announcements/${annId}`"
                    class="text-base-content/80 dark:text-base-content/80 visited:text-base-content/80 dark:visited:text-base-content/80 block min-w-0 break-words whitespace-normal hover:underline"
                  >
                    {{ title }}
                  </router-link>
                </td>
                <td>{{ formatTime(createTime) }}</td>
                <td v-if="session.isAdmin">
                  <div class="tooltip" data-tip="Edit">
                    <router-link
                      class="btn btn-ghost btn-sm btn-circle"
                      :to="`/course/Public/announcements/${annId}/edit`"
                    >
                      <i-uil-edit class="lg:h-5 lg:w-5" />
                    </router-link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </data-status-wrapper>
    </div>
  </div>
  <div v-else class="space-y-4">
    <h2 class="text-base-content flex items-center gap-2 px-1 text-xl font-bold">
      <i-uil-megaphone />
      {{ $t("components.systemAnn.ann") }}
    </h2>

    <data-status-wrapper :error="error as AxiosError | undefined" :is-loading="isLoading">
      <template #loading>
        <div class="skeleton mb-3 h-20 w-full rounded-xl" v-for="i in 3" :key="i"></div>
      </template>
      <template #data>
        <div class="flex flex-col gap-3">
          <div
            v-for="{ title, createTime, annId } in announcements"
            :key="annId"
            class="card bg-base-100 border-base-200 border shadow-sm"
          >
            <div class="card-body p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <h3 class="text-lg leading-snug font-bold">
                    <router-link
                      :to="`/announcements/${annId}`"
                      class="hover:text-primary block transition-colors hover:underline"
                    >
                      {{ title }}
                    </router-link>
                  </h3>
                  <div class="text-base-content/60 mt-1 text-xs">
                    {{ formatTime(createTime) }}
                  </div>
                </div>
                <div v-if="session.isAdmin" class="shrink-0">
                  <router-link
                    class="btn btn-ghost btn-xs btn-circle"
                    :to="`/course/Public/announcements/${annId}/edit`"
                  >
                    <i-uil-edit />
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </data-status-wrapper>
  </div>
</template>
