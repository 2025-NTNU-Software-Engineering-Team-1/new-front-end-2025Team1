import basic from "./01-basic.md?raw";
import config from "./02-config.md?raw";
import pipeline from "./03-pipeline.md?raw";

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
