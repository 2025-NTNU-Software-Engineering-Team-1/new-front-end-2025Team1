<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { samplePosts } from './mockData';
import { computed } from 'vue';

const route = useRoute();
const { t } = useI18n();
const id = route.params.id as string;

const post = computed(() => samplePosts.find(p => p.id === id) ?? null);
</script>

<template>
	<div class="card-container">
		<div class="card max-w-5xl w-full mx-auto">
			<div class="card-body">
				<div v-if="post">
					<div class="mb-4">
						<div class="text-2xl font-bold">{{ post.title }}</div>
						<div class="text-sm text-gray-500 dark:text-gray-400">{{ t('discussion.detail.by') }} {{ post.author }} · {{ post.time }}</div>
					</div>

					<div class="prose p-4 rounded-lg">
						<p>{{ post.excerpt }}</p>
						<p>{{ t('discussion.detail.mockContent', { id: post.id }) }}</p>
					</div>

					<div class="mt-6">
						<div class="text-lg font-semibold">{{ t('discussion.detail.comments') }}</div>
						<div class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ t('discussion.detail.noComments') }}</div>
					</div>
				</div>
				<div v-else class="text-center text-gray-500 dark:text-gray-400">{{ t('discussion.detail.notFound') }}</div>
			</div>
		</div>
	</div>
</template>

