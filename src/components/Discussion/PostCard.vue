<script setup lang="ts">
import type { PropType } from 'vue';
import { computed } from 'vue';

const props = defineProps<{ post: {
  id: string;
  author: string;
  avatarColor?: string;
  time: string;
  title: string;
  excerpt: string;
  likes: number;
  comments: number;
  views: number;
  tags?: string[];
} }>();

const initials = computed(() => props.post.author?.[0] ?? '?');
</script>

<template>
  <div class="p-4 bg-gray-100 rounded-xl border">
    <div class="flex gap-4">
      <div class="w-12">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white" :style="{ background: post.avatarColor || '#999' }">
          {{ initials }}
        </div>
      </div>
      <div class="flex-1">
        <div class="flex justify-between items-start">
          <div>
            <div class="text-sm font-semibold">{{ post.author }}</div>
            <div class="text-xs text-gray-500">{{ post.time }}</div>
          </div>
        </div>

        <div class="mt-3">
          <div class="text-lg font-bold">{{ post.title }}</div>
          <div class="text-sm text-gray-600 mt-2">{{ post.excerpt }}</div>
        </div>

        <div class="mt-3 flex justify-end items-center gap-4 text-sm text-gray-600">
          <div class="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 21l-1-1c-5-4-8-6-8-10a5 5 0 0 1 5-5c2 0 3 1 4 2 1-1 2-2 4-2a5 5 0 0 1 5 5c0 4-3 6-8 10l-1 1z" stroke="#000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>{{ post.likes }}</div>
          <div class="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>{{ post.comments }}</div>
          <div class="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5c7 0 11 7 11 7s-4 7-11 7S1 12 1 12s4-7 11-7z" stroke="#000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>{{ post.views }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
