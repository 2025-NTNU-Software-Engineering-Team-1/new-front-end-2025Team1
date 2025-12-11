<script setup lang="ts">
import { inject, Ref, ref, watch, computed, defineProps, withDefaults } from "vue";
import { useRoute } from "vue-router";
import { ZipReader, BlobReader } from "@zip.js/zip.js";
import { assertFileSizeOK } from "@/utils/checkFileSize";

const props = withDefaults(defineProps<{ variant?: "student" | "teacher" }>(), {
  variant: "student",
});
const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;
const isDrag = ref(false);
const route = useRoute();
const isTeacher = computed(() => props.variant === "teacher");
const enableKey = computed(() => (isTeacher.value ? "resourceDataTeacher" : "resourceData"));
const assetKey = computed(() => (isTeacher.value ? "resourceDataTeacherZip" : "resourceDataZip"));
const assetPathKey = computed(() => (isTeacher.value ? "resource_data_teacher" : "resource_data"));
const labelText = computed(() =>
  isTeacher.value ? "Set ResourceData (Teacher)" : "Set ResourceData (Student)",
);
const allowReadRef = computed(() => {
  const pipe = problem.value.pipeline || {};
  const cfg = problem.value.config || ({} as any);
  return Boolean(pipe.allowRead ?? cfg.allowRead ?? cfg.allow_read ?? cfg.fopen ?? false);
});
const allowReadSatisfied = computed(() => isTeacher.value || allowReadRef.value);
const hasRemoteTestcase = computed(() => Boolean((problem.value.config as any)?.assetPaths?.case));
const hasTestdata = computed(
  () => hasRemoteTestcase.value || (problem.value.testCaseInfo?.tasks?.length ?? 0) > 0,
);
// 警告訊息直接用 computed 計算（不需要 watch 和初始化標記）
const resourceDataWarning = computed(() => {
  if (isTeacher.value) return "";
  if (!allowReadSatisfied.value && enableRef.value) {
    return "Enable Allow Read to use Resource Data.";
  }
  return "";
});
const resourceCaseCount = ref<number | null>(null);
const hasRemoteAsset = computed(() =>
  Boolean((problem.value.config as any)?.assetPaths?.[assetPathKey.value]),
);
const remoteTaskCount = computed(() => {
  const len = problem.value.testCaseInfo?.tasks?.length ?? 0;
  return len > 0 ? len : null;
});
watch(
  () => problem.value.config?.resourceData,
  (val) => {
    if (!val) {
      resourceCaseCount.value = null;
    }
  },
);
const enableDisabledReason = computed(() => {
  if (!hasTestdata.value) return "Upload TestData first";
  if (!allowReadSatisfied.value) return "Allow Read required";
  return "";
});
const showDisabledText = computed(() => Boolean(enableDisabledReason.value || resourceDataWarning.value));

const enableRef = computed({
  get: () => (problem.value.config as any)?.[enableKey.value],
  set: (val: boolean) => {
    (problem.value.config as any)[enableKey.value] = val;
  },
});

const fileRef = computed({
  get: () => (problem.value.assets as any)?.[assetKey.value] ?? null,
  set: (val: File | null) => {
    if (problem.value.assets) (problem.value.assets as any)[assetKey.value] = val;
  },
});

const downloadUrl = computed(() => {
  const pid = route.params.id;
  if (!pid || Array.isArray(pid)) return null;
  const assetPaths = (problem.value.config as any)?.assetPaths;
  if (assetPaths && !assetPaths[assetPathKey.value]) return null;
  return `/api/problem/${pid}/asset/${assetPathKey.value}/download`;
});
const hasExistingTasks = computed(() => (problem.value.testCaseInfo?.tasks?.length ?? 0) > 0);

const expectedPrefixes = computed(() => {
  const tasks = problem.value.testCaseInfo?.tasks || [];
  const prefixes: string[] = [];
  tasks.forEach((t, ti) => {
    for (let ci = 0; ci < (t.caseCount || 0); ci++) {
      prefixes.push(`${String(ti).padStart(2, "0")}${String(ci).padStart(2, "0")}`);
    }
  });
  return prefixes;
});

