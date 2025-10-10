<script setup lang="ts">
import type { ProblemDraftV2 } from "@/types/problem-v2";

interface Props {
  problem: ProblemDraftV2;
  preview?: boolean;
}
withDefaults(defineProps<Props>(), {
  preview: false,
});
</script>

<template>
  <div class="card min-w-full">
    <div class="card-body">
      <div class="flex flex-wrap items-start justify-between gap-y-4">
        <div class="flex flex-col gap-4">
          <div class="card-title md:text-2xl lg:text-3xl">
            <template v-if="!preview">Problem - {{ problem.problemName }}</template>
            <template v-else>Preview - {{ problem.problemName }}</template>
          </div>
          <div class="flex">
            <span class="badge badge-info mr-1" v-for="tag in problem.description.tags" :key="tag">{{ tag }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-y-4">
          <div class="stats py-1">
            <div class="stat place-items-center py-0">
              <div class="stat-title">Quota</div>
              <div class="stat-value">
                <template v-if="problem.description.quota === -1">
                  <span class="text-sm">Unlimited</span>
                </template>
                <template v-else>
                  <span>{{ problem.description.quota }}</span>
                </template>
              </div>
            </div>
            <div class="stat place-items-center py-0">
              <div class="stat-title">Time Limit</div>
              <div class="stat-value">
                <span>{{ problem.pipeline.scoringAndTestcase.timeLimit }}</span>
                <span class="text-sm font-normal"> ms</span>
              </div>
            </div>
            <div class="stat place-items-center py-0">
              <div class="stat-title">Memory Limit</div>
              <div class="stat-value">
                <span>{{ problem.pipeline.scoringAndTestcase.memoryLimit }}</span>
                <span class="text-sm font-normal"> KB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="divider" />

      <div class="card min-w-full rounded-none">
        <div class="card-body p-0">
          <div class="card-title md:text-xl lg:text-2xl">Description</div>
          <markdown-renderer class="mb-10" :md="problem.description.description" />

          <div class="card-title md:text-xl lg:text-2xl">Input</div>
          <markdown-renderer class="mb-10" :md="problem.description.input" />

          <div class="card-title md:text-xl lg:text-2xl">Output</div>
          <markdown-renderer class="mb-10" :md="problem.description.output" />

          <div class="card-title md:text-xl lg:text-2xl">Examples</div>
          <div class="mb-10">
            <table class="table w-full">
              <thead>
                <tr><th>#</th><th>Sample Input</th><th>Sample Output</th></tr>
              </thead>
              <tbody>
                <tr v-for="i in Math.max(problem.description.sampleInput.length, problem.description.sampleOutput.length)" :key="i">
                  <td class="align-top">{{ i }}</td>
                  <td class="align-top">
                    <sample-code-block v-if="problem.description.sampleInput[i - 1]" :code="problem.description.sampleInput[i - 1]" />
                    <span v-else class="italic opacity-70">No content</span>
                  </td>
                  <td class="align-top">
                    <sample-code-block v-if="problem.description.sampleOutput[i - 1]" :code="problem.description.sampleOutput[i - 1]" />
                    <span v-else class="italic opacity-70">No content</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card-title md:text-xl lg:text-2xl">Hint</div>
          <markdown-renderer class="mb-10" :md="problem.description.hint" />

          <div class="card-title md:text-xl lg:text-2xl">Subtasks</div>
          <table class="table w-full">
            <thead>
              <tr><th>#</th><th>Case Count</th><th>Score</th></tr>
            </thead>
            <tbody>
              <tr v-for="(t, idx) in problem.pipeline.scoringAndTestcase.testCaseInfo.tasks" :key="idx">
                <td>{{ idx + 1 }}</td>
                <td>{{ t.caseCount }}</td>
                <td>{{ t.taskScore }}</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-8">
            <div class="font-semibold">Accepted Format</div>
            <div class="opacity-80">{{ problem.configuration.acceptedFormat }}</div>
          </div>

          <div class="mt-2">
            <div class="font-semibold">Artifact Collection</div>
            <div class="flex gap-2">
              <span class="badge" v-for="a in problem.configuration.artifactCollection" :key="a">{{ a }}</span>
              <span class="italic opacity-70" v-if="problem.configuration.artifactCollection.length === 0">None</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>