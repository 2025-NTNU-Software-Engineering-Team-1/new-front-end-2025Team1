<script setup lang="ts">
import { inject, Ref, ref, watch } from "vue";
import { ZipReader, BlobReader } from "@zip.js/zip.js";

defineProps<{ v$: any }>();
const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;

function ensurePipeline() {
  if (!problem.value.pipeline) {
    problem.value.pipeline = {
      fopen: false,
      fwrite: false,
      executionMode: "general",
      customChecker: false,
      teacherFirst: false,
    };
  }
  if (!problem.value.assets) {
    problem.value.assets = {
      checkerPy: null,
      makefileZip: null,
      teacherFile: null,
      scorePy: null,
      scoreJson: null,
      localServiceZip: null,
      testdataZip: null,
    };
  }
}
ensurePipeline();

// drag state for testdata area
const isDrag = ref(false);

// parse testdata zip like original logic
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
      alert(`Input and output files are not matched. (got ${inputs.length} .in, ${outputs.length} .out)`);
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
    if (tasks.length > 0) {
      problem.value.testCaseInfo = { ...problem.value.testCaseInfo, tasks };
    } else {
      alert("No Test Data found in the zip file! (Only files required, no folders)");
    }
  },
);
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <!-- fopen -->
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">fopen</span>
        <input type="checkbox" class="toggle" v-model="problem.pipeline!.fopen" />
      </label>
    </div>

    <!-- fwrite -->
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">fwrite</span>
        <input type="checkbox" class="toggle" v-model="problem.pipeline!.fwrite" />
      </label>
    </div>

    <!-- execution mode -->
    <div class="form-control col-span-1 md:col-span-2">
      <label class="label"><span class="label-text">Execution mode</span></label>
      <div class="flex gap-6">
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio"
            value="general"
            v-model="(problem.pipeline!.executionMode as any)"
          />
          <span class="label-text">general</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio"
            value="functionOnly"
            v-model="(problem.pipeline!.executionMode as any)"
          />
          <span class="label-text">functionOnly</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio"
            value="interactive"
            v-model="(problem.pipeline!.executionMode as any)"
          />
          <span class="label-text">interactive</span>
        </label>
      </div>
    </div>

    <!-- general/functionOnly custom checker -->
    <div
      v-if="problem.pipeline!.executionMode === 'general' || problem.pipeline!.executionMode === 'functionOnly'"
      class="form-control"
    >
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Custom checker</span>
        <input type="checkbox" class="toggle" v-model="problem.pipeline!.customChecker" />
      </label>
      <div v-if="problem.pipeline!.customChecker" class="mt-2">
        <label class="label"><span class="label-text">Upload checker.py</span></label>
        <input
          type="file"
          accept=".py"
          class="file-input file-input-bordered"
          @change="(e:any) => problem.assets!.checkerPy = e.target.files?.[0] || null"
        />
      </div>
    </div>

    <!-- functionOnly makefile.zip -->
    <div v-if="problem.pipeline!.executionMode === 'functionOnly'" class="form-control">
      <label class="label"><span class="label-text">Upload makefile.zip</span></label>
      <input
        type="file"
        accept=".zip"
        class="file-input file-input-bordered"
        @change="(e:any) => problem.assets!.makefileZip = e.target.files?.[0] || null"
      />
    </div>

    <!-- interactive -->
    <div
      v-if="problem.pipeline!.executionMode === 'interactive'"
      class="form-control col-span-1 md:col-span-2"
    >
      <label class="label"><span class="label-text">Upload Teacher_file</span></label>
      <input
        type="file"
        class="file-input file-input-bordered"
        @change="(e:any) => problem.assets!.teacherFile = e.target.files?.[0] || null"
      />
      <label class="label mt-2 cursor-pointer justify-start gap-x-4">
        <span class="label-text">Teacher first</span>
        <input type="checkbox" class="toggle" v-model="problem.pipeline!.teacherFirst" />
      </label>
    </div>

    <!-- testdata upload -->
    <div class="form-control col-span-1 md:col-span-2">
      <label class="label"><span class="label-text">Test data</span></label>
      <div
        :class="['textarea textarea-bordered w-full p-4', isDrag ? 'border-accent' : '']"
        @drop.prevent="problem.assets!.testdataZip = $event.dataTransfer!.files![0]"
        @dragover.prevent="isDrag = true"
        @dragleave="isDrag = false"
      >
        <template v-if="!problem.assets!.testdataZip">
          <span class="mb-6 mr-6 text-sm">Drop a .zip file here</span>
          <input
            type="file"
            accept=".zip"
            @change="(e:any) => {
              problem.assets!.testdataZip = e.target.files?.[0] || null;
              console.log('現在選擇的 testdataZip：', problem.assets!.testdataZip);
            }"
          />
        </template>
        <template v-else>
          <div class="flex">
            <span class="mr-3">{{ problem.assets!.testdataZip?.name }}</span>
            <button class="btn btn-sm" @click="problem.assets!.testdataZip = null">
              <i-uil-times />
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- scoring script -->
    <div class="form-control col-span-1 md:col-span-2">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Scoring script - Custom</span>
        <!-- You can keep this flag under pipeline.scoringScript = { custom: boolean } -->
        <input type="checkbox" class="toggle" v-model="(problem as any).pipeline.scoringScript.custom" />
      </label>
      <div v-if="(problem as any).pipeline.scoringScript?.custom" class="mt-2 grid gap-3 md:grid-cols-2">
        <div class="form-control">
          <label class="label"><span class="label-text">Upload score.py</span></label>
          <input
            type="file"
            accept=".py"
            class="file-input file-input-bordered"
            @change="(e:any) => problem.assets!.scorePy = e.target.files?.[0] || null"
          />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Upload score.json</span></label>
          <input
            type="file"
            accept=".json"
            class="file-input file-input-bordered"
            @change="(e:any) => problem.assets!.scoreJson = e.target.files?.[0] || null"
          />
        </div>
      </div>
    </div>

    <!-- show and edit subtasks -->
    <label
      class="label text-error"
      v-show="v$.testCaseInfo.tasks.$error"
      v-text="v$.testCaseInfo.tasks.$errors[0]?.$message"
    />
    <template v-for="(t, i) in problem.testCaseInfo.tasks" :key="i">
      <div class="col-span-1 md:col-span-2">
        <div class="font-semibold">Subtask {{ i + 1 }}</div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div class="form-control">
            <label class="label"><span class="label-text">#Cases</span></label>
            <input type="text" class="input input-bordered w-full max-w-xs" :value="t.caseCount" readonly />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Score</span></label>
            <input
              type="number"
              class="input input-bordered w-full max-w-xs"
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
              class="input input-bordered w-full max-w-xs"
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
              class="input input-bordered w-full max-w-xs"
              :value="t.timeLimit"
              @input="
                problem.testCaseInfo.tasks[i].timeLimit = Number(($event.target as HTMLInputElement).value)
              "
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
