<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import PostCard from "@/components/Discussion/PostCard.vue";
import API from "@/models/api";
import type {
  DiscussionPost,
  DiscussionProblem,
  // GetPostsResponse,
  // SearchPostsResponse,
  // GetProblemMetaResponse,
  PaginationInfo,
} from "@/types/discussion";

const route = useRoute();
const { t } = useI18n();
const problemId = route.params.problemId as string;

const query = ref("");
const posts = ref<DiscussionPost[]>([]);
const problems = ref<DiscussionProblem[]>([]);
const loading = ref(true);
const error = ref<string>("");
const problemName = ref<string>("");
const problemMeta = ref<{
  Role: string;
  Deadline: string;
  Code_Allowed: boolean;
} | null>(null);

// 分頁相關
const pagination = ref<PaginationInfo>({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

// 載入題目列表
const loadProblems = async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await API.Discussion.getProblems({ Limit: 100, Course_Id: route.params.name });
    const status = response.data?.Status;
    const problemsData = response.data?.Problems;

    if (status === "OK") {
      problems.value = problemsData || [];
      console.log("[loadProblems] Loaded problems:", problems.value.length, problems.value);
    }
  } catch (err) {
    console.error("Error loading problems:", err);
  }
};

// 根據 Problem_Id 獲取題目名稱
const getProblemName = (problemId?: string): string | undefined => {
  if (!problemId) return undefined;
  console.log("[getProblemName] Looking for problemId:", problemId, "in", problems.value.length, "problems");
  const problem = problems.value.find((p) => p.Problem_Id.toString() === problemId.toString());
  console.log("[getProblemName] Found:", problem);
  return problem?.Problem_Name;
};

// 載入題目相關貼文
const loadProblemPosts = async () => {
  try {
    loading.value = true;
    error.value = "";

    const params = {
      Problem_Id: problemId,
      Limit: pagination.value.limit,
      Page: pagination.value.page,
      Course_Id: route.params.name,
    };

    console.log("Loading posts for problem:", problemId, "with params:", params);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await API.Discussion.getPosts(params);
    console.log("Problem posts response:", response);

    // axios interceptor 將 response.data 展開到 response 層級
    const status = response.Status || response.data?.Status;
    const postsData = response.Posts || response.data?.Posts;

    if (status === "OK") {
      posts.value = postsData || [];
      console.log("Loaded", posts.value.length, "posts for problem", problemId);
    } else {
      console.error("Failed to load problem posts, response:", response);
      const errorMsg = response.Message || response.data?.Message || t("discussion.err.err_unknown");
      error.value = t("discussion.err.err_failed_load") + errorMsg;
    }
  } catch (err) {
    console.error("Error loading problem posts:", err);
    error.value = t("discussion.err.err_network") + t("discussion.err.err");
  } finally {
    loading.value = false;
  }
};

