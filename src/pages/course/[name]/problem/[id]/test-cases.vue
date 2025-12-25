<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTitle } from "@vueuse/core";
// api import removed - not currently used
import { useI18n } from "vue-i18n";
import { ZipReader, BlobReader, TextWriter, ZipWriter, BlobWriter, TextReader } from "@zip.js/zip.js";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useTitle(`Test Cases - ${route.params.id} - ${route.params.name} | Normal OJ`);

const selectedTestcases = ref<string[]>([]);
const testcaseFiles = ref<{ name: string; content: string }[]>([]);
const selectedTestcaseContent = ref("");
const isLoading = ref(false);
const saveSuccess = ref(false);
const saveError = ref(false);

// Load existing custom testcases from localStorage
onMounted(() => {
  const storageKey = `testcase_settings_${route.params.id}`;
  const settingsJson = localStorage.getItem(storageKey);
  if (settingsJson) {
    try {
      const settings = JSON.parse(settingsJson);
      if (settings.testcaseFiles) {
        testcaseFiles.value = settings.testcaseFiles;
      }
      if (settings.selectedTestcases) {
        selectedTestcases.value = settings.selectedTestcases;
      }
    } catch (err) {
      console.error("Failed to load testcase settings:", err);
    }
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
  if (selectedTestcases.value.length === 0) {
    alert(t("course.problem.test.testcaseModal.alert"));
    return;
  }
  isLoading.value = true;
  saveSuccess.value = false;
  saveError.value = false;

  try {
    // Create testcase zip with selected files
    const testcaseZipWriter = new ZipWriter(new BlobWriter("application/zip"));
    for (const testcase of testcaseFiles.value) {
      if (selectedTestcases.value.includes(testcase.name)) {
        await testcaseZipWriter.add(testcase.name, new TextReader(testcase.content));
      }
    }
    const testcaseBlob = await testcaseZipWriter.close();

    // Save settings to localStorage for test.vue to use
    const storageKey = `testcase_settings_${route.params.id}`;
    const settings = {
      selectedTestcases: selectedTestcases.value,
      testcaseFiles: testcaseFiles.value.map((f) => ({ name: f.name, content: f.content })),
    };
    localStorage.setItem(storageKey, JSON.stringify(settings));

    // If custom testcases blob exists, convert to base64 and store
    if (testcaseBlob) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        localStorage.setItem(`${storageKey}_blob`, base64);
      };
      reader.readAsDataURL(testcaseBlob);
    } else {
      localStorage.removeItem(`${storageKey}_blob`);
    }

    saveSuccess.value = true;

    // Navigate to test page after a short delay to show success message
    setTimeout(() => {
      router.push(`/course/${route.params.name}/problem/${route.params.id}/test`);
    }, 1000);
  } catch (error) {
    saveError.value = true;
    console.error("Error saving testcase settings:", error);
  } finally {
    isLoading.value = false;
  }
}

async function downloadTestcases() {
  try {
    const storageKey = `testcase_settings_${route.params.id}`;
    const blobBase64 = localStorage.getItem(`${storageKey}_blob`);

    if (!blobBase64) {
      // User-friendly error message when no testcases found
      alert(t("course.problem.test.testcaseModal.noTestcasesToDownload"));
      return;
    }

    // Convert data URL to blob
    const response = await fetch(blobBase64);
    if (!response.ok) {
      throw new Error("Failed to fetch blob");
    }
    const blob = await response.blob();

    if (blob.size === 0) {
      alert(t("course.problem.test.testcaseModal.emptyTestcaseFile"));
      return;
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `problem_${route.params.id}_custom_testcases.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading testcases:", error);
    alert(t("course.problem.test.testcaseModal.downloadFailed"));
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <!-- Title and Upload section in the same row -->
        <div class="mb-4 flex items-center justify-between">
          <div class="card-title">{{ t("course.problem.test.testcaseModal.customTestcases") }}</div>

          <!-- Upload status, download button, and file input -->
          <div class="flex items-center gap-3">
            <!-- Status Badge & Download -->
            <div class="flex items-center gap-2">
              <span v-if="testcaseFiles.length > 0" class="badge badge-success badge-outline text-xs">
                {{ t("course.problems.uploaded") }}
              </span>
              <span v-else class="badge badge-outline text-xs opacity-70">
                {{ t("course.problems.notUploaded") }}
              </span>
              <!-- Download Button -->
              <button v-if="testcaseFiles.length > 0" class="btn btn-xs" @click="downloadTestcases">
                {{ t("course.problems.download") }}
              </button>
            </div>
            <!-- File Upload Input -->
            <input
              type="file"
              class="file-input-bordered file-input w-full max-w-xs"
              accept=".zip"
              @change="handleTestcaseUpload"
            />
          </div>
        </div>

        <!-- Files and Preview section -->
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
            <div class="bg-base-200 h-64 max-w-full overflow-auto rounded border p-2 whitespace-pre-wrap">
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

        <div class="alert alert-success mt-4" v-if="saveSuccess">
          <i-uil-check-circle class="h-6 w-6" />
          <span>{{ t("course.problem.test.testcaseModal.saveSuccess") }}</span>
        </div>

        <div class="alert alert-error mt-4" v-if="saveError">
          <i-uil-exclamation-triangle class="h-6 w-6" />
          <span>{{ t("course.problem.test.testcaseModal.saveError") }}</span>
        </div>

        <!-- Bottom buttons: Save and Back -->
        <div class="card-actions mt-4 justify-end gap-2">
          <router-link :to="`/course/${route.params.name}/problem/${route.params.id}/test`" class="btn">
            {{ t("course.problem.test.back") }}
          </router-link>
          <button :class="['btn btn-primary', isLoading && 'loading']" @click="saveTestcaseSettings">
            {{ t("course.problem.test.testcaseModal.save") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
