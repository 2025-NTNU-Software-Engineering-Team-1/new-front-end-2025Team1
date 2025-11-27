<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import PostCard from "@/components/Discussion/PostCard.vue";
import API from "@/models/api";
import type { 
  DiscussionPost, 
  GetPostsResponse, 
  SearchPostsResponse,
  PaginationInfo 
} from "@/types/discussion";

const { t } = useI18n();
const route = useRoute();

const query = ref("");
const activeTab = ref<"Hot" | "New">("Hot");
const posts = ref<DiscussionPost[]>([]);
const loading = ref(false);
const error = ref<string>("");

// 分頁相關
const pagination = ref<PaginationInfo>({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

// 載入貼文列表
const loadPosts = async () => {
  try {
    loading.value = true;
    error.value = "";
    
    const params = {
      Mode: activeTab.value,
      Limit: pagination.value.limit,
      Page: pagination.value.page,
    };

    const response = await API.Discussion.getPosts(params) as unknown as GetPostsResponse;
    
    if (response.Status === "OK") {
      posts.value = response.Posts || [];
    } else {
      error.value = "Failed to load posts";
    }
  } catch (err) {
    console.error("Error loading posts:", err);
    error.value = "Network error occurred";
  } finally {
    loading.value = false;
  }
};

// 搜尋貼文
const searchPosts = async () => {
  if (!query.value.trim()) {
    return loadPosts();
  }

  try {
    loading.value = true;
    error.value = "";
    
    const params = {
      Words: query.value.trim(),
      Limit: pagination.value.limit,
      Page: pagination.value.page,
    };

    const response = await API.Discussion.searchPosts(params) as unknown as SearchPostsResponse;
    
    if (response.Status === "OK") {
      posts.value = response.Post || [];
    } else {
      error.value = "Failed to search posts";
    }
  } catch (err) {
    console.error("Error searching posts:", err);
    error.value = "Network error occurred";
  } finally {
    loading.value = false;
  }
};

// 轉換貼文資料格式為 PostCard 組件需要的格式
const transformedPosts = computed(() => {
  return posts.value.map(post => ({
    id: post.Post_Id.toString(),
    author: post.Author,
    time: post.Created_Time,
    title: post.Title,
    excerpt: "", // API 沒有提供摘要，可以從內容截取
    likes: post.Like_Count,
    comments: post.Reply_Count,
    isPinned: post.Is_Pinned,
  }));
});

// 處理搜尋輸入
const handleSearch = () => {
  pagination.value.page = 1;
  searchPosts();
};

// 處理標籤切換
const handleTabChange = (tab: "Hot" | "New") => {
  activeTab.value = tab;
  pagination.value.page = 1;
  if (query.value.trim()) {
    searchPosts();
  } else {
    loadPosts();
  }
};

// 監聽路由變化
watch(() => route.params.name, () => {
  loadPosts();
});

onMounted(() => {
  loadPosts();
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
                  @keyup.enter="handleSearch"
                />
                <button
                  class="absolute right-2 top-1/2 -translate-y-1/2 transform rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                  @click="handleSearch"
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
                  <i-uil-file-upload-alt /> {{ $t("discussion.problems.title") }}
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
                  :class="['pb-2', activeTab === 'Hot' ? 'border-b-2 border-black' : 'text-gray-500']"
                  @click="handleTabChange('Hot')"
                  :disabled="loading"
                >
                  {{ t('discussion.hot') }}
                </button>
                <button
                  :class="['pb-2', activeTab === 'New' ? 'border-b-2 border-black' : 'text-gray-500']"
                  @click="handleTabChange('New')"
                  :disabled="loading"
                >
                  {{ t('discussion.new') }}
                </button>
              </nav>
            </div>

            <!-- Loading state -->
            <div v-if="loading" class="mt-4 flex justify-center">
              <div class="loading loading-spinner loading-lg"></div>
            </div>

            <!-- Error state -->
            <div v-else-if="error" class="mt-4 alert alert-error">
              <span>{{ error }}</span>
              <button class="btn btn-sm btn-ghost" @click="loadPosts">重試</button>
            </div>

            <!-- Posts list -->
            <div v-else class="mt-4 space-y-4">
              <div v-if="transformedPosts.length === 0" class="text-center text-gray-500 py-8">
                {{ query ? t('discussion.noSearchResults') : t('discussion.noPosts') }}
              </div>
              <template v-for="post in transformedPosts" :key="post.id">
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