// 載入題目資訊
const loadProblemMeta = async () => {
  try {
    console.log("Loading problem meta for:", problemId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await API.Discussion.getProblemMeta(problemId);
    console.log("Problem meta response:", response);

    // axios interceptor 將 response.data 展開到 response 層級
    const status = response.Status || response.data?.Status;

    if (status === "OK") {
      // 設置題目名稱
      const name = response.Problem_Name || response.data?.Problem_Name;
      if (name) {
        problemName.value = name;
      }

      problemMeta.value = {
        Role: response.Role || response.data?.Role,
        Deadline: response.Deadline || response.data?.Deadline,
        Code_Allowed: response.Code_Allowed ?? response.data?.Code_Allowed,
      };
      console.log("Problem meta loaded:", problemMeta.value);
    }
  } catch (err) {
    console.error("Error loading problem meta:", err);
  }
};

// 搜尋題目相關貼文（在前端進行過濾）
const searchProblemPosts = async () => {
  if (!query.value.trim()) {
    return loadProblemPosts();
  }

  try {
    loading.value = true;
    error.value = "";

    const params = {
      Problem_Id: problemId,
      Limit: 100, // 載入更多以便搜尋
      Page: 1,
      Course_Id: route.params.name,
    };

    console.log("Searching problem posts with params:", params);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await API.Discussion.getPosts(params);
    console.log("Search response:", response);

    // axios interceptor 將 response.data 展開到 response 層級
    const status = response.Status || response.data?.Status;
    const postsData = response.Posts || response.data?.Posts;

    if (status === "OK") {
      // 在前端進行關鍵字過濾
      const allPosts = postsData || [];
      const searchTerm = query.value.trim().toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      posts.value = allPosts.filter((post: any) => post.Title?.toLowerCase().includes(searchTerm));
      console.log("Found", posts.value.length, "posts matching search term out of", allPosts.length, "total");
    } else {
      console.error("Search failed, response:", response);
      const errorMsg = response.Message || response.data?.Message || t("discussion.err.err_unknown");
      error.value = t("discussion.err.err_failed_search") + errorMsg;
    }
  } catch (err) {
    console.error("Error searching problem posts:", err);
    error.value = t("discussion.err.err_network") + t("discussion.err.err");
  } finally {
    loading.value = false;
  }
};

// 轉換貼文資料以符合 PostCard 需求
const transformedPosts = computed(() => {
  return posts.value.map((post) => {
    // 處理 Author 欄位：可能是字串或物件
    let authorName: string;
    if (typeof post.Author === "object" && post.Author !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorName = (post.Author as any).displayedName || (post.Author as any).username || "Unknown";
    } else {
      authorName = typeof post.Author === "string" ? post.Author : "Unknown";
    }

    // 處理 Problem_Id 欄位：後端可能返回 Problem_Id 或 Problem_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postProblemId = (post as any).Problem_Id || post.Problem_id;
    console.log("[transformedPosts] Post:", post.Post_Id, "problemId:", postProblemId);

    return {
      id: post.Post_Id.toString(),
      author: authorName,
      time: post.Created_Time,
      title: post.Title,
      excerpt: "", // API 沒有提供摘要
      likes: post.Like_Count,
      comments: post.Reply_Count,
      isPinned: post.Is_Pinned,
      isSolved: post.Is_Solved ?? false,
      isClosed: post.Is_Closed ?? false,
      problemId: postProblemId,
      problemName: getProblemName(postProblemId),
    };
  });
});

// 處理搜尋
const handleSearch = () => {
  pagination.value.page = 1;
  searchProblemPosts();
};

// 監聽路由變化
watch(
  () => route.params.problemId,
  (newProblemId) => {
    if (newProblemId) {
      loadProblemPosts();
      loadProblemMeta();
    }
  },
);

onMounted(async () => {
  await loadProblems();
  loadProblemPosts();
  loadProblemMeta();
});
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <!-- Header with back button and problem info -->
        <div class="mb-6">
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <router-link
                :to="`/course/${route.params.name}/discussion/Problems`"
                class="btn btn-ghost btn-sm"
              >
                <i-uil-arrow-left class="h-4 w-4" />
                {{ t("discussion.problems.backToProblems") }}
              </router-link>
            </div>

            <router-link class="btn btn-primary" :to="`/course/${route.params.name}/discussion/Post`">
              <i-uil-plus /> {{ t("discussion.post") }}
            </router-link>
          </div>
        </div>

        <!-- Search bar -->
        <div class="mb-6">
          <div class="relative max-w-md">
            <input
              v-model="query"
              :placeholder="t('discussion.placeholder')"
              maxlength="50"
              class="input-bordered input w-full pr-10"
              @keyup.enter="handleSearch"
            />
            <button
              class="absolute top-1/2 right-2 -translate-y-1/2 transform rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="handleSearch"
            >
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

        <!-- Loading state -->
        <div v-if="loading" class="flex justify-center py-8">
          <div class="loading loading-spinner loading-lg"></div>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="alert alert-error">
          <span>{{ error }}</span>
          <button class="btn btn-ghost btn-sm" @click="loadProblemPosts">
            {{ t("discussion.err.err") }}
          </button>
        </div>

        <!-- Posts list -->
        <div v-else-if="transformedPosts.length > 0" class="space-y-4">
          <template v-for="post in transformedPosts" :key="post.id">
            <router-link :to="`/course/${route.params.name}/discussion/${post.id}`" class="block">
              <PostCard :post="post" :course-name="route.params.name as string" />
            </router-link>
          </template>
        </div>

        <!-- Empty state -->
        <div v-else class="py-12 text-center">
          <div class="mb-4 text-gray-500 dark:text-gray-400">
            <svg class="mx-auto mb-4 h-16 w-16 opacity-50" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"
                clip-rule="evenodd"
              />
            </svg>
            <p class="text-lg">{{ t("discussion.problems.noDiscussions") }}</p>
            <p class="mt-2 text-sm">{{ t("discussion.detail.reply.no_comments") }}</p>
          </div>
          <router-link
            class="btn btn-primary mt-4"
            :to="`/course/${route.params.name}/discussion/Post?problemId=${problemId}`"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clip-rule="evenodd"
              />
            </svg>
            {{ t("discussion.detail.reply.start") }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
