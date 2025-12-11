<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api from "@/models/api";
import { useI18n } from "vue-i18n";

const route = useRoute();
const { t } = useI18n();
useTitle(`AI Usage - ${route.params.name} | Normal OJ`);

const isLoading = ref(false);
const error = ref<unknown>(null);
const expandedKeys = ref<Record<string, boolean>>({});

// 後端原始回傳結構
interface ProblemUsage {
  problem_id: number;
  problem_name: string;
  total_token?: number;
}

interface RawKeyItem {
  id: string | number;
  key_name: string;
  created_by: string;
  masked_value: string;
  problem_usages: ProblemUsage[];
}

// 前端加上的統計欄位
interface KeyItem extends RawKeyItem {
  all_total_token: number;
  max_problems: ProblemUsage[];
  min_problems: ProblemUsage[];
}

interface CourseUsageData {
  totalToken: number;
  keys: KeyItem[];
}

const data = ref<CourseUsageData | null>(null);

function calcKeyStatistics(usages: ProblemUsage[]): {
  total: number;
  maxProblems: ProblemUsage[];
  minProblems: ProblemUsage[];
} {
  if (!usages || usages.length === 0) {
    return { total: 0, maxProblems: [], minProblems: [] };
  }

  const total = usages.reduce((acc, u) => acc + (u.total_token ?? 0), 0);
  const tokenValues = usages.map((u) => u.total_token ?? 0);

  const maxVal = Math.max(...tokenValues);
  const minVal = Math.min(...tokenValues);

  const maxProblems = usages.filter((u) => u.total_token === maxVal);
  const minProblems = usages.filter((u) => u.total_token === minVal);

  return { total, maxProblems, minProblems };
}

// 從後端抓資料並處理成統計資訊
async function fetchUsage() {
  isLoading.value = true;
  error.value = null;

  try {
    const res = await api.CourseAPIUsage.getCourseUsage(route.params.name as string);
    const rawKeys: RawKeyItem[] = res?.data?.keys || [];

    const keys: KeyItem[] = rawKeys.map((key) => {
      const { total, maxProblems, minProblems } = calcKeyStatistics(key.problem_usages);
      return {
        ...key,
        all_total_token: total,
        max_problems: maxProblems,
        min_problems: minProblems,
      };
    });

    const totalToken = keys.reduce((sum, k) => sum + (k.all_total_token || 0), 0);

    data.value = { totalToken, keys };

    // 初始化折疊狀態
    expandedKeys.value = Object.fromEntries(keys.map((k) => [String(k.id), false]));
  } catch (err) {
    console.error("Failed to load API usage data:", err);
    error.value = err;
    data.value = null;
  } finally {
    isLoading.value = false;
  }
}

function toggleExpand(id: string) {
  expandedKeys.value[id] = !expandedKeys.value[id];
}

onMounted(fetchUsage);
</script>

<template>
  <div class="card-container pb-20">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-4">API Usage ({{ route.params.name }})</div>

        <!-- 總 Token -->
        <div
          v-if="data?.totalToken != null"
          class="mb-8 rounded-lg border border-base-300 bg-base-200 p-4 text-center text-lg font-semibold"
        >
          Total Token Usage：
          <span>{{ data.totalToken.toLocaleString() }}</span>
        </div>

        <!-- 加載或錯誤狀態 -->
        <template v-if="isLoading">
          <ui-spinner />
        </template>

        <template v-else-if="error">
          <div class="alert alert-error shadow-lg">
            <div>
              <i-uil-times-circle />
              <span>Failed to load API usage data.</span>
            </div>
          </div>
        </template>

        <!-- 資料顯示 -->
        <template v-else>
          <div v-if="data?.keys.length">
            <div
              v-for="keyItem in data.keys"
              :key="keyItem.id"
              class="mb-6 rounded-lg border border-base-200 bg-base-100 p-4 shadow"
            >
              <div
                class="flex cursor-pointer select-none flex-wrap items-center justify-between gap-3"
                @click="toggleExpand(String(keyItem.id))"
              >
                <div class="flex items-center gap-2 text-lg font-semibold">
                  <span>{{ expandedKeys[keyItem.id] ? "▼" : "▸" }}</span>
                  {{ keyItem.key_name }}
                </div>
                <div class="text-sm">
                  Used by {{ keyItem.problem_usages.length }} problems • Token {{
                    keyItem.all_total_token.toLocaleString()
                  }}
                  • Created by {{ keyItem.created_by }}
                </div>
              </div>

              <transition name="fade">
                <div v-if="expandedKeys[keyItem.id]" class="mt-4 border-t border-base-300 pt-4">
                  <table class="table table-compact w-full">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Problem Name (max/min shown)</th>
                        <th>Token Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="usage in keyItem.problem_usages" :key="usage.problem_id">
                        <td>
                          <router-link
                            class="link link-hover"
                            :to="`/course/${route.params.name}/problem/${usage.problem_id}`"
                          >
                            {{ usage.problem_id }}
                          </router-link>
                        </td>
                        <td>
                          {{ usage.problem_name }}
                          <template
                            v-if="keyItem.max_problems.some((p) => p.problem_id === usage.problem_id)"
                          >
                            <span>(Max)</span>
                          </template>
                          <template
                            v-if="keyItem.min_problems.some((p) => p.problem_id === usage.problem_id)"
                          >
                            <span>(Min)</span>
                          </template>
                        </td>
                        <td>{{ usage.total_token?.toLocaleString?.() || 0 }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </transition>
            </div>
          </div>

          <p v-else class="italic text-base-content/70">No API key usage data.</p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
