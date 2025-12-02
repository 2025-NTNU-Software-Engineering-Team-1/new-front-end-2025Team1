<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSession } from '@/stores/session';
import { useI18n } from 'vue-i18n';
import API from "@/models/api";
import type { 
  DiscussionProblem,
  CreatePostParams,
  CreatePostResponse,
  GetProblemsResponse,
  GetProblemMetaResponse
} from "@/types/discussion";

const router = useRouter();
const route = useRoute();
const session = useSession();
const { t } = useI18n();

// Form fields
const problemId = ref('');
const title = ref('');
const content = ref('');
const category = ref('');
const language = ref('');
const containsCode = ref(false);

// Data
const problems = ref<DiscussionProblem[]>([]);
const loading = ref(false);
const submitting = ref(false);
const error = ref<string>("");

// Meta information
const codeAllowed = ref(true);
const userRole = ref("");

// Language options
const languageOptions = [
  { value: '', label: '無' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'python', label: 'Python' },
];

// Category options
const categoryOptions = [
  { value: '', label: '一般討論' },
  { value: 'question', label: '問題求助' },
  { value: 'solution', label: '解法分享' },
  { value: 'bug', label: '錯誤報告' },
  { value: 'suggestion', label: '建議' },
];

// Load problems list
const loadProblems = async () => {
  try {
    loading.value = true;
    const response: any = await API.Discussion.getProblems({
      Limit: 100,
      Page: 1
    });
    
    
    // axios interceptor 將 response.data 展開到 response 層級
    const status = response.Status || response.data?.Status;
    const problemsData = response.Problems || response.data?.Problems;

    if (status === "OK") {
      problems.value = problemsData || [];
      // 空題目列表不是錯誤，只是課程還沒有題目
    } else {
      const errorMsg = response.Message || response.data?.Message || "未知錯誤";
      error.value = "無法載入題目列表：" + errorMsg;
    }
  } catch (err) {
    console.error("Error loading problems:", err);
    error.value = "載入題目列表時發生錯誤";
  } finally {
    loading.value = false;
  }
};

// Load problem meta information
const loadProblemMeta = async (problemIdValue: string) => {
  if (!problemIdValue) return;
  
  try {
    const response = await API.Discussion.getProblemMeta(problemIdValue) as unknown as GetProblemMetaResponse;
    
    if (response.Status === "OK") {
      codeAllowed.value = response.Code_Allowed;
      userRole.value = response.Role;
    }
  } catch (err) {
    console.error("Error loading problem meta:", err);
  }
};

// Auto-detect if content contains code
const detectCodeContent = () => {
  const codePatterns = [
    /```[\s\S]*```/,  // Code blocks
    /`[^`\n]+`/,      // Inline code
    /function\s*\(/,   // Function declarations
    /class\s+\w+/,     // Class declarations
    /import\s+.*from/, // Import statements
    /export\s+/,       // Export statements
    /#include\s*</,    // C/C++ includes
    /def\s+\w+\s*\(/,  // Python functions
    /public\s+class/,  // Java class
  ];
  
  containsCode.value = codePatterns.some(pattern => pattern.test(content.value));
};

// Submit post
const submitPost = async () => {
  if (!title.value.trim()) {
    error.value = "標題不能為空";
    return;
  }
  
  if (!content.value.trim()) {
    error.value = "內容不能為空";
    return;
  }
  
  if (!problemId.value) {
    error.value = "請選擇題目";
    return;
  }
  
  try {
    submitting.value = true;
    error.value = "";
    
    const postData: CreatePostParams = {
      Title: title.value.trim(),
      Content: content.value.trim(),
      Problem_id: problemId.value,
      Category: category.value || undefined,
      Language: language.value || undefined,
      Contains_Code: containsCode.value,
    };
    
    console.log('Submitting post:', postData);
    const response: any = await API.Discussion.createPost(postData);
    console.log('Submit response:', response);
    
    const status = response.Status || response.data?.Status;
    const postId = response.Post_ID || response.data?.Post_ID;
    
    if (status === "OK" && postId) {
      // Navigate to the new post
      router.push(`/course/${route.params.name}/discussion/${postId}`);
    } else {
      const errorMsg = response.Message || response.data?.Message || "未知錯誤";
      error.value = "發布失敗：" + errorMsg;
    }
  } catch (err: any) {
    console.error("Error submitting post:", err);
    const errorMsg = err.response?.data?.Message || err.message || "網路錯誤";
    error.value = "發布失敗：" + errorMsg;
  } finally {
    submitting.value = false;
  }
};

// Cancel and go back
const cancel = () => {
  router.back();
};

// Watch for problem selection changes
const onProblemChange = () => {
  if (problemId.value) {
    loadProblemMeta(problemId.value);
  }
};

onMounted(() => {
  loadProblems();
});
</script>

<template>
  <div class="card-container">
    <div class="card max-w-5xl w-full mx-auto">
      <div class="card-body px-8">
        <h2 class="text-2xl font-semibold mb-4">{{ t('discussion.create.title') }}</h2>
        <!-- Error display -->
        <div v-if="error" class="alert alert-error mb-4">
          <span>{{ error }}</span>
        </div>

        <!-- Problem selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">{{ t('discussion.create.problem') }}</label>
          <select 
            v-model="problemId" 
            class="w-full select select-bordered" 
            @change="onProblemChange"
          >
            <option value="">{{ t('discussion.create.problemPlaceholder') }}</option>
            <option v-for="problem in problems" :key="problem.Problem_Id" :value="problem.Problem_Id">
              {{ problem.Problem_Name }}
            </option>
          </select>
        </div>

        <!-- Category selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">分類</label>
          <select v-model="category" class="w-full select select-bordered">
            <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Language selection (if code allowed) -->
        <div v-if="codeAllowed" class="mb-4">
          <label class="block text-sm font-medium mb-1">程式語言</label>
          <select v-model="language" class="w-full select select-bordered">
            <option v-for="option in languageOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- Title -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">{{ t('discussion.create.titleLabel') }}</label>
          <input 
            v-model="title" 
            class="w-full input input-bordered" 
            :placeholder="t('discussion.create.titlePlaceholder')" 
            maxlength="200"
          />
          <div class="text-xs text-gray-500 mt-1">{{ title.length }}/200</div>
        </div>

        <!-- Content -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1">{{ t('discussion.create.contentLabel') }}</label>
          <textarea 
            v-model="content" 
            rows="12" 
            class="w-full textarea textarea-bordered" 
            :placeholder="t('discussion.create.contentPlaceholder')"
            @input="detectCodeContent"
          ></textarea>
          <div class="flex justify-between items-center mt-1">
            <div class="text-xs text-gray-500">支援 Markdown 語法</div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">包含程式碼：</span>
              <input 
                type="checkbox" 
                v-model="containsCode" 
                class="checkbox checkbox-xs"
                :disabled="!codeAllowed"
              />
            </div>
          </div>
        </div>

        <!-- Code not allowed warning -->
        <div v-if="!codeAllowed && containsCode" class="alert alert-warning mb-4">
          <span>此題目不允許分享程式碼</span>
        </div>

        <!-- Submit buttons -->
        <div class="flex gap-3">
          <button 
            class="btn btn-primary" 
            @click="submitPost"
            :disabled="submitting || !title.trim() || !content.trim()"
          >
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            {{ submitting ? '發布中...' : t('discussion.create.submit') }}
          </button>
          <button class="btn btn-ghost" @click="cancel" :disabled="submitting">
            {{ t('discussion.create.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>