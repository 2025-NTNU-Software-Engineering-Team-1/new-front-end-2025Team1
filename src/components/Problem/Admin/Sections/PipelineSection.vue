<script setup lang="ts">
import { ZipReader, BlobReader } from "@zip.js/zip.js";
import MultiStringInput from "../Controls/MultiStringInput.vue";
import { inject, Ref, ref, onMounted } from "vue";
import api from "@/models/api";

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
      staticAnalysis: {
        libraryRestrictions: {
          enabled: false,
          whitelist: [],
          blacklist: [],
        },
      },
      scoringScript: { custom: false },
    };
  }
  if (!problem.value.assets) {
    problem.value.assets = {
      checkerPy: null,
      makefileZip: null,
      teacherFile: null,
      scorePy: null,
      localServiceZip: null,
      testdataZip: null,
    };
  }
}
ensurePipeline();

const isDrag = ref(false);
const libraryOptions = ref<string[]>([]);
onMounted(async () => {
  try {
    const resp = await api.Problem.getStaticAnalysisOptions();
    libraryOptions.value = resp.data?.librarySymbols || [];
  } catch {
    libraryOptions.value = [];
  }
});

function toggleArray(arr: string[], value: string) {
  const idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);
}

function getAllowedFileExtensions(): string[] {
  const lang = problem.value.allowedLanguage;
  const list: string[] = [];
  if (lang & 1) list.push(".c");
  if (lang & 2) list.push(".cpp");
  if (lang & 4) list.push(".py");
  return list;
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <!-- File Process -->
    <div class="col-span-2 rounded-lg border border-base-300 p-3">
      <div class="mb-2 text-sm">File Process</div>
      <div class="flex gap-x-8">
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-2">
            <span class="label-text">fopen</span>
            <input type="checkbox" class="toggle" v-model="problem.pipeline!.fopen" />
          </label>
        </div>
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-2">
            <span class="label-text">fwrite</span>
            <input type="checkbox" class="toggle" v-model="problem.pipeline!.fwrite" />
          </label>
        </div>
      </div>
    </div>

    <!-- Library restrictions -->
    <div class="form-control col-span-1 md:col-span-2">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Library restrictions</span>
        <input
          type="checkbox"
          class="toggle"
          v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions!.enabled"
        />
      </label>
      <div
        v-if="problem.pipeline!.staticAnalysis!.libraryRestrictions!.enabled"
        class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <div>
          <div class="label-text mb-1">Whitelist</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="sym in libraryOptions"
              :key="`w-${sym}`"
              class="btn btn-xs"
              :class="problem.pipeline!.staticAnalysis!.libraryRestrictions!.whitelist.includes(sym) && 'btn-accent'"
              @click="toggleArray(problem.pipeline!.staticAnalysis!.libraryRestrictions!.whitelist, sym)"
            >
              {{ sym }}
            </button>
          </div>
        </div>
        <div>
          <div class="label-text mb-1">Blacklist</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="sym in libraryOptions"
              :key="`b-${sym}`"
              class="btn btn-xs"
              :class="problem.pipeline!.staticAnalysis!.libraryRestrictions!.blacklist.includes(sym) && 'btn-error text-base-100'"
              @click="toggleArray(problem.pipeline!.staticAnalysis!.libraryRestrictions!.blacklist, sym)"
            >
              {{ sym }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- === Execution mode (with all mode-linked fields) === -->
    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-base-300 p-4">
        <label class="label mb-2">
          <span class="label-text font-semibold">Execution mode</span>
        </label>

        <!-- radio options -->
        <div class="mb-4 flex flex-wrap gap-6">
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

        <!-- Custom checker -->
        <div class="form-control mb-3">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label class="label mb-0 cursor-pointer justify-start gap-x-2">
              <span class="label-text flex items-center gap-1">
                <span>Custom Checker</span>
                <i-uil-lock-alt
                  v-if="problem.pipeline!.executionMode === 'interactive'"
                  class="text-error"
                  title="Disabled in interactive mode"
                />
              </span>
              <input
                type="checkbox"
                class="toggle toggle-sm"
                v-model="problem.pipeline!.customChecker"
                :disabled="problem.pipeline!.executionMode === 'interactive'"
              />
            </label>

            <div
              v-if="problem.pipeline!.customChecker && problem.pipeline!.executionMode !== 'interactive'"
              class="flex items-center gap-x-2"
            >
              <span class="text-sm opacity-80">Upload checker.py</span>
              <input
                type="file"
                accept=".py"
                class="file-input file-input-bordered file-input-sm w-56"
                @change="(e: any) => (problem.assets!.checkerPy = e.target.files?.[0] || null)"
              />
            </div>
          </div>
        </div>

        <!-- functionOnly makefile.zip -->
        <div v-if="problem.pipeline!.executionMode === 'functionOnly'" class="form-control mb-3">
          <label class="label"><span class="label-text">Upload makefile.zip</span></label>
          <input
            type="file"
            accept=".zip"
            class="file-input file-input-bordered file-input-sm w-56"
            @change="(e: any) => (problem.assets!.makefileZip = e.target.files?.[0] || null)"
          />
        </div>

        <!-- interactive 模式 -->
        <div
          v-if="problem.pipeline!.executionMode === 'interactive'"
          class="form-control col-span-1 md:col-span-2"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <!-- 左：Teacher first -->
            <label class="label mb-0 cursor-pointer justify-start gap-x-2">
              <span class="label-text flex items-center gap-1">Teacher first</span>
              <input type="checkbox" class="toggle toggle-sm" v-model="problem.pipeline!.teacherFirst" />
            </label>

            <!-- 右：Teacher_file -->
            <div class="flex flex-col">
              <div class="flex items-center gap-x-2">
                <span class="text-sm opacity-80">Upload Teacher_file</span>
                <input
                  type="file"
                  :accept="getAllowedFileExtensions().join(',')"
                  class="file-input file-input-bordered file-input-sm w-56"
                  @change="
                    (e: any) => {
                      const file = (e.target.files as FileList)?.[0] || null;
                      // 僅當符合副檔名才塞入
                      if (file && getAllowedFileExtensions().some((ext) => file.name.endsWith(ext))) {
                        problem.assets!.teacherFile = file;
                      } else {
                        problem.assets!.teacherFile = null;
                      }
                    }
                  "
                />
              </div>
              <span class="label-text-alt mt-1 text-sm opacity-70">
                Allowed: {{ getAllowedFileExtensions().join(", ") }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Scoring Script -->
    <div class="form-control col-span-1 md:col-span-2">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Custom Scoring Script</span>
        <input type="checkbox" class="toggle" v-model="(problem as any).pipeline.scoringScript.custom" />
      </label>
      <div v-if="(problem as any).pipeline.scoringScript?.custom" class="mt-2">
        <div class="form-control">
          <label class="label"><span class="label-text">Upload score.py</span></label>
          <input
            type="file"
            accept=".py"
            class="file-input file-input-bordered"
            @change="(e: any) => (problem.assets!.scorePy = e.target.files?.[0] || null)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
