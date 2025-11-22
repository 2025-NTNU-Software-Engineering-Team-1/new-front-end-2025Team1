<script setup lang="ts">
import { useRoute } from 'vue-router';
import { samplePosts } from './mockData';
import { computed } from 'vue';

const route = useRoute();
const id = route.params.id as string;

const post = computed(() => samplePosts.find(p => p.id === id) ?? null);
</script>

<template>
	<div class="p-6">
		<div v-if="post" class="max-w-3xl mx-auto">
			<div class="mb-4">
				<div class="text-2xl font-bold">{{ post.title }}</div>
				<div class="text-sm text-gray-500">By {{ post.author }} · {{ post.time }}</div>
			</div>

			<div class="prose bg-white p-4 rounded-lg border">
				<p>{{ post.excerpt }}</p>
				<p>This is mock content for post {{ post.id }}. Replace with real API data later.</p>
			</div>

			<div class="mt-6">
				<div class="text-lg font-semibold">Comments</div>
				<div class="mt-2 text-sm text-gray-600">(No real comments — this is mock data.)</div>
			</div>
		</div>
		<div v-else class="text-center text-gray-500">Post not found.</div>
	</div>
</template>

