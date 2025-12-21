<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api from "@/models/api";

// ==========================================
// [CONFIG] Console  1=open, 0=close
const DEBUG_MODE = 1;
// ==========================================

// --- Logger Utility ---
const logger = {
  log: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Log] ${label}`, "color: #3b82f6; font-weight: bold;", data || "");
  },
  success: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Success] ${label}`, "color: #10b981; font-weight: bold;", data || "");
  },
  error: (label: string, error?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Error] ${label}`, "color: #ef4444; font-weight: bold;", error || "");
  },
  group: (label: string) => {
    if (!DEBUG_MODE) return;
    console.group(`%c[Group] ${label}`, "color: #8b5cf6; font-weight: bold;");
  },
  groupCollapsed: (label: string) => {
    if (!DEBUG_MODE) return;
    console.groupCollapsed(`%c[Detail] ${label}`, "color: #6366f1; font-weight: bold;");
  },
  groupEnd: () => {
    if (!DEBUG_MODE) return;
    console.groupEnd();
  },
  table: (data: unknown) => {
    if (!DEBUG_MODE) return;
    console.table(data);
  },
};

const route = useRoute();
// const { t } = useI18n();
useTitle(`AI Usage - ${route.params.name} | Normal OJ`);

const isLoading = ref(false);
const error = ref<unknown>(null);
const expandedKeys = ref<Record<string, boolean>>({});

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

interface KeyItem extends RawKeyItem {
  all_total_token: number;
  average_token: number;
  is_flat: boolean;
  problem_usages: ProblemUsage[];
}

interface CourseUsageData {
  totalToken: number;
  keys: KeyItem[];
}

const data = ref<CourseUsageData | null>(null);

function parseApiResponse(res: unknown) {
  const data = res?.data;
  const rawStatus = data?.status || res?.status;
  const statusStr = String(rawStatus || "").toLowerCase();
  const message = data?.message || res?.message || "Unknown response";
  const isSuccess = statusStr === "ok" || statusStr === "success" || rawStatus === 200;
  return { isSuccess, message, data, rawStatus };
}

// Sort desc, calculate avg, check if flat
function calcKeyStatistics(usages: ProblemUsage[]): {
  total: number;
  average: number;
  isFlat: boolean;
  sortedUsages: ProblemUsage[];
} {
  if (!usages || usages.length === 0) {
    return { total: 0, average: 0, isFlat: true, sortedUsages: [] };
  }

  // Sort descending by token usage
  const sortedUsages = [...usages].sort((a, b) => {
    return (b.total_token ?? 0) - (a.total_token ?? 0);
  });

  const total = sortedUsages.reduce((acc, u) => acc + (u.total_token ?? 0), 0);

  // Check boundaries
  const maxVal = sortedUsages[0].total_token ?? 0;
  const minVal = sortedUsages[sortedUsages.length - 1].total_token ?? 0;

  // If max == min, the data is "flat" (e.g., all 0 or all equal)
  const isFlat = maxVal === minVal;

  const average = total / sortedUsages.length;

  return { total, average, isFlat, sortedUsages };
}

async function fetchUsage() {
  logger.group(`Fetch Usage Started: ${route.params.name}`);
  isLoading.value = true;
  error.value = null;

  try {
    const res = await api.CourseAPIUsage.getCourseUsage(route.params.name as string);
    const { isSuccess, data: resData, message } = parseApiResponse(res);

    if (!isSuccess && !resData) {
      throw new Error(message || "Failed to fetch usage data");
    }

    const rawKeys: RawKeyItem[] = resData?.keys || [];
    logger.log(`Found ${rawKeys.length} keys`);

    const keys: KeyItem[] = rawKeys.map((key, index) => {
      // --- Data Integrity Check ---
      const missingFields: string[] = [];
      if (key.id == null) missingFields.push("id");
      if (!key.key_name) missingFields.push("key_name");
      if (!key.problem_usages) missingFields.push("problem_usages");

      if (missingFields.length > 0) {
        logger.error(`Missing Data at Index ${index}`, missingFields);
      }

      const safeUsages = key.problem_usages || [];

      // Calculate stats and sort
      const { total, average, isFlat, sortedUsages } = calcKeyStatistics(safeUsages);

      logger.groupCollapsed(`Key: ${key.key_name}`);
      logger.log(`Total: ${total}, Avg: ${average}, IsFlat: ${isFlat}`);
      logger.groupEnd();

      return {
        ...key,
        id: key.id || `temp-${index}`,
        key_name: key.key_name || "Unknown Key",
        created_by: key.created_by || "Unknown User",
        problem_usages: sortedUsages, // Sorted list
        all_total_token: total,
        average_token: average,
        is_flat: isFlat,
      };
    });

    const totalToken = keys.reduce((sum, k) => sum + (k.all_total_token || 0), 0);
    logger.success("Calculation Complete", { totalToken });

    data.value = { totalToken, keys };
    expandedKeys.value = Object.fromEntries(keys.map((k) => [String(k.id), false]));
  } catch (err: unknown) {
    const errMsg = err?.response?.data?.message || err?.message || "Failed to load API usage data";
    logger.error("Fetch Usage Error", err);
    error.value = errMsg;
    data.value = null;
  } finally {
    isLoading.value = false;
    logger.groupEnd();
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

        <div
          v-if="data?.totalToken != null"
          class="border-base-300 bg-base-200 mb-8 rounded-lg border p-4 text-center text-lg font-semibold"
        >
          Total Token Usage：
          <span>{{ data.totalToken.toLocaleString() }}</span>
        </div>

        <template v-if="isLoading">
          <ui-spinner />
        </template>

        <template v-else-if="error">
          <div class="alert alert-error shadow-lg">
            <div>
              <i-uil-times-circle />
              <span>{{ error }}</span>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="data?.keys.length">
            <div
              v-for="keyItem in data.keys"
              :key="keyItem.id"
              class="border-base-200 bg-base-100 mb-6 rounded-lg border p-4 shadow"
            >
              <div
                class="flex cursor-pointer flex-wrap items-center justify-between gap-3 select-none"
                @click="toggleExpand(String(keyItem.id))"
              >
                <div class="flex items-center gap-2 text-lg font-semibold">
                  <span>{{ expandedKeys[keyItem.id] ? "▼" : "▸" }}</span>
                  {{ keyItem.key_name }}
                </div>
                <div class="text-sm">
                  Used by {{ keyItem.problem_usages.length }} problems • Token
                  {{ keyItem.all_total_token.toLocaleString() }} • Created by {{ keyItem.created_by }}
                </div>
              </div>

              <transition name="fade">
                <div v-if="expandedKeys[keyItem.id]" class="border-base-300 mt-4 border-t pt-4">
                  <div
                    v-if="!keyItem.is_flat && keyItem.problem_usages.length > 0"
                    class="text-base-content/60 mb-2 text-xs"
                  >
                    Average: {{ Math.round(keyItem.average_token).toLocaleString() }} tokens / problem
                  </div>

                  <table class="table-compact table w-full">
                    <thead>
                      <tr>
                        <th class="w-16">Rank</th>
                        <th>Problem Name</th>
                        <th class="text-right">Token Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(usage, index) in keyItem.problem_usages" :key="usage.problem_id">
                        <td class="font-mono text-xs opacity-50">{{ index + 1 }}</td>

                        <td>
                          <div class="flex items-center gap-2">
                            <router-link
                              class="link link-hover font-medium"
                              :to="`/course/${route.params.name}/problem/${usage.problem_id}`"
                            >
                              {{ usage.problem_name }}
                            </router-link>

                            <template v-if="!keyItem.is_flat">
                              <span
                                v-if="index === 0"
                                class="badge badge-error badge-sm gap-1 font-bold text-white"
                              >
                                TOP 1
                              </span>
                              <span
                                v-else-if="(usage.total_token || 0) > keyItem.average_token * 1.5"
                                class="badge badge-warning badge-sm text-xs"
                              >
                                High
                              </span>
                            </template>
                          </div>
                        </td>

                        <td class="text-right font-mono">
                          <span :class="{ 'text-base-content font-bold': index === 0 && !keyItem.is_flat }">
                            {{ usage.total_token?.toLocaleString?.() || 0 }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </transition>
            </div>
          </div>

          <p v-else class="text-base-content/70 italic">No API key usage data.</p>
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
