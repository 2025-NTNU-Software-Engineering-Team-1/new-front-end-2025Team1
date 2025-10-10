<script setup lang="ts">
import { ref, inject, Ref, computed } from "vue";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, minValue, between, helpers } from "@vuelidate/validators";
import type { ProblemDraftV2 } from "@/types/problem-v2";

const problem = inject<Ref<ProblemDraftV2>>("problem") as Ref<ProblemDraftV2>;

const isLoading = ref(false);
const errorMsg = ref("");
defineExpose({ isLoading, errorMsg });

const emits = defineEmits<{
  (e: "update", key: keyof ProblemDraftV2, value: ProblemDraftV2[typeof key]): void;
  (e: "submit"): void;
}>();

function update<K extends keyof ProblemDraftV2>(key: K, value: ProblemDraftV2[K]) {
  emits("update", key, value);
}

function updateDescription<K extends keyof ProblemDraftV2["description"]>(key: K, value: ProblemDraftV2["description"][K]) {
  emits("update", "description", { ...problem.value.description, [key]: value });
}

function updateConfiguration<K extends keyof ProblemDraftV2["configuration"]>(
  key: K,
  value: ProblemDraftV2["configuration"][K],
) {
  emits("update", "configuration", { ...problem.value.configuration, [key]: value });
}

function updateConfigurationStaticAnalysis<K extends keyof ProblemDraftV2["configuration"]["staticAnalysis"]>(
  key: K,
  value: ProblemDraftV2["configuration"]["staticAnalysis"][K],
) {
  emits("update", "configuration", {
    ...problem.value.configuration,
    staticAnalysis: { ...problem.value.configuration.staticAnalysis, [key]: value },
  });
}

function updateLibraryRestrictions<
  K extends keyof ProblemDraftV2["configuration"]["staticAnalysis"]["libraryRestrictions"]
>(key: K, value: ProblemDraftV2["configuration"]["staticAnalysis"]["libraryRestrictions"][K]) {
  updateConfigurationStaticAnalysis("libraryRestrictions", {
    ...problem.value.configuration.staticAnalysis.libraryRestrictions,
    [key]: value,
  });
}

function updateNetworkFirewall<
  K extends keyof ProblemDraftV2["configuration"]["staticAnalysis"]["networkAccessRestriction"]["firewallExtranet"]
>(key: K, value: ProblemDraftV2["configuration"]["staticAnalysis"]["networkAccessRestriction"]["firewallExtranet"][K]) {
  const p = problem.value.configuration.staticAnalysis.networkAccessRestriction;
  updateConfigurationStaticAnalysis("networkAccessRestriction", {
    ...p,
    firewallExtranet: { ...p.firewallExtranet, [key]: value },
  });
}

function updateNetworkLocal<
  K extends keyof ProblemDraftV2["configuration"]["staticAnalysis"]["networkAccessRestriction"]["connectWithLocal"]
>(key: K, value: ProblemDraftV2["configuration"]["staticAnalysis"]["networkAccessRestriction"]["connectWithLocal"][K]) {
  const p = problem.value.configuration.staticAnalysis.networkAccessRestriction;
  updateConfigurationStaticAnalysis("networkAccessRestriction", {
    ...p,
    connectWithLocal: { ...p.connectWithLocal, [key]: value },
  });
}

function updatePipeline<K extends keyof ProblemDraftV2["pipeline"]>(key: K, value: ProblemDraftV2["pipeline"][K]) {
  emits("update", "pipeline", { ...problem.value.pipeline, [key]: value });
}

function updateExecutionMode<K extends keyof ProblemDraftV2["pipeline"]["executionMode"]>(
  key: K,
  value: ProblemDraftV2["pipeline"]["executionMode"][K],
) {
  updatePipeline("executionMode", { ...problem.value.pipeline.executionMode, [key]: value });
}

function updateExecutionModeSection<
  T extends "general" | "functionOnly" | "interactive",
  K extends keyof ProblemDraftV2["pipeline"]["executionMode"][T]
>(section: T, key: K, value: ProblemDraftV2["pipeline"]["executionMode"][T][K]) {
  const em = problem.value.pipeline.executionMode;
  updateExecutionMode(section, { ...(em as any)[section], [key]: value } as any);
}

function updateScoring<K extends keyof ProblemDraftV2["pipeline"]["scoringAndTestcase"]>(
  key: K,
  value: ProblemDraftV2["pipeline"]["scoringAndTestcase"][K],
) {
  updatePipeline("scoringAndTestcase", { ...problem.value.pipeline.scoringAndTestcase, [key]: value });
}

function updateTestCaseInfo<K extends keyof ProblemDraftV2["pipeline"]["scoringAndTestcase"]["testCaseInfo"]>(
  key: K,
  value: ProblemDraftV2["pipeline"]["scoringAndTestcase"]["testCaseInfo"][K],
) {
  const sc = problem.value.pipeline.scoringAndTestcase;
  updateScoring("testCaseInfo", { ...sc.testCaseInfo, [key]: value });
}

// Reserved options for library list (fill via backend later)
const availableLibraries = ref<string[]>([]);

