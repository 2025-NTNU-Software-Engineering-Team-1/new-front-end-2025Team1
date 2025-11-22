<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import PostCard from "@/components/Discussion/PostCard.vue";
type Post = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  avatarColor?: string;
  time: string;
  createdAt?: string;
  likes: number;
  comments: number;
  views: number;
  tags?: string[];
};

const samplePosts: Post[] = [
  {
    id: "1",
    title: "Welcome to the discussion",
    excerpt: "This is a mock post used for development and testing.",
    author: "Alice",
    avatarColor: "#F97316",
    time: "2025-01-01T12:00:00Z",
    createdAt: "2025-01-01",
    likes: 5,
    comments: 2,
    views: 120,
    tags: ["welcome"],
  },
  {
    id: "2",
    title: "Problem with sample data",
    excerpt: "Another mock post example.",
    author: "Bob",
    avatarColor: "#06B6D4",
    time: "2025-02-01T09:30:00Z",
    createdAt: "2025-02-01",
    likes: 3,
    comments: 1,
    views: 45,
    tags: ["bug"],
  },
];

const { t } = useI18n();
const route = useRoute();

const query = ref("");
const activeTab = ref<"hot" | "new">("hot");

const posts = ref<Post[]>(samplePosts);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return posts.value.filter((p) => {
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q);
    return matchQ;
  });
});
</script>

<template>
  <div class="px-4 py-6">
    <!-- Header: search + actions -->
    <div class="flex items-start gap-6">
      <div class="flex-1">
        <div class="flex items-center gap-4">
          <div
            class="flex h-12 w-full max-w-2xl items-center justify-between rounded-xl border bg-slate-200 px-4"
          >
            <input
              v-model="query"
              :placeholder="t('discussion.placeholder')"
              class="w-full rounded-xl bg-transparent focus:outline-none"
            />
            <button class="ml-2 rounded-full p-2 hover:bg-gray-300">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                  stroke="#000"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>

          <div class="flex gap-4">
            <router-link
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/discussion/Post`"
            >
              <i-uil-file-upload-alt /> {{ $t("discussion.post") }}
            </router-link>
            <router-link
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/discussion/Problems`"
            >
              <i-uil-file-upload-alt /> {{ $t("discussion.problems") }}
            </router-link>
          </div>
        </div>

        <!-- Tag area (mock) -->
        <div class="mt-4 max-w-2xl rounded-lg border bg-white p-4">
          <div class="mb-2 text-sm font-semibold">Hot</div>
          <div class="flex gap-2">
            <span class="rounded-full bg-gray-200 px-2 py-1 text-sm">python</span>
            <span class="rounded-full bg-gray-200 px-2 py-1 text-sm">c</span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mt-6 border-b">
          <nav class="flex gap-6">
            <button
              :class="['pb-2', activeTab === 'hot' ? 'border-b-2 border-black' : 'text-gray-500']"
              @click="activeTab = 'hot'"
            >
              Hot
            </button>
            <button
              :class="['pb-2', activeTab === 'new' ? 'border-b-2 border-black' : 'text-gray-500']"
              @click="activeTab = 'new'"
            >
              New
            </button>
          </nav>
        </div>

        <!-- Posts list -->
        <div class="mt-4 space-y-4">
          <template v-for="post in filtered" :key="post.id">
            <router-link :to="`/course/${route.params.name}/discussion/${post.id}`" class="block">
              <PostCard :post="post" />
            </router-link>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
