<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import PostCard from "@/components/Discussion/PostCard.vue";
import { samplePosts, type Post } from "./mockData";

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
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <!-- Header: search + actions -->
        <div class="flex items-start gap-6">
          <div class="flex-1">
            <div class="flex items-center gap-4">
              <div class="relative max-w-2xl flex-1">
                <input
                  v-model="query"
                  :placeholder="t('discussion.placeholder')"
                  class="input input-bordered w-full pr-10"
                />
                <button
                  class="absolute right-2 top-1/2 -translate-y-1/2 transform rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
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
            <div class="mt-4 max-w-2xl">
              <div class="card bg-base-200">
                <div class="card-body p-4">
                  <div class="mb-2 text-sm font-semibold">{{ t('discussion.hot') }}</div>
                  <div class="flex gap-2">
                    <span class="badge badge-outline">python</span>
                    <span class="badge badge-outline">c</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tabs -->
            <div class="mt-6 border-b">
              <nav class="flex gap-6">
                <button
                  :class="['pb-2', activeTab === 'hot' ? 'border-b-2 border-black' : 'text-gray-500']"
                  @click="activeTab = 'hot'"
                >
                  {{ t('discussion.hot') }}
                </button>
                <button
                  :class="['pb-2', activeTab === 'new' ? 'border-b-2 border-black' : 'text-gray-500']"
                  @click="activeTab = 'new'"
                >
                  {{ t('discussion.new') }}
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
    </div>
  </div>
</template>
