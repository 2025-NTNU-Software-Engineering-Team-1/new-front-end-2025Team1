<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api, { fetcher } from "@/models/api";
import { useI18n } from "vue-i18n";
import { ZipReader, BlobReader, TextWriter, ZipWriter, BlobWriter, TextReader } from "@zip.js/zip.js";

const route = useRoute();
const { t } = useI18n();

useTitle(`Test Cases - ${route.params.id} - ${route.params.name} | Normal OJ`);

const useDefaultTestcases = ref(true);
const selectedTestcases = ref<string[]>([]);
const testcaseFiles = ref<{ name: string; content: string }[]>([]);
const selectedTestcaseContent = ref("");
const isLoading = ref(false);
const saveSuccess = ref(false);
const saveError = ref(false);

// Public test cases from API
const publicTestCases = ref<
  Array<{
    File_Name: string;
    Memory_Limit: number;
    Time_Limit: number;
    Input_Content: string;
    Output_Content: string;
  }>
>([]);
const isLoadingPublicCases = ref(false);

// API 1: Load public test cases when component mounts
onMounted(async () => {
  try {
    isLoadingPublicCases.value = true;
    const response = await api.TrialSubmission.getPublicTestCases(Number(route.params.id));
    if (response.data.status === "OK") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicTestCases.value = response.data.trial_cases.map((tc: any) => ({
        File_Name: tc.file_name,
        Memory_Limit: tc.memory_limit,
        Time_Limit: tc.time_limit,
        Input_Content: tc.input_content,
        Output_Content: tc.output_content,
      }));
      console.log("Loaded public test cases:", publicTestCases.value);
    } else {
      console.error("Failed to load public test cases");
    }
  } catch (error) {
    console.error("Error loading public test cases:", error);
  } finally {
    isLoadingPublicCases.value = false;
  }
});

async function handleTestcaseUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !file.name.endsWith(".zip")) return;
  if (testcaseFiles.value.length > 0) {
    const confirmReplace = confirm(t("course.problem.test.testcaseModal.confirm"));
    if (!confirmReplace) return;
  }

  const zipReader = new ZipReader(new BlobReader(file));
  const entries = await zipReader.getEntries();

  testcaseFiles.value = [];
  for (const entry of entries) {
    if (!entry.directory && entry.getData) {
      const ext = entry.filename.split(".").pop()?.toLowerCase();
      try {
        if (["pdf"].includes(ext || "")) {
          const blobWriter = new BlobWriter("application/pdf");
          const blob = await entry.getData(blobWriter);
          const url = URL.createObjectURL(blob);

          testcaseFiles.value.push({
            name: entry.filename,
            content: `${t("course.problem.test.testcaseModal.pdfNotice")}\n${url}`,
          });
        } else if (["txt", "md", "in", "out", "json", "csv", "xml"].includes(ext || "")) {
          const textWriter = new TextWriter();
          const content = await entry.getData(textWriter);
          testcaseFiles.value.push({ name: entry.filename, content });
        } else {
          const blobWriter = new BlobWriter();
          const blob = await entry.getData(blobWriter);
          const url = URL.createObjectURL(blob);
          testcaseFiles.value.push({
            name: entry.filename,
            content: `[${t("course.problem.test.testcaseModal.unsupported", { ext })}]\n${url}`,
          });
        }
      } catch (err) {
        console.error(`Error reading ${entry.filename}:`, err);
      }
    }
  }
  await zipReader.close();
}

function previewTestcase(file: { name: string; content: string }) {
  selectedTestcaseContent.value = file.content;
}

function deleteTestcase(file: { name: string; content: string }) {
  const index = testcaseFiles.value.findIndex((f) => f.name === file.name);
  if (index !== -1) {
    testcaseFiles.value.splice(index, 1);
    selectedTestcases.value = selectedTestcases.value.filter((name) => name !== file.name);
    if (selectedTestcaseContent.value === file.content) {
      selectedTestcaseContent.value = "";
    }
  }
}

async function saveTestcaseSettings() {
  if (!useDefaultTestcases.value && selectedTestcases.value.length === 0) {
    alert(t("course.problem.test.testcaseModal.alert"));
    return;
  }
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
    console.error("Error saving testcase settings:", error);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div class="card-title">{{ t("course.problem.test.testcaseModal.title") }}</div>
          <router-link :to="`/course/${route.params.name}/problem/${route.params.id}/test`" class="btn">
            {{ t("course.problem.test.back") }}
          </router-link>
        </div>

        <div class="divider"></div>

        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <span class="label-text">{{ t("course.problem.test.testcaseModal.useDefault") }}</span>
            <input type="checkbox" class="toggle" v-model="useDefaultTestcases" />
          </label>
        </div>

        <div class="divider"></div>

        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <span class="text-lg font-semibold">
              {{ t("course.problem.test.testcaseModal.customTestcases") }}
            </span>
            <input
              type="file"
              class="file-input-bordered file-input w-full max-w-xs"
              accept=".zip"
              @change="handleTestcaseUpload"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="rounded border p-4">
              <h4 class="mb-2 font-semibold">{{ t("course.problem.test.testcaseModal.files") }}</h4>
              <div class="flex flex-col gap-2">
                <label v-for="file in testcaseFiles" :key="file.name" class="flex items-center gap-2">
                  <input type="checkbox" class="checkbox" v-model="selectedTestcases" :value="file.name" />
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

            <div class="rounded border p-4">
              <h4 class="mb-2 font-semibold">{{ t("course.problem.test.testcaseModal.preview") }}</h4>
              <div class="h-64 max-w-full overflow-auto whitespace-pre-wrap rounded border bg-base-200 p-2">
                <template v-if="selectedTestcaseContent.includes('blob:')">
                  <div v-for="(line, idx) in selectedTestcaseContent.split('\n')" :key="idx">
                    <template v-if="line.startsWith('blob:')">
                      <a :href="line" target="_blank" class="link break-all text-blue-500 underline">
                        {{ t("course.problem.test.testcaseModal.download") }}
                      </a>
                    </template>
                    <template v-else>
                      {{ line }}
                    </template>
                  </div>
                </template>
                <template v-else>
                  <pre><code>{{ selectedTestcaseContent }}</code></pre>
                </template>
              </div>
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

        <div class="card-actions mt-4 justify-end">
          <button :class="['btn btn-primary', isLoading && 'loading']" @click="saveTestcaseSettings">
            {{ t("course.problem.test.testcaseModal.save") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
