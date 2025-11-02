<script setup lang="ts">
import { inject, Ref } from "vue";

defineProps<{ v$: any }>();
defineEmits<{
  (e: "update", key: keyof ProblemForm, value: ProblemForm[typeof key]): void;
}>();

const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;
</script>

<template>
  <div class="form-control w-full">
    <label class="label"><span class="label-text">Description of problem</span></label>
    <textarea
      :class="['textarea textarea-bordered h-24', v$.description.description.$error && 'textarea-error']"
      :value="problem.description.description"
      @input="
        $emit('update', 'description', {
          ...problem.description,
          description: ($event.target as HTMLTextAreaElement).value,
        })
      "
    />
    <label class="label" v-show="v$.description.description.$error">
      <span class="label-text-alt text-error" v-text="v$.description.description.$errors[0]?.$message" />
    </label>
  </div>

  <div class="form-control mt-2 w-full">
    <label class="label"><span class="label-text">Description of Input</span></label>
    <textarea
      :class="['textarea textarea-bordered h-24', v$.description.input.$error && 'textarea-error']"
      :value="problem.description.input"
      @input="
        $emit('update', 'description', {
          ...problem.description,
          input: ($event.target as HTMLTextAreaElement).value,
        })
      "
    />
    <label class="label" v-show="v$.description.input.$error">
      <span class="label-text-alt text-error" v-text="v$.description.input.$errors[0]?.$message" />
    </label>
  </div>

  <div class="form-control mt-2 w-full">
    <label class="label"><span class="label-text">Description of Output</span></label>
    <textarea
      :class="['textarea textarea-bordered h-24', v$.description.output.$error && 'textarea-error']"
      :value="problem.description.output"
      @input="
        $emit('update', 'description', {
          ...problem.description,
          output: ($event.target as HTMLTextAreaElement).value,
        })
      "
    />
    <label class="label" v-show="v$.description.output.$error">
      <span class="label-text-alt text-error" v-text="v$.description.output.$errors[0]?.$message" />
    </label>
  </div>

  <div class="col-span-2 mt-2 flex w-full">
    <div class="mr-2 rounded border border-error p-2" v-show="v$.description.sampleInput.$invalid">
      Input {{ v$.description.sampleInput.$silentErrors[0]?.$message }}
    </div>
    <div class="rounded border border-error p-2" v-show="v$.description.sampleOutput.$invalid">
      Output {{ v$.description.sampleOutput.$silentErrors[0]?.$message }}
    </div>
  </div>

  <template v-for="(no, i) in problem.description.sampleInput.length" :key="i">
    <div class="mt-2 grid w-full grid-cols-1 gap-3 md:grid-cols-2">
      <!-- Input -->
      <div class="form-control">
        <label class="label">
          <span class="label-text">Examples - Input {{ no }}</span>
        </label>
        <textarea
          class="textarea textarea-bordered h-24"
          :value="problem.description.sampleInput[i]"
          @input="
            $emit('update', 'description', {
              ...problem.description,
              sampleInput: [
                ...problem.description.sampleInput.slice(0, i),
                ($event.target as HTMLInputElement).value,
                ...problem.description.sampleInput.slice(i + 1),
              ],
            })
          "
        />
      </div>

      <!-- Output -->
      <div class="form-control">
        <label class="label">
          <span class="label-text">Examples - Output {{ no }}</span>
        </label>
        <textarea
          class="textarea textarea-bordered h-24"
          :value="problem.description.sampleOutput[i]"
          @input="
            $emit('update', 'description', {
              ...problem.description,
              sampleOutput: [
                ...problem.description.sampleOutput.slice(0, i),
                ($event.target as HTMLInputElement).value,
                ...problem.description.sampleOutput.slice(i + 1),
              ],
            })
          "
        />
      </div>
    </div>
  </template>

  <div class="col-span-2 mx-auto mt-2">
    <div class="tooltip" data-tip="append new sample">
      <div
        class="btn btn-sm mr-3"
        @click="
          $emit('update', 'description', {
            ...problem.description,
            sampleInput: [...problem.description.sampleInput, ''],
            sampleOutput: [...problem.description.sampleOutput, ''],
          })
        "
      >
        <i-uil-plus class="mr-1" /> Add sample
      </div>
    </div>
    <div class="tooltip" data-tip="remove last sample">
      <div
        class="btn btn-sm"
        @click="
          $emit('update', 'description', {
            ...problem.description,
            sampleInput: problem.description.sampleInput.slice(0, -1),
            sampleOutput: problem.description.sampleOutput.slice(0, -1),
          })
        "
      >
        <i-uil-minus class="mr-1" /> Remove last
      </div>
    </div>
  </div>

  <div class="form-control mt-2 w-full">
    <label class="label"><span class="label-text">Hint</span></label>
    <textarea
      :class="['textarea textarea-bordered h-24', v$.description.hint.$error && 'textarea-error']"
      :value="problem.description.hint"
      @input="
        $emit('update', 'description', {
          ...problem.description,
          hint: ($event.target as HTMLTextAreaElement).value,
        })
      "
    />
    <label class="label" v-show="v$.description.hint.$error">
      <span class="label-text-alt text-error" v-text="v$.description.hint.$errors[0]?.$message" />
    </label>
  </div>
</template>
