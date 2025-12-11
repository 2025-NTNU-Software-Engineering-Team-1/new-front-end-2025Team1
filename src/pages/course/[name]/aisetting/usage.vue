<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api from "@/models/api";
import { useI18n } from "vue-i18n";

// ==========================================
// [CONFIG] Console  1=open, 0=close
const DEBUG_MODE = 1;
// ==========================================

// --- Logger Utility ---
const logger = {
  log: (label: string, data?: any) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Log] ${label}`, "color: #3b82f6; font-weight: bold;", data || "");
  },
  success: (label: string, data?: any) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Success] ${label}`, "color: #10b981; font-weight: bold;", data || "");
  },
  error: (label: string, error?: any) => {
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
  table: (data: any) => {
    if (!DEBUG_MODE) return;
    console.table(data);
  },
};

const route = useRoute();
const { t } = useI18n();
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
  max_problems: ProblemUsage[];
  min_problems: ProblemUsage[];
}

interface CourseUsageData {
  totalToken: number;
  keys: KeyItem[];
}

const data = ref<CourseUsageData | null>(null);

function parseApiResponse(res: any) {
  const data = res?.data;
  const rawStatus = data?.status || res?.status;
  const statusStr = String(rawStatus || "").toLowerCase();
  const message = data?.message || res?.message || "Unknown response";
  const isSuccess = statusStr === "ok" || statusStr === "success" || rawStatus === 200;
  return { isSuccess, message, data, rawStatus };
}

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

async function fetchUsage() {
  logger.group(`Fetch Usage Started: ${route.params.name}`);
  isLoading.value = true;
  error.value = null;

  try {
    const res = await api.CourseAPIUsage.getCourseUsage(route.params.name as string);
    // logger.log("Raw Response Received", res);

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
      if (!key.created_by) missingFields.push("created_by");
      if (!key.problem_usages) missingFields.push("problem_usages (CRITICAL)");

      if (missingFields.length > 0) {
        logger.error(`Missing Data Detected at Index ${index} (ID: ${key.id || "Unknown"})`, {
          missing: missingFields,
          rawObject: key,
        });
      }

      if (key.problem_usages && Array.isArray(key.problem_usages)) {
        key.problem_usages.forEach((u, i) => {
          if (!u.problem_id || !u.problem_name) {
            logger.error(`Incomplete Problem Data at Key ID ${key.id}, Item ${i}`, u);
          }
        });
      }

      logger.groupCollapsed(`Processing Key: ${key.key_name} (ID: ${key.id})`);

      const safeUsages = key.problem_usages || [];

      const { total, maxProblems, minProblems } = calcKeyStatistics(safeUsages);

      logger.log(`Problem Usages Count: ${safeUsages.length}`);
      logger.log(`Calculated Total Token: ${total}`);

      if (safeUsages.length > 0) {
        logger.table(
          safeUsages.map((u) => ({ id: u.problem_id, name: u.problem_name, token: u.total_token })),
        );
      }

      logger.groupEnd(); // End key detail

      return {
        ...key,
        id: key.id || `temp-${index}`,
        key_name: key.key_name || "Unknown Key",
        created_by: key.created_by || "Unknown User",
        problem_usages: safeUsages,
        all_total_token: total,
        max_problems: maxProblems,
        min_problems: minProblems,
      };
    });

    const totalToken = keys.reduce((sum, k) => sum + (k.all_total_token || 0), 0);
    logger.success("Final Calculation Complete", { totalToken, keysCount: keys.length });

    data.value = { totalToken, keys };

    expandedKeys.value = Object.fromEntries(keys.map((k) => [String(k.id), false]));
    logger.log("Initialized Expanded State", expandedKeys.value);
  } catch (err: any) {
    const errMsg = err?.response?.data?.message || err?.message || "Failed to load API usage data";
    logger.error("Fetch Usage Error", err);
    error.value = errMsg;
    data.value = null;
  } finally {
    isLoading.value = false;
    logger.groupEnd(); // End Fetch Group
  }
}

function toggleExpand(id: string) {
  expandedKeys.value[id] = !expandedKeys.value[id];
  logger.log(`Toggled Key ID [${id}]`, expandedKeys.value[id] ? "Expanded (▼)" : "Collapsed (▸)");
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
          class="mb-8 rounded-lg border border-base-300 bg-base-200 p-4 text-center text-lg font-semibold"
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
                  Used by {{ keyItem.problem_usages.length }} problems • Token
                  {{ keyItem.all_total_token.toLocaleString() }} • Created by {{ keyItem.created_by }}
                </div>
              </div>

              <transition name="fade">
                <div v-if="expandedKeys[keyItem.id]" class="mt-4 border-t border-base-300 pt-4">
                  <table class="table table-compact w-full">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Problem Name (max/min shown)</th>
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
                            <span class="font-bold text-warning">(Max)</span>
                          </template>
                          <template
                            v-if="keyItem.min_problems.some((p) => p.problem_id === usage.problem_id)"
                          >
                            <span class="font-bold text-info">(Min)</span>
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

          <p v-else class="italic text-base-content/70">No API key usage data.</p>
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
