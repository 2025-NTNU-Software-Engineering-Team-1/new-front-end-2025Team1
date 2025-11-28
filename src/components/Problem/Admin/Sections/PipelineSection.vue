<script setup lang="ts">
import { onMounted, inject, Ref, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import MultiStringInput from "../Controls/MultiStringInput.vue";
import api from "@/models/api";
import { assertFileSizeOK } from "@/utils/checkFileSize";

const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;

// ===============================================
// pipeline 完整層級
// ===============================================
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
          whitelist: { syntax: [], imports: [], headers: [], functions: [] },
          blacklist: { syntax: [], imports: [], headers: [], functions: [] },
        },
      },
      scoringScript: { custom: false },
    };
  } else {
    const libs = problem.value.pipeline.staticAnalysis?.libraryRestrictions;
    if (!libs) {
      problem.value.pipeline.staticAnalysis = {
        libraryRestrictions: {
          enabled: false,
          whitelist: { syntax: [], imports: [], headers: [], functions: [] },
          blacklist: { syntax: [], imports: [], headers: [], functions: [] },
        },
      };
    } else {
      ["whitelist", "blacklist"].forEach((key) => {
        if (!(libs as any)[key]) (libs as any)[key] = {};
        ["syntax", "imports", "headers", "functions"].forEach((f) => {
          if (!(libs as any)[key][f]) (libs as any)[key][f] = [];
        });
      });
    }
  }
}
ensurePipeline();

// ===============================================
// 後端 static-analysis options
// ===============================================
const libraryOptions = ref({
  imports: [] as string[],
  headers: [] as string[],
  functions: [] as string[],
});

// 不論後端有無資料都安全渲染
onMounted(async () => {
  let imports: string[] = [];
  let headers: string[] = [];
  let functions: string[] = [];
  try {
    const resp = await api.Problem.getStaticAnalysisOptions();
    const libs = (resp && resp.data && (resp.data as any).librarySymbols) || {};
    imports = Array.isArray(libs.imports) ? libs.imports : [];
    headers = Array.isArray(libs.headers) ? libs.headers : [];
    functions = Array.isArray(libs.functions) ? libs.functions : [];
  } catch (err) {
    console.warn("StaticAnalysisOptions fetch failed, using empty lists:", err);
  } finally {
    libraryOptions.value = { imports, headers, functions };
  }
});

// ===============================================
// 模式控制與開關 - 加入 watch 監聽切換時清空對方清單
// ===============================================
const syntaxMode = ref<"whitelist" | "blacklist">("whitelist");
const importMode = ref<"whitelist" | "blacklist">("whitelist");
const headerMode = ref<"whitelist" | "blacklist">("whitelist");
const functionMode = ref<"whitelist" | "blacklist">("whitelist");

// ===============================================
// 當 syntaxMode 切換時,清空另一方的清單
// ===============================================
watch(syntaxMode, (newMode: "whitelist" | "blacklist") => {
  const oppositeMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  problem.value.pipeline!.staticAnalysis!.libraryRestrictions![oppositeMode]!.syntax = [];
});
watch(importMode, (newMode: "whitelist" | "blacklist") => {
  const oppositeMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  problem.value.pipeline!.staticAnalysis!.libraryRestrictions![oppositeMode]!.imports = [];
});
watch(headerMode, (newMode: "whitelist" | "blacklist") => {
  const oppositeMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  problem.value.pipeline!.staticAnalysis!.libraryRestrictions![oppositeMode]!.headers = [];
});
watch(functionMode, (newMode: "whitelist" | "blacklist") => {
  const oppositeMode = newMode === "whitelist" ? "blacklist" : "whitelist";
  problem.value.pipeline!.staticAnalysis!.libraryRestrictions![oppositeMode]!.functions = [];
});

const defaultSyntaxOptions = ["while", "for", "recursive"];

// ===============================================
// 語言權限控制 (imports ➜ python, headers ➜ c/cpp)
// ===============================================
const allowImports = ref(false);
const allowHeaders = ref(false);
const route = useRoute();
watch(
  () => problem.value.allowedLanguage,
  (lang: number) => {
    allowImports.value = Boolean(lang & 4); // python
    allowHeaders.value = Boolean(lang & 1 || lang & 2); // c or cpp
  },
  { immediate: true },
);

