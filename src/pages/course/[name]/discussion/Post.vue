<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSession } from '@/stores/session';
import { useI18n } from 'vue-i18n';
import { addPost } from './mockData';
import { useProblemSelection } from '@/composables/useProblemSelection';

const router = useRouter();
const route = useRoute();
const session = useSession();
const { t } = useI18n();

const problemId = ref('');
const title = ref('');
const content = ref('');

const { problemSelections } = useProblemSelection(route.params.name as string);

function cancel() {
  router.back();
}

function submitPost() {
  const author = session.displayedName || session.username || 'Anonymous';
  const now = new Date();
  const time = now.toLocaleString();

  const newPost = addPost({
    author,
    avatarColor: '#888',
    time,
    title: title.value || '(no title)',
    excerpt: content.value || '',
    likes: 0,
    comments: 0,
    views: 0,
    problemId: problemId.value,
  });

  // navigate to new post detail
  router.push(`/course/${route.params.name}/discussion/${newPost.id}`);
}
</script>

<template>
  <div class="card-container">
    <div class="card max-w-5xl w-full mx-auto">
      <div class="card-body px-8">
        <h2 class="text-2xl font-semibold mb-4">{{ t('discussion.create.title') }}</h2>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">{{ t('discussion.create.problem') }}</label>
          <select v-model="problemId" class="w-full select select-bordered">
            <option value="">{{ t('discussion.create.problemPlaceholder') }}</option>
            <option v-for="{ text, value } in problemSelections" :key="value" :value="value">
              {{ text }}
            </option>
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">{{ t('discussion.create.titleLabel') }}</label>
          <input v-model="title" class="w-full input input-bordered" :placeholder="t('discussion.create.titlePlaceholder')" />
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">{{ t('discussion.create.contentLabel') }}</label>
          <textarea v-model="content" rows="8" class="w-full textarea textarea-bordered" :placeholder="t('discussion.create.contentPlaceholder')"></textarea>
        </div>
        <div class="flex gap-3">
          <button class="btn btn-primary" @click="submitPost">{{ t('discussion.create.submit') }}</button>
          <button class="btn btn-ghost" @click="cancel">{{ t('discussion.create.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>