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

  // Extra (admin config/pipeline/assets)
  config?: ProblemConfigExtra;
  pipeline?: ProblemPipeline;
  assets?: ProblemAssets;
}

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
  testCase: ProblemTestCase[];
  canViewStdout: boolean;
  owner: string;
  defaultCode: string;
  submitCount: number;
  highScore: number;
  ACUser: number;
  submitter: number;

  // 後端 /problem/view/:id 可能附帶 Extra 設定（供前端行為判斷）
  config?: ProblemConfigExtra;
}

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

interface ProblemStaticAnalysis {
  custom: boolean;
  libraryRestrictions?: {
    enabled: boolean;
    whitelist: string[];
    blacklist: string[];
  };

  networkAccessRestriction?: {
    enabled: boolean;
    firewallExtranet?: {
      enabled: boolean;
      whitelist: string[];
      blacklist: string[];
    };
    connectWithLocal?: {
      enabled: boolean;
      whitelist: string[];
      blacklist: string[];
      localServiceZip?: File | null;
    };
  };
}

interface ProblemConfigExtra {
  compilation: boolean;
  testMode: boolean;
  aiVTuber: boolean;
  acceptedFormat: AcceptedFormat;
  staticAnalysis: ProblemStaticAnalysis;
  artifactCollection: ArtifactCollection[];
}

interface ProblemScoringScript {
  custom: boolean;
}

interface ProblemPipeline {
  fopen: boolean;
  fwrite: boolean;
  executionMode: ExecutionMode;
  customChecker: boolean;
  teacherFirst?: boolean;
  scoringScript?: ProblemScoringScript; // optional custom scoring script flag
}

interface ProblemAssets {
  // All are optional and nullable; stored for upload.
  checkerPy?: File | null;
  makefileZip?: File | null;
  teacherFile?: File | null;
  scorePy?: File | null;
  scoreJson?: File | null;
  localServiceZip?: File | null;
  testdataZip?: File | null;
}
