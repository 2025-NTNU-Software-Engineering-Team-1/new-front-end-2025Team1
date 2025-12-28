<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ZipReader, BlobReader, TextWriter } from "@zip.js/zip.js";
import api from "@/models/api";
import {
  ALWAYS_AVAILABLE_COMPONENTS,
  COMPONENT_OPTIONS,
  COMPONENT_SECTIONS,
  CORE_COMPONENTS,
  SETTINGS_COMPONENTS,
  type ProblemComponentOption,
} from "@/utils/problemImportExport";
import { useI18n } from "vue-i18n";
import { useSession } from "@/stores/session";
import CourseMultiSelect from "@/components/Course/CourseMultiSelect.vue";

type ImportPreviewProblem = {
  originalId?: number;
  name: string;
  type?: number;
  testcaseCount?: number;
  components?: string[];
  requiredComponents?: string[];
  featureFlags?: ProblemFeatureFlags;
  tags?: string[];
};

type ProblemFeatureFlags = {
  customChecker: boolean;
  executionMode?: string;
  scoringScriptCustom: boolean;
  trialMode: boolean;
  resourceData: boolean;
  resourceDataTeacher: boolean;
  networkAccessEnabled: boolean;
};

type ImportPreview = {
  mode: "single" | "batch";
  problems: ImportPreviewProblem[];
  components: string[];
  requiredComponents: string[];
};

const props = defineProps<{
  modelValue: boolean;
  courseName: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "imported"): void;
}>();

const { t } = useI18n();
const session = useSession();

const file = ref<File | null>(null);
const isDragging = ref(false);
const preview = ref<ImportPreview | null>(null);
const previewError = ref("");
const isParsing = ref(false);
const isImporting = ref(false);
const importError = ref("");
const importResult = ref<{
  imported?: Array<{
    originalId?: number;
    newId?: number;
    problemId?: number;
    name?: string;
    problemName?: string;
    course?: string;
  }>;
  failed?: Array<{ originalId?: number; reason?: string; course?: string }>;
  problemId?: number;
  problemName?: string;
} | null>(null);

const STATUS_HIDDEN = 1;
const STATUS_VISIBLE = 0;

const selectedCourses = ref<string[]>([]);
const status = ref<ProblemStatus>(STATUS_HIDDEN as ProblemStatus);
const courseOptions = ref<{ text: string; value: string }[]>([]);
const isLoadingCourses = ref(false);
const courseError = ref("");
let autoCloseTimer: number | null = null;

const availableComponents = computed(() => {
  if (!preview.value) return [];
  const available = new Set(preview.value.components);
  ALWAYS_AVAILABLE_COMPONENTS.forEach((id) => available.add(id));
  return COMPONENT_OPTIONS.filter((opt) => opt.group === "core" || available.has(opt.id));
});

const selectedComponents = ref<Set<string>>(new Set());

const requiredComponents = computed(() => new Set(preview.value?.requiredComponents || []));

const availableComponentIds = computed(() => new Set(availableComponents.value.map((opt) => opt.id)));

const componentSections = computed(() => {
  const optionMap = new Map(COMPONENT_OPTIONS.map((opt) => [opt.id, opt]));
  return COMPONENT_SECTIONS.map((section) => {
    const options = section.componentIds
      .filter((id) => availableComponentIds.value.has(id))
      .map((id) => optionMap.get(id))
      .filter((opt): opt is ProblemComponentOption => !!opt);
    return { ...section, options };
  }).filter((section) => section.options.length > 0);
});

const optionalSelectable = computed(() =>
  availableComponents.value.filter((opt) => opt.group !== "core" && !requiredComponents.value.has(opt.id)),
);

const allOptionalSelected = computed(() =>
  optionalSelectable.value.every((opt) => selectedComponents.value.has(opt.id)),
);

const MAX_PREVIEW_TAGS = 3;

const hasImportSuccess = computed(() => {
  const result = importResult.value;
  return !!(result?.problemId || (result?.imported && result.imported.length));
});

const hasImportFailures = computed(() => (importResult.value?.failed?.length || 0) > 0);

const assetToggleWarnings = computed(() => {
  if (!preview.value) return [];
  const warnings: Array<{ name: string; components: string[] }> = [];
  const selected = selectedComponents.value;
  preview.value.problems.forEach((problem) => {
    if (!problem.featureFlags) return;
    const available = new Set(problem.components || []);
    const included = new Set<string>();
    available.forEach((id) => {
      if (selected.has(id) || CORE_COMPONENTS.includes(id)) {
        included.add(id);
      }
    });
    const mismatches = collectAssetMismatches(problem.featureFlags, included);
    if (mismatches.length) {
      warnings.push({
        name: problem.name,
        components: mismatches.map((id) => getComponentLabel(id)),
      });
    }
  });
  return warnings;
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      clearAutoClose();
      status.value = STATUS_HIDDEN as ProblemStatus;
      resetState();
      loadCourses();
    } else {
      clearAutoClose();
    }
  },
);

function resetState() {
  file.value = null;
  preview.value = null;
  previewError.value = "";
  importError.value = "";
  importResult.value = null;
  courseError.value = "";
  selectedCourses.value = [];
  selectedComponents.value = new Set();
}

function clearAutoClose() {
  if (autoCloseTimer === null) return;
  window.clearTimeout(autoCloseTimer);
  autoCloseTimer = null;
}

function scheduleAutoClose() {
  clearAutoClose();
  autoCloseTimer = window.setTimeout(() => {
    close();
  }, 2000);
}

async function loadCourses() {
  isLoadingCourses.value = true;
  courseError.value = "";
  try {
    const resp = await api.Course.list();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = resp?.data || resp;
    const list = payload?.data || payload;
    const courseEntries = Array.isArray(list) ? list : [];
    const normalizedEntries = courseEntries.map((item) =>
      typeof item === "string" ? { course: item } : item || {},
    );
    const courseNames = normalizedEntries.map((item) => item.course).filter(Boolean);

    if (session.isAdmin) {
      courseOptions.value = courseNames.map((name: string) => ({ text: name, value: name }));
    } else {
      const hasTeacherInfo = normalizedEntries.every((item) => item?.teacher?.username);
      if (hasTeacherInfo) {
        courseOptions.value = normalizedEntries
          .filter((item) => item?.teacher?.username === session.username)
          .map((item) => ({ text: item.course, value: item.course }));
      } else {
        const detailChecks = await Promise.all(
          courseNames.map(async (name: string) => {
            try {
              const detailResp = await api.Course.get(name);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const detailPayload: any = detailResp?.data || detailResp;
              const detail = detailPayload?.data || detailPayload;
              const teacher = detail?.teacher?.username;
              return teacher === session.username ? name : null;
            } catch {
              return null;
            }
          }),
        );
        courseOptions.value = detailChecks
          .filter((name): name is string => !!name)
          .map((name) => ({ text: name, value: name }));
      }
    }

    if (courseOptions.value.length) {
      const defaultCourse = courseOptions.value.find((c) => c.value === props.courseName)?.value;
      selectedCourses.value = defaultCourse ? [defaultCourse] : [courseOptions.value[0].value];
    }
  } catch (err) {
    console.error("Failed to load courses:", err);
    courseError.value = t("course.problems.importCourseLoadFailed");
  } finally {
    isLoadingCourses.value = false;
  }
}

function close() {
  clearAutoClose();
  emit("update:modelValue", false);
}

function handleFileSelect(selected: File | null) {
  file.value = selected;
  preview.value = null;
  previewError.value = "";
  importError.value = "";
  importResult.value = null;
  selectedComponents.value = new Set();
  if (selected) {
    parseZip(selected);
  }
}

function handleInputChange(event: Event) {
  const selected = (event.target as HTMLInputElement).files?.[0] || null;
  handleFileSelect(selected);
}

async function parseZip(selected: File) {
  isParsing.value = true;
  previewError.value = "";
  try {
    const zipReader = new ZipReader(new BlobReader(selected));
    try {
      const entries = await zipReader.getEntries();
      const entryMap = new Map(entries.map((entry) => [entry.filename, entry]));

      const rootManifestEntry = entryMap.get("manifest.json");
      if (!rootManifestEntry || !rootManifestEntry.getData) {
        throw new Error(t("course.problems.importManifestMissing"));
      }

      const rootManifestText = await rootManifestEntry.getData(new TextWriter());
      const rootManifest = JSON.parse(rootManifestText);

      if (rootManifest?.problems && Array.isArray(rootManifest.problems)) {
        const problems: ImportPreviewProblem[] = [];
        const componentSet = new Set<string>();
        const requiredSet = new Set<string>();

        for (const item of rootManifest.problems) {
          const folder = item?.folder;
          const manifestEntry = folder ? entryMap.get(`${folder}/manifest.json`) : null;
          const metaEntry = folder ? entryMap.get(`${folder}/meta.json`) : null;
          let meta: any = null;
          let manifest: any = null;

          if (manifestEntry?.getData) {
            const manifestText = await manifestEntry.getData(new TextWriter());
            manifest = JSON.parse(manifestText);
          }

          if (metaEntry?.getData) {
            const metaText = await metaEntry.getData(new TextWriter());
            meta = JSON.parse(metaText);
          }

          const components = extractComponents(manifest);
          ALWAYS_AVAILABLE_COMPONENTS.forEach((id) => {
            if (!components.includes(id)) components.push(id);
          });
          components.forEach((c) => componentSet.add(c));
          const required = computeRequiredComponents(meta);
          required.forEach((c) => requiredSet.add(c));

          problems.push({
            originalId: item?.originalId,
            name: item?.name || meta?.problemName || folder || "Unknown",
            type: meta?.type,
            testcaseCount: computeTestcaseCount(meta),
            components,
            requiredComponents: Array.from(required),
            featureFlags: deriveFeatureFlags(meta),
            tags: normalizeTags(meta?.tags),
          });
        }

        preview.value = {
          mode: "batch",
          problems,
          components: Array.from(componentSet),
          requiredComponents: Array.from(requiredSet),
        };
      } else {
        const metaEntry = entryMap.get("meta.json");
        if (!metaEntry?.getData) {
          throw new Error(t("course.problems.importMetaMissing"));
        }
        const manifest = rootManifest;
        const metaText = await metaEntry.getData(new TextWriter());
        const meta = JSON.parse(metaText);

        const components = extractComponents(manifest);
        ALWAYS_AVAILABLE_COMPONENTS.forEach((id) => {
          if (!components.includes(id)) components.push(id);
        });
        const required = computeRequiredComponents(meta);

        preview.value = {
          mode: "single",
          problems: [
            {
              name: meta?.problemName || "Unknown",
              type: meta?.type,
              testcaseCount: computeTestcaseCount(meta),
              components,
              requiredComponents: Array.from(required),
              featureFlags: deriveFeatureFlags(meta),
              tags: normalizeTags(meta?.tags),
            },
          ],
          components,
          requiredComponents: Array.from(required),
        };
      }
    } finally {
      await zipReader.close();
    }

    const initial = new Set<string>(preview.value?.components || []);
    CORE_COMPONENTS.forEach((c) => initial.add(c));
    ALWAYS_AVAILABLE_COMPONENTS.forEach((c) => initial.add(c));
    selectedComponents.value = initial;
  } catch (err) {
    previewError.value = err instanceof Error ? err.message : t("course.problems.importParseFailed");
  } finally {
    isParsing.value = false;
  }
}

function extractComponents(manifest: any): string[] {
  const components = new Set<string>();
  if (manifest?.components && typeof manifest.components === "object") {
    Object.keys(manifest.components).forEach((key) => components.add(key));
  }
  if (!components.size && manifest?.files) {
    Object.values(manifest.files).forEach((info: any) => {
      if (info?.role) components.add(info.role);
    });
  }
  CORE_COMPONENTS.forEach((c) => components.add(c));
  return Array.from(components);
}

function deriveFeatureFlags(meta: any): ProblemFeatureFlags {
  const config = meta?.config || {};
  const pipeline = meta?.pipeline || {};
  const executionMode = pipeline?.executionMode || config?.executionMode;
  const scoring = pipeline?.scoringScript ?? config?.scoringScript;
  const scoringScriptCustom = !!(typeof scoring === "object" ? scoring?.custom : scoring);
  const trialMode = !!(config?.trialMode ?? config?.testMode);
  const networkAccessEnabled = resolveNetworkEnabled(config);
  return {
    customChecker: !!(pipeline?.customChecker ?? config?.customChecker),
    executionMode,
    scoringScriptCustom,
    trialMode,
    resourceData: !!config?.resourceData,
    resourceDataTeacher: !!config?.resourceDataTeacher,
    networkAccessEnabled,
  };
}

function resolveNetworkEnabled(config: any): boolean {
  if (typeof config?.networkAccessEnabled === "boolean") {
    return config.networkAccessEnabled;
  }
  const restriction = config?.networkAccessRestriction;
  if (!restriction || typeof restriction !== "object") {
    return false;
  }
  const external = restriction.external;
  const sidecars = restriction.sidecars;
  const hasExternal =
    (external &&
      typeof external === "object" &&
      ((Array.isArray(external.ip) && external.ip.length > 0) || !!external.ip)) ||
    (external &&
      typeof external === "object" &&
      ((Array.isArray(external.url) && external.url.length > 0) || !!external.url));
  const hasSidecars = Array.isArray(sidecars) && sidecars.length > 0;
  return !!(hasExternal || hasSidecars || restriction.enabled || restriction.firewallExtranet || restriction.connectWithLocal);
}

function collectAssetMismatches(flags: ProblemFeatureFlags, included: Set<string>): string[] {
  const checks: Array<{ id: string; enabled: boolean }> = [
    { id: "assets.checker", enabled: flags.customChecker },
    { id: "assets.makefile", enabled: flags.executionMode === "functionOnly" },
    { id: "assets.teacher_file", enabled: flags.executionMode === "interactive" },
    { id: "assets.scoring_script", enabled: flags.scoringScriptCustom },
    { id: "trial.public_testdata", enabled: flags.trialMode },
    { id: "trial.ac_code", enabled: flags.trialMode },
    { id: "assets.resource_data", enabled: flags.resourceData },
    { id: "assets.resource_data_teacher", enabled: flags.resourceDataTeacher },
    { id: "assets.network_dockerfile", enabled: flags.networkAccessEnabled },
    { id: "assets.local_service", enabled: flags.networkAccessEnabled },
  ];
  return checks.filter((check) => included.has(check.id) && !check.enabled).map((check) => check.id);
}

function getComponentLabel(id: string): string {
  const labelKey = COMPONENT_OPTIONS.find((opt) => opt.id === id)?.labelKey;
  return labelKey ? t(labelKey) : id;
}

function computeRequiredComponents(meta: any): Set<string> {
  const required = new Set<string>(CORE_COMPONENTS);
  const config = meta?.config || {};
  const pipeline = meta?.pipeline || {};

  if (pipeline?.customChecker) required.add("assets.checker");
  if (pipeline?.executionMode === "functionOnly") required.add("assets.makefile");
  if (pipeline?.executionMode === "interactive") required.add("assets.teacher_file");

  const scoring = pipeline?.scoringScript;
  if (scoring && (scoring === true || scoring.custom)) {
    required.add("assets.scoring_script");
  }
  if (config?.trialMode ?? config?.testMode) {
    required.add("trial.public_testdata");
    required.add("trial.ac_code");
  }
  if (config?.resourceData) {
    required.add("assets.resource_data");
  }
  if (config?.resourceDataTeacher) {
    required.add("assets.resource_data_teacher");
  }
  return required;
}

function normalizeTags(input: any): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  input.forEach((tag) => {
    const value = String(tag || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    result.push(value);
  });
  return result;
}

function computeTestcaseCount(meta: any): number | undefined {
  const tasks = meta?.testCase?.tasks || meta?.testCaseInfo?.tasks;
  if (!Array.isArray(tasks)) return undefined;
  return tasks.reduce((sum: number, task: any) => sum + (task?.caseCount || 0), 0);
}

function formatProblemType(type?: number) {
  if (type === 1) return t("course.problems.problemTypeFillIn");
  if (type === 2) return t("course.problems.problemTypeFileUpload");
  return t("course.problems.problemTypeProgramming");
}

function toggleComponent(option: ProblemComponentOption) {
  if (requiredComponents.value.has(option.id) || option.group === "core") return;
  if (selectedComponents.value.has(option.id)) {
    selectedComponents.value.delete(option.id);
  } else {
    selectedComponents.value.add(option.id);
  }
  selectedComponents.value = new Set(selectedComponents.value);
}

function toggleAllOptional() {
  const next = new Set(selectedComponents.value);
  if (allOptionalSelected.value) {
    optionalSelectable.value.forEach((opt) => next.delete(opt.id));
  } else {
    optionalSelectable.value.forEach((opt) => next.add(opt.id));
  }
  selectedComponents.value = next;
}

