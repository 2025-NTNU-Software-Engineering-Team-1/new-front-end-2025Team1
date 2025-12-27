import axios from "axios";
import { useGlobal } from "@/stores/global";
import type { APIToken } from "@/types/api-token";

export const fetcher = axios.create({
  baseURL: (import.meta.env.VITE_APP_API_BASE_URL as string) || "/api",
  withCredentials: true,
});

fetcher.interceptors.response.use(
  (response) => ({
    ...response,
    ...response.data,
  }),
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
  // basic CRUD
  create: (body: ProblemForm) => fetcher.post("/problem/manage", body),
  modify: (id: string | number, body: ProblemForm) => fetcher.put(`/problem/manage/${id}`, body),
  delete: (id: string | number) => fetcher.delete(`/problem/manage/${id}`),

  // testcase uploads
  modifyTestdata: (id: string | number, body: FormData) =>
    fetcher.put(`/problem/manage/${id}`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getTestCaseUrl: (problemId: number) => `${fetcher.defaults.baseURL}/problem/${problemId}/testcase`,
  initiateTestCaseUpload: (problemId: number, body: { length: number; partSize: number }) =>
    fetcher.post<{ upload_id: string; urls: string[] }>(
      `/problem/${problemId}/initiate-test-case-upload`,
      body,
    ),
  completeTestCaseUpload: (
    problemId: number,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[],
  ) => fetcher.post(`/problem/${problemId}/complete-test-case-upload`, { uploadId, parts }),

  // save configuration + pipeline meta only (no files)
  saveMeta: (problemId: number, body: { config?: ProblemConfigExtra; pipeline?: ProblemPipeline }) =>
    fetcher.put(`/problem/${problemId}/meta`, body),

  // unified asset upload (v2)
  uploadAssetsV2: (problemId: number, formData: FormData) =>
    fetcher.put(`/problem/${problemId}/assets`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // static analysis options
  getStaticAnalysisOptions: () =>
    fetcher.get<{ librarySymbols: { imports: string[]; headers: string[]; functions: string[] } }>(
      `/problem/static-analysis/options`,
    ),

  // syntax options for static analysis (Python 130+ / C++ 66+ types)
  getSyntaxOptions: () =>
    fetcher.get<{
      python: { common: string[]; all: string[]; categories: Record<string, string[]> };
      cpp: { common: string[]; all: string[]; categories: Record<string, string[]> };
    }>(`/problem/syntax-options`),

  // get a problem detail
  get: (id: string | number) => fetcher.get<Problem>(`/problem/view/${id}`),
};

const Submission = {
  create: (body: { problemId: number; languageType: number }) =>
    fetcher.post<{ submissionId: string }>("/submission", body),

  modify: (id: string, body: FormData) =>
    fetcher.put(`/submission/${id}`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  rejudge: (id: string) => fetcher.get(`/submission/${id}/rejudge`),

  rejudgeAll: (problemId: number) =>
    fetcher.post<{
      ok: boolean;
      success: number;
      failed: number;
      skipped: number;
    }>("/submission/rejudge-all", { problem_id: problemId }),

  delete: (id: string) => fetcher.delete<{ ok: boolean }>(`/submission/${id}`),

  deleteAll: (filters: {
    problemId?: number;
    username?: string;
    status?: string;
    languageType?: string;
    course: string;
  }) => fetcher.delete<{
    ok: boolean;
    deleted: number;
    skipped: number;
  }>('/submission/delete-all', { data: { filters } }),

  getArtifactUrl: (id: string, kind: "compiledBinary" | "zip", taskIndex?: number) => {
    const base = (fetcher.defaults.baseURL || "").toString().replace(/\/$/, "");
    const path =
      taskIndex != null
        ? `/submission/${id}/artifact/${kind}/${taskIndex}`
        : `/submission/${id}/artifact/${kind}`;
    return `${base}${path}`;
  },

  // Manual grade APIs for frontend score editing
  manualGrade: (id: string, score: number, reason?: string) =>
    fetcher.put<{
      ok: boolean;
      beforeScore: number;
      afterScore: number;
    }>(`/submission/${id}/manual-grade`, { score, reason }),

  manualGradeTask: (id: string, taskIndex: number, score: number, reason?: string) =>
    fetcher.put<{
      ok: boolean;
      taskIndex: number;
      beforeScore: number;
      afterScore: number;
      newTotalScore: number;
    }>(`/submission/${id}/manual-grade/task/${taskIndex}`, { score, reason }),

  getScoreHistory: (id: string) =>
    fetcher.get<{
      ok: boolean;
      history: Array<{
        modifier: string;
        timestamp: number;
        beforeScore: number;
        afterScore: number;
        taskIndex: number | null;
        reason: string | null;
      }>;
      count: number;
    }>(`/submission/${id}/score-history`),

  // Get case output (stdout/stderr)
  getCaseOutput: (id: string, taskNo: number, caseNo: number) =>
    fetcher.get<{
      stdout: string;
      stderr: string;
    }>(`/submission/${id}/output/${taskNo}/${caseNo}`),

  // Get case artifact files (all files in artifact zip including stdout, stderr, images, etc.)
  getCaseArtifactFiles: (id: string, taskNo: number, caseNo: number) =>
    fetcher.get<{
      stdout: string | null; // null means file doesn't exist, '' means empty file
      stderr: string | null;
      files: Record<
        string,
        {
          type: "text" | "image" | "binary";
          content: string;
          extension: string;
          mimeType?: string;
        }
      >;
    }>(`/submission/${id}/artifact/case/${taskNo}/${caseNo}`),
};

type TrialHistoryItem = {
  trial_Submission_td: string;
  problem_Id: string;
  status: string;
  score: number;
  language_Type: number;
  timestamp: Date;
};
type TrialHistoryInnerData = {
  total_count: number;
  history: TrialHistoryItem[];
};
type TrialHistoryMergedResponse = {
  status: string;
  message: string;
  data: TrialHistoryInnerData;
};
// Trial Submission APIs
const TrialSubmission = {
  // API 1: 取得Public-TrialCase 的 .in 以及 .out 內容
  // GET /problem/<problem_id>/public-testcases
  getPublicTestCases: (problemId: number) =>
    fetcher.get<{
      status: string;
      trial_cases: Array<{
        fFile_name: string;
        nemory_limit: number; // KB
        time_limit: number; // ms
        input_content: string;
        output_content: string;
      }>;
    }>(`/problem/${problemId}/public-testcases`),

  // API 2: 提交 Trial Submission 請求
  // POST /problem/<problem_id>/trial/request
  createTrialRequest: (body: {
    problem_id: number;
    language_type: number; // 0: Python, 1: C++, 2: C
    use_default_test_cases: boolean;
  }) =>
    fetcher.post<{
      status: string;
      message: string;
      trial_submission_id?: string;
    }>(`/problem/${body.problem_id}/trial/request`, body),

  // API 3: 送出 Trial Submission 的程式以及測試測資
  // PUT /trial-submission/<Trial_Submission_Id>/files
  uploadTrialFiles: (trialSubmissionId: string, body: FormData) =>
    fetcher.put<{
      status: string;
      message: string;
    }>(`/trial-submission/${trialSubmissionId}/files`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // API 4: 取得所有Trial Submission紀錄
  // GET /problem/<problem_id>/trial/history

  getTrialHistory: (problemId: number) =>
    fetcher.get<TrialHistoryMergedResponse>(`/problem/${problemId}/trial/history`),

  // API 5: 取得某筆Trial Submission紀錄資料
  // GET /trial-submission/<Trial_Submission_Id>
  getTrialSubmission: (trialSubmissionId: string) =>
    fetcher.get<{
      trial_submission_id: string;
      timestamp: Date;
      status: string;
      score: number;
      language_type?: number;
      code?: string;
      tasks: Array<{
        status: string; // (AC, WA, TLE)
        exec_time: number;
        memory_usage: number;
        score: number;
        stdout: string;
        stderr: string;
      }>;
      sa_status?: number;
      sa_message?: string;
    }>(`/trial-submission/${trialSubmissionId}`),

  // API 6a: 下載某個 Task 的所有 case 結果（artifact zip）
  // GET /trial-submission/<Trial_Submission_Id>/download/task/<task_index>
  downloadTaskResult: (trialSubmissionId: string, taskIndex: number) =>
    `/trial-submission/${trialSubmissionId}/download/task/${taskIndex}`,

  // API 6b: 下載某個 Case 的結果（artifact zip）
  // GET /trial-submission/<Trial_Submission_Id>/download/case?task_index=<t_idx>&case_index=<c_idx>
  downloadCaseResult: (trialSubmissionId: string, taskIndex: number, caseIndex: number) =>
    `/trial-submission/${trialSubmissionId}/download/case?task_index=${taskIndex}&case_index=${caseIndex}`,

  // API 7: 下載一整題該Test Submission的所有測資結果
  // GET /trial-submission/<Trial_Submission_Id>/download
  downloadAllResults: (trialSubmissionId: string) => `/trial-submission/${trialSubmissionId}/download`,

  // API 8: Rejudge 單一 Trial Submission
  // GET /trial-submission/<trial_id>/rejudge
  rejudge: (trialSubmissionId: string) =>
    fetcher.get<{ status: string; message: string; data: { ok: boolean } }>(
      `/trial-submission/${trialSubmissionId}/rejudge`,
    ),

  // API 9: Rejudge All Trial Submissions for a problem
  // POST /trial-submission/rejudge-all/<problem_id>
  rejudgeAll: (problemId: number) =>
    fetcher.post<{
      status: string;
      message: string;
      data: { success: number; failed: number; skipped: number };
    }>(`/trial-submission/rejudge-all/${problemId}`),

  // API 10: Check if user can rejudge trial submissions for a problem
  // GET /trial-submission/check-rejudge-permission/<problem_id>
  checkRejudgePermission: (problemId: number) =>
    fetcher.get<{ status: string; data: { can_rejudge: boolean } }>(
      `/trial-submission/check-rejudge-permission/${problemId}`,
    ),

  // API 11: Delete a trial submission
  // DELETE /trial-submission/<trial_id>
  delete: (trialSubmissionId: string) =>
    fetcher.delete<{ status: string; message: string; data: { ok: boolean } }>(
      `/trial-submission/${trialSubmissionId}`
    ),

  deleteAll: (problemId: number) =>
    fetcher.delete<{
      status: string;
      data: { deleted: number; skipped: number };
    }>(`/trial-submission/delete-all/${problemId}`),

  // API 12: Get specialized case artifact files (stdout, stderr, etc.)
  getTrialCaseArtifactFiles: (trialSubmissionId: string, taskNo: number, caseNo: number) =>
    fetcher.get<{
      stdout: string | null;
      stderr: string | null;
      files: Record<
        string,
        {
          type: "text" | "image" | "binary";
          content: string;
          extension: string;
          mimeType?: string;
        }
      >;
    }>(`/trial-submission/${trialSubmissionId}/artifact/case/${taskNo}/${caseNo}`),
};

//test api

const Copycat = {
  detect: (body: { course: string; problemId: number; studentNicknames: Record<string, string> }) =>
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
  modify: (body: { course: string; new_course: string; teacher: string; color: string; emoji: string }) =>
    fetcher.put("/course", body),
  join: (body: { course_code: string }) =>
    fetcher.post<{ message: string; data: { course: string } }>("/course/join", body),
  // Course code management (for teachers)
  getCode: (courseName: string) =>
    fetcher.get<{ data: { course_code: string | null } }>(`/course/${courseName}/code`),
  generateCode: (courseName: string) =>
    fetcher.post<{ data: { course_code: string } }>(`/course/${courseName}/code`),
  removeCode: (courseName: string) => fetcher.delete<{ message: string }>(`/course/${courseName}/code`),
  // Member role management (for teachers only, not TAs)
  changeMemberRole: (courseName: string, username: string, role: "student" | "ta") =>
    fetcher.put<{ message: string; data: { username: string; new_role: string } }>(
      `/course/${courseName}/member/${username}/role`,
      { role },
    ),
  // Remove member from course (for teachers only, not TAs)
  removeMember: (courseName: string, username: string) =>
    fetcher.delete<{ message: string; data: { username: string } }>(
      `/course/${courseName}/member/${username}`,
    ),
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
    Course_Id?: string | string[];
  }) => fetcher.get("/discussion/posts", { params }),

  // 2. 依關鍵字搜尋貼文
  searchPosts: (params: { Words: string; Limit?: number; Page?: number; Course_Id?: string | string[] }) =>
    fetcher.get("/discussion/search", { params }),

  // 3. 發佈文�
  createPost: (body: {
    Title: string;
    Content: string;
    Problem_id?: string;
    Category?: string;
    Language?: string;
    Contains_Code?: boolean;
  }) => fetcher.post("/discussion/post", body),

  // 4. 回覆文�
  createReply: (
    postId: string | number,
    body: {
      Reply_To?: number;
      Content: string;
      Contains_Code?: boolean;
    },
  ) => fetcher.post(`/discussion/posts/${postId}/reply`, body),

  // 5. 按讚
  likePost: (
    postId: string | number,
    body: {
      ID: number;
      Action: boolean;
    },
  ) => fetcher.post(`/discussion/posts/${postId}/like`, body),

  // 6. 取得貼文內部細� � (留言/按讚數)
  getPostDetail: (postId: string | number) => fetcher.get(`/discussion/posts/${postId}`),

  // 7. 管理文� 狀態 (置� �/關帖/標已解決/刪除)
  managePostStatus: (
    postId: string | number,
    body: {
      Action: string;
    },
  ) => fetcher.post(`/discussion/posts/${postId}/status`, body),

  // 8. 刪除功能 (留言/貼文)
  deletePost: (
    postId: string | number,
    body: {
      Type: string;
      Id: number;
    },
  ) => fetcher.delete(`/discussion/posts/${postId}/delete`, { data: body }),

  // 9. 取得題目列表
  getProblems: (params: { Mode?: string; Limit?: number; Page?: number; Course_Id?: string | string[] }) =>
    fetcher.get("/discussion/problems", { params }),

  // 11. 角色權限&&截止時間
  getProblemMeta: (problemId: string | number) => fetcher.get(`/discussion/problems/${problemId}/meta`),
};

const CourseAPIUsage = {
  getCourseUsage: (courseName: string) =>
    fetcher.get<{
      keys: {
        id: string | number;
        key_name: string;
        created_by: string;
        masked_value: string;
        problem_usages: {
          problem_id: number;
          problem_name: string;
          total_token: number;
        }[];
      }[];
    }>(`/course/${courseName}/aisetting/usage`),
};

const AIVTuber = {
  getCourseKeys: (courseName: string) =>
    fetcher.get<{
      keys: {
        id: string;
        key_name: string;
        masked_value: string;
        is_active: boolean;
        input_token: number;
        output_token: number;
        request_count: number;
        created_by: string;
      }[];
    }>(`/course/${courseName}/ai/key`),

  addKey: (
    courseName: string,
    body: { key_name: string; value: string; is_active?: boolean; created_by?: string },
  ) =>
    fetcher.post<{ status: string; message: string; masked_id: string }>(
      `/course/${courseName}/ai/key`,
      body,
    ),

  updateKey: (courseName: string, keyId: string, body: { key_name?: string; is_active?: boolean }) =>
    fetcher.patch<{ status: string; message: string }>(`/course/${courseName}/ai/key/${keyId}`, body),

  deleteKey: (courseName: string, keyId: string) =>
    fetcher.delete<{ status: string; message: string }>(`/course/${courseName}/ai/key/${keyId}`),

  getKeySuggestion: (courseName: string, model: string) =>
    fetcher.get(`/course/${courseName}/ai/key/suggestion`, {
      params: { model },
    }),
};

const APITokenAPI = {
  getAll: () => fetcher.get<{ Tokens: APIToken[] }>("/profile/api_token"),
  getScopes: () => fetcher.get<{ Scope: string[] }>("/profile/api_token/getscope"),
  create: (body: { Name: string; Due_Time: string; Scope: string[] }) =>
    fetcher.post<{ Type: string; Token: string; Message: string }>("/profile/api_token/create", body),
  edit: (id: string, body: { data: { Name: string; Due_Time: string; Scope: string[] } }) =>
    fetcher.patch<{ Type: string; Message: string }>(`/profile/api_token/edit/${id}`, body),
  deactivate: (id: string) =>
    fetcher.patch<{ Type: string; Message: string }>(`/profile/api_token/deactivate/${id}`),
};

const Chatbot = {
  // 使用者發問：POST /ai/chatbot/ask
  ask: (body: { message: string; current_code: string; course_name: string; problem_id: string }) =>
    fetcher.post<{
      data: { text: string; emotion?: string }[];
    }>("/ai/chatbot/ask", body),

  // 取得歷史紀錄：GET /ai/chatbot/history?course_name=...&username=...
  getHistory: (params: { course_name: string; username: string }) =>
    fetcher.get<{
      data: { role: string; text: string }[];
    }>("/ai/chatbot/history", { params }),

  // 清除對話紀錄：DELETE /ai/chatbot/history?course_name=...
  resetHistory: (params: { course_name: string }) =>
    fetcher.delete<{ message: string }>("/ai/chatbot/history", { params }),
};

// VtuberSkin types
export type VtuberSkinInfo = {
  skin_id: string;
  name: string;
  thumbnail_path: string | null;
  is_builtin: boolean;
  is_public: boolean;
  uploaded_by: string | null;
  file_size: number;
};

export type EmotionMappings = {
  smile?: string | null;
  unhappy?: string | null;
  tired?: string | null;
  surprised?: string | null;
};

export type VtuberSkinDetail = VtuberSkinInfo & {
  model_path: string;
  model_json_name: string;
  emotion_mappings: EmotionMappings;
};

const VtuberSkin = {
  // Get all available skins
  list: () => fetcher.get<{ data: VtuberSkinInfo[] }>("/ai/skins"),

  // Upload a new skin
  upload: (formData: FormData) =>
    fetcher.post<{ message: string; data: { skin_id: string; name: string } }>("/ai/skins", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Get skin details
  get: (skinId: string) => fetcher.get<{ data: VtuberSkinDetail }>(`/ai/skins/${skinId}`),

  // Delete a skin
  delete: (skinId: string) => fetcher.delete<{ message: string }>(`/ai/skins/${skinId}`),

  // Get user preference
  getPreference: () => fetcher.get<{ data: { selected_skin_id: string } }>("/ai/user-preference"),

  // Set user preference
  setPreference: (skinId: string) =>
    fetcher.put<{ message: string }>("/ai/user-preference", { skin_id: skinId }),

  // Get storage stats (admin only)
  getStorageStats: () =>
    fetcher.get<{
      data: {
        total_size: number;
        total_count: number;
        per_user: { username: string; size: number; count: number }[];
      };
    }>("/ai/storage-stats"),

  // Update emotion mappings
  updateEmotions: (skinId: string, mappings: EmotionMappings) =>
    fetcher.put<{ message: string }>(`/ai/skins/${skinId}/emotions`, { mappings }),

  // Update skin (name, thumbnail, emotion_mappings)
  update: (skinId: string, formData: FormData) =>
    fetcher.put<{ message: string }>(`/ai/skins/${skinId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Toggle public/private visibility (teachers/admins only)
  updateVisibility: (skinId: string, isPublic: boolean) =>
    fetcher.patch<{ message: string }>(`/ai/skins/${skinId}/visibility`, { is_public: isPublic }),
};

export default {
  Auth,
  Problem,
  Submission,
  TrialSubmission,
  Copycat,
  Announcement,
  Homework,
  Course,
  User,
  Discussion,
  APIToken: APITokenAPI,
  Chatbot,
  AIVTuber,
  CourseAPIUsage,
  VtuberSkin,
};
