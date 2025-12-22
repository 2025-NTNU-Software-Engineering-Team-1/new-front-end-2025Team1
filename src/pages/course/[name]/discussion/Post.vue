<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import API from "@/models/api";
import type { DiscussionProblem, CreatePostParams } from "@/types/discussion";

const router = useRouter();
const route = useRoute();
// const session = useSession();
const { t } = useI18n();

// Form fields
const problemId = ref("");
const title = ref("");
const content = ref("");
const language = ref("");
const containsCode = ref(false);

// Data
const problems = ref<DiscussionProblem[]>([]);
const loading = ref(false);
const submitting = ref(false);
const error = ref<string>("");

// Meta information
const codeAllowed = ref(false);
const userRole = ref("");
const metaLoading = ref(false);
const metaLoaded = ref(false);

// Language options
const languageOptions = [
  { value: "", label: t("discussion.create.none") },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "python", label: "Python" },
];

// Load problems list
const loadProblems = async () => {
  try {
    loading.value = true;
    const response: unknown = await API.Discussion.getProblems({
      Limit: 100,
      Page: 1,
    });

    // axios interceptor 將 response.data 展開到 response 層級
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = response as any;
    const status = res.Status || res.data?.Status;
    const problemsData = res.Problems || res.data?.Problems;

    if (status === "OK") {
      problems.value = problemsData || [];
      // 空題目列表不是錯誤，只是課程還沒有題目
    } else {
      const errorMsg = res.Message || res.data?.Message || t("discussion.err_unknown");
      error.value = t("discussion.err_problems_list") + errorMsg;
    }
  } catch (err) {
    console.error("Error loading problems:", err);
    error.value = t("discussion.err_problems_list");
  } finally {
    loading.value = false;
  }
};

// Load problem meta information
const loadProblemMeta = async (problemIdValue: string) => {
  if (!problemIdValue) {
    codeAllowed.value = false;
    userRole.value = "";
    metaLoaded.value = false;
    return;
  }

  try {
    metaLoading.value = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await API.Discussion.getProblemMeta(problemIdValue);
    console.log("[Post.vue] getProblemMeta response:", response);

    // 檢查兩種可能的� �式：直接在 response 或在 response.data 中
    const apiStatus = response.Status || response.data?.Status;
    const codeAllowedValue = response.Code_Allowed ?? response.data?.Code_Allowed;
    const roleValue = response.Role || response.data?.Role;
    const deadlineValue = response.Deadline || response.data?.Deadline;

    console.log("[Post.vue] Extracted values:", {
      status: apiStatus,
      codeAllowed: codeAllowedValue,
      role: roleValue,
      deadline: deadlineValue,
    });

    if (apiStatus === "OK") {
      // 確保 codeAllowed 是布林值
      codeAllowed.value = Boolean(codeAllowedValue);
      userRole.value = roleValue || "";
      metaLoaded.value = true;
      console.log("[Post.vue] Set codeAllowed:", codeAllowed.value, "userRole:", userRole.value);
    } else {
      codeAllowed.value = false;
      userRole.value = "";
      metaLoaded.value = false;
    }
  } catch (err) {
    console.error("[Post.vue] Error loading problem meta:", err);
    codeAllowed.value = false;
    userRole.value = "";
    metaLoaded.value = false;
  } finally {
    metaLoading.value = false;
  }
};

