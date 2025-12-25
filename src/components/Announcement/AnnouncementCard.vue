<script setup lang="ts">
import { formatTime } from "@/utils/formatTime";

interface Props {
  announcement: AnnouncementListItem | AnnouncementPreviewForm;
}
defineProps<Props>();
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-8 flex w-full items-start gap-2">
          <span v-if="announcement.pinned" class="shrink-0 text-xl" title="置頂">📌</span>
          <span
            class="text-base-content/80 dark:text-base-content/80 block min-w-0 flex-1 whitespace-normal break-all text-2xl font-bold"
          >
            {{ announcement.title }}
          </span>
        </div>
        <div class="w-full overflow-x-hidden break-all">
          <markdown-renderer :md="announcement.markdown" />
        </div>

        <div class="mt-4 flex items-center gap-2 text-sm">
          {{ $t("components.ann.card.lastUpdate", { time: formatTime(announcement.updateTime) }) }}
        </div>
        <div class="mt-2 flex items-center gap-2 text-sm">
          {{
            $t("components.ann.card.postBy", {
              author: announcement.creator.displayedName,
              time: formatTime(announcement.createTime),
            })
          }}
        </div>
      </div>
    </div>
  </div>
</template>
