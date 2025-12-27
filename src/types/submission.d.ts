declare enum SubmissionStatusCodes {
  WAITING = -2,
  PENDING = -1,
  ACCEPTED = 0,
  WRONG_ANSWER = 1,
  COMPILE_ERROR = 2,
  TIME_LIMIT_EXCEED = 3,
  MEMORY_LIMIT_EXCEED = 4,
  RUNTIME_ERROR = 5,
  JUDGE_ERROR = 6,
  OUTPUT_LIMIT_EXCEED = 7,
  ANALYSIS_ERROR = 8,
}

interface Case {
  execTime: number;
  memoryUsage: number;
  status: SubmissionStatusCodes;
}

interface Task {
  cases: Case[];
  execTime: number;
  memoryUsage: number;
  score: number;
  status: SubmissionStatusCodes;
}

interface SubmissionListItem {
  languageType: number;
  lastSend: number;
  memoryUsage: number;
  problemId: number;
  runTime: number;
  score: number;
  status: SubmissionStatusCodes;
  submissionId: string;
  timestamp: number;
  user: UserInfo;
  ipAddr: string;
}

type SubmissionList = SubmissionListItem[];

interface Submission extends SubmissionListItem {
  code: string;
  tasks: Task[];
  saStatus?: number | null;
  saMessage?: string;
  saReport?: string;
  saReportPath?: string;
}

interface GetSubmissionListResponse {
  submissions: SubmissionList;
  submissionCount: number;
}

interface SubmissionListQuery {
  offset: number;
  count: number;
  course?: string;
  problemId?: string;
  status?: string;
  languageType?: string;
  username?: string;
}

interface SubmissionListFilter {
  problemId?: string;
  status?: string;
  languageType?: string;
  username?: string;
}
