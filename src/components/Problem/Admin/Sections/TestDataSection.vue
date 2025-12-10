<script setup lang="ts">
import { inject, Ref, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { ZipReader, BlobReader } from "@zip.js/zip.js";
import { assertFileSizeOK } from "@/utils/checkFileSize";

defineProps<{ v$: any }>();

const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;
const isDrag = ref(false);
const route = useRoute();
const downloadUrl = computed(() => {
  const id = route.params.id;
  if (!id || Array.isArray(id)) return null;
  return `/api/problem/${id}/testcase`;
});
const hasRemoteTestcase = computed(
  () => Boolean((problem.value.config as any)?.assetPaths?.case),
);
const hasExistingTasks = computed(() => (problem.value.testCaseInfo?.tasks?.length ?? 0) > 0);
const hasBackendTestcase = computed(() => hasExistingTasks.value || hasRemoteTestcase.value);
const currentTaskLabel = computed(() => {
  if (!hasBackendTestcase.value) return "";
  const len = problem.value.testCaseInfo?.tasks?.length ?? 0;
  return len > 0 ? `${len} task(s)` : "remote";
});

watch(
  () => problem.value.assets?.testdataZip,
  async () => {
    isDrag.value = false;
    const file = problem.value.assets?.testdataZip;
    if (!file) {
      problem.value.testCaseInfo = { ...problem.value.testCaseInfo, tasks: [] };
      return;
    }

    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    const filenames = entries.map(({ filename }) => filename);
    const inputs = filenames.filter((f) => f.endsWith(".in"));
    const outputs = filenames.filter((f) => f.endsWith(".out"));
    if (inputs.length !== outputs.length) {
      alert(`Input and output 文件不對稱。（in=${inputs.length}, out=${outputs.length})`);
      problem.value.assets!.testdataZip = null;
      return;
    }
    let i = 0;
    const tasks = [];
    while (true) {
      const count = inputs.filter((fn) => fn.startsWith(`0${i}`.slice(-2))).length;
      if (count > 0) {
        tasks.push({ caseCount: count, memoryLimit: 134218, taskScore: 0, timeLimit: 1000 });
        i++;
      } else break;
    }
    if (tasks.length > 0) problem.value.testCaseInfo = { ...problem.value.testCaseInfo, tasks };
    else alert("未在 zip 找到測資。");
  },
);
</script>

<template>
  <div class="form-control col-span-2">
    <label class="label">
      <span class="label-text">Test Data Zip</span>
      <div class="flex items-center gap-2">
        <span v-if="hasBackendTestcase" class="badge badge-success badge-outline text-xs">
          Current: {{ currentTaskLabel }}
        </span>
        <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
        <a
          v-if="hasBackendTestcase && downloadUrl"
          class="btn btn-xs"
          :href="downloadUrl"
          target="_blank"
          rel="noopener"
        >
          Download current
        </a>
      </div>
    </label>

    <!-- Test Data Upload Row -->
    <div class="mt-2 overflow-hidden rounded-lg">
      <div class="grid grid-cols-5">
        <!-- 左側灰底區 -->
        <div class="col-span-1 flex items-center justify-center bg-base-300 text-sm">zip file</div>

        <!-- 右側白底上傳區 -->
        <div
          class="textarea-bordered col-span-4 flex flex-col bg-base-100 p-4"
          :class="[isDrag && 'border border-accent']"
          @drop.prevent="problem.assets!.testdataZip = $event.dataTransfer!.files![0]"
          @dragover.prevent="isDrag = true"
          @dragleave="isDrag = false"
        >
          <!-- 永遠在上方顯示 -->
          <div class="mb-2 text-sm opacity-70">Drop a zip file here</div>

          <!-- 選擇或顯示檔案 -->
          <template v-if="!problem.assets!.testdataZip">
            <input
              type="file"
              accept=".zip"
              class="file-input file-input-bordered file-input-sm w-full"
              @change="
                (e: any) => {
                  const file = e.target.files?.[0];
                  if (file && !assertFileSizeOK(file, 'testdataZip')) {
                    e.target.value = '';
                    return;
                  }
                  problem.assets!.testdataZip = file || null;
                }
              "
            />
          </template>
          <template v-else>
            <div class="flex items-center">
              <span class="mr-3 font-medium">{{ problem.assets!.testdataZip.name }}</span>
              <button class="btn btn-sm" @click="problem.assets!.testdataZip = null">
                <i-uil-times />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 驗證錯誤訊息 -->
    <label
      class="label text-error"
      v-show="v$.testCaseInfo.tasks.$error"
      v-text="v$.testCaseInfo.tasks.$errors[0]?.$message"
    />

    <!-- Tasks 表格 -->
    <template v-for="(t, i) in problem.testCaseInfo.tasks" :key="i">
      <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div class="form-control">
          <label class="label"><span class="label-text">#Cases</span></label>
          <input type="text" class="input input-bordered" :value="t.caseCount" readonly />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Score</span></label>
          <input
            type="number"
            class="input input-bordered"
            :value="t.taskScore"
            @input="
              problem.testCaseInfo.tasks[i].taskScore = Number(($event.target as HTMLInputElement).value)
            "
          />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Memory limit (KB)</span></label>
          <input
            type="number"
            class="input input-bordered"
            :value="t.memoryLimit"
            @input="
              problem.testCaseInfo.tasks[i].memoryLimit = Number(($event.target as HTMLInputElement).value)
            "
          />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Time limit (ms)</span></label>
          <input
            type="number"
            class="input input-bordered"
            :value="t.timeLimit"
            @input="
              problem.testCaseInfo.tasks[i].timeLimit = Number(($event.target as HTMLInputElement).value)
            "
          />
        </div>
      </div>
    </template>
  </div>
</template>
