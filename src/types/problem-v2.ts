export type ArtifactKind = 'compiledBinary' | 'zip';
export type AcceptedFormat = 'code' | 'zip';
export type PipelineType = 'general' | 'functionOnly' | 'interactive';
export type ExecutionOrder = 'studentFirst' | 'teacherFirst';

export interface ProblemDraftV2 {
  courses: string[];
  problemName: string;
  // 1 means Visible (isNotHidden), 0 means Hidden
  status: 0 | 1;

  description: {
    tags: string[];
    allowedLanguage: number; // bitmask 1..7
    quota: number; // -1 for unlimited
    description: string;
    input: string;
    output: string;
    hint: string;
    sampleInput: string[];
    sampleOutput: string[];
  };

  configuration: {
    compilation: boolean;
    testMode: boolean;
    aiVTuber: boolean;
    acceptedFormat: AcceptedFormat; // single-select
    artifactCollection: ArtifactKind[]; // multi-select
    staticAnalysis: {
      default: boolean;
      libraryRestrictions: {
        isEnabled: boolean;
        whitelist: string[];
        blacklist: string[];
      };
      networkAccessRestriction: {
        firewallExtranet: {
          isEnabled: boolean;
          whitelist: string[];
          blacklist: string[];
        };
        connectWithLocal: {
          isEnabled: boolean;
          whitelist: string[];
          blacklist: string[];
          localService: { file: string };
        };
      };
    };
  };

  pipeline: {
    fopen: boolean;
    fwrite: boolean;
    executionMode: {
      selectedPipelineType: PipelineType;
      general: {
        checker: {
          isCustom: boolean;
          customChecker: { file: string };
        };
      };
      functionOnly: {
        teacherUpload: { file: string };
        checker: {
          isCustom: boolean;
          customChecker: { file: string };
        };
      };
      interactive: {
        teacherBinary: { file: string };
        executionOrder: ExecutionOrder;
      };
    };
    scoringAndTestcase: {
      testCaseInfo: {
        language: number;
        fillInTemplate: string;
        tasks: Array<{
          caseCount: number;
          taskScore: number;
        }>;
      };
      timeLimit: number; // global ms
      memoryLimit: number; // global KB
      scoringScript: {
        isCustom: boolean;
        customScoringScript: { file: string };
        customScoringJson: { file: string };
      };
    };
  };
}

// 這是送舊 API 用的 payload（不包含 canViewStdout、defaultCode）
export interface LegacyProblemCreateRequest {
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
  type: 0 | 2; // 0: code (programming), 2: zip (file upload)
  status: 0 | 1; // 0 Visible, 1 Hidden（舊 enum）
  testCaseInfo: {
    language: number;
    fillInTemplate: string;
    tasks: Array<{
      caseCount: number;
      taskScore: number;
      timeLimit: number;
      memoryLimit: number;
    }>;
  };
}