// Auto-detect if content contains code
const detectCodeContent = () => {
  // 如果不允許分享程式碼，不要自動勾選
  if (!codeAllowed.value) {
    containsCode.value = false;
    return;
  }

  const codePatterns = [
    /```[\s\S]*```/, // Code blocks
    /`[^`\n]+`/, // Inline code
    /function\s*\(/, // Function declarations
    /class\s+\w+/, // Class declarations
    /import\s+.*from/, // Import statements
    /export\s+/, // Export statements
    /#include\s*</, // C/C++ includes
    /def\s+\w+\s*\(/, // Python functions
    /public\s+class/, // Java class
  ];

  containsCode.value = codePatterns.some((pattern) => pattern.test(content.value));
};

// Submit post
const submitPost = async () => {
  if (!title.value.trim()) {
    error.value = t("discussion.create.submit_post_err.title_required");
    return;
  }

  if (!content.value.trim()) {
    error.value = t("discussion.create.submit_post_err.content_required");
    return;
  }

  if (!problemId.value) {
    error.value = t("discussion.create.submit_post_err.problem_required");
    return;
  }

  // 檢查程式碼分享權限
  console.log("[Post.vue] Checking code permission:", {
    containsCode: containsCode.value,
    codeAllowed: codeAllowed.value,
    userRole: userRole.value,
  });

  if (containsCode.value && !codeAllowed.value) {
    error.value = t("discussion.create.submit_post_err.contentallowed");
    return;
  }

  try {
    submitting.value = true;
    error.value = "";

    const postData: CreatePostParams = {
      Title: title.value.trim(),
      Content: content.value.trim(),
      Problem_id: problemId.value,
      Language: language.value || undefined,
      Contains_Code: containsCode.value,
    };

    console.log("Submitting post:", postData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await API.Discussion.createPost(postData);
    console.log("Submit response:", response);

    const status = response.Status || response.data?.Status;
    const postId = response.Post_ID || response.data?.Post_ID;

    if (status === "OK" && postId) {
      // Navigate to the new post
      router.push(`/course/${route.params.name}/discussion/${postId}`);
    } else {
      const errorMsg = response.Message || response.data?.Message || t("discussion.err.err_unknown");
      error.value = t("discussion.err.err_failed_create") + errorMsg;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("Error submitting post:", err);
    const errorMsg = err.response?.data?.Message || err.message || t("discussion.err.err_network");
    error.value = t("discussion.err_failed_create") + errorMsg;
  } finally {
    submitting.value = false;
  }
};

// Cancel and go back
const cancel = () => {
  router.back();
};

// Watch for problem selection changes
const onProblemChange = async () => {
  console.log("[Post.vue] onProblemChange called, problemId:", problemId.value);
  if (problemId.value) {
    await loadProblemMeta(problemId.value);
    console.log("[Post.vue] After loadProblemMeta, codeAllowed:", codeAllowed.value);
    // 如果不允許分享程式碼，清除 containsCode 標記
    if (!codeAllowed.value) {
      containsCode.value = false;
      console.log("[Post.vue] Cleared containsCode because codeAllowed is false");
    }
  } else {
    console.log("[Post.vue] No problemId, resetting values");
    codeAllowed.value = false;
    userRole.value = "";
    containsCode.value = false;
  }
};

onMounted(() => {
  loadProblems();
});
</script>

<template>
  <div class="card-container">
    <div class="card mx-auto w-full max-w-5xl">
      <div class="card-body px-8">
        <h2 class="mb-4 text-2xl font-semibold">{{ t("discussion.create.title") }}</h2>
        <!-- Error display -->
        <div v-if="error" class="alert alert-error mb-4">
          <span>{{ error }}</span>
        </div>

        <!-- Problem selection -->
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium">{{ t("discussion.create.problem") }}</label>
          <select v-model="problemId" class="select select-bordered w-full" @change="onProblemChange">
            <option value="" disabled selected hidden>{{ t("discussion.create.problemPlaceholder") }}</option>
            <option v-for="problem in problems" :key="problem.Problem_Id" :value="problem.Problem_Id">
              {{ problem.Problem_Name }}
            </option>
          </select>
        </div>

        <!-- Language selection (if code allowed) -->
        <div v-if="codeAllowed" class="mb-4">
          <label class="mb-1 block text-sm font-medium">{{ t("discussion.create.language") }}</label>
          <select v-model="language" class="select select-bordered w-full">
            <option v-for="option in languageOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Title -->
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium">{{ t("discussion.create.titleLabel") }}</label>
          <input
            v-model="title"
            class="input input-bordered w-full"
            :placeholder="t('discussion.create.titlePlaceholder')"
            maxlength="200"
          />
          <div class="mt-1 text-xs text-gray-500">{{ title.length }}/200</div>
        </div>

        <!-- Content -->
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium">{{ t("discussion.create.contentLabel") }}</label>
          <textarea
            v-model="content"
            rows="12"
            class="textarea textarea-bordered w-full"
            :placeholder="t('discussion.create.contentPlaceholder')"
            @input="detectCodeContent"
          ></textarea>
          <div class="mt-1 flex items-center justify-between">
            <div class="text-xs text-gray-500">{{ t("discussion.create.contentHint") }}</div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">{{ t("discussion.create.contentIncluded") }}</span>
              <input
                type="checkbox"
                v-model="containsCode"
                class="checkbox checkbox-xs"
                :disabled="!codeAllowed"
              />
            </div>
          </div>
        </div>

        <!-- Debug info (remove after testing) -->
        <!-- <div class="text-xs text-gray-500 mb-2">
          Debug: problemId={{ problemId }}, codeAllowed={{ codeAllowed }}, userRole={{ userRole }}, metaLoaded={{ metaLoaded }}
        </div> -->

        <!-- Code not allowed warning -->
        <div v-if="problemId && metaLoaded && !codeAllowed" class="alert alert-warning mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <div class="font-bold">{{ t("discussion.contentallowed.not_allowed") }}</div>
            <div class="text-xs">{{ t("discussion.contentallowed.role", { userRole }) }}</div>
          </div>
        </div>

        <!-- Code allowed info -->
        <div v-else-if="problemId && metaLoaded && codeAllowed" class="alert alert-success mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ t("discussion.contentallowed.allowed") }}</span>
        </div>

        <!-- Submit buttons -->
        <div class="flex gap-3">
          <button
            class="btn btn-primary"
            @click="submitPost"
            :disabled="submitting || !title.trim() || !content.trim()"
          >
            <span v-if="submitting" class="loading-spinner loading-sm loading"></span>
            {{ submitting ? t("discussion.create.submit_processing") : t("discussion.create.submit") }}
          </button>
          <button class="btn btn-ghost" @click="cancel" :disabled="submitting">
            {{ t("discussion.create.cancel") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
