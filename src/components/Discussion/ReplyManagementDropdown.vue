<script setup lang="ts">
import { ref, computed } from "vue";
import { useDiscussionManagement, useDiscussionPermissions } from "@/composables/useDiscussionManagement";
import { useSession } from "@/stores/session";
import type { DiscussionReply } from "@/types/discussion";

const props = defineProps<{
  reply: DiscussionReply;
  postId: string | number;
}>();

const emit = defineEmits<{
  refresh: [];
  deleted: [replyId: number];
}>();

const session = useSession();
const { loading, error, deleteReply } = useDiscussionManagement();
const { canManagePost, canDeleteAnyPost } = useDiscussionPermissions();

// 確認對話框狀態
const showConfirmDialog = ref(false);

// 權限檢查
const userRole = computed(() => {
  console.log("Reply - Session role:", session.role);
  if (session.role === 0) return "Admin";
  if (session.role === 1) return "Teacher";
  if (session.role === 2) return "Student";
  return "Guest";
});
const isAuthor = computed(() => {
  console.log("Reply - Session username:", session.username, "Reply author:", props.reply.Author);
  return session.username === props.reply.Author;
});

const canDelete = computed(() => {
  const result = canDeleteAnyPost(userRole.value) || isAuthor.value;
  console.log("Reply - Can delete:", result);
  return result;
});

const canManage = computed(() => {
  const result = canManagePost(userRole.value, isAuthor.value);
  console.log("Reply - Can manage:", result, "Role:", userRole.value, "Is author:", isAuthor.value);
  return result;
});

// 刪除回覆
const handleDelete = () => {
  showConfirmDialog.value = true;
};

const confirmDelete = async () => {
  const result = await deleteReply(props.postId, props.reply.Reply_ID);
  if (result.success) {
    emit("deleted", props.reply.Reply_ID);
    emit("refresh");
  }
  showConfirmDialog.value = false;
};

const closeConfirmDialog = () => {
  showConfirmDialog.value = false;
};
</script>

<template>
  <div v-if="canManage" class="dropdown dropdown-end">
    <label tabindex="0" class="btn btn-ghost btn-xs" :class="{ 'btn-disabled': loading }">
      <svg v-if="!loading" class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
        />
      </svg>
      <div v-else class="loading-spinner loading-xs loading"></div>
    </label>

    <ul tabindex="0" class="dropdown-content menu rounded-box bg-base-100 z-50 w-32 p-2 shadow">
      <!-- 編輯回覆 -->
      <li v-if="isAuthor">
        <a class="text-xs">
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
            />
          </svg>
          {{ $t("discussion.components.reply.edit") }}
        </a>
      </li>

      <!-- 刪除回覆 -->
      <li v-if="canDelete">
        <a @click="handleDelete" class="text-error text-xs">
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd" />
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
          {{ $t("discussion.components.reply.delete") }}
        </a>
      </li>
    </ul>

    <!-- 確認刪除對話框 -->
    <div v-if="showConfirmDialog" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ $t("discussion.components.reply.delete_reply") }}</h3>
        <p class="py-4">{{ $t("discussion.components.reply.delete_reply_info") }}</p>
        <div v-if="error" class="alert alert-error mb-4">
          <span>{{ error }}</span>
        </div>
        <div class="modal-action">
          <button class="btn btn-error" @click="confirmDelete" :disabled="loading">
            <span v-if="loading" class="loading-spinner loading-sm loading"></span>
            {{ $t("discussion.components.reply.delete_confirm") }}
          </button>
          <button class="btn btn-ghost" @click="closeConfirmDialog" :disabled="loading">
            {{ $t("discussion.components.cancel") }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeConfirmDialog"></div>
    </div>
  </div>
</template>
