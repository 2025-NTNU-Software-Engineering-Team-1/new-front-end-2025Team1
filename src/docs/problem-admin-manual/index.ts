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

export const PROBLEM_ADMIN_MANUAL_PAGES: ManualPage[] = [
  { id: "basic", title: "Basic", md: basic },
  { id: "config", title: "Configuration", md: config },
  { id: "pipeline", title: "Pipeline", md: pipeline },
];

export const PROBLEM_ADMIN_MANUAL_PAGES_ZH: ManualPage[] = [
  { id: "basic", title: "基本", md: basicZh },
  { id: "config", title: "設定", md: configZh },
  { id: "pipeline", title: "流程", md: pipelineZh },
];