// Validators
const oneOf = (arr: any[]) => helpers.withMessage(`Value must be one of: ${arr.join(", ")}`, (v: any) => arr.includes(v));
const uniqueArray = helpers.withMessage("Duplicate values are not allowed", (arr: string[]) => {
  const set = new Set(arr.filter(Boolean));
  return set.size === arr.filter(Boolean).length;
});
const nonEmptyIfEnabled = (isEnabledGetter: () => boolean) =>
  helpers.withMessage("At least one item required", (arr: string[]) => {
    return !isEnabledGetter() || arr.filter((s) => s && s.trim() !== "").length >= 1;
  });

const v$ = useVuelidate(
  computed(() => {
    const p = problem.value;
    return {
      problemName: { required, maxLength: maxLength(64) },
      status: {},
      courses: {},

      description: {
        tags: {
          uniqueArray,
          itemMaxLength: helpers.withMessage(
            "Each tag length should be <= 16",
            (v: string[]) => v.every((d) => d.length <= 16),
          ),
        },
        allowedLanguage: { required, between: between(1, 7) },
        quota: { required, minValue: minValue(-1) },
        description: { maxLength: maxLength(10000) },
        input: { maxLength: maxLength(10000) },
        output: { maxLength: maxLength(10000) },
        hint: { maxLength: maxLength(10000) },
        sampleInput: {
          itemMaxLength: helpers.withMessage(
            "The length of each sample input should <= 1024",
            (v: string[]) => v.every((d) => d.length <= 1024),
          ),
        },
        sampleOutput: {
          itemMaxLength: helpers.withMessage(
            "The length of each sample output should <= 1024",
            (v: string[]) => v.every((d) => d.length <= 1024),
          ),
        },
      },

      configuration: {
        compilation: {},
        testMode: {},
        aiVTuber: {},
        acceptedFormat: { required, oneOf: oneOf(["code", "zip"]) },
        artifactCollection: {
          uniqueArray,
          itemOneOf: helpers.withMessage(
            "Invalid artifact type",
            (v: string[]) => v.every((d) => ["compiledBinary", "zip"].includes(d)),
          ),
        },
        staticAnalysis: {
          default: {},
          libraryRestrictions: {
            isEnabled: {},
            whitelist: {
              nonEmptyIfEnabled: nonEmptyIfEnabled(
                () => p.configuration.staticAnalysis.libraryRestrictions.isEnabled,
              ),
            },
            blacklist: {},
          },
          networkAccessRestriction: {
            firewallExtranet: {
              isEnabled: {},
              whitelist: {},
              blacklist: {},
            },
            connectWithLocal: {
              isEnabled: {},
              whitelist: {},
              blacklist: {},
              localService: {},
            },
          },
        },
      },

      pipeline: {
        fopen: {},
        fwrite: {},
        executionMode: {
          selectedPipelineType: { required, oneOf: oneOf(["general", "functionOnly", "interactive"]) },
          general: {
            checker: {
              isCustom: {},
              customChecker: {
                file: helpers.withMessage(
                  "Custom checker file is required",
                  () =>
                    !p.pipeline.executionMode.general.checker.isCustom ||
                    !!p.pipeline.executionMode.general.checker.customChecker.file,
                ),
              },
            },
          },
          functionOnly: {
            teacherUpload: {
              file: helpers.withMessage(
                "Teacher upload file is required for functionOnly",
                () =>
                  p.pipeline.executionMode.selectedPipelineType !== "functionOnly" ||
                  !!p.pipeline.executionMode.functionOnly.teacherUpload.file,
              ),
            },
            checker: {
              isCustom: {},
              customChecker: {
                file: helpers.withMessage(
                  "Custom checker file is required",
                  () =>
                    !p.pipeline.executionMode.functionOnly.checker.isCustom ||
                    !!p.pipeline.executionMode.functionOnly.checker.customChecker.file,
                ),
              },
            },
          },
          interactive: {
            teacherBinary: {
              file: helpers.withMessage(
                "Teacher binary file is required for interactive",
                () =>
                  p.pipeline.executionMode.selectedPipelineType !== "interactive" ||
                  !!p.pipeline.executionMode.interactive.teacherBinary.file,
              ),
            },
            executionOrder: { oneOf: oneOf(["studentFirst", "teacherFirst"]) },
          },
        },
        scoringAndTestcase: {
          testCaseInfo: {
            language: {},
            fillInTemplate: {},
            tasks: {
              minOne: helpers.withMessage("At least one subtask is required", (tasks: any[]) => tasks.length >= 1),
              scoreSum: helpers.withMessage(
                "The sum of all subtasks score should be 100",
                (tasks: any[]) => tasks.reduce((acc: number, cur: any) => acc + Number(cur.taskScore || 0), 0) === 100,
              ),
              positiveCounts: helpers.withMessage(
                "Each subtask caseCount must be >= 1",
                (tasks: any[]) => tasks.every((t: any) => Number(t.caseCount) >= 1),
              ),
            },
          },
          timeLimit: { required, minValue: minValue(1) },
          memoryLimit: { required, minValue: minValue(1) },
          scoringScript: {
            isCustom: {},
            customScoringScript: {
              file: helpers.withMessage(
                "Provide script or JSON when isCustom is true",
                () =>
                  !p.pipeline.scoringAndTestcase.scoringScript.isCustom ||
                  !!p.pipeline.scoringAndTestcase.scoringScript.customScoringScript.file ||
                  !!p.pipeline.scoringAndTestcase.scoringScript.customScoringJson.file,
              ),
            },
            customScoringJson: {
              file: helpers.withMessage(
                "Provide script or JSON when isCustom is true",
                () =>
                  !p.pipeline.scoringAndTestcase.scoringScript.isCustom ||
                  !!p.pipeline.scoringAndTestcase.scoringScript.customScoringScript.file ||
                  !!p.pipeline.scoringAndTestcase.scoringScript.customScoringJson.file,
              ),
            },
          },
        },
      },
    };
  }),
  problem,
);

