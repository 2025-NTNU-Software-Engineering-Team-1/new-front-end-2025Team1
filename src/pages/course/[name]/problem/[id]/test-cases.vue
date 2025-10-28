<script setup lang="ts">
import { ref } from "vue";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import { fetcher } from "@/models/api";
import { useI18n } from "vue-i18n";
import { ZipReader, BlobReader, TextWriter, ZipWriter, BlobWriter, TextReader } from "@zip.js/zip.js";

const route = useRoute();
const { t } = useI18n();

useTitle(`Test Cases - ${route.params.id} - ${route.params.name} | Normal OJ`);

const useDefaultTestcases = ref(true);
const selectedTestcases = ref<string[]>([]);
const testcaseFiles = ref<{name: string, content: string}[]>([]);
const selectedTestcaseContent = ref("");
const isLoading = ref(false);
const saveSuccess = ref(false);
const saveError = ref(false);

async function handleTestcaseUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !file.name.endsWith('.zip')) return;

  const zipReader = new ZipReader(new BlobReader(file));
  const entries = await zipReader.getEntries();
  
  testcaseFiles.value = [];
  for (const entry of entries) {
    if (!entry.directory && entry.getData) {
      const textWriter = new TextWriter();
      const content = await entry.getData(textWriter);
      testcaseFiles.value.push({
        name: entry.filename,
        content,
      });
    }
  }
}

function previewTestcase(file: {name: string, content: string}) {
  selectedTestcaseContent.value = file.content;
}

function deleteTestcase(file: {name: string, content: string}) {
  const index = testcaseFiles.value.findIndex(f => f.name === file.name);
  if (index !== -1) {
    testcaseFiles.value.splice(index, 1);
    selectedTestcases.value = selectedTestcases.value.filter(name => name !== file.name);
    if (selectedTestcaseContent.value === file.content) {
      selectedTestcaseContent.value = "";
    }
  }
}

async function saveTestcaseSettings() {
  isLoading.value = true;
  saveSuccess.value = false;
  saveError.value = false;

  try {
    // Create testcase zip if custom testcases are selected
    let testcaseBlob = null;
    if (!useDefaultTestcases.value && selectedTestcases.value.length > 0) {
      const testcaseZipWriter = new ZipWriter(new BlobWriter("application/zip"));
      for (const testcase of testcaseFiles.value) {
        if (selectedTestcases.value.includes(testcase.name)) {
          await testcaseZipWriter.add(testcase.name, new TextReader(testcase.content));
        }
      }
      testcaseBlob = await testcaseZipWriter.close();
    }

    const formData = new FormData();
    formData.append("use_default_testcases", useDefaultTestcases.value.toString());
    if (testcaseBlob) {
      formData.append("custom_testcases", testcaseBlob);
    }

    await fetcher.post(`/problem/${route.params.id}/test-settings`, formData);
    saveSuccess.value = true;
  } catch (error) {
    saveError.value = true;
    console.error('Error saving testcase settings:', error);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex justify-between items-center">
          <div class="card-title">{{ t("course.problem.test.testcaseModal.title") }}</div>
          <router-link
            :to="`/course/${route.params.name}/problem/${route.params.id}/test`"
            class="btn"
          >
            {{ t("course.problem.test.back") }}
          </router-link>
        </div>

        <div class="divider"></div>

        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text">{{ t("course.problem.test.testcaseModal.useDefault") }}</span>
            <input type="checkbox" class="toggle" v-model="useDefaultTestcases" />
          </label>
        </div>

        <div class="divider"></div>

        <div class="flex flex-col gap-4">
          <div class="flex justify-between items-center">
            <span class="text-lg font-semibold">
              {{ t("course.problem.test.testcaseModal.customTestcases") }}
            </span>
            <input type="file" class="file-input file-input-bordered w-full max-w-xs"
                   accept=".zip" @change="handleTestcaseUpload" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="border rounded p-4">
              <h4 class="font-semibold mb-2">{{ t("course.problem.test.testcaseModal.files") }}</h4>
              <div class="flex flex-col gap-2">
                <label v-for="file in testcaseFiles" :key="file.name" class="flex items-center gap-2">
                  <input type="checkbox" class="checkbox" 
                         v-model="selectedTestcases" :value="file.name" />
                  <span>{{ file.name }}</span>
                  <button class="btn btn-ghost btn-xs" @click="previewTestcase(file)">
                    <i-uil-eye class="h-4 w-4" />
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" @click="deleteTestcase(file)">
                    <i-uil-trash-alt class="h-4 w-4" />
                  </button>
                </label>
              </div>
            </div>

            <div class="border rounded p-4">
              <h4 class="font-semibold mb-2">{{ t("course.problem.test.testcaseModal.preview") }}</h4>
              <pre class="whitespace-pre-wrap"><code>{{ selectedTestcaseContent }}</code></pre>
            </div>
          </div>
        </div>

        <div class="alert alert-success mt-4" v-if="saveSuccess">
          <i-uil-check-circle class="h-6 w-6" />
          <span>{{ t("course.problem.test.testcaseModal.saveSuccess") }}</span>
        </div>

        <div class="alert alert-error mt-4" v-if="saveError">
          <i-uil-exclamation-triangle class="h-6 w-6" />
          <span>{{ t("course.problem.test.testcaseModal.saveError") }}</span>
        </div>

        <div class="card-actions justify-end mt-4">
          <button :class="['btn btn-primary', isLoading && 'loading']" @click="saveTestcaseSettings">
            {{ t("course.problem.test.testcaseModal.save") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>