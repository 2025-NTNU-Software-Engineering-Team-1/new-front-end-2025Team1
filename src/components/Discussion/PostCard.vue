<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatFriendlyTime } from "@/composables/useDateTime";

const props = defineProps<{
  post: {
    id: string;
    author: string;
    avatarColor?: string;
    time: string;
    title: string;
    excerpt: string;
    likes: number;
    comments: number;
    views?: number;
    tags?: string[];
    isPinned?: boolean;
    isSolved?: boolean;
    isClosed?: boolean;
  };
}>();

const { post } = props;
const { t } = useI18n();

const initials = computed(() => post.author?.[0] ?? "?");
const formattedTime = computed(() => formatFriendlyTime(post.time));
</script>

<template>
  <div class="card bg-base-200 dark:bg-base-300">
    <div class="card-body p-4">
      <div class="flex gap-4">
        <div class="w-12 flex-shrink-0">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full text-white"
            :style="{ background: post.avatarColor || '#999' }"
          >
            {{ initials }}
          </div>
        </div>
        <div class="flex-1">
          <div class="flex items-start justify-between">
            <div>
              <div class="text-sm font-semibold">{{ post.author }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ formattedTime }}</div>
            </div>
          </div>

          <div class="mt-3">
            <div class="flex items-center gap-2">
              <span v-if="post.isPinned" class="text-lg">📌</span>
              <div class="text-lg font-bold">{{ post.title }}</div>
              <span v-if="post.isSolved" class="badge badge-success gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {{ t("discussion.solved") }}
              </span>
              <span v-if="post.isClosed" class="badge badge-error gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17 11V7A5 5 0 0 0 7 7v4M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {{ t("discussion.closed") }}
              </span>
            </div>
            <div class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ post.excerpt }}</div>
          </div>

          <div class="mt-3 flex items-center justify-end gap-4 text-sm text-gray-600 dark:text-gray-300">
            <div class="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 21l-1-1c-5-4-8-6-8-10a5 5 0 0 1 5-5c2 0 3 1 4 2 1-1 2-2 4-2a5 5 0 0 1 5 5c0 4-3 6-8 10l-1 1z"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg>
              >{{ post.likes }}
            </div>
            <div class="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg>
              >{{ post.comments }}
            </div>
            <div v-if="post.views" class="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5c7 0 11 7 11 7s-4 7-11 7S1 12 1 12s4-7 11-7z"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg>
              >{{ post.views }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
