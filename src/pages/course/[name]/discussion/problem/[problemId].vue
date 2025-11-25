<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useProblemSelection } from '@/composables/useProblemSelection';
import PostCard from '@/components/Discussion/PostCard.vue';
import { samplePosts, type Post } from '../mockData';

const route = useRoute();
const { t } = useI18n();
const problemId = route.params.problemId as string;

const { problemId2Meta } = useProblemSelection(route.params.name as string);

const query = ref('');

// Filter posts by problemId
const problemPosts = computed(() => {
  return samplePosts.filter(post => post.problemId === problemId);
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return problemPosts.value.filter((p) => {
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q);
    return matchQ;
  });
});

const problemName = computed(() => {
  return problemId2Meta.value[problemId]?.name || `Problem ${problemId}`;
});
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <!-- Header with back button and problem info -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-4">
              <router-link 
                :to="`/course/${route.params.name}/discussion/Problems`"
                class="btn btn-ghost btn-sm"
              >
                <i-uil-arrow-left class="w-4 h-4" />
                {{ t('discussion.problems.backToProblems') }}
              </router-link>
            </div>
            
            <router-link
              class="btn btn-primary"
              :to="`/course/${route.params.name}/discussion/Post`"
            >
              <i-uil-plus /> {{ t('discussion.post') }}
            </router-link>
          </div>
          
          <h1 class="text-2xl font-bold mb-2">{{ problemName }}</h1>
          <p class="text-gray-600 dark:text-gray-300">
            {{ t('discussion.problems.discussionCount', { count: problemPosts.length }) }}
          </p>
        </div>

        <!-- Search bar -->
        <div class="mb-6">
          <div class="relative max-w-md">
            <input
              v-model="query"
              :placeholder="t('discussion.placeholder')"
              class="input input-bordered w-full pr-10"
            />
            <button class="absolute right-2 top-1/2 -translate-y-1/2 transform rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Posts list -->
        <div v-if="filtered.length > 0" class="space-y-4">
          <template v-for="post in filtered" :key="post.id">
            <router-link :to="`/course/${route.params.name}/discussion/${post.id}`" class="block">
              <PostCard :post="post" />
            </router-link>
          </template>
        </div>
        
        <!-- Empty state -->
        <div v-else class="text-center py-12">
          <div class="text-gray-500 dark:text-gray-400 mb-4">
            <i-uil-comment-alt-slash class="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p class="text-lg">{{ t('discussion.problems.noDiscussions') }}</p>
            <p class="text-sm mt-2">Be the first to start a discussion about this problem!</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>