watch(
  () => fileRef.value,
  async () => {
    isDrag.value = false;
    const file = fileRef.value;
    if (!file) {
      resourceCaseCount.value = null;
      return;
    }
    if (!hasExistingTasks.value) {
      fileRef.value = null;
      return;
    }
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    const filenames = entries.map(({ filename }) => filename).filter((f) => !f.endsWith("/"));
    const prefixes = expectedPrefixes.value;
    const prefixSet = new Set(prefixes);
    const seenCases = new Set<string>();
    const seenTasks = new Set<string>();
    for (const name of filenames) {
      const base = name.split("/").pop() || name;
      const [prefix] = base.split("_");
      if (!prefixSet.has(prefix)) {
        alert(`ResourceData 檔名前綴不符測資結構: ${base}`);
        fileRef.value = null;
        return;
      }
      seenCases.add(prefix);
      seenTasks.add(prefix.slice(0, 2));
    }
    if (seenCases.size !== prefixSet.size) {
      alert("ResourceData 檔案數量與 TestData 測資數量不一致，請確認每個 case 都有對應資源。");
      fileRef.value = null;
      resourceCaseCount.value = null;
      return;
    }
    resourceCaseCount.value = seenTasks.size;
  },
);
</script>

<template>
  <div class="form-control col-span-2">
    <div class="flex flex-wrap items-center gap-3">
      <span class="label-text">{{ labelText }}</span>
      <label class="label cursor-pointer justify-start gap-x-2">
        <span class="label-text">Enable</span>
        <input
          type="checkbox"
          class="toggle"
          :disabled="Boolean(enableDisabledReason)"
          v-model="enableRef"
          @change="
            () => {
              if (!enableRef) fileRef = null;
            }
          "
        />
      </label>
      <i-uil-lock-alt v-if="enableDisabledReason" class="text-error" />
      <span v-if="showDisabledText" class="whitespace-nowrap text-sm text-error">
        {{ resourceDataWarning || enableDisabledReason }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <span
          v-if="resourceCaseCount !== null || hasRemoteAsset"
          class="badge badge-success badge-outline text-xs"
        >
          Current: {{ resourceCaseCount ?? remoteTaskCount ?? "remote" }} task(s)
        </span>
        <span v-else-if="fileRef" class="badge badge-success badge-outline text-xs"> Uploaded </span>
        <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
        <a
          v-if="downloadUrl && hasRemoteAsset"
          class="btn btn-xs"
          :href="downloadUrl"
          target="_blank"
          rel="noopener"
        >
          Download current
        </a>
      </div>
    </div>

    <div class="mt-2 overflow-hidden rounded-lg">
      <div class="grid grid-cols-5">
        <div class="col-span-1 flex items-center justify-center bg-base-300 text-sm">zip file</div>
        <div
          class="textarea-bordered col-span-4 flex flex-col bg-base-100 p-4"
          :class="[isDrag && 'border border-accent']"
          @drop.prevent="fileRef = enableRef && !enableDisabledReason ? $event.dataTransfer!.files![0] : null"
          @dragover.prevent="isDrag = enableRef && !enableDisabledReason"
          @dragleave="isDrag = false"
        >
          <div class="mb-2 text-sm opacity-70">
            {{
              enableDisabledReason
                ? enableDisabledReason
                : allowReadSatisfied
                ? enableRef
                  ? "Drop a zip file here"
                  : "Enable first, then upload"
                : "Enable Allow Read first"
            }}
          </div>

          <template v-if="!fileRef">
            <input
              type="file"
              accept=".zip"
              class="file-input file-input-bordered file-input-sm w-full"
              :disabled="!enableRef || Boolean(enableDisabledReason)"
              @change="
                (e: any) => {
                  const file = e.target.files?.[0];
                  if (file && !assertFileSizeOK(file, 'resourceDataZip')) {
                    e.target.value = '';
                    return;
                  }
                  fileRef = enableRef ? file || null : null;
                }
              "
            />
          </template>
          <template v-else>
            <div class="flex items-center">
              <span class="mr-3 font-medium">{{ fileRef.name }}</span>
              <button class="btn btn-sm" @click="fileRef = null">
                <i-uil-times />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
