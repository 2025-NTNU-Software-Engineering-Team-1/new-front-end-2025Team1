<script setup lang="ts">
import dayjs from "dayjs";
import { ref, watchEffect, computed } from "vue";
import { useTitle } from "@vueuse/core";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import api, { fetcher } from "@/models/api";
import axios, { type AxiosError } from "axios";
import AnnouncementForm from "@/components/Announcement/AnnouncementForm.vue";
import { useI18n } from "vue-i18n";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
useTitle(`${t("course.ann.edit.title")} - ${route.params.id} - ${route.params.name} | Normal OJ`);

const formElement = ref<InstanceType<typeof AnnouncementForm>>();

const {
  data: announcements,
  error: fetchError,
  isLoading: isFetching,
} = useAxios<AnnouncementList>(`/ann/${route.params.name}/${route.params.id}`, fetcher);
const announcement = computed(() => announcements.value && announcements.value[0]);

const edittingAnnouncement = ref<AnnouncementForm>();
watchEffect(() => {
  if (announcement.value) {
    edittingAnnouncement.value = announcement.value;
  }
});

function update<K extends keyof AnnouncementForm>(key: K, value: AnnouncementForm[K]) {
  if (!edittingAnnouncement.value) return;
  edittingAnnouncement.value[key] = value;
}

const openPreview = ref<boolean>(false);
const previewPostMockMeta = computed(() => ({
  creator: announcement.value?.creator || { displayedName: "Ijichi Nijika" },
  createTime: announcement.value?.createTime || dayjs().unix(),
  updateTime: announcement.value?.updateTime || dayjs().unix(),
}));

async function submit() {
  if (!edittingAnnouncement.value || !formElement.value) return;

  formElement.value.isLoading = true;
  try {
    await api.Announcement.modify({
      ...edittingAnnouncement.value,
      annId: route.params.id as string,
    });
    router.push(`/course/${route.params.name}/announcements/${route.params.id}`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      formElement.value.errorMsg = error.response.data.message;
    } else {
      formElement.value.errorMsg = "Unknown error occurred :(";
    }
    throw error;
  } finally {
    formElement.value.isLoading = false;
  }
}
async function delete_() {
  if (!formElement.value) return;

  formElement.value.isLoading = true;
  if (!confirm(t("course.ann.edit.confirmDelete"))) return;
  try {
    await api.Announcement.delete({ annId: route.params.id as string });
    router.push(`/course/${route.params.name}/announcements`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      formElement.value.errorMsg = error.response.data.message;
    } else {
      formElement.value.errorMsg = "Unknown error occurred :(";
    }
    throw error;
  } finally {
    formElement.value.isLoading = false;
  }
}
function discard() {
  if (!confirm(t("course.ann.edit.confirmDiscard"))) return;
  router.push(`/course/${route.params.name}/announcements`);
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-3 flex-wrap justify-between lg:flex-nowrap">
          {{ t("course.ann.edit.title") }}
          <div class="flex gap-x-3">
            <button
              :class="['btn btn-error btn-outline btn-sm lg:btn-md', formElement?.isLoading && 'loading']"
              @click="delete_"
            >
              <i-uil-trash-alt class="mr-1 lg:h-5 lg:w-5" /> {{ t("course.ann.edit.delete") }}
            </button>
            <button
              :class="['btn btn-warning btn-sm lg:btn-md', formElement?.isLoading && 'loading']"
              @click="discard"
            >
              <i-uil-times-circle class="mr-1 lg:h-5 lg:w-5" /> {{ t("course.ann.edit.discardChanges") }}
            </button>
          </div>
        </div>

        <data-status-wrapper :error="fetchError as AxiosError" :is-loading="isFetching">
          <template #loading>
            <skeleton-card />
          </template>
          <template #data>
            <template v-if="edittingAnnouncement">
              <announcement-form
                :value="edittingAnnouncement"
                ref="formElement"
                @update="update"
                @submit="submit"
              />

              <div class="divider" />

              <div class="card-title mb-3">
                {{ t("course.ann.edit.preview") }}
                <input v-model="openPreview" type="checkbox" class="toggle" />
              </div>

              <announcement-card
                v-show="openPreview"
                :announcement="{ ...previewPostMockMeta, ...edittingAnnouncement }"
                class="rounded border-2 border-slate-300"
              />
            </template>
          </template>
        </data-status-wrapper>
      </div>
    </div>
  </div>
</template>
