import axios from "axios";
import { useGlobal } from "@/stores/global";

export const fetcher = axios.create({
  baseURL: (import.meta.env.VITE_APP_API_BASE_URL as string) || "/api",
  withCredentials: true,
});

fetcher.interceptors.response.use(
  (response) => {
    return {
      ...response,
      ...response.data,
    };
  },
  (error) => {
    const global = useGlobal();
    if (error?.response?.status >= 500) {
      global.onServerError();
    }
    throw error;
  },
);

const Auth = {
  getSession: () => fetcher.get<UserProperties>("/auth/me"),
  login: (body: { username: string; password: string }) => fetcher.post("/auth/session", body),
  logout: () => fetcher.get("/auth/session"),
  changePassword: (body: { oldPassword: string; newPassword: string }) =>
    fetcher.post("/auth/change-password", body),
  batchSignup: (body: { newUsers: string; force: boolean; course: string }) =>
    fetcher.post("/auth/batch-signup", body),
  checkEmail: (body: { email: string }) => fetcher.post<CheckEmail>("/auth/check/email", body),
  sendRecoveryEmail: (body: { email: string }) => fetcher.post("/auth/password-recovery", body),
};

const Problem = {
  create: (body: ProblemForm) => fetcher.post("/problem/manage", body),
  getTestCaseUrl: (problemId: number) => `${fetcher.defaults.baseURL}/problem/${problemId}/testcase`,
  modify: (id: string | number, body: ProblemForm) => fetcher.put(`/problem/manage/${id}`, body),
  modifyTestdata: (id: string | number, body: FormData) =>
    fetcher.put(`/problem/manage/${id}`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id: string | number) => fetcher.delete(`/problem/manage/${id}`),
  initiateTestCaseUpload: (
    problemId: number,
    body: {
      length: number;
      partSize: number;
    },
  ) =>
    fetcher.post<{ upload_id: string; urls: string[] }>(
      `/problem/${problemId}/initiate-test-case-upload`,
      body,
    ),
  completeTestCaseUpload: (
    problemId: number,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[],
  ) => fetcher.post(`/problem/${problemId}/complete-test-case-upload`, { uploadId, parts }),
};

const Submission = {
  create: (body: { problemId: number; languageType: number }) =>
    fetcher.post<{ submissionId: string }>("/submission", body),
  modify: (id: string, body: FormData) =>
    fetcher.put(`/submission/${id}`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  rejudge: (id: string) => fetcher.get(`/submission/${id}/rejudge`),
};

const Copycat = {
  detect: (body: { course: string; problemId: number; studentNicknames: { [k: string]: string } }) =>
    fetcher.post("/copycat", body),
};

const Announcement = {
  create: (body: AnnouncementCreationForm) => fetcher.post<{ annId: string }>("/ann", body),
  modify: (body: AnnouncementEditionForm) => fetcher.put("/ann", body),
  delete: (body: { annId: string }) => fetcher.delete("/ann", { data: body }),
};

const Homework = {
  create: (body: HomeworkCreationForm) => fetcher.post("/homework", body),
  modify: (id: string, body: HomeworkEditionForm) => fetcher.put(`/homework/${id}`, body),
  delete: (id: string) => fetcher.delete(`/homework/${id}`),
};

const Course = {
  create: (body: CourseForm) => fetcher.post("/course", body),
};

const User = {
  modify: (username: string, body: UserEditionForm) => fetcher.patch(`/user/${username}`, body),
};

const Discussion = {
  // 1. 取得貼文列表 (New/Hot 切換)
  getPosts: (params: {
    Mode?: string;
    Limit?: number;
    Page?: number;
    Problem_Id?: string;
  }) => fetcher.get("/discussion/posts", { params }),

  // 2. 依關鍵字搜尋貼文
  searchPosts: (params: {
    Words: string;
    Limit?: number;
    Page?: number;
  }) => fetcher.get("/discussion/search", { params }),

  // 3. 發佈文章
  createPost: (body: {
    Title: string;
    Content: string;
    Problem_id?: string;
    Category?: string;
    Language?: string;
    Contains_Code?: boolean;
  }) => fetcher.post("/discussion/post", body),

  // 4. 回覆文章
  createReply: (postId: string | number, body: {
    Reply_To?: number;
    Content: string;
    Contains_Code?: boolean;
  }) => fetcher.post(`/discussion/posts/${postId}/reply`, body),

  // 5. 按讚
  likePost: (postId: string | number, body: {
    ID: number;
    Action: boolean;
  }) => fetcher.post(`/discussion/posts/${postId}/like`, body),

  // 6. 取得貼文內部細項 (留言/按讚數)
  getPostDetail: (postId: string | number) => fetcher.get(`/discussion/posts/${postId}`),

  // 7. 管理文章狀態 (置頂/關帖/標已解決/刪除)
  managePostStatus: (postId: string | number, body: {
    Action: string;
  }) => fetcher.post(`/discussion/posts/${postId}/status`, body),

  // 8. 刪除功能 (留言/貼文)
  deletePost: (postId: string | number, body: {
    Type: string;
    Id: number;
  }) => fetcher.delete(`/discussion/posts/${postId}/delete`, { data: body }),

  // 9. 取得題目列表
  getProblems: (params: {
    Mode?: string;
    Limit?: number;
    Page?: number;
  }) => fetcher.get("/discussion/problems", { params }),

  // 11. 角色權限&&截止時間
  getProblemMeta: (problemId: string | number) => 
    fetcher.get(`/discussion/problems/${problemId}/meta`),
};

export default {
  Auth,
  Problem,
  Submission,
  Copycat,
  Announcement,
  Homework,
  Course,
  User,
  Discussion,
};
