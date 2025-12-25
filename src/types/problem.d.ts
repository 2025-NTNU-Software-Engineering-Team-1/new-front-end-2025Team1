declare enum ProblemType {
  OJ = 0,
  FillIn = 1,
  HandWritten = 2,
}

declare enum ProblemStatus {
  Hidden = 1,
  Visible = 0,
}

interface ProblemTestCase {
  taskScore: number;
  caseCount: number;
  memoryLimit: number;
  timeLimit: number;
}

/* ------------------------------
 * 基本 ProblemForm 定義
 * ------------------------------ */
interface ProblemForm {
  problemName: string;
  description: {
    description: string;
    input: string;
    output: string;
    hint: string;
    sampleInput: string[];
    sampleOutput: string[];
  };
  courses: string[];
  tags: string[];
  allowedLanguage: number;
  quota: number;
  type: ProblemType;
  status: ProblemStatus;
  testCaseInfo: {
    language: number;
    fillInTemplate: string;
    tasks: ProblemTestCase[];
  };
  canViewStdout: boolean;
  defaultCode: string;

  config: ProblemConfigExtra;
  pipeline: ProblemPipeline;
  assets: ProblemAssets;
}

/* ------------------------------
 * API 回傳 Problem
 * ------------------------------ */
interface Problem {
  problemName: string;
  description: {
    description: string;
    input: string;
    output: string;
    hint: string;
    sampleInput: string[];
    sampleOutput: string[];
  };
  courses: string[];
  tags: string[];
  allowedLanguage: number;
  quota: number;
  type: ProblemType;
  status: ProblemStatus;
  testCase?: ProblemTestCase[];
  testCaseInfo?: {
    language?: number;
    fillInTemplate?: string;
    tasks?: ProblemTestCase[];
  };
  canViewStdout: boolean;
  owner: string;
  defaultCode: string;
  submitCount: number;
  highScore: number;
  ACUser: number;
  submitter: number;

  config?: ProblemConfigExtra;
  pipeline?: ProblemPipeline;
  assets?: ProblemAssets;
}

/* ------------------------------
 * 題目列表 & 統計
 * ------------------------------ */
interface ProblemListItem {
  problemId: number;
  problemName: string;
  status: ProblemStatus;
  ACUser: number;
  submitter: number;
  tags: string[];
  type: ProblemType;
  quota: number;
  submitCount: number;
  // AI-TA (aiVTuber) flag, optional for backward compatibility
  aiVTuber?: boolean;
  // Trial mode flags (optional)
  trialModeEnabled?: boolean;
  trialResultVisible?: boolean;
}
type ProblemList = ProblemListItem[];

interface ProblemStats {
  statusCount: { [key in SubmissionStatusCode]: number };
  triedUserCount: number;
  average: number;
  std: number;
  scoreDistribution: number[];
  acUserRatio: number[];
  top10RunTime: SubmissionList;
  top10MemoryUsage: SubmissionList;
}

interface MossReport {
  cpp_report: string;
  python_report: string;
}

type LangOption = { value: number; text: string; mask: number };
type ProblemUpdater = <K extends keyof ProblemForm>(key: K, value: ProblemForm[K]) => void;

type AcceptedFormat = "code" | "zip";
type ExecutionMode = "general" | "functionOnly" | "interactive";
type ArtifactCollection = "compiledBinary" | "zip";

/* ===========================================================
 * CONFIG (設定)
 * =========================================================== */
interface ProblemConfigExtra {
  acceptedFormat: AcceptedFormat;
  maxStudentZipSizeMB?: number;
  resourceData?: boolean;
  allowRead?: boolean;
  allowWrite?: boolean;
  allow_read?: boolean;
  allow_write?: boolean;
  fopen?: boolean;
  fwrite?: boolean;

  // Trial Mode
  trialMode: boolean;
  maxNumberOfTrial?: number;
  trialResultVisible: false;
  trialResultDownloadable: false;

  // AI VTuber
  aiVTuber: boolean;
  aiVTuberMode?: "gemini-2.5-flash-lite" | "gemini-2.5-flash" | "gemini-2.5-pro";
  aiVTuberApiKeys?: string[];

  // AI Checker (for custom checker with AI support)
  aiChecker?: {
    enabled: boolean;
    apiKeyId?: string;
    model?: "gemini-2.5-flash-lite" | "gemini-2.5-flash" | "gemini-2.5-pro";
  };

  // Network Access Restriction
  networkAccessEnabled?: boolean;
  networkAccessRestriction?: {
    sidecars: {
      image: string;
      name: string;
      env?: Record<string, string>;
      args?: string[];
    }[];
    external: {
      model: "Black" | "White";
      ip: string[];
      url: string[];
    };
  };
  assetPaths?: Record<string, string>;
  exposeTestcase?: boolean;
  artifactCollection: ArtifactCollection[];
  resourceDataTeacher?: boolean;
}

/* ===========================================================
 * PIPELINE
 * =========================================================== */
interface ProblemPipeline {
  allowRead: boolean;
  allowWrite: boolean;
  executionMode: ExecutionMode;
  customChecker: boolean;
  teacherFirst?: boolean;

  scoringScript?: { custom: boolean }; // Custom py-only scorer
  staticAnalysis?: {
    libraryRestrictions?: {
      enabled: boolean;
      whitelist: {
        syntax: string[];
        imports: string[];
        headers: string[];
        functions: string[];
      };
      blacklist: {
        syntax: string[];
        imports: string[];
        headers: string[];
        functions: string[];
      };
    };
  };
}

/* ===========================================================
 * ASSETS
 * =========================================================== */
interface ProblemAssets {
  trialModePublicTestDataZip?: File | null;
  trialModeACFiles?: File[] | null;
  //aiVTuberFiles?: File[] | null;
  aiVTuberACFiles?: File[] | null;
  customCheckerPy?: File | null;
  makefileZip?: File | null;
  teacherFile?: File | null;
  scorePy?: File | null;
  dockerfilesZip?: File | null;
  localServiceZip?: File | null;
  testdataZip?: File | null;
  resourceDataZip?: File | null;
  resourceDataTeacherZip?: File | null;
}
