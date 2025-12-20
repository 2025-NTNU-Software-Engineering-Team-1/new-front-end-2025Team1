<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSession } from "@/stores/session";
import API from "@/models/api";
import ReplyItem from "@/components/Discussion/ReplyItem.vue";
import PostManagementDropdown from "@/components/Discussion/PostManagementDropdown.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import { formatFriendlyTime } from "@/composables/useDateTime";
import type {
  DiscussionPostDetail,
  DiscussionReply,
  GetPostDetailResponse,
  CreateReplyResponse,
  LikeActionResponse,
  CreateReplyParams,
} from "@/types/discussion";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const session = useSession();

const postId = route.params.id as string;
const post = ref<DiscussionPostDetail | null>(null);
const replies = ref<DiscussionReply[]>([]);
const loading = ref(true);
const error = ref<string>("");

// 回覆相關
const showReplyForm = ref(false);
const replyContent = ref("");
const replyToId = ref<number | undefined>(undefined);
const submittingReply = ref(false);

// 按讚相關
const likingPost = ref(false);
const userLikeStatus = ref<boolean | null>(null);

// 載入貼文詳情
const loadPostDetail = async () => {
  try {
    loading.value = true;
    error.value = "";

    const response: any = await API.Discussion.getPostDetail(postId);

    console.log("Post detail response:", response);
    console.log("response.data:", response.data);

    // axios interceptor 將 response.data 展開到 response 層級
    const status = response.Status || response.data?.Status;
    const postArray = response.Post || response.data?.Post;

    console.log("Parsed status:", status);
    console.log("Parsed post array:", postArray);

    if (status === "OK" && postArray && Array.isArray(postArray) && postArray.length > 0) {
      const postData = postArray[0];
      console.log("Post data:", postData);

      // 確保必要欄位有預設值
      post.value = {
        ...postData,
        Is_Pinned: postData.Is_Pinned ?? false,
        Is_Solved: postData.Is_Solved ?? false,
        Is_Closed: postData.Is_Closed ?? false,
        Category: postData.Category || "",
      };
      replies.value = postData.Replies || [];
      console.log("Post loaded successfully:", post.value?.Title || "Untitled");
    } else {
      console.error("Invalid response - status:", status, "postArray:", postArray);
      error.value = t("discussion.detail.err_failed_find");
    }
  } catch (err: any) {
    console.error("Error loading post detail:", err);
    error.value = t("discussion.err_failed_load") + (err?.message || t("discussion.err_failed_load"));
  } finally {
    loading.value = false;
  }
};

// 按讚功能
const toggleLike = async () => {
  if (!post.value || likingPost.value) return;

  try {
    likingPost.value = true;

    const currentLikeStatus = userLikeStatus.value ?? false;
    const newAction = !currentLikeStatus;

    console.log("Toggling like:", { currentLikeStatus, newAction, postId });

    const response: any = await API.Discussion.likePost(postId, {
      ID: post.value.Post_Id,
      Action: newAction,
    });

    console.log("Like response:", response);

    const status = response.Status || response.data?.Status;
    const likeCount = response.Like_Count ?? response.data?.Like_Count;
    const likeStatus = response.Like_Status ?? response.data?.Like_Status;

    if (status === "OK") {
      // 立即更新 UI
      post.value.Like_Count = likeCount;
      userLikeStatus.value = likeStatus;
      console.log("Like updated:", { likeCount, likeStatus });
    } else {
      console.error("Like failed:", response);
    }
  } catch (err: any) {
    console.error("Error toggling like:", err);
    const errorMsg = err.response?.data?.Message || err.message;
    console.error("Like error details:", errorMsg);
  } finally {
    likingPost.value = false;
  }
};

