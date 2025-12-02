<script setup lang="ts">
import { computed } from "vue";
import { useSession } from "@/stores/session";
import ReplyManagementDropdown from "./ReplyManagementDropdown.vue";
import type { DiscussionReply } from "@/types/discussion";
import { formatFriendlyTime } from "@/composables/useDateTime";

// 擴展 DiscussionReply 類型以包含 children
interface ReplyWithChildren extends DiscussionReply {
  children?: ReplyWithChildren[];
}

const props = defineProps<{
  reply: ReplyWithChildren;
  postId?: string | number;
}>();

const emit = defineEmits<{
  reply: [replyId: number, authorName: string];
  refresh: [];
}>();

const session = useSession();

// 生成頭像首字母
const authorInitials = computed(() => {
  return props.reply.Author?.[0]?.toUpperCase() || "?";
});

// 生成隨機顏色
const avatarColor = computed(() => {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
  ];
  const index = props.reply.Author.length % colors.length;
  return colors[index];
});

// 處理回覆按鈕
const handleReply = () => {
  emit("reply", props.reply.Reply_ID, props.reply.Author);
};
</script>

<template>
  <div class="flex gap-3 rounded-lg bg-base-100 p-4">
    <!-- Avatar -->
    <div class="flex-shrink-0">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
        :style="{ backgroundColor: avatarColor }"
      >
        {{ authorInitials }}
      </div>
    </div>

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <!-- Header -->
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm">
          <span class="font-semibold">{{ reply.Author }}</span>
          <span class="text-gray-500">{{ formatFriendlyTime(reply.Created_Time) }}</span>
        </div>

        <!-- Actions dropdown -->
        <ReplyManagementDropdown
          v-if="postId"
          :reply="reply"
          :post-id="postId"
          @refresh="() => emit('refresh')"
          @deleted="() => emit('refresh')"
        />
      </div>

      <!-- Reply content -->
      <div class="prose prose-sm mb-3 max-w-none">
        <div
          class="whitespace-pre-wrap"
          :class="{ 'rounded bg-base-200 p-3 font-mono text-sm': reply.Contains_Code }"
        >
          {{ reply.Content }}
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-4 text-xs">
        <button class="flex items-center gap-1 text-gray-500 hover:text-primary" @click="handleReply">
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414L2.586 8l3.707-3.707a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          回覆
        </button>

        <button
          v-if="reply.Like_Count !== undefined"
          class="flex items-center gap-1 text-gray-500 hover:text-red-500"
          :class="{ 'text-red-500': reply.Is_Liked }"
        >
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clip-rule="evenodd"
            />
          </svg>
          {{ reply.Like_Count }}
        </button>
      </div>

      <!-- Nested replies (子回覆) -->
      <div
        v-if="reply.children && reply.children.length > 0"
        class="mt-4 space-y-3 border-l-2 border-base-300 pl-4"
      >
        <ReplyItem
          v-for="childReply in reply.children"
          :key="childReply.Reply_ID"
          :reply="childReply"
          :post-id="postId"
          @reply="(id, author) => emit('reply', id, author)"
          @refresh="() => emit('refresh')"
        />
      </div>
    </div>
  </div>
</template>
