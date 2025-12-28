<script setup lang="ts">
import { computed } from "vue";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute } from "vue-router";
import api, { fetcher } from "@/models/api";
import { ref } from "vue";
import { formatTime } from "@/utils/formatTime";
import { useSession } from "@/stores/session";
import { useTitle } from "@vueuse/core";
import type { AxiosError } from "axios";

const session = useSession();
const route = useRoute();
defineProps(["name"]);

useTitle(`Announcements - ${route.params.name} | Normal OJ`);
const {
  data: announcements,
  error,
  isLoading,
} = useAxios<AnnouncementList>(`/course/${route.params.name}/ann`, fetcher);

// 將置頂公告排在前面
const sortedAnnouncements = computed(() => {
  if (!announcements.value) return [];
  return [...announcements.value].sort((a, b) => {
    // 置頂的排在前面
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // 同樣狀態的按時間排序（新的在前）
    return b.createTime - a.createTime;
  });
});

// --- Delete Logic ---
const deleteModalOpen = ref(false);
const itemToDelete = ref<{ id: string; name: string } | null>(null);
const isDeleting = ref(false);

async function performDelete(id: string) {
  try {
    await api.Announcement.delete({ annId: id });
    // Remove from local list to update UI
    if (announcements.value) {
      announcements.value = announcements.value.filter((a) => a.annId !== id);
    }
  } catch (e) {
    console.error("Failed to delete announcement:", e);
    alert("Failed to delete announcement. Please try again.");
  }
}

function deleteAnnouncement(event: MouseEvent, id: string, name: string) {
  if (event.shiftKey) {
    performDelete(id);
    return;
  }
  itemToDelete.value = { id, name };
  deleteModalOpen.value = true;
}

async function confirmDelete() {
  if (!itemToDelete.value) return;
  isDeleting.value = true;
  await performDelete(itemToDelete.value.id);
  isDeleting.value = false;
  deleteModalOpen.value = false;
  itemToDelete.value = null;
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title justify-between">
          {{ $t("course.ann.index.title") }}
          <router-link
            v-if="session.isAdmin"
            class="btn btn-success"
            :to="`/course/${$route.params.name}/announcements/new`"
          >
            <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.ann.index.new") }}
          </router-link>
          <router-link
            v-if="session.isTeacher"
            class="btn btn-success"
            :to="`/course/${$route.params.name}/announcements/new`"
          >
            <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.ann.index.new") }}
          </router-link>
          <router-link
            v-if="session.isTA"
            class="btn btn-success"
            :to="`/course/${$route.params.name}/announcements/new`"
          >
            <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.ann.index.new") }}
          </router-link>
        </div>

        <div class="my-2" />

        <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
          <template #loading>
            <skeleton-table :col="3" :row="5" />
          </template>
          <template #data>
            <table class="table w-full !min-w-0 table-fixed">
              <thead>
                <tr>
                  <th>{{ $t("course.ann.index.table.title") }}</th>
                  <th>{{ $t("course.ann.index.table.author") }}</th>
                  <th>{{ $t("course.ann.index.table.time") }}</th>
                  <th v-if="session.isAdmin"></th>
                  <th v-if="session.isTeacher"></th>
                  <th v-if="session.isTA"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="{ title, creator, createTime, annId, pinned } in sortedAnnouncements"
                  :key="annId"
                  class="hover"
                >
                  <td>
                    <div class="flex min-w-0 items-center gap-2">
                      <span v-if="pinned" class="text-lg" :title="$t('course.announcements.pinned')">📌</span>
                      <router-link
                        :to="`/course/${$route.params.name}/announcements/${annId}`"
                        class="text-base-content/80 dark:text-base-content/80 visited:text-base-content/80 dark:visited:text-base-content/80 block min-w-0 break-words whitespace-normal hover:underline"
                      >
                        {{ title }}
                      </router-link>
                    </div>
                  </td>
                  <td>{{ creator.displayedName }}</td>
                  <td>{{ formatTime(createTime) }}</td>
                  <td v-if="session.isAdmin">
                    <div class="tooltip" :data-tip="$t('course.problems.edit')">
                      <router-link
                        class="btn btn-ghost btn-sm btn-circle"
                        :to="`/course/${$route.params.name}/announcements/${annId}/edit`"
                      >
                        <i-uil-edit class="lg:h-5 lg:w-5" />
                      </router-link>
                    </div>
                    <div class="tooltip" :data-tip="$t('course.problems.delete')">
                      <button
                        class="btn btn-ghost btn-sm btn-circle text-error"
                        @click="deleteAnnouncement($event, annId, title)"
                      >
                        <i-uil-trash-alt class="lg:h-5 lg:w-5" />
                      </button>
                    </div>
                  </td>
                  <td v-if="session.isTeacher">
                    <div class="tooltip" :data-tip="$t('course.problems.edit')">
                      <router-link
                        class="btn btn-ghost btn-sm btn-circle"
                        :to="`/course/${$route.params.name}/announcements/${annId}/edit`"
                      >
                        <i-uil-edit class="lg:h-5 lg:w-5" />
                      </router-link>
                    </div>
                    <div class="tooltip" :data-tip="$t('course.problems.delete')">
                      <button
                        class="btn btn-ghost btn-sm btn-circle text-error"
                        @click="deleteAnnouncement($event, annId, title)"
                      >
                        <i-uil-trash-alt class="lg:h-5 lg:w-5" />
                      </button>
                    </div>
                  </td>
                  <td v-if="session.isTA">
                    <div class="tooltip" :data-tip="$t('course.problems.edit')">
                      <router-link
                        class="btn btn-ghost btn-sm btn-circle"
                        :to="`/course/${$route.params.name}/announcements/${annId}/edit`"
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
  </div>
  <!-- Delete Confirmation Modal -->
  <dialog class="modal" :class="{ 'modal-open': deleteModalOpen }">
    <div class="modal-box">
      <h3 class="text-lg font-bold">{{ $t("general.deleteConfirmTitle") }}</h3>
      <p class="py-4">
        {{ $t("general.deleteConfirmText", { name: itemToDelete?.name }) }}
        <br />
        <span class="text-error">{{ $t("general.deleteDetails") }}</span>
      </p>
      <p class="mt-2 text-xs text-gray-500">
        {{ $t("general.shiftTip") }}
      </p>
      <div class="modal-action">
        <button class="btn" @click="deleteModalOpen = false" :disabled="isDeleting">
          {{ $t("general.cancel") }}
        </button>
        <button class="btn btn-error" @click="confirmDelete" :disabled="isDeleting">
          {{ isDeleting ? "..." : $t("general.delete") }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="deleteModalOpen = false">close</button>
    </form>
  </dialog>
</template>