// Execution Mode
watch(
  () => problem.value.pipeline!.executionMode,
  (newMode: string) => {
    if (newMode === "interactive") {
      problem.value.pipeline!.customChecker = false;
      if (problem.value.assets) {
        problem.value.assets.checkerPy = null;
      }
    }
  },
);

// ===============================================
// 共用邏輯與預設項目
// ===============================================
function toggleItem(arr: string[], item: string) {
  const idx = arr.indexOf(item);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(item);
}

function getAllowedFileExtensions(): string[] {
  const lang = problem.value.allowedLanguage;
  const list: string[] = [];
  if (lang & 1) list.push(".c");
  if (lang & 2) list.push(".cpp");
  if (lang & 4) list.push(".py");
  return list;
}

const assetPaths = computed<Record<string, string>>(
  () => ((problem.value.config as any)?.assetPaths as Record<string, string>) || {},
);

const hasAsset = (key: string) => Boolean(assetPaths.value && assetPaths.value[key]);
const assetDownloadUrl = (key: string) =>
  assetPaths.value && assetPaths.value[key] ? `/api/problem/${route.params.id}/asset/${key}/download` : null;
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <!-- File Process -->
    <div class="col-span-2 rounded-lg border border-gray-400 p-4">
      <div class="mb-2 text-sm font-semibold">File Process</div>
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

    <!-- Library Restrictions -->
    <div class="form-control col-span-2 rounded-lg border border-gray-400 p-4">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Library Restrictions</span>
        <input
          type="checkbox"
          class="toggle"
          v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions!.enabled"
        />
      </label>

      <div
        v-if="problem.pipeline!.staticAnalysis!.libraryRestrictions!.enabled"
        class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <!-- ===== 上排左邊：syntax ===== -->
        <div class="rounded-lg border border-gray-400 p-3">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text font-medium">Syntax Restrictions</h4>
            <!-- 滑動開關 -->
            <div class="mode-switcher">
              <div class="mode-switcher-container">
                <div
                  class="mode-switcher-slider"
                  :class="{ 'slider-blacklist': syntaxMode === 'blacklist' }"
                ></div>
                <button
                  class="mode-switcher-option"
                  :class="{ active: syntaxMode === 'whitelist' }"
                  @click="syntaxMode = 'whitelist'"
                >
                  <span>Whitelist</span>
                </button>
                <button
                  class="mode-switcher-option"
                  :class="{ active: syntaxMode === 'blacklist' }"
                  @click="syntaxMode = 'blacklist'"
                >
                  <span>Blacklist</span>
                </button>
              </div>
            </div>
          </div>

          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="opt in defaultSyntaxOptions"
              :key="`syntax-${opt}`"
              class="btn btn-xs"
              :class="
                problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax.includes(opt)
                  ? (syntaxMode === 'whitelist' ? 'btn-info' : 'btn-error')
                  : ''
              "
              @click="
                toggleItem(problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax, opt)
              "
            >
              {{ opt }}
            </button>
          </div>

          <div class="mt-2">
            <MultiStringInput
              v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions![syntaxMode]!.syntax"
              placeholder="Add syntax keyword"
              :badge-class="syntaxMode === 'whitelist' ? 'badge-info' : 'badge-error'"
            />
          </div>
        </div>

        <!-- ===== 上排右邊：imports ===== -->
        <div class="relative rounded-lg border border-gray-400 p-3">
          <!-- 禁用遮罩提示 -->
          <div
            v-if="!allowImports"
            class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-900/80 backdrop-blur-sm"
          >
            <div class="px-4 text-center">
              <i-uil-lock-alt class="mb-2 text-4xl text-warning" />
              <p class="text-sm font-medium text-gray-300">Imports Restrictions Disabled</p>
              <p class="mt-1 text-xs text-gray-400">Python language must be enabled to use this feature</p>
            </div>
          </div>

          <div class="mb-3 flex items-center justify-between">
            <h4 class="text font-medium">Imports Restrictions</h4>
            <!-- 滑動開關 -->
            <div class="mode-switcher">
              <div class="mode-switcher-container">
                <div
                  class="mode-switcher-slider"
                  :class="{ 'slider-blacklist': importMode === 'blacklist' }"
                ></div>
                <button
                  class="mode-switcher-option"
                  :class="{ active: importMode === 'whitelist' }"
                  @click="importMode = 'whitelist'"
                  :disabled="!allowImports"
                >
                  <span>Whitelist</span>
                </button>
                <button
                  class="mode-switcher-option"
                  :class="{ active: importMode === 'blacklist' }"
                  @click="importMode = 'blacklist'"
                  :disabled="!allowImports"
                >
                  <span>Blacklist</span>
                </button>
              </div>
            </div>
          </div>

          <div v-if="allowImports" class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="opt in libraryOptions.imports"
              :key="`import-${opt}`"
              class="btn btn-xs"
              :class="
                problem.pipeline!.staticAnalysis!.libraryRestrictions![importMode]!.imports.includes(opt)
                  ? (importMode === 'whitelist' ? 'btn-info' : 'btn-error')
                  : ''
              "
              @click="
                toggleItem(problem.pipeline!.staticAnalysis!.libraryRestrictions![importMode]!.imports, opt)
              "
            >
              {{ opt }}
            </button>
          </div>

          <div v-if="allowImports" class="mt-2">
            <MultiStringInput
              v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions![importMode]!.imports"
              placeholder="Add import"
              :badge-class="importMode === 'whitelist' ? 'badge-info' : 'badge-error'"
            />
          </div>
        </div>

        <!-- ===== 下排左邊：headers ===== -->
        <div class="relative rounded-lg border border-gray-400 p-3">
          <!-- 禁用遮罩提示 -->
          <div
            v-if="!allowHeaders"
            class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-900/80 backdrop-blur-sm"
          >
            <div class="px-4 text-center">
              <i-uil-lock-alt class="mb-2 text-4xl text-warning" />
              <p class="text-sm font-medium text-gray-300">Headers Restrictions Disabled</p>
              <p class="mt-1 text-xs text-gray-400">C or C++ language must be enabled to use this feature</p>
            </div>
          </div>

          <div class="mb-3 flex items-center justify-between">
            <h4 class="text font-medium">Headers Restrictions</h4>
            <!-- 滑動開關 -->
            <div class="mode-switcher">
              <div class="mode-switcher-container">
                <div
                  class="mode-switcher-slider"
                  :class="{ 'slider-blacklist': headerMode === 'blacklist' }"
                ></div>
                <button
                  class="mode-switcher-option"
                  :class="{ active: headerMode === 'whitelist' }"
                  @click="headerMode = 'whitelist'"
                  :disabled="!allowHeaders"
                >
                  <span>Whitelist</span>
                </button>
                <button
                  class="mode-switcher-option"
                  :class="{ active: headerMode === 'blacklist' }"
                  @click="headerMode = 'blacklist'"
                  :disabled="!allowHeaders"
                >
                  <span>Blacklist</span>
                </button>
              </div>
            </div>
          </div>

          <div v-if="allowHeaders" class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="opt in libraryOptions.headers"
              :key="`header-${opt}`"
              class="btn btn-xs"
              :class="
                problem.pipeline!.staticAnalysis!.libraryRestrictions![headerMode]!.headers.includes(opt)
                  ? (headerMode === 'whitelist' ? 'btn-info' : 'btn-error')
                  : ''
              "
              @click="
                toggleItem(problem.pipeline!.staticAnalysis!.libraryRestrictions![headerMode]!.headers, opt)
              "
            >
              {{ opt }}
            </button>
          </div>

          <div v-if="allowHeaders" class="mt-2">
            <MultiStringInput
              v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions![headerMode]!.headers"
              placeholder="Add header"
              :badge-class="headerMode === 'whitelist' ? 'badge-info' : 'badge-error'"
            />
          </div>
        </div>

        <!-- ===== 下排右邊：functions ===== -->
        <div class="rounded-lg border border-gray-400 p-3">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text font-medium">Functions Restrictions</h4>
            <!-- 滑動開關 -->
            <div class="mode-switcher">
              <div class="mode-switcher-container">
                <div
                  class="mode-switcher-slider"
                  :class="{ 'slider-blacklist': functionMode === 'blacklist' }"
                ></div>
                <button
                  class="mode-switcher-option"
                  :class="{ active: functionMode === 'whitelist' }"
                  @click="functionMode = 'whitelist'"
                >
                  <span>Whitelist</span>
                </button>
                <button
                  class="mode-switcher-option"
                  :class="{ active: functionMode === 'blacklist' }"
                  @click="functionMode = 'blacklist'"
                >
                  <span>Blacklist</span>
                </button>
              </div>
            </div>
          </div>

          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="opt in libraryOptions.functions"
              :key="`func-${opt}`"
              class="btn btn-xs"
              :class="
                problem.pipeline!.staticAnalysis!.libraryRestrictions![functionMode]!.functions.includes(opt)
                  ? (functionMode === 'whitelist' ? 'btn-info' : 'btn-error')
                  : ''
              "
              @click="
                toggleItem(
                  problem.pipeline!.staticAnalysis!.libraryRestrictions![functionMode]!.functions,
                  opt,
                )
              "
            >
              {{ opt }}
            </button>
          </div>

          <div class="mt-2">
            <MultiStringInput
              v-model="problem.pipeline!.staticAnalysis!.libraryRestrictions![functionMode]!.functions"
              placeholder="Add function"
              :badge-class="functionMode === 'whitelist' ? 'badge-info' : 'badge-error'"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- === Execution mode (with all mode-linked fields) === -->
    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <label class="label mb-2">
          <span class="label-text">Execution Mode</span>
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
            <span class="label-text">General</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="functionOnly"
              v-model="(problem.pipeline!.executionMode as any)"
            />
            <span class="label-text">Function Only</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input
              type="radio"
              class="radio"
              value="interactive"
              v-model="(problem.pipeline!.executionMode as any)"
            />
            <span class="label-text">Interactive</span>
          </label>
        </div>

        <!-- General mode fields -->

        <!-- functionOnly fields -->
        <div
          v-if="problem.pipeline!.executionMode === 'functionOnly'"
          class="rounded-lg border border-gray-400 p-4"
        >
          <!-- makefile.zip -->
          <div class="form-control">
            <label class="label justify-start gap-x-4">
              <span class="label-text">Upload Makefile.zip</span>
              <div class="flex items-center gap-2">
                <div v-if="hasAsset('makefile')" class="flex items-center gap-2">
                  <span class="badge badge-success badge-outline text-xs">Uploaded</span>
                  <a
                    :href="assetDownloadUrl('makefile') || '#'"
                    class="btn btn-xs"
                    target="_blank"
                    rel="noopener"
                  >
                    Download
                  </a>
                </div>
                <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
              </div>
            </label>
            <input
              type="file"
              accept=".zip"
              class="file-input file-input-bordered file-input-sm w-56"
              @change="
                (e: any) => {
                  const file = e.target.files?.[0];
                  if (file && !assertFileSizeOK(file, 'makefileZip')) {
                    e.target.value = '';
                    return;
                  }
                  problem.assets!.makefileZip = file || null;
                }
              "
            />
          </div>
        </div>

        <!-- interactive fields -->
        <div
          v-if="problem.pipeline!.executionMode === 'interactive'"
          class="rounded-lg border border-gray-400 p-4"
        >
          <!-- Teacher first & Teacher_file -->
          <div class="form-control">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <!-- 左：Teacher first -->
              <label class="label mb-0 cursor-pointer justify-start gap-x-2">
                <span class="label-text flex items-center gap-1">Teacher First</span>
                <input type="checkbox" class="toggle toggle-sm" v-model="problem.pipeline!.teacherFirst" />
              </label>

              <!-- 右：Teacher_Code -->
              <div class="flex flex-col">
                <div class="flex items-center gap-x-2">
                  <span class="text-sm opacity-80">Upload Teacher_Code</span>
                  <div class="flex items-center gap-2">
                    <div v-if="hasAsset('teacher_file')" class="flex items-center gap-2">
                      <span class="badge badge-success badge-outline text-xs">Uploaded</span>
                      <a
                        :href="assetDownloadUrl('teacher_file') || '#'"
                        class="btn btn-xs"
                        target="_blank"
                        rel="noopener"
                      >
                        Download
                      </a>
                    </div>
                    <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
                  </div>
                  <input
                    type="file"
                    :accept="getAllowedFileExtensions().join(',')"
                    class="file-input file-input-bordered file-input-sm w-56"
                    @change="
                      (e: any) => {
                        const file = (e.target.files as FileList)?.[0] || null;
                        if (file && getAllowedFileExtensions().some((ext: string) => file.name.endsWith(ext))) {
                          if (!assertFileSizeOK(file, 'teacherFile')) {
                            (e.target as HTMLInputElement).value = '';
                            problem.assets!.teacherFile = null;
                            return;
                          }

                          problem.assets!.teacherFile = file;
                        } else {
                          problem.assets!.teacherFile = null;
                          (e.target as HTMLInputElement).value = '';
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
    </div>

    <!-- Custom checker (shared) -->
    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <div class="flex items-center gap-4">
          <label class="label cursor-pointer justify-start gap-x-4">
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
              class="toggle"
              v-model="problem.pipeline!.customChecker"
              :disabled="problem.pipeline!.executionMode === 'interactive'"
            />
          </label>

          <div class="flex items-center gap-2">
            <div v-if="hasAsset('checker')" class="flex items-center gap-2">
              <span class="badge badge-success badge-outline text-xs">Uploaded</span>
              <a :href="assetDownloadUrl('checker') || '#'" class="btn btn-xs" target="_blank" rel="noopener">
                Download
              </a>
            </div>
            <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
          </div>
        </div>

        <div v-if="problem.pipeline!.customChecker" class="flex items-center gap-x-2">
          <span class="text-sm opacity-80">Upload Checker.py</span>
          <input
            type="file"
            accept=".py"
            class="file-input file-input-bordered file-input-sm w-56"
            :disabled="problem.pipeline!.executionMode === 'interactive'"
            @change="
              (e: any) => {
                const file = e.target.files?.[0];
                if (file && !assertFileSizeOK(file, 'checker.py')) {
                  e.target.value = '';
                  return;
                }
                problem.assets!.checkerPy = file || null;
              }
            "
          />
        </div>
        <div v-else class="text-xs opacity-70">
          {{
            problem.pipeline!.executionMode === "interactive"
              ? "Custom Checker disabled in Interactive mode."
              : "Enable to upload Checker.py"
          }}
        </div>
      </div>
    </div>

    <!-- Custom Scoring Script -->
    <div class="form-control col-span-1 md:col-span-2">
      <div class="rounded-lg border border-gray-400 p-4">
        <div class="flex items-center gap-4">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Custom Scoring Script</span>
            <input type="checkbox" class="toggle" v-model="(problem as any).pipeline.scoringScript.custom" />
          </label>
          <div class="flex items-center gap-2">
            <div v-if="hasAsset('scoring_script')" class="flex items-center gap-2">
              <span class="badge badge-success badge-outline text-xs">Uploaded</span>
              <a
                :href="assetDownloadUrl('scoring_script') || '#'"
                class="btn btn-xs"
                target="_blank"
                rel="noopener"
              >
                Download
              </a>
            </div>
            <span v-else class="badge badge-outline text-xs opacity-70">Not Uploaded</span>
          </div>
        </div>

        <div v-if="(problem as any).pipeline.scoringScript?.custom" class="flex items-center gap-x-2">
          <span class="text-sm opacity-80">Upload Score.py</span>
          <input
            type="file"
            accept=".py"
            class="file-input file-input-bordered file-input-sm w-56"
            @change="
              (e: any) => {
                const file = e.target.files?.[0];
                if (file && !assertFileSizeOK(file, 'scorePy')) {
                  e.target.value = '';
                  return;
                }
                problem.assets!.scorePy = file || null;
              }
            "
          />
        </div>
        <div v-else class="text-xs opacity-70">Enable to upload Score.py</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 黑白名單切換器 */
.mode-switcher {
  display: flex;
  align-items: center;
}

.mode-switcher-container {
  position: relative;
  display: inline-flex;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
  padding: 3px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.mode-switcher-slider {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 9px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4), 0 0 20px rgba(59, 130, 246, 0.2);
  z-index: 1;
}

.mode-switcher-slider.slider-blacklist {
  transform: translateX(calc(100% + 3px));
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.2);
}

.mode-switcher-option {
  position: relative;
  z-index: 2;
  padding: 6px 16px;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  border-radius: 9px;
}

.mode-switcher-option:hover {
  color: rgba(255, 255, 255, 0.8);
}

.mode-switcher-option.active {
  color: white;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.mode-switcher-option:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@keyframes pulse-warning {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.mode-switcher-option:disabled {
  animation: pulse-warning 2s ease-in-out infinite;
}

@media (max-width: 640px) {
  .mode-switcher-option {
    padding: 5px 12px;
    font-size: 0.7rem;
  }
}
</style>
