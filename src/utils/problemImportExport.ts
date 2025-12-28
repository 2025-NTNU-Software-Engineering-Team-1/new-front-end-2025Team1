export type ProblemComponentGroup = "core" | "assets" | "trial" | "analysis" | "settings";

export type ProblemComponentOption = {
  id: string;
  labelKey: string;
  group: ProblemComponentGroup;
  required?: boolean;
};

export const COMPONENT_OPTIONS: ProblemComponentOption[] = [
  {
    id: "core.meta",
    labelKey: "course.problems.componentMeta",
    group: "core",
    required: true,
  },
  {
    id: "core.testcase",
    labelKey: "course.problems.componentTestcase",
    group: "core",
    required: true,
  },
  { id: "assets.checker", labelKey: "course.problems.componentChecker", group: "assets" },
  { id: "assets.makefile", labelKey: "course.problems.componentMakefile", group: "assets" },
  { id: "assets.teacher_file", labelKey: "course.problems.componentTeacherFile", group: "assets" },
  { id: "assets.scoring_script", labelKey: "course.problems.componentScoringScript", group: "assets" },
  { id: "assets.local_service", labelKey: "course.problems.componentLocalService", group: "assets" },
  { id: "assets.resource_data", labelKey: "course.problems.componentResourceData", group: "assets" },
  {
    id: "assets.resource_data_teacher",
    labelKey: "course.problems.componentResourceDataTeacher",
    group: "assets",
  },
  { id: "assets.network_dockerfile", labelKey: "course.problems.componentNetworkDockerfile", group: "assets" },
  { id: "trial.public_testdata", labelKey: "course.problems.componentTrialPublicTestdata", group: "trial" },
  { id: "trial.ac_code", labelKey: "course.problems.componentTrialAcCode", group: "trial" },
  { id: "static_analysis", labelKey: "course.problems.componentStaticAnalysis", group: "analysis" },
  { id: "settings.network", labelKey: "course.problems.componentNetworkSettings", group: "settings" },
  { id: "settings.ai_ta", labelKey: "course.problems.componentAiTaSettings", group: "settings" },
  { id: "settings.artifact", labelKey: "course.problems.componentArtifactSettings", group: "settings" },
  { id: "settings.file_access", labelKey: "course.problems.componentFileAccessSettings", group: "settings" },
];

export const CORE_COMPONENTS = COMPONENT_OPTIONS.filter((opt) => opt.group === "core").map((opt) => opt.id);

export const OPTIONAL_COMPONENTS = COMPONENT_OPTIONS.filter((opt) => opt.group !== "core").map(
  (opt) => opt.id,
);

export const SETTINGS_COMPONENTS = COMPONENT_OPTIONS.filter((opt) => opt.group === "settings").map((opt) => opt.id);

export const ALWAYS_AVAILABLE_COMPONENTS = [...SETTINGS_COMPONENTS, "static_analysis"];

export type ProblemComponentSection = {
  id: string;
  labelKey: string;
  componentIds: string[];
};

export const COMPONENT_SECTIONS: ProblemComponentSection[] = [
  {
    id: "core",
    labelKey: "course.problems.componentSectionCore",
    componentIds: ["core.meta", "core.testcase"],
  },
  {
    id: "settings",
    labelKey: "course.problems.componentSectionSettings",
    componentIds: ["settings.network", "settings.ai_ta", "settings.artifact", "settings.file_access"],
  },
  {
    id: "trial",
    labelKey: "course.problems.componentSectionTrial",
    componentIds: ["trial.public_testdata", "trial.ac_code"],
  },
  {
    id: "network",
    labelKey: "course.problems.componentSectionNetwork",
    componentIds: ["assets.network_dockerfile", "assets.local_service"],
  },
  {
    id: "analysis",
    labelKey: "course.problems.componentSectionAnalysis",
    componentIds: ["static_analysis"],
  },
  {
    id: "execution",
    labelKey: "course.problems.componentSectionExecution",
    componentIds: ["assets.makefile", "assets.teacher_file"],
  },
  {
    id: "scoring",
    labelKey: "course.problems.componentSectionScoring",
    componentIds: ["assets.checker", "assets.scoring_script"],
  },
  {
    id: "resources",
    labelKey: "course.problems.componentSectionResources",
    componentIds: ["assets.resource_data", "assets.resource_data_teacher"],
  },
];