async function submit() {
  const ok = await v$.value.$validate();
  if (ok) {
    emits("submit");
  }
}

// Utilities
function addToArray(arr: string[], value = "") {
  return [...arr, value];
}
function removeFromArray(arr: string[], i: number) {
  return [...arr.slice(0, i), ...arr.slice(i + 1)];
}

function addTask() {
  const info = problem.value.pipeline.scoringAndTestcase.testCaseInfo;
  updateTestCaseInfo("tasks", [...info.tasks, { caseCount: 1, taskScore: 0 }]);
}
function removeTask(i: number) {
  const info = problem.value.pipeline.scoringAndTestcase.testCaseInfo;
  updateTestCaseInfo("tasks", [...info.tasks.slice(0, i), ...info.tasks.slice(i + 1)]);
}

const openDescription = ref(true);
const openConfiguration = ref(false);
const openPipeline = ref(false);
</script>

<template>
  <div v-if="errorMsg" class="alert alert-error shadow-lg mb-4">
    <div>
      <i-uil-times-circle />
      <span>{{ errorMsg }}</span>
    </div>
  </div>

  <!-- Top-level: name + status -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
    <div class="form-control">
      <label class="label"><span class="label-text">Problem Name</span></label>
      <input
        type="text"
        :class="['input input-bordered', v$.problemName.$error && 'input-error']"
        :value="problem.problemName"
        @input="update('problemName', ($event.target as HTMLInputElement).value)"
      />
      <label class="label" v-show="v$.problemName.$error">
        <span class="label-text-alt text-error" v-text="v$.problemName.$errors[0]?.$message" />
      </label>
    </div>

    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Visible</span>
        <input
          type="checkbox"
          class="toggle toggle-success"
          :checked="problem.status === 1"
          @change="update('status', (problem.status ^ 1) as 0 | 1)"
        />
      </label>
    </div>
  </div>

  <!-- Description -->
  <div class="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
    <input type="checkbox" v-model="openDescription" />
    <div class="collapse-title text-xl font-medium">Description</div>
    <div class="collapse-content">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="form-control">
          <label class="label"><span class="label-text">Tags (comma-separated)</span></label>
          <input
            type="text"
            :class="['input input-bordered', v$.description.tags.$error && 'input-error']"
            :value="problem.description.tags.join(',')"
            @input="updateDescription('tags', ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()))"
          />
          <label class="label" v-if="v$.description.tags.$error">
            <span class="label-text-alt" v-text="v$.description.tags.$errors[0]?.$message" />
          </label>
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Allowed Languages</span></label>
          <language-multi-select
            :model-value="problem.description.allowedLanguage"
            @update:model-value="(val) => updateDescription('allowedLanguage', val)"
          />
          <label class="label" v-show="v$.description.allowedLanguage.$error">
            <span class="label-text-alt text-error" v-text="v$.description.allowedLanguage.$errors[0]?.$message" />
          </label>
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Quota</span></label>
          <input
            type="number"
            :class="['input input-bordered', v$.description.quota.$error && 'input-error']"
            :value="problem.description.quota"
            @input="updateDescription('quota', Number(($event.target as HTMLInputElement).value))"
          />
          <label class="label">
            <span class="label-text-alt">
              {{ v$.description.quota.$error ? v$.description.quota.$errors[0]?.$message : 'Use -1 for unlimited' }}
            </span>
          </label>
        </div>

        <div class="form-control md:col-span-2">
          <label class="label"><span class="label-text">Problem Description</span></label>
          <textarea class="textarea textarea-bordered min-h-[120px]"
            :value="problem.description.description"
            @input="updateDescription('description', ($event.target as HTMLTextAreaElement).value)" />
        </div>
        <div class="form-control md:col-span-2">
          <label class="label"><span class="label-text">Input</span></label>
          <textarea class="textarea textarea-bordered min-h-[80px]"
            :value="problem.description.input"
            @input="updateDescription('input', ($event.target as HTMLTextAreaElement).value)" />
        </div>
        <div class="form-control md:col-span-2">
          <label class="label"><span class="label-text">Output</span></label>
          <textarea class="textarea textarea-bordered min-h-[80px]"
            :value="problem.description.output"
            @input="updateDescription('output', ($event.target as HTMLTextAreaElement).value)" />
        </div>
        <div class="form-control md:col-span-2">
          <label class="label"><span class="label-text">Hint</span></label>
          <textarea class="textarea textarea-bordered min-h-[80px]"
            :value="problem.description.hint"
            @input="updateDescription('hint', ($event.target as HTMLTextAreaElement).value)" />
        </div>

        <!-- Samples -->
        <div class="md:col-span-1">
          <div class="flex items-center justify-between">
            <div class="font-semibold mb-2">Sample Inputs</div>
            <button class="btn btn-xs" @click="updateDescription('sampleInput', addToArray(problem.description.sampleInput))">Add</button>
          </div>
          <div class="space-y-2">
            <div v-for="(s, i) in problem.description.sampleInput" :key="'si-' + i" class="flex items-start gap-2">
              <textarea class="textarea textarea-bordered flex-1" :value="s"
                @input="
                  updateDescription('sampleInput', [
                    ...problem.description.sampleInput.slice(0, i),
                    ($event.target as HTMLTextAreaElement).value,
                    ...problem.description.sampleInput.slice(i + 1),
                  ])
                "
              />
              <button class="btn btn-ghost btn-xs"
                @click="updateDescription('sampleInput', removeFromArray(problem.description.sampleInput, i))">
                <i-uil-times />
              </button>
            </div>
          </div>
        </div>

        <div class="md:col-span-1">
          <div class="flex items-center justify-between">
            <div class="font-semibold mb-2">Sample Outputs</div>
            <button class="btn btn-xs" @click="updateDescription('sampleOutput', addToArray(problem.description.sampleOutput))">Add</button>
          </div>
          <div class="space-y-2">
            <div v-for="(s, i) in problem.description.sampleOutput" :key="'so-' + i" class="flex items-start gap-2">
              <textarea class="textarea textarea-bordered flex-1" :value="s"
                @input="
                  updateDescription('sampleOutput', [
                    ...problem.description.sampleOutput.slice(0, i),
                    ($event.target as HTMLTextAreaElement).value,
                    ...problem.description.sampleOutput.slice(i + 1),
                  ])
                "
              />
              <button class="btn btn-ghost btn-xs"
                @click="updateDescription('sampleOutput', removeFromArray(problem.description.sampleOutput, i))">
                <i-uil-times />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Configuration -->
  <div class="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box mt-6">
    <input type="checkbox" v-model="openConfiguration" />
    <div class="collapse-title text-xl font-medium">Configuration</div>
    <div class="collapse-content">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Compilation</span>
            <input type="checkbox" class="toggle"
              :checked="problem.configuration.compilation"
              @change="updateConfiguration('compilation', !problem.configuration.compilation)" />
          </label>
        </div>
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Test Mode</span>
            <input type="checkbox" class="toggle"
              :checked="problem.configuration.testMode"
              @change="updateConfiguration('testMode', !problem.configuration.testMode)" />
          </label>
        </div>
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">AI VTuber</span>
            <input type="checkbox" class="toggle"
              :checked="problem.configuration.aiVTuber"
              @change="updateConfiguration('aiVTuber', !problem.configuration.aiVTuber)" />
          </label>
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Accepted Format</span></label>
          <select class="select select-bordered"
            :class="v$.configuration.acceptedFormat.$error && 'select-error'"
            :value="problem.configuration.acceptedFormat"
            @change="updateConfiguration('acceptedFormat', ($event.target as HTMLSelectElement).value as any)">
            <option value="code">code</option>
            <option value="zip">zip</option>
          </select>
          <label class="label" v-show="v$.configuration.acceptedFormat.$error">
            <span class="label-text-alt text-error" v-text="v$.configuration.acceptedFormat.$errors[0]?.$message" />
          </label>
        </div>

        <div class="form-control md:col-span-2">
          <label class="label"><span class="label-text">Artifact Collection</span></label>
          <div class="flex gap-4">
            <label class="label cursor-pointer gap-2">
              <input type="checkbox" class="checkbox"
                :checked="problem.configuration.artifactCollection.includes('compiledBinary')"
                @change="
                  updateConfiguration('artifactCollection',
                    ($event.target as HTMLInputElement).checked
                      ? Array.from(new Set([...problem.configuration.artifactCollection, 'compiledBinary']))
                      : problem.configuration.artifactCollection.filter(v => v !== 'compiledBinary')
                  )
                "
              />
              <span class="label-text">compiledBinary</span>
            </label>
            <label class="label cursor-pointer gap-2">
              <input type="checkbox" class="checkbox"
                :checked="problem.configuration.artifactCollection.includes('zip')"
                @change="
                  updateConfiguration('artifactCollection',
                    ($event.target as HTMLInputElement).checked
                      ? Array.from(new Set([...problem.configuration.artifactCollection, 'zip']))
                      : problem.configuration.artifactCollection.filter(v => v !== 'zip')
                  )
                "
              />
              <span class="label-text">zip</span>
            </label>
          </div>
          <label class="label" v-show="v$.configuration.artifactCollection.$error">
            <span class="label-text-alt text-error" v-text="v$.configuration.artifactCollection.$errors[0]?.$message" />
          </label>
        </div>

        <div class="divider md:col-span-2">Static Analysis</div>

        <div class="form-control md:col-span-2">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Enable default rule</span>
            <input type="checkbox" class="toggle"
              :checked="problem.configuration.staticAnalysis.default"
              @change="updateConfigurationStaticAnalysis('default', !problem.configuration.staticAnalysis.default)" />
          </label>
        </div>

        <div class="form-control md:col-span-2">
          <div class="font-semibold mb-2">Library Restrictions</div>
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Enabled</span>
            <input type="checkbox" class="toggle"
              :checked="problem.configuration.staticAnalysis.libraryRestrictions.isEnabled"
              @change="
                updateLibraryRestrictions('isEnabled', !problem.configuration.staticAnalysis.libraryRestrictions.isEnabled)
              " />
          </label>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <div class="flex items-center justify-between">
                <div class="label-text font-semibold">Whitelist</div>
                <button class="btn btn-xs"
                  @click="updateLibraryRestrictions('whitelist', addToArray(problem.configuration.staticAnalysis.libraryRestrictions.whitelist))"
                >Add</button>
              </div>
              <div class="space-y-2">
                <div v-for="(s, i) in problem.configuration.staticAnalysis.libraryRestrictions.whitelist" :key="'wl-' + i" class="flex gap-2">
                  <input class="input input-bordered flex-1" list="lib-options"
                    :value="s"
                    @input="
                      updateLibraryRestrictions('whitelist', [
                        ...problem.configuration.staticAnalysis.libraryRestrictions.whitelist.slice(0, i),
                        ($event.target as HTMLInputElement).value,
                        ...problem.configuration.staticAnalysis.libraryRestrictions.whitelist.slice(i + 1),
                      ])
                    " />
                  <button class="btn btn-ghost btn-xs"
                    @click="
                      updateLibraryRestrictions('whitelist',
                        removeFromArray(problem.configuration.staticAnalysis.libraryRestrictions.whitelist, i)
                      )
                    "><i-uil-times /></button>
                </div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between">
                <div class="label-text font-semibold">Blacklist</div>
                <button class="btn btn-xs"
                  @click="updateLibraryRestrictions('blacklist', addToArray(problem.configuration.staticAnalysis.libraryRestrictions.blacklist))"
                >Add</button>
              </div>
              <div class="space-y-2">
                <div v-for="(s, i) in problem.configuration.staticAnalysis.libraryRestrictions.blacklist" :key="'bl-' + i" class="flex gap-2">
                  <input class="input input-bordered flex-1" list="lib-options"
                    :value="s"
                    @input="
                      updateLibraryRestrictions('blacklist', [
                        ...problem.configuration.staticAnalysis.libraryRestrictions.blacklist.slice(0, i),
                        ($event.target as HTMLInputElement).value,
                        ...problem.configuration.staticAnalysis.libraryRestrictions.blacklist.slice(i + 1),
                      ])
                    " />
                  <button class="btn btn-ghost btn-xs"
                    @click="
                      updateLibraryRestrictions('blacklist',
                        removeFromArray(problem.configuration.staticAnalysis.libraryRestrictions.blacklist, i)
                      )
                    "><i-uil-times /></button>
                </div>
              </div>
            </div>
          </div>

          <datalist id="lib-options">
            <option v-for="opt in availableLibraries" :key="opt" :value="opt" />
          </datalist>

          <label class="label" v-show="v$.configuration.staticAnalysis.libraryRestrictions.whitelist.$error">
            <span class="label-text-alt text-error" v-text="v$.configuration.staticAnalysis.libraryRestrictions.whitelist.$errors[0]?.$message" />
          </label>
        </div>

        <div class="form-control md:col-span-2">
          <div class="font-semibold mb-2">Network Access Restriction</div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Firewall -->
            <div class="border border-base-300 rounded p-3">
              <div class="label cursor-pointer justify-start gap-x-4">
                <span class="label-text">Firewall Extranet Enabled</span>
                <input type="checkbox" class="toggle"
                  :checked="problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.isEnabled"
                  @change="
                    updateNetworkFirewall('isEnabled',
                      !problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.isEnabled
                    )
                  " />
              </div>
              <div class="label-text mt-2">Whitelist</div>
              <div class="space-y-2 mb-2">
                <div v-for="(s, i) in problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.whitelist" :key="'fw-wl-' + i" class="flex gap-2">
                  <input class="input input-bordered flex-1" :value="s"
                    @input="
                      updateNetworkFirewall('whitelist', [
                        ...problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.whitelist.slice(0, i),
                        ($event.target as HTMLInputElement).value,
                        ...problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.whitelist.slice(i + 1),
                      ])
                    " />
                  <button class="btn btn-ghost btn-xs"
                    @click="
                      updateNetworkFirewall('whitelist',
                        removeFromArray(problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.whitelist, i)
                      )
                    "><i-uil-times /></button>
                </div>
                <button class="btn btn-xs"
                  @click="
                    updateNetworkFirewall('whitelist',
                      addToArray(problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.whitelist)
                    )
                  "
                >Add</button>
              </div>
              <div class="label-text">Blacklist</div>
              <div class="space-y-2">
                <div v-for="(s, i) in problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.blacklist" :key="'fw-bl-' + i" class="flex gap-2">
                  <input class="input input-bordered flex-1" :value="s"
                    @input="
                      updateNetworkFirewall('blacklist', [
                        ...problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.blacklist.slice(0, i),
                        ($event.target as HTMLInputElement).value,
                        ...problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.blacklist.slice(i + 1),
                      ])
                    " />
                  <button class="btn btn-ghost btn-xs"
                    @click="
                      updateNetworkFirewall('blacklist',
                        removeFromArray(problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.blacklist, i)
                      )
                    "><i-uil-times /></button>
                </div>
                <button class="btn btn-xs"
                  @click="
                    updateNetworkFirewall('blacklist',
                      addToArray(problem.configuration.staticAnalysis.networkAccessRestriction.firewallExtranet.blacklist)
                    )
                  "
                >Add</button>
              </div>
            </div>

            <!-- Connect with Local -->
            <div class="border border-base-300 rounded p-3">
              <div class="label cursor-pointer justify-start gap-x-4">
                <span class="label-text">Connect With Local Enabled</span>
                <input type="checkbox" class="toggle"
                  :checked="problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.isEnabled"
                  @change="
                    updateNetworkLocal('isEnabled',
                      !problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.isEnabled
                    )
                  " />
              </div>

              <div class="label-text mt-2">Whitelist</div>
              <div class="space-y-2 mb-2">
                <div v-for="(s, i) in problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.whitelist" :key="'cl-wl-' + i" class="flex gap-2">
                  <input class="input input-bordered flex-1" :value="s"
                    @input="
                      updateNetworkLocal('whitelist', [
                        ...problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.whitelist.slice(0, i),
                        ($event.target as HTMLInputElement).value,
                        ...problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.whitelist.slice(i + 1),
                      ])
                    " />
                  <button class="btn btn-ghost btn-xs"
                    @click="
                      updateNetworkLocal('whitelist',
                        removeFromArray(problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.whitelist, i)
                      )
                    "><i-uil-times /></button>
                </div>
                <button class="btn btn-xs"
                  @click="
                    updateNetworkLocal('whitelist',
                      addToArray(problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.whitelist)
                    )
                  "
                >Add</button>
              </div>

              <div class="label-text">Blacklist</div>
              <div class="space-y-2 mb-2">
                <div v-for="(s, i) in problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.blacklist" :key="'cl-bl-' + i" class="flex gap-2">
                  <input class="input input-bordered flex-1" :value="s"
                    @input="
                      updateNetworkLocal('blacklist', [
                        ...problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.blacklist.slice(0, i),
                        ($event.target as HTMLInputElement).value,
                        ...problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.blacklist.slice(i + 1),
                      ])
                    " />
                  <button class="btn btn-ghost btn-xs"
                    @click="
                      updateNetworkLocal('blacklist',
                        removeFromArray(problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.blacklist, i)
                      )
                    "><i-uil-times /></button>
                </div>
                <button class="btn btn-xs"
                  @click="
                    updateNetworkLocal('blacklist',
                      addToArray(problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.blacklist)
                    )
                  "
                >Add</button>
              </div>

              <div class="form-control">
                <label class="label"><span class="label-text">Local Service File</span></label>
                <input class="input input-bordered"
                  :value="problem.configuration.staticAnalysis.networkAccessRestriction.connectWithLocal.localService.file"
                  @input="updateNetworkLocal('localService', { file: ($event.target as HTMLInputElement).value })" />
              </div>
            </div>
          </div>
        </div>
      </div> <!-- grid -->
    </div>
  </div>

  <!-- Pipeline -->
  <div class="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box mt-6">
    <input type="checkbox" v-model="openPipeline" />
    <div class="collapse-title text-xl font-medium">Pipeline</div>
    <div class="collapse-content">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Enable fopen</span>
            <input type="checkbox" class="toggle"
              :checked="problem.pipeline.fopen"
              @change="updatePipeline('fopen', !problem.pipeline.fopen)" />
          </label>
        </div>
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Enable fwrite</span>
            <input type="checkbox" class="toggle"
              :checked="problem.pipeline.fwrite"
              @change="updatePipeline('fwrite', !problem.pipeline.fwrite)" />
          </label>
        </div>

        <div class="form-control md:col-span-2">
          <label class="label"><span class="label-text">Execution Mode</span></label>
          <select class="select select-bordered"
            :class="v$.pipeline.executionMode.selectedPipelineType.$error && 'select-error'"
            :value="problem.pipeline.executionMode.selectedPipelineType"
            @change="updateExecutionMode('selectedPipelineType', ($event.target as HTMLSelectElement).value as any)"
          >
            <option value="general">general</option>
            <option value="functionOnly">functionOnly</option>
            <option value="interactive">interactive</option>
          </select>
          <label class="label" v-show="v$.pipeline.executionMode.selectedPipelineType.$error">
            <span class="label-text-alt text-error" v-text="v$.pipeline.executionMode.selectedPipelineType.$errors[0]?.$message" />
          </label>
        </div>

        <!-- General checker -->
        <div class="form-control md:col-span-2" v-if="problem.pipeline.executionMode.selectedPipelineType === 'general'">
          <div class="label font-semibold">General Checker</div>
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Use Custom Checker</span>
            <input type="checkbox" class="toggle"
              :checked="problem.pipeline.executionMode.general.checker.isCustom"
              @change="updateExecutionModeSection('general', 'checker', {
                ...problem.pipeline.executionMode.general.checker,
                isCustom: !problem.pipeline.executionMode.general.checker.isCustom
              })"
            />
          </label>
          <div class="form-control mt-2" v-if="problem.pipeline.executionMode.general.checker.isCustom">
            <label class="label"><span class="label-text">customChecker.file</span></label>
            <input class="input input-bordered"
              :class="v$.pipeline.executionMode.general.checker.customChecker.file.$error && 'input-error'"
              :value="problem.pipeline.executionMode.general.checker.customChecker.file"
              @input="updateExecutionModeSection('general', 'checker', {
                ...problem.pipeline.executionMode.general.checker,
                customChecker: { file: ($event.target as HTMLInputElement).value }
              })" />
            <label class="label" v-show="v$.pipeline.executionMode.general.checker.customChecker.file.$error">
              <span class="label-text-alt text-error" v-text="v$.pipeline.executionMode.general.checker.customChecker.file.$errors[0]?.$message" />
            </label>
          </div>
        </div>

        <!-- functionOnly -->
        <div class="form-control md:col-span-2" v-if="problem.pipeline.executionMode.selectedPipelineType === 'functionOnly'">
          <div class="label font-semibold">Function Only</div>
          <div class="form-control">
            <label class="label"><span class="label-text">teacherUpload.file</span></label>
            <input class="input input-bordered"
              :class="v$.pipeline.executionMode.functionOnly.teacherUpload.file.$error && 'input-error'"
              :value="problem.pipeline.executionMode.functionOnly.teacherUpload.file"
              @input="updateExecutionModeSection('functionOnly', 'teacherUpload', { file: ($event.target as HTMLInputElement).value })" />
            <label class="label" v-show="v$.pipeline.executionMode.functionOnly.teacherUpload.file.$error">
              <span class="label-text-alt text-error" v-text="v$.pipeline.executionMode.functionOnly.teacherUpload.file.$errors[0]?.$message" />
            </label>
          </div>

          <div class="form-control mt-2">
            <label class="label cursor-pointer justify-start gap-x-4">
              <span class="label-text">Use Custom Checker</span>
              <input type="checkbox" class="toggle"
                :checked="problem.pipeline.executionMode.functionOnly.checker.isCustom"
                @change="updateExecutionModeSection('functionOnly', 'checker', {
                  ...problem.pipeline.executionMode.functionOnly.checker,
                  isCustom: !problem.pipeline.executionMode.functionOnly.checker.isCustom
                })" />
            </label>
            <div class="form-control mt-2" v-if="problem.pipeline.executionMode.functionOnly.checker.isCustom">
              <label class="label"><span class="label-text">customChecker.file</span></label>
              <input class="input input-bordered"
                :class="v$.pipeline.executionMode.functionOnly.checker.customChecker.file.$error && 'input-error'"
                :value="problem.pipeline.executionMode.functionOnly.checker.customChecker.file"
                @input="updateExecutionModeSection('functionOnly', 'checker', {
                  ...problem.pipeline.executionMode.functionOnly.checker,
                  customChecker: { file: ($event.target as HTMLInputElement).value }
                })" />
              <label class="label" v-show="v$.pipeline.executionMode.functionOnly.checker.customChecker.file.$error">
                <span class="label-text-alt text-error" v-text="v$.pipeline.executionMode.functionOnly.checker.customChecker.file.$errors[0]?.$message" />
              </label>
            </div>
          </div>
        </div>

        <!-- interactive -->
        <div class="form-control md:col-span-2" v-if="problem.pipeline.executionMode.selectedPipelineType === 'interactive'">
          <div class="label font-semibold">Interactive</div>
          <div class="form-control">
            <label class="label"><span class="label-text">teacherBinary.file</span></label>
            <input class="input input-bordered"
              :class="v$.pipeline.executionMode.interactive.teacherBinary.file.$error && 'input-error'"
              :value="problem.pipeline.executionMode.interactive.teacherBinary.file"
              @input="updateExecutionModeSection('interactive', 'teacherBinary', { file: ($event.target as HTMLInputElement).value })" />
            <label class="label" v-show="v$.pipeline.executionMode.interactive.teacherBinary.file.$error">
              <span class="label-text-alt text-error" v-text="v$.pipeline.executionMode.interactive.teacherBinary.file.$errors[0]?.$message" />
            </label>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-x-4">
              <span class="label-text">Teacher First?</span>
              <input type="checkbox" class="toggle"
                :checked="problem.pipeline.executionMode.interactive.executionOrder === 'teacherFirst'"
                @change="
                  updateExecutionModeSection('interactive', 'executionOrder',
                    problem.pipeline.executionMode.interactive.executionOrder === 'teacherFirst' ? 'studentFirst' : 'teacherFirst'
                  )
                " />
            </label>
          </div>
        </div>

        <div class="divider md:col-span-2">Scoring & Testcases</div>

        <div class="form-control">
          <label class="label"><span class="label-text">Test Language</span></label>
          <input type="number" class="input input-bordered"
            :value="problem.pipeline.scoringAndTestcase.testCaseInfo.language"
            @input="updateTestCaseInfo('language', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Fill-in Template</span></label>
          <input type="text" class="input input-bordered"
            :value="problem.pipeline.scoringAndTestcase.testCaseInfo.fillInTemplate"
            @input="updateTestCaseInfo('fillInTemplate', ($event.target as HTMLInputElement).value)" />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Global Time Limit (ms)</span></label>
          <input type="number"
            :class="['input input-bordered', v$.pipeline.scoringAndTestcase.timeLimit.$error && 'input-error']"
            :value="problem.pipeline.scoringAndTestcase.timeLimit"
            @input="updateScoring('timeLimit', Number(($event.target as HTMLInputElement).value))" />
          <label class="label" v-show="v$.pipeline.scoringAndTestcase.timeLimit.$error">
            <span class="label-text-alt text-error" v-text="v$.pipeline.scoringAndTestcase.timeLimit.$errors[0]?.$message" />
          </label>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Global Memory Limit (KB)</span></label>
          <input type="number"
            :class="['input input-bordered', v$.pipeline.scoringAndTestcase.memoryLimit.$error && 'input-error']"
            :value="problem.pipeline.scoringAndTestcase.memoryLimit"
            @input="updateScoring('memoryLimit', Number(($event.target as HTMLInputElement).value))" />
          <label class="label" v-show="v$.pipeline.scoringAndTestcase.memoryLimit.$error">
            <span class="label-text-alt text-error" v-text="v$.pipeline.scoringAndTestcase.memoryLimit.$errors[0]?.$message" />
          </label>
        </div>

        <div class="md:col-span-2">
          <div class="flex items-center justify-between">
            <div class="font-semibold">Subtasks</div>
            <button class="btn btn-sm" @click="addTask"><i-uil-plus class="mr-1" /> Add Subtask</button>
          </div>
          <label class="label text-error" v-show="v$.pipeline.scoringAndTestcase.testCaseInfo.tasks.$error">
            <span class="label-text-alt" v-text="v$.pipeline.scoringAndTestcase.testCaseInfo.tasks.$errors[0]?.$message" />
          </label>
          <div class="overflow-x-auto">
            <table class="table w-full">
              <thead>
                <tr><th>#</th><th>Case Count</th><th>Score</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="(t, i) in problem.pipeline.scoringAndTestcase.testCaseInfo.tasks" :key="'task-' + i">
                  <td>{{ i + 1 }}</td>
                  <td>
                    <input type="number" class="input input-bordered w-28" :value="t.caseCount"
                      @input="
                        updateTestCaseInfo('tasks', [
                          ...problem.pipeline.scoringAndTestcase.testCaseInfo.tasks.slice(0, i),
                          { ...t, caseCount: Number(($event.target as HTMLInputElement).value) },
                          ...problem.pipeline.scoringAndTestcase.testCaseInfo.tasks.slice(i + 1),
                        ])
                      "
                    />
                  </td>
                  <td>
                    <input type="number" class="input input-bordered w-28" :value="t.taskScore"
                      @input="
                        updateTestCaseInfo('tasks', [
                          ...problem.pipeline.scoringAndTestcase.testCaseInfo.tasks.slice(0, i),
                          { ...t, taskScore: Number(($event.target as HTMLInputElement).value) },
                          ...problem.pipeline.scoringAndTestcase.testCaseInfo.tasks.slice(i + 1),
                        ])
                      "
                    />
                  </td>
                  <td>
                    <button class="btn btn-ghost btn-xs" @click="removeTask(i)">
                      <i-uil-trash-alt />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-2 text-sm opacity-75">Total score must equal 100.</div>
        </div>

        <div class="divider md:col-span-2">Scoring Script</div>
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Use Custom Scoring</span>
            <input type="checkbox" class="toggle"
              :checked="problem.pipeline.scoringAndTestcase.scoringScript.isCustom"
              @change="
                updateScoring('scoringScript', {
                  ...problem.pipeline.scoringAndTestcase.scoringScript,
                  isCustom: !problem.pipeline.scoringAndTestcase.scoringScript.isCustom
                })
              " />
          </label>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">customScoringScript.file</span></label>
          <input class="input input-bordered"
            :value="problem.pipeline.scoringAndTestcase.scoringScript.customScoringScript.file"
            @input="
              updateScoring('scoringScript', {
                ...problem.pipeline.scoringAndTestcase.scoringScript,
                customScoringScript: { file: ($event.target as HTMLInputElement).value }
              })
            " />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">customScoringJson.file</span></label>
          <input class="input input-bordered"
            :value="problem.pipeline.scoringAndTestcase.scoringScript.customScoringJson.file"
            @input="
              updateScoring('scoringScript', {
                ...problem.pipeline.scoringAndTestcase.scoringScript,
                customScoringJson: { file: ($event.target as HTMLInputElement).value }
              })
            " />
        </div>
      </div>
    </div>
  </div>

  <div class="mt-6 flex justify-end">
    <button :class="['btn btn-success', isLoading && 'loading']" @click="submit">
      <i-uil-file-upload-alt class="mr-1 lg:h-5 lg:w-5" /> Submit
    </button>
  </div>
</template>

