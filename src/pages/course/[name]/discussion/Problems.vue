<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import API from "@/models/api";
import type { 
  DiscussionProblem,
  GetProblemsResponse,
  PaginationInfo
} from "@/types/discussion";

const route = useRoute();
const { t } = useI18n();

const problems = ref<DiscussionProblem[]>([]);
const loading = ref(true);
const error = ref<string>("");

// 分頁相關
const pagination = ref<PaginationInfo>({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
});

// 載入題目列表
const loadProblems = async () => {
  try {
    loading.value = true;
    error.value = "";
    
    const params = {
      Mode: "New",
      Limit: pagination.value.limit,
      Page: pagination.value.page,
    };

    const response = await API.Discussion.getProblems(params) as unknown as GetProblemsResponse;
    
    if (response.Status === "OK") {
      problems.value = response.Problems || [];
    } else {
      error.value = "Failed to load problems";
    }
  } catch (err) {
    console.error("Error loading problems:", err);
    error.value = "Network error occurred";
  } finally {
    loading.value = false;
  }
};

// 計算題目討論數量（這裡可以在後端API中提供，或者通過額外的API調用獲取）
const problemDiscussionCounts = computed(() => {
  // 這裡應該從API獲取每個題目的討論數量
  // 暫時使用空對象，實際應用中可以調用額外的API
  const counts: Record<number, number> = {};
  return counts;
});

onMounted(() => {
  loadProblems();
});
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex items-center justify-between mb-6">
          <router-link 
            :to="`/course/${route.params.name}/discussion`"
            class="btn btn-ghost btn-sm"
          >
            <i-uil-arrow-left class="w-4 h-4" />
            {{ t('discussion.problems.backToDiscussion') }}
          </router-link>
        </div>
        <div class="card-title mb-6">
          {{ t('discussion.problems.title') }}
        </div>
        
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          {{ t('discussion.problems.selectProblem') }}
        </p>

        <!-- Loading state -->
        <div v-if="loading" class="flex justify-center py-8">
          <div class="loading loading-spinner loading-lg"></div>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="alert alert-error">
          <span>{{ error }}</span>
          <button class="btn btn-sm btn-ghost" @click="loadProblems">重試</button>
        </div>

        <!-- Problems grid -->
        <div v-else-if="problems.length > 0" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <router-link 
            v-for="problem in problems" 
            :key="problem.Problem_Id" 
            :to="`/course/${route.params.name}/discussion/problem/${problem.Problem_Id}`"
            class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer"
          >
            <div class="card-body p-4">
              <h3 class="card-title text-lg">{{ problem.Problem_Name }}</h3>
              <div class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <span v-if="problemDiscussionCounts[problem.Problem_Id]">
                  {{ problemDiscussionCounts[problem.Problem_Id] }} 個討論
                </span>
                <span v-else>
                  暫無討論
                </span>
              </div>
              <div class="mt-2">
                <div class="badge badge-outline badge-sm">
                  ID: {{ problem.Problem_Id }}
                </div>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center text-gray-500 py-8">
          目前沒有可討論的題目
        </div>
      </div>
    </div>
  </div>
</template>