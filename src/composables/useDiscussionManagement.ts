import { ref } from 'vue';
import API from "@/models/api";
import type { 
  ManagePostStatusResponse,
  DeleteResponse,
  ManagePostStatusParams,
  DeleteParams
} from "@/types/discussion";

export function useDiscussionManagement() {
  const loading = ref(false);
  const error = ref<string>("");

  // 管理貼文狀態（置頂/關帖/標已解決）
  const managePostStatus = async (postId: string | number, action: string) => {
    try {
      loading.value = true;
      error.value = "";
      
      const params: ManagePostStatusParams = { Action: action };
      const response = await API.Discussion.managePostStatus(postId, params) as unknown as ManagePostStatusResponse;
      
      if (response.Status === "OK") {
        return {
          success: true,
          newStatus: response.New_Status,
        };
      } else {
        error.value = "操作失敗";
        return { success: false };
      }
    } catch (err) {
      console.error("Error managing post status:", err);
      error.value = "網路錯誤";
      return { success: false };
    } finally {
      loading.value = false;
    }
  };

  // 置頂貼文
  const pinPost = (postId: string | number) => managePostStatus(postId, "pin");

  // 取消置頂
  const unpinPost = (postId: string | number) => managePostStatus(postId, "unpin");

  // 關閉貼文
  const closePost = (postId: string | number) => managePostStatus(postId, "close");

  // 重新開放貼文
  const reopenPost = (postId: string | number) => managePostStatus(postId, "reopen");

  // 標記為已解決
  const markSolved = (postId: string | number) => managePostStatus(postId, "solved");

  // 標記為未解決
  const markUnsolved = (postId: string | number) => managePostStatus(postId, "unsolved");

  // 刪除貼文或回覆
  const deleteItem = async (postId: string | number, type: "post" | "reply", itemId: number) => {
    try {
      loading.value = true;
      error.value = "";
      
      const params: DeleteParams = { 
        Type: type,
        Id: itemId 
      };
      
      const response = await API.Discussion.deletePost(postId, params) as unknown as DeleteResponse;
      
      if (response.Status === "OK") {
        return {
          success: true,
          message: response.Message,
        };
      } else {
        error.value = "刪除失敗";
        return { success: false };
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      error.value = "網路錯誤";
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