<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDiscussionManagement, useDiscussionPermissions } from '@/composables/useDiscussionManagement';
import { useSession } from "@/stores/session";
import type { DiscussionPostDetail } from "@/types/discussion";

const props = defineProps<{
  post: DiscussionPostDetail;
}>();

const emit = defineEmits<{
  refresh: [];
  statusChanged: [newStatus: string];
}>();

const session = useSession();
const { 
  loading, 
  error, 
  pinPost, 
  unpinPost, 
  closePost, 
  reopenPost, 
  markSolved, 
  markUnsolved, 
  deletePost 
} = useDiscussionManagement();

const { 
  canManagePost, 
  canDeleteAnyPost, 
  canPinPost, 
  canMarkSolved, 
  canClosePost 
} = useDiscussionPermissions();

// 確認對話框狀態
const showConfirmDialog = ref(false);
const confirmAction = ref<() => void>(() => {});
const confirmTitle = ref("");
const confirmMessage = ref("");

// 權限檢查
const userRole = computed(() => {
  if (session.role === 0) return "Admin";
  if (session.role === 1) return "Teacher";
  if (session.role === 2) return "Student";
  return "Guest";
});
const isAuthor = computed(() => session.username === props.post.Author);

const canManage = computed(() => canManagePost(userRole.value, isAuthor.value));
const canDelete = computed(() => canDeleteAnyPost(userRole.value) || isAuthor.value);
const canPin = computed(() => canPinPost(userRole.value));
const canMarkStatus = computed(() => canMarkSolved(userRole.value));
const canClose = computed(() => canClosePost(userRole.value));

// 執行操作
const executeAction = async (actionFn: () => Promise<any>, successMessage: string) => {
  const result = await actionFn();
  if (result.success) {
    emit('refresh');
    if ('newStatus' in result) {
      emit('statusChanged', result.newStatus);
    }
    // 顯示成功訊息（可以使用 toast 或其他方式）
    console.log(successMessage);
  }
  closeConfirmDialog();
};

// 顯示確認對話框
const showConfirm = (title: string, message: string, action: () => void) => {
  confirmTitle.value = title;
  confirmMessage.value = message;
  confirmAction.value = action;
  showConfirmDialog.value = true;
};

// 關閉確認對話框
const closeConfirmDialog = () => {
  showConfirmDialog.value = false;
  confirmAction.value = () => {};
};

// 各種操作方法
const handlePin = () => {
  if (props.post.Is_Pinned) {
    showConfirm(
      "取消置頂",
      "確定要取消置頂此貼文嗎？",
      () => executeAction(() => unpinPost(props.post.Post_Id), "已取消置頂")
    );
  } else {
    showConfirm(
      "置頂貼文",
      "確定要置頂此貼文嗎？",
      () => executeAction(() => pinPost(props.post.Post_Id), "已置頂")
    );
  }
};

const handleSolved = () => {
  if (props.post.Is_Solved) {
    showConfirm(
      "標記為未解決",
      "確定要將此貼文標記為未解決嗎？",
      () => executeAction(() => markUnsolved(props.post.Post_Id), "已標記為未解決")
    );
  } else {
    showConfirm(
      "標記為已解決",
      "確定要將此貼文標記為已解決嗎？",
      () => executeAction(() => markSolved(props.post.Post_Id), "已標記為已解決")
    );
  }
};

const handleClose = () => {
  showConfirm(
    "關閉貼文",
    "關閉後將無法繼續回覆此貼文，確定要關閉嗎？",
    () => executeAction(() => closePost(props.post.Post_Id), "貼文已關閉")
  );
};

const handleDelete = () => {
  showConfirm(
    "刪除貼文",
    "刪除後無法復原，確定要刪除此貼文嗎？",
    () => executeAction(() => deletePost(props.post.Post_Id), "貼文已刪除")
  );
};
</script>

<template>
  <div v-if="canManage" class="dropdown dropdown-end">
    <label tabindex="0" class="btn btn-ghost btn-sm" :disabled="loading">
      <svg v-if="!loading" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
      </svg>
      <div v-else class="loading loading-spinner loading-xs"></div>
    </label>
    
    <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 z-50">
      <!-- 置頂/取消置頂 -->
      <li v-if="canPin">
        <a @click="handlePin" class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path v-if="!post.Is_Pinned" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1.414.707L10 14.414l-4.586 2.293A1 1 0 014 16V4z"/>
            <path v-else d="M5 4a1 1 0 000 2h10a1 1 0 100-2H5zM4 8a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zm0 4a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z"/>
          </svg>
          {{ post.Is_Pinned ? '取消置頂' : '置頂' }}
        </a>
      </li>

      <!-- 標記解決狀態 -->
      <li v-if="canMarkStatus">
        <a @click="handleSolved" class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path v-if="!post.Is_Solved" fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            <path v-else fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
          {{ post.Is_Solved ? '標記為未解決' : '標記為已解決' }}
        </a>
      </li>

      <!-- 關閉貼文 -->
      <li v-if="canClose">
        <a @click="handleClose" class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
          </svg>
          關閉討論
        </a>
      </li>

      <div class="divider my-1"></div>

      <!-- 刪除貼文 -->
      <li v-if="canDelete">
        <a @click="handleDelete" class="flex items-center gap-2 text-error">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          刪除貼文
        </a>
      </li>
    </ul>

    <!-- 確認對話框 -->
    <div v-if="showConfirmDialog" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ confirmTitle }}</h3>
        <p class="py-4">{{ confirmMessage }}</p>
        <div v-if="error" class="alert alert-error mb-4">
          <span>{{ error }}</span>
        </div>
        <div class="modal-action">
          <button 
            class="btn btn-error" 
            @click="confirmAction"
            :disabled="loading"
          >
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            確認
          </button>
          <button class="btn btn-ghost" @click="closeConfirmDialog" :disabled="loading">
            取消
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeConfirmDialog"></div>
    </div>
  </div>
</template>