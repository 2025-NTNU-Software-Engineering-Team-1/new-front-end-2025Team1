import { ref } from "vue";
import API from "@/models/api";
import type { ManagePostStatusParams, DeleteParams } from "@/types/discussion";

interface ApiResponse {
  Status?: string;
  Message?: string;
  New_Status?: boolean;
  data?: {
    Status?: string;
    Message?: string;
    New_Status?: boolean;
  };
}

export function useDiscussionManagement() {
  const loading = ref(false);
  const error = ref<string>("");

  // 管理貼文狀態（置� �/關帖/標已解決）
  const managePostStatus = async (postId: string | number, action: string) => {
    try {
      loading.value = true;
      error.value = "";

      const params: ManagePostStatusParams = { Action: action };
      console.log("Managing post status:", { postId, action });
      const response = (await API.Discussion.managePostStatus(postId, params)) as ApiResponse;
      console.log("Manage status response:", response);

      const status = response.Status || response.data?.Status;
      const newStatus = response.New_Status || response.data?.New_Status;

      if (status === "OK") {
        return {
          success: true,
          newStatus: newStatus,
        };
      } else {
        const errorMsg = response.Message || response.data?.Message || "操作失敗";
        error.value = errorMsg;
        return { success: false };
      }
    } catch (err: unknown) {
      console.error("Error managing post status:", err);
      const errorMsg =
        (err as { response?: { data?: { Message?: string } }; message?: string }).response?.data?.Message ||
        (err as { message?: string }).message ||
        "網路錯誤";
      error.value = errorMsg;
      return { success: false };
    } finally {
      loading.value = false;
    }
  };

  // 置� �貼文
  const pinPost = (postId: string | number) => managePostStatus(postId, "pin");

  // 取消置� �
  const unpinPost = (postId: string | number) => managePostStatus(postId, "unpin");

  // 關閉貼文
  const closePost = (postId: string | number) => managePostStatus(postId, "close");

  // 重新開放貼文
  const reopenPost = (postId: string | number) => managePostStatus(postId, "reopen");

  // 標記為已解決
  const markSolved = (postId: string | number) => managePostStatus(postId, "solve");

  // 標記為未解決
  const markUnsolved = (postId: string | number) => managePostStatus(postId, "unsolve");

  // 刪除貼文或回覆
  const deleteItem = async (postId: string | number, type: "post" | "reply", itemId: number) => {
    try {
      loading.value = true;
      error.value = "";

      const params: DeleteParams = {
        Type: type,
        Id: itemId,
      };

      console.log("Deleting item:", { postId, type, itemId, params });
      const response = (await API.Discussion.deletePost(postId, params)) as ApiResponse;
      console.log("Delete response:", response);

      const status = response.Status || response.data?.Status;
      const message = response.Message || response.data?.Message;

      if (status === "OK") {
        return {
          success: true,
          message: message || "刪除成功",
        };
      } else {
        const errorMsg = message || "刪除失敗";
        error.value = errorMsg;
        return { success: false };
      }
    } catch (err: unknown) {
      console.error("Error deleting item:", err);
      const errorMsg =
        (err as { response?: { data?: { Message?: string } }; message?: string }).response?.data?.Message ||
        (err as { message?: string }).message ||
        "網路錯誤";
      error.value = errorMsg;
      return { success: false };
    } finally {
      loading.value = false;
    }
  };

  // 刪除貼文
  const deletePost = (postId: string | number) => deleteItem(postId, "post", parseInt(postId.toString()));

  // 刪除回覆
  const deleteReply = (postId: string | number, replyId: number) => deleteItem(postId, "reply", replyId);

  return {
    loading,
    error,
    // 狀態管理
    pinPost,
    unpinPost,
    closePost,
    reopenPost,
    markSolved,
    markUnsolved,
    // 刪除功能
    deletePost,
    deleteReply,
  };
}

// 權限檢查組合式函數
export function useDiscussionPermissions() {
  const isAdmin = (userRole: string) => userRole === "Admin";
  const isTeacher = (userRole: string) => userRole === "Teacher";
  const isStudent = (userRole: string) => userRole === "Student";

  const canManagePost = (userRole: string, isAuthor: boolean = false) => {
    return isAdmin(userRole) || isTeacher(userRole) || isAuthor;
  };

  const canDeleteAnyPost = (userRole: string) => {
    return isAdmin(userRole) || isTeacher(userRole);
  };

  const canPinPost = (userRole: string) => {
    return isAdmin(userRole) || isTeacher(userRole);
  };

  const canMarkSolved = (userRole: string) => {
    return isAdmin(userRole) || isTeacher(userRole);
  };

  const canClosePost = (userRole: string) => {
    return isAdmin(userRole) || isTeacher(userRole);
  };

  return {
    isAdmin,
    isTeacher,
    isStudent,
    canManagePost,
    canDeleteAnyPost,
    canPinPost,
    canMarkSolved,
    canClosePost,
  };
}
