<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import API from "@/models/api";
import type { DiscussionProblem, GetProblemsResponse, PaginationInfo } from "@/types/discussion";

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
      Mode: "All", // 後端只支援 "All" 模式
      Limit: pagination.value.limit,
      Page: pagination.value.page,
    };

    console.log("Loading problems with params:", params);
    const response: any = await API.Discussion.getProblems(params);
    console.log("Problems response:", response);

    // axios interceptor 將 response.data 展開到 response 層級
    const status = response.Status || response.data?.Status;
    const problemsData = response.Problems || response.data?.Problems;

    if (status === "OK") {
      problems.value = problemsData || [];
      console.log("Loaded problems count:", problems.value.length);
    } else {
      console.error("Failed to load problems:", response);
      const errorMsg = response.Message || response.data?.Message || "未知錯誤";
      error.value = "載入題目失敗：" + errorMsg;
    }
  } catch (err: any) {
    console.error("Error loading problems:", err);
    const errorMsg = err.response?.data?.Message || err.message || "網路錯誤";
    error.value = "載入題目失敗：" + errorMsg;
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
        <div class="mb-6 flex items-center justify-between">
          <router-link :to="`/course/${route.params.name}/discussion`" class="btn btn-ghost btn-sm">
            <i-uil-arrow-left class="h-4 w-4" />
            {{ t("discussion.problems.backToDiscussion") }}
          </router-link>
        </div>
        <div class="card-title mb-6">
          {{ t("discussion.problems.title") }}
        </div>

        <p class="mb-6 text-gray-600 dark:text-gray-300">
          {{ t("discussion.problems.selectProblem") }}
        </p>

        <!-- Loading state -->
        <div v-if="loading" class="flex justify-center py-8">
          <div class="loading-spinner loading-lg loading"></div>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="alert alert-error">
          <span>{{ error }}</span>
          <button class="btn btn-ghost btn-sm" @click="loadProblems">重試</button>
        </div>

        <!-- Problems grid -->
        <div v-else-if="problems.length > 0" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <router-link
            v-for="problem in problems"
            :key="problem.Problem_Id"
            :to="`/course/${route.params.name}/discussion/problem/${problem.Problem_Id}`"
            class="card cursor-pointer bg-base-200 transition-colors hover:bg-base-300"
          >
            <div class="card-body p-4">
              <h3 class="card-title text-lg">{{ problem.Problem_Name }}</h3>
              <div class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <span v-if="problemDiscussionCounts[problem.Problem_Id]">
                  {{ problemDiscussionCounts[problem.Problem_Id] }} 個討論
                </span>
                <span v-else> 暫無討論 </span>
              </div>
              <div class="mt-2">
                <div class="badge badge-outline badge-sm">ID: {{ problem.Problem_Id }}</div>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Empty state -->
        <div v-else class="py-8 text-center text-gray-500">目前沒有可討論的題目</div>
      </div>
    </div>
  </div>
</template>