// 提交回覆
const submitReply = async () => {
  if (!replyContent.value.trim() || submittingReply.value) return;

  try {
    submittingReply.value = true;

    const replyData: CreateReplyParams = {
      Content: replyContent.value.trim(),
      Contains_Code: /```|\bcode\b|function|class|import|export/.test(replyContent.value),
      ...(replyToId.value && { Reply_To: replyToId.value }),
    };

    console.log("Submitting reply:", replyData);
    const response: any = await API.Discussion.createReply(postId, replyData);
    console.log("Reply response:", response);

    const status = response.Status || response.data?.Status;

    if (status === "OK") {
      // 重新載入貼文以獲取最新的回覆
      await loadPostDetail();

      // 清空表單
      replyContent.value = "";
      showReplyForm.value = false;
      replyToId.value = undefined;

      console.log("Reply submitted successfully");
    } else {
      console.error("Reply failed:", response);
      const errorMsg = response.Message || response.data?.Message || t("discussion.err_failed_reply");
      alert(t("discussion.err_failed_reply") + errorMsg);
    }
  } catch (err: any) {
    console.error("Error submitting reply:", err);
    const errorMsg = err.response?.data?.Message || err.message || t("discussion.err_network");
    alert(t("discussion.detail.err_failed_reply") + errorMsg);
  } finally {
    submittingReply.value = false;
  }
};

// 回覆特定留言
const replyToComment = (replyId: number, authorName: string) => {
  replyToId.value = replyId;
  showReplyForm.value = true;
  // 不再使用 @ 功能
};

// 取消回覆
const cancelReply = () => {
  showReplyForm.value = false;
  replyContent.value = "";
  replyToId.value = undefined;
};

// 檢查是否為管理員或作者
const canManagePost = computed(() => {
  const isAdmin = session.role === 0;
  const isTeacher = session.role === 1;
  const isAuthor = session.username === post.value?.Author;
  return isAdmin || isTeacher || isAuthor;
});

// 建立巢狀回覆結構
const nestedReplies = computed(() => {
  const replyMap = new Map<number, DiscussionReply & { children: DiscussionReply[] }>();
  const rootReplies: (DiscussionReply & { children: DiscussionReply[] })[] = [];

  console.log("Building nested replies from:", replies.value);
  replies.value.forEach((r) => {
    console.log(`Reply ${r.Reply_ID}: Reply_To=${r.Reply_To}, Author=${r.Author}`);
  });

  // 初始化所有回覆，添加 children 陣列
  replies.value.forEach((reply) => {
    replyMap.set(reply.Reply_ID, { ...reply, children: [] });
  });

  // 檢測循環引用並標記為根回覆
  const visited = new Set<number>();
  const inPath = new Set<number>();
  const cycleNodes = new Set<number>();

  const detectCycle = (replyId: number): boolean => {
    if (inPath.has(replyId)) {
      // 找到循環，標記路徑中的所有節點
      cycleNodes.add(replyId);
      return true;
    }
    if (visited.has(replyId)) return false;

    visited.add(replyId);
    inPath.add(replyId);

    const reply = replies.value.find((r) => r.Reply_ID === replyId);
    if (reply?.Reply_To && replyMap.has(reply.Reply_To)) {
      if (detectCycle(reply.Reply_To)) {
        cycleNodes.add(replyId);
      }
    }

    inPath.delete(replyId);
    return false;
  };

  // 檢測所有可能的循環
  replies.value.forEach((reply) => {
    if (!visited.has(reply.Reply_ID)) {
      detectCycle(reply.Reply_ID);
    }
  });

  console.log("Cycle nodes detected:", Array.from(cycleNodes));

  // 第一遍：找出所有根回覆
  replies.value.forEach((reply) => {
    const replyWithChildren = replyMap.get(reply.Reply_ID);
    if (!replyWithChildren) return;

    // 如果沒有 Reply_To、Reply_To 不存在、或在循環中，視為根回覆
    if (!reply.Reply_To || !replyMap.has(reply.Reply_To) || cycleNodes.has(reply.Reply_ID)) {
      rootReplies.push(replyWithChildren);
      console.log(
        `Reply ${reply.Reply_ID} added as root reply (Reply_To: ${reply.Reply_To}, in cycle: ${cycleNodes.has(
          reply.Reply_ID,
        )})`,
      );
    }
  });

  // 第二遍：建立父子關係（跳過循環引用）
  replies.value.forEach((reply) => {
    const replyWithChildren = replyMap.get(reply.Reply_ID);
    if (!replyWithChildren) return;

    // 如果有有效的父回覆且不在循環中，添加到父回覆的 children 中
    if (reply.Reply_To && replyMap.has(reply.Reply_To) && !cycleNodes.has(reply.Reply_ID)) {
      const parent = replyMap.get(reply.Reply_To);
      if (parent) {
        parent.children.push(replyWithChildren);
        console.log(`Reply ${reply.Reply_ID} added as child of ${reply.Reply_To}`);
      }
    }
  });

  console.log("Root replies:", rootReplies.length, rootReplies);
  return rootReplies;
});

onMounted(() => {
  loadPostDetail();
});
</script>

<template>
  <div class="card-container">
    <div class="card mx-auto w-full max-w-5xl">
      <div class="card-body">
        <!-- Loading state -->
        <div v-if="loading" class="flex justify-center py-8">
          <div class="loading-spinner loading-lg loading"></div>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="alert alert-error">
          <span>{{ error }}</span>
          <button class="btn btn-ghost btn-sm" @click="loadPostDetail">
            {{ t("discussion.detail.err") }}
          </button>
        </div>

        <!-- Post content -->
        <div v-else-if="post">
          <!-- Post header -->
          <div class="mb-4">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="mb-2 flex items-center gap-2">
                  <span v-if="post.Is_Pinned" class="text-2xl">📌</span>
                  <h1 class="text-2xl font-bold">{{ post.Title }}</h1>
                  <span v-if="post.Is_Solved" class="badge badge-success"
                    >✓ {{ t("discussion.detail.solved") }}</span
                  >
                  <span v-if="post.Is_Closed" class="badge badge-error"
                    >🔒 {{ t("discussion.detail.closed") }}</span
                  >
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t("discussion.detail.by") }} {{ post.Author }} ·
                  {{ formatFriendlyTime(post.Created_Time) }}
                </div>
                <div v-if="post.Category" class="mt-1">
                  <span class="badge badge-outline">{{ post.Category }}</span>
                </div>
              </div>

              <!-- Admin controls -->
              <PostManagementDropdown
                v-if="post"
                :post="post"
                @refresh="loadPostDetail"
                @status-changed="
                  (newStatus) => {
                    /* Handle status change */
                  }
                "
                @deleted="() => router.push(`/course/${route.params.name}/discussion`)"
              />
            </div>
          </div>

          <!-- Post content -->
          <div class="bg-base-200 mb-4 rounded-lg p-4">
            <MarkdownRenderer :md="post.Content" />
          </div>

          <!-- Post actions -->
          <div class="mb-6 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <button
                class="btn btn-ghost btn-sm gap-2"
                :class="{ 'text-red-500': userLikeStatus }"
                @click="toggleLike"
                :disabled="likingPost || post.Is_Closed"
                :title="post.Is_Closed ? t('discussion.detail.closed_msg') : ''"
              >
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clip-rule="evenodd"
                  />
                </svg>
                {{ post.Like_Count }}
              </button>

              <button
                class="btn btn-ghost btn-sm gap-2"
                @click="showReplyForm = !showReplyForm"
                :disabled="post.Is_Closed"
                :title="post.Is_Closed ? t('discussion.detail.closed_msg') : ''"
              >
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                    clip-rule="evenodd"
                  />
                </svg>
                {{ post.Reply_Count }}
              </button>
            </div>
          </div>

          <!-- Closed discussion notice -->
          <div v-if="post.Is_Closed" class="alert alert-warning mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 shrink-0 stroke-current"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{{ t("discussion.detail.closed_msg") }}</span>
          </div>

          <!-- Reply form -->
          <div v-else-if="showReplyForm" class="bg-base-200 mb-6 rounded-lg p-4">
            <div class="mb-2">
              <label class="text-sm font-medium">
                {{
                  replyToId
                    ? t("discussion.detail.reply.replyto_comment")
                    : t("discussion.detail.reply.post_reply")
                }}
              </label>
            </div>
            <textarea
              v-model="replyContent"
              class="textarea textarea-bordered mb-3 w-full"
              rows="4"
              :placeholder="t('discussion.detail.reply.placeholder')"
            ></textarea>
            <div class="flex gap-2">
              <button
                class="btn btn-primary btn-sm"
                @click="submitReply"
                :disabled="!replyContent.trim() || submittingReply"
              >
                <span v-if="submittingReply" class="loading-spinner loading-xs loading"></span>
                {{ t("discussion.detail.reply.submit") }}
              </button>
              <button class="btn btn-ghost btn-sm" @click="cancelReply">
                {{ t("discussion.detail.reply.cancel") }}
              </button>
            </div>
          </div>

          <!-- Replies section -->
          <div class="mt-6">
            <h3 class="mb-4 text-lg font-semibold">
              {{ t("discussion.detail.comments") }} ({{ replies.length }})
            </h3>

            <div v-if="replies.length === 0" class="py-4 text-center text-gray-500">
              {{ t("discussion.detail.reply.no_comments") }}
            </div>

            <div v-else class="space-y-4">
              <ReplyItem
                v-for="reply in nestedReplies"
                :key="reply.Reply_ID"
                :reply="reply"
                :post-id="postId"
                @reply="replyToComment"
                @refresh="loadPostDetail"
              />
            </div>
          </div>
        </div>

        <!-- Not found state -->
        <div v-else class="py-8 text-center text-gray-500 dark:text-gray-400">
          {{ t("discussion.detail.notFound") }}
        </div>
      </div>
    </div>
  </div>
</template>
