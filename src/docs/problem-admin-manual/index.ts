import basic from "./01-basic.md?raw";
import config from "./02-config.md?raw";
import pipeline from "./03-pipeline.md?raw";

import basicZh from "./01-basic.zh.md?raw";
import configZh from "./02-config.zh.md?raw";
import pipelineZh from "./03-pipeline.zh.md?raw";

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

export const PROBLEM_ADMIN_MANUAL_CATEGORIES: ManualCategory[] = [
  {
    id: "general",
    title: "General",
    pages: [{ id: "basic", title: "Basic", md: basic }],
  },
  {
    id: "advanced",
    title: "Advanced",
    pages: [
      { id: "config", title: "Configuration", md: config },
      { id: "pipeline", title: "Pipeline", md: pipeline },
    ],
  },
];

export const PROBLEM_ADMIN_MANUAL_CATEGORIES_ZH: ManualCategory[] = [
  {
    id: "general",
    title: "首頁",
    pages: [{ id: "basic", title: "導覽", md: basicZh }],
  },
  {
    id: "advanced",
    title: "進階",
    pages: [
      { id: "config", title: "基礎流程設定", md: configZh },
      { id: "pipeline", title: "進階選項設定", md: pipelineZh },
    ],
  },
];
