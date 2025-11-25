<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useProblemSelection } from '@/composables/useProblemSelection';
import { samplePosts } from './mockData';
import { computed } from 'vue';

const route = useRoute();
const { t } = useI18n();
const { problemSelections } = useProblemSelection(route.params.name as string);

// Count discussions for each problem
const problemDiscussionCounts = computed(() => {
  const counts: Record<string, number> = {};
  samplePosts.forEach(post => {
    if (post.problemId) {
      counts[post.problemId] = (counts[post.problemId] || 0) + 1;
    }
  });
  return counts;
});
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex items-center justify-between mb-6">
          <router-link 
            :to="`/course/${route.params.name}/discussion`"
            class="btn btn-ghost btn-sm"
          >
            <i-uil-arrow-left class="w-4 h-4" />
            {{ t('discussion.problems.backToDiscussion') }}
          </router-link>
        </div>
        <div class="card-title mb-6">
          {{ t('discussion.problems.title') }}
        </div>
        
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          {{ t('discussion.problems.selectProblem') }}
        </p>

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <router-link 
            v-for="{ text, value } in problemSelections" 
            :key="value" 
            :to="`/course/${route.params.name}/discussion/problem/${value}`"
            class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer"
          >
            <div class="card-body p-4">
              <h3 class="card-title text-lg">{{ text }}</h3>
              <div class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <span v-if="problemDiscussionCounts[value]">
                  {{ t('discussion.problems.discussionCount', { count: problemDiscussionCounts[value] }) }}
                </span>
                <span v-else>
                  {{ t('discussion.problems.noDiscussions') }}
                </span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>