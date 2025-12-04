import axios from "axios";
import { useGlobal } from "@/stores/global";
import type { APIToken } from "@/types/api-token";

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

type TrialHistoryItem = {
  Trial_Submission_Id: string;
  Problem_Id: string;
  Status: string;
  Score: number;
  Language_Type: number;
  Timestamp: Date; 
};
type TrialHistoryInnerData = {
  Total_Count: number;
  History: TrialHistoryItem[];
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
      Trial_Cases: Array<{
        File_Name: string;
        Memory_Limit: number; // KB
        Time_Limit: number; // ms
        Input_Content: string;
        Output_Content: string;
      }>;
    }>(`/problem/${problemId}/public-testcases`),

  // API 2: 提交 Trial Submission 請求
  // POST /problem/<problem_id>/trial/request
  createTrialRequest: (body: {
    Problem_Id: number;
    Language_Type: number; // 0: Python, 1: C++, 2: C
    Use_Default_Test_Cases: boolean;
  }) =>
    fetcher.post<{
      status: string;
      message: string;
      Trial_Submission_Id?: string;
    }>(`/problem/${body.Problem_Id}/trial/request`, body),

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
      tasks: Array<{
        status: string; // (AC, WA, TLE)
        exec_Time: number;
        memory_Usage: number;
        score: number;
        stdout: string;
        stderr: string;
      }>;
    }>(`/trial-submission/${trialSubmissionId}`),

  // API 6: 下載各別測資的結果
  // GET /trial-submission/<Trial_Submission_Id>/download/case?task_index=<t_idx>
  downloadCaseResult: (trialSubmissionId: string, taskIndex: number) =>
    `/trial-submission/${trialSubmissionId}/download/case?task_index=${taskIndex}`,

  // API 7: 下載一整題該Test Submission的所有測資結果
  // GET /trial-submission/<Trial_Submission_Id>/download
  downloadAllResults: (trialSubmissionId: string) => `/trial-submission/${trialSubmissionId}/download`,
};

//test api

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
  TrialSubmission,
  Copycat,
  Announcement,
  Homework,
  Course,
  User,
  APIToken,
};
