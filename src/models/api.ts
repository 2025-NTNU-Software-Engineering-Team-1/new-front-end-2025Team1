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
};

const Submission = {
  create: (body: { problemId: number; languageType: number }) =>
    fetcher.post<{ submissionId: string }>("/submission", body),

  modify: (id: string, body: FormData) =>
    fetcher.put(`/submission/${id}`, body, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  rejudge: (id: string) => fetcher.get(`/submission/${id}/rejudge`),

  getArtifactUrl: (id: string, kind: "compiledBinary" | "zip", taskIndex?: number) => {
    const base = (fetcher.defaults.baseURL || "").toString().replace(/\/$/, "");
    const path =
      taskIndex != null
        ? `/submission/${id}/artifact/${kind}/${taskIndex}`
        : `/submission/${id}/artifact/${kind}`;
    return `${base}${path}`;
  },
};

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
};

const User = {
  modify: (username: string, body: UserEditionForm) => fetcher.patch(`/user/${username}`, body),
};

const CourseAPIUsage = {
  getCourseUsage: (courseName: string) =>
    fetcher.get<{
      totalToken: number;
      keys: {
        key_id: string | number;
        key_name: string;
        created_by: string;
        masked_value: string;
        total_token: number;
        max_problem?: { problem_id: number; problem_name: string; token: number };
        min_problem?: { problem_id: number; problem_name: string; token: number };
        problem_usages: {
          problem_id: number;
          problem_name: string;
          token: number;
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
  getKeySuggestion: (courseName: string, model: string) =>
    fetcher.get(`/course/${courseName}/ai/key/suggestion`, {
      params: { model },
    }),
};

const APIToken = {
  getAll: () => fetcher.get<{ Tokens: APIToken[] }>("/profile/api_token"),
  getScopes: () => fetcher.get<{ Scope: string[] }>("/profile/api_token/getscope"),
  create: (body: { Name: string; Due_Time: string; Scope: string[] }) =>
    fetcher.post<{ Type: string; Token: string; Message: string }>("/profile/api_token/create", body),
  edit: (id: string, body: { data: { Name: string; Due_Time: string; Scope: string[] } }) =>
    fetcher.patch<{ Type: string; Message: string }>(`/profile/api_token/edit/${id}`, body),
  deactivate: (id: string) =>
    fetcher.patch<{ Type: string; Message: string }>(`/profile/api_token/deactivate/${id}`),
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
  APIToken,
  AIVTuber,
  CourseAPIUsage,
};
