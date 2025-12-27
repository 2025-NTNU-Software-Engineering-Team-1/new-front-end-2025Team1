import overview from "./01-overview.md?raw";
import overviewZh from "./01-overview.zh.md?raw";
import problem from "./03-problem.md?raw";
import problemZh from "./03-problem.zh.md?raw";
import submission from "./04-submission.md?raw";
import submissionZh from "./04-submission.zh.md?raw";
import course from "./05-course.md?raw";
import courseZh from "./05-course.zh.md?raw";
import errors from "./06-errors.md?raw";
import errorsZh from "./06-errors.zh.md?raw";

export type ManualPage = {
  id: string;
  title: string;
  md: string;
};

export type ManualCategory = {
  id: string;
  title: string;
  pages: ManualPage[];
};

export const PAT_MANUAL_CATEGORIES: ManualCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    pages: [{ id: "overview", title: "Overview", md: overview }],
  },
  {
    id: "api-reference",
    title: "API Reference",
    pages: [
      { id: "problem", title: "Problem API", md: problem },
      { id: "submission", title: "Submission API", md: submission },
      { id: "course", title: "Course API", md: course },
    ],
  },
  {
    id: "appendix",
    title: "Appendix",
    pages: [{ id: "errors", title: "Errors & Enums", md: errors }],
  },
];

export const PAT_MANUAL_CATEGORIES_ZH: ManualCategory[] = [
  {
    id: "getting-started",
    title: "快速開始",
    pages: [{ id: "overview", title: "概覽", md: overviewZh }],
  },
  {
    id: "api-reference",
    title: "API 參考",
    pages: [
      { id: "problem", title: "題目 API", md: problemZh },
      { id: "submission", title: "繳交 API", md: submissionZh },
      { id: "course", title: "課程 API", md: courseZh },
    ],
  },
  {
    id: "appendix",
    title: "附錄",
    pages: [{ id: "errors", title: "錯誤代碼與列舉", md: errorsZh }],
  },
];