async function submitImport() {
  if (!file.value || !preview.value) return;
  if (!selectedCourses.value.length) {
    importError.value = t("course.problems.importCourseRequired");
    return;
  }
  isImporting.value = true;
  importError.value = "";
  importResult.value = null;
  try {
    const formData = new FormData();
    formData.append("file", file.value);
    formData.append("courses", JSON.stringify(selectedCourses.value));
    formData.append("status", String(status.value));
    if (selectedComponents.value.size > 0) {
      formData.append("components", Array.from(selectedComponents.value).join(","));
    }

    const resp =
      preview.value.mode === "batch"
        ? await api.Problem.importBatch(formData)
        : await api.Problem.import(formData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = resp?.data || resp;
    importResult.value = payload?.data || payload;
    emit("imported");
    const hasFailures = (importResult.value?.failed?.length || 0) > 0;
    if (!hasFailures && preview.value?.mode === "single") {
      scheduleAutoClose();
    }
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorObj = err as any;
    importError.value = errorObj?.response?.data?.message || errorObj?.message || t("course.problems.importFailed");
  } finally {
    isImporting.value = false;
  }
}

onBeforeUnmount(() => {
  clearAutoClose();
});
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': modelValue }">
    <div class="modal-box max-w-3xl">
      <h3 class="text-lg font-bold">{{ t("course.problems.importTitle") }}</h3>

      <div class="mt-4 space-y-4">
        <div
          class="border-base-300 rounded-lg border border-dashed p-4 transition"
          :class="isDragging ? 'border-primary bg-primary/5' : ''"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="
            isDragging = false;
            handleFileSelect($event.dataTransfer?.files?.[0] || null);
          "
        >
          <template v-if="!file">
            <p class="text-base-content/70 text-sm">
              {{ t("course.problems.importDropHint") }}
            </p>
            <input
              type="file"
              accept=".zip,.noj.zip"
              class="file-input file-input-sm mt-3 w-full"
              @change="handleInputChange"
            />
          </template>
          <template v-else>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-medium">{{ file.name }}</p>
                <p class="text-base-content/60 text-xs">{{ (file.size / (1024 * 1024)).toFixed(2) }} MB</p>
              </div>
              <button class="btn btn-xs btn-ghost" type="button" @click="handleFileSelect(null)">
                {{ t("course.problems.clearFile") }}
              </button>
            </div>
          </template>
        </div>

        <div v-if="previewError" class="alert alert-error">
          <span>{{ previewError }}</span>
        </div>

        <div v-if="preview" class="space-y-4">
          <div class="flex items-center gap-2">
            <span class="font-semibold">{{ t("course.problems.importPreview") }}</span>
            <span class="badge badge-outline">{{ preview.mode === "batch" ? "Batch" : "Single" }}</span>
          </div>

          <div class="rounded-lg border border-base-200 p-3">
            <div v-for="(item, idx) in preview.problems" :key="idx" class="border-base-200 border-b py-2 last:border-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ item.name }}</span>
                <span v-if="item.originalId" class="badge badge-ghost">#{{ item.originalId }}</span>
                <span v-if="item.type !== undefined" class="text-base-content/60 text-xs">
                  {{ formatProblemType(item.type) }}
                </span>
                <span v-if="item.testcaseCount !== undefined" class="text-base-content/60 text-xs">
                  {{ t("course.problems.importTestcaseCount", { count: item.testcaseCount }) }}
                </span>
                <template v-if="item.tags?.length">
                  <span
                    v-for="tag in item.tags.slice(0, MAX_PREVIEW_TAGS)"
                    :key="tag"
                    class="badge badge-info badge-sm"
                  >
                    {{ tag }}
                  </span>
                  <span v-if="item.tags.length > MAX_PREVIEW_TAGS" class="badge badge-ghost badge-sm">
                    +{{ item.tags.length - MAX_PREVIEW_TAGS }}
                  </span>
                </template>
              </div>
            </div>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between">
              <span class="font-semibold">{{ t("course.problems.importComponents") }}</span>
              <button class="btn btn-xs btn-ghost" type="button" @click="toggleAllOptional">
                {{ allOptionalSelected ? t("course.problems.clearAll") : t("course.problems.selectAll") }}
              </button>
            </div>
            <div class="space-y-3">
              <div
                v-for="section in componentSections"
                :key="section.id"
                class="rounded-lg border border-base-200 p-3"
              >
                <div class="mb-2 flex items-center justify-between">
                  <span class="font-medium">{{ t(section.labelKey) }}</span>
                </div>
                <div class="grid gap-2 md:grid-cols-2">
                  <label v-for="opt in section.options" :key="opt.id" class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      :checked="selectedComponents.has(opt.id)"
                      :disabled="requiredComponents.has(opt.id) || opt.group === 'core'"
                      @change="toggleComponent(opt)"
                    />
                    <span>{{ t(opt.labelKey) }}</span>
                    <span
                      v-if="requiredComponents.has(opt.id) || opt.group === 'core'"
                      class="badge badge-ghost badge-sm"
                    >
                      {{ t("course.problems.required") }}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div v-if="assetToggleWarnings.length" class="alert alert-warning">
            <div>
              <p class="font-semibold">{{ t("course.problems.importAssetWarningTitle") }}</p>
              <p class="text-base-content/70 text-sm">
                {{ t("course.problems.importAssetWarningHint") }}
              </p>
              <div class="mt-2 space-y-1 text-sm">
                <div
                  v-for="(item, idx) in assetToggleWarnings"
                  :key="idx"
                  class="flex flex-wrap items-center gap-2"
                >
                  <span class="font-medium">{{ item.name }}</span>
                  <span class="text-base-content/70">: {{ item.components.join(", ") }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ t("course.problems.importCourse") }}</span>
              </label>
              <CourseMultiSelect
                v-model="selectedCourses"
                :courses="courseOptions"
                :placeholder="t('course.problems.importCoursePlaceholder')"
              />
              <label class="label">
                <span v-if="isLoadingCourses" class="label-text-alt">{{ t("course.problems.importCourseLoading") }}</span>
                <span v-else-if="courseError" class="label-text-alt text-error">{{ courseError }}</span>
                <span v-else class="label-text-alt">{{ t("course.problems.importCourseHint") }}</span>
              </label>
            </div>
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ t("course.problems.importStatus") }}</span>
              </label>
              <select v-model="status" class="select select-bordered select-sm">
                <option :value="STATUS_HIDDEN">{{ t("course.problems.importStatusHidden") }}</option>
                <option :value="STATUS_VISIBLE">{{ t("course.problems.importStatusVisible") }}</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="importError" class="alert alert-error">
          <span>{{ importError }}</span>
        </div>

        <div v-if="importResult" class="space-y-3">
          <div v-if="hasImportSuccess" class="alert alert-success">
            <div>
              <p class="font-semibold">{{ t("course.problems.importDone") }}</p>
              <p v-if="importResult.problemId">
                #{{ importResult.problemId }} {{ importResult.problemName }}
              </p>
              <p v-if="importResult.imported?.length">
                {{ t("course.problems.importBatchDone", { count: importResult.imported.length }) }}
              </p>
              <div v-if="importResult.imported?.length" class="mt-2 space-y-1">
                <div
                  v-for="(item, idx) in importResult.imported"
                  :key="idx"
                  class="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span v-if="item.newId ?? item.problemId" class="badge badge-outline">
                    #{{ item.newId ?? item.problemId }}
                  </span>
                  <span class="font-medium">{{ item.name || item.problemName || "-" }}</span>
                  <span v-if="item.course" class="badge badge-ghost">{{ item.course }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="hasImportFailures" class="alert alert-error">
            <div>
              <p class="font-semibold">
                {{ t("course.problems.importBatchFailed", { count: importResult.failed?.length || 0 }) }}
              </p>
              <div class="mt-2 space-y-1">
                <div
                  v-for="(item, idx) in importResult.failed"
                  :key="idx"
                  class="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span v-if="item.course" class="badge badge-ghost">{{ item.course }}</span>
                  <span>{{ item.reason }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" type="button" @click="close">
          {{ t("course.problems.cancel") }}
        </button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="!file || !!previewError || isParsing || isImporting"
          @click="submitImport"
        >
          <span v-if="isParsing">{{ t("course.problems.importParsing") }}</span>
          <span v-else-if="isImporting">{{ t("course.problems.importing") }}</span>
          <span v-else>{{ t("course.problems.importStart") }}</span>
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="close">close</button>
    </form>
  </dialog>
</template>
