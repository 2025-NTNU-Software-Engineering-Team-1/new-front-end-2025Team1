<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api from "@/models/api";
import { useI18n } from "vue-i18n";

// --- ECharts Imports ---
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, GraphChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
} from "echarts/components";
import VChart from "vue-echarts";

// Register ECharts components
use([
  CanvasRenderer,
  BarChart,
  GraphChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
]);

const { t } = useI18n();

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
useTitle(`AI Usage - ${route.params.name} | Normal OJ`);

const isLoading = ref(false);
const error = ref<unknown>(null);
const expandedKeys = ref<Record<string, boolean>>({});

// [STATE] Control Chart Section Expansion (Default Closed)
const isChartExpanded = ref(false);

// --- Interfaces ---

// [NEW] Interface for ECharts Tooltip Params to fix "no-explicit-any"
interface ChartTooltipParam {
  componentType?: "series";
  seriesType?: string;
  seriesIndex?: number;
  seriesName?: string;
  name: string;
  dataIndex: number;
  data: unknown;
  value: number | string;
  color?: string;
  marker?: string;
}

interface ProblemUsage {
  problem_id: number;
  problem_name: string;
  total_token?: number;
  cycle_token?: number;
}

interface RawKeyItem {
  id: string | number;
  key_name: string;
  created_by: string;
  masked_value: string;
  problem_usages: ProblemUsage[];
  rpd?: number;
  last_reset_date?: string;
  cycle_total_token?: number;
}

interface KeyItem extends RawKeyItem {
  all_total_token: number;
  all_cycle_token: number;
  average_token: number;
  is_flat: boolean;
  problem_usages: ProblemUsage[];
}

interface CourseUsageData {
  totalToken: number;
  totalCycleToken: number;
  lastResetDate: string | null;
  keys: KeyItem[];
}

const data = ref<CourseUsageData | null>(null);

// ==========================================
// [CHART LOGIC] Aggregation & Config
// ==========================================
const chartType = ref<"bar" | "bubble">("bar");

const problemStats = computed(() => {
  if (!data.value || !data.value.keys) return [];

  const map = new Map<number, { id: number; name: string; total: number }>();

  data.value.keys.forEach((key) => {
    key.problem_usages.forEach((usage) => {
      const pid = usage.problem_id;
      if (!map.has(pid)) {
        map.set(pid, {
          id: pid,
          name: usage.problem_name,
          total: 0,
        });
      }
      map.get(pid)!.total += usage.total_token || 0;
    });
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
});

// Helper color palette for bubbles
const colorPalette = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

const chartOption = computed(() => {
  const stats = problemStats.value;
  const isBubble = chartType.value === "bubble";

  // Common Tooltip Configuration
  const tooltip = {
    trigger: isBubble ? "item" : "axis",
    axisPointer: { type: "shadow" },
    formatter: (params: ChartTooltipParam | ChartTooltipParam[]) => {
      const p = Array.isArray(params) ? params[0] : params;
      const val = Number(p.value);
      const marker =
        p.marker ||
        `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${p.color};"></span>`;

      return `
        <div style="font-weight:bold; margin-bottom: 4px;">${p.name}</div>
        <div style="display: flex; align-items: center; gap: 4px;">
          ${marker}
          Token Usage: <span style="font-weight:bold;">${val.toLocaleString()}</span>
        </div>
      `;
    },
  };

  // --- BAR CHART CONFIG ---
  if (!isBubble) {
    return {
      tooltip,
      grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
      dataZoom: [
        { type: "inside", start: 0, end: stats.length > 20 ? 30 : 100 },
        { type: "slider", bottom: 10 },
      ],
      xAxis: {
        type: "category",
        data: stats.map((i) => i.name),
        axisLabel: { interval: 0, rotate: 45, width: 100, overflow: "truncate" },
      },
      yAxis: { type: "value", name: t("course.aisetting.usage.totalTokens") },
      series: [
        {
          name: "Token Usage",
          type: "bar",
          data: stats.map((i) => i.total),
          itemStyle: { color: "#3b82f6", borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }

  // --- PACKED BUBBLE CHART CONFIG (Graph Force Layout) ---
  const maxVal = Math.max(...stats.map((s) => s.total), 1);
  const minVal = Math.min(...stats.map((s) => s.total), 0);

  const graphData = stats.map((item, index) => {
    const ratio = (item.total - minVal) / (maxVal - minVal || 1);
    const size = 30 + ratio * 90; // range 30 -> 120

    return {
      name: item.name,
      value: item.total,
      symbolSize: size,
      draggable: true,
      itemStyle: {
        color: colorPalette[index % colorPalette.length],
        shadowBlur: 10,
        shadowColor: "rgba(0,0,0,0.1)",
      },
      label: {
        show: size > 40,
        formatter: "{b}",
        fontSize: 10,
        color: "#fff",
        textBorderColor: "#000",
        textBorderWidth: 2,
      },
    };
  });

  return {
    tooltip,
    xAxis: { show: false },
    yAxis: { show: false },
    series: [
      {
        type: "graph",
        layout: "force",
        data: graphData,
        roam: true,
        label: { show: true, position: "inside" },
        force: {
          repulsion: 200,
          gravity: 0.1,
          edgeLength: 30,
          layoutAnimation: true,
        },
      },
    ],
  };
});

// ==========================================
// [DATA LOGIC] Fetching & Parsing
// ==========================================

function parseApiResponse(res: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res as any)?.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawStatus = data?.status || (res as any)?.status;
  const statusStr = String(rawStatus || "").toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = data?.message || (res as any)?.message || "Unknown response";
  const isSuccess = statusStr === "ok" || statusStr === "success" || rawStatus === 200;
  return { isSuccess, message, data, rawStatus };
}

function calcKeyStatistics(usages: ProblemUsage[]): {
  total: number;
  average: number;
  isFlat: boolean;
  sortedUsages: ProblemUsage[];
} {
  if (!usages || usages.length === 0) {
    return { total: 0, average: 0, isFlat: true, sortedUsages: [] };
  }
  const sortedUsages = [...usages].sort((a, b) => (b.total_token ?? 0) - (a.total_token ?? 0));
  const total = sortedUsages.reduce((acc, u) => acc + (u.total_token ?? 0), 0);
  const maxVal = sortedUsages[0].total_token ?? 0;
  const minVal = sortedUsages[sortedUsages.length - 1].total_token ?? 0;
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

    if (!isSuccess && !resData) throw new Error(message || "Failed to fetch usage data");

    const rawKeys: RawKeyItem[] = resData?.keys || [];
    const keys: KeyItem[] = rawKeys.map((key, index) => {
      const safeUsages = key.problem_usages || [];
      const { total, average, isFlat, sortedUsages } = calcKeyStatistics(safeUsages);
      const cycleTotal = safeUsages.reduce((sum, u) => sum + (u.cycle_token || 0), 0);
      return {
        ...key,
        id: key.id || `temp-${index}`,
        key_name: key.key_name || "Unknown Key",
        created_by: key.created_by || "Unknown User",
        problem_usages: sortedUsages,
        all_total_token: total,
        all_cycle_token: key.cycle_total_token || cycleTotal,
        average_token: average,
        is_flat: isFlat,
      };
    });

    const totalToken = keys.reduce((sum, k) => sum + (k.all_total_token || 0), 0);
    const totalCycleToken = keys.reduce((sum, k) => sum + (k.all_cycle_token || 0), 0);
    // Use the first key's last_reset_date as reference (all keys should reset together)
    const lastResetDate = rawKeys.length > 0 ? rawKeys[0].last_reset_date || null : null;
    data.value = { totalToken, totalCycleToken, lastResetDate, keys };
    expandedKeys.value = Object.fromEntries(keys.map((k) => [String(k.id), false]));
  } catch (err: unknown) {
    interface ApiError {
      response?: { data?: { message?: string } };
      message?: string;
    }

    const apiErr = err as ApiError;
    const errMsg = apiErr?.response?.data?.message || apiErr?.message || "Failed to load API usage data";

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

function formatResetDate(isoString: string | null): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// Check if the cycle has exceeded 24 hours (lazy reset behavior)
const isCycleExpired = computed(() => {
  if (!data.value?.lastResetDate) return false;
  try {
    const resetDate = new Date(data.value.lastResetDate);
    const now = new Date();
    const diffMs = now.getTime() - resetDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 24;
  } catch {
    return false;
  }
});

onMounted(fetchUsage);
</script>

<template>
  <div class="card-container pb-20">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-4">
          {{ t("course.aisetting.usage.title", { name: route.params.name }) }}
        </div>

        <!-- Hero Stats Section -->
        <div v-if="data?.totalToken != null" class="mb-8 grid gap-4 md:grid-cols-2">
          <!-- Total Token Usage -->
          <div class="border-base-300 bg-base-200 rounded-lg border p-4 text-center">
            <div class="text-base-content/60 mb-1 text-sm">{{ t("course.aisetting.usage.totalUsage") }}</div>
            <div class="text-2xl font-bold">{{ data.totalToken.toLocaleString() }}</div>
          </div>

          <!-- 1-Day Cycle Usage -->
          <div class="border-base-300 bg-base-200 rounded-lg border p-4 text-center">
            <div class="text-base-content/60 mb-1 flex items-center justify-center gap-1 text-sm">
              <span>🔄</span>
              <span>{{ t("course.aisetting.usage.cycleUsage") }}</span>
              <div class="tooltip tooltip-bottom" :data-tip="t('course.aisetting.usage.cycleTooltip')">
                <span class="cursor-help text-xs opacity-60">ⓘ</span>
              </div>
            </div>
            <div class="text-2xl font-bold">{{ data.totalCycleToken?.toLocaleString() || 0 }}</div>
            <div v-if="data.lastResetDate" class="text-base-content/50 mt-1 text-xs">
              {{ t("course.aisetting.usage.sinceReset", { time: formatResetDate(data.lastResetDate) }) }}
            </div>
            <div v-if="isCycleExpired" class="text-base-content/40 mt-1 text-xs italic">
              {{ t("course.aisetting.usage.cycleExpired") }}
            </div>
          </div>
        </div>

        <template v-if="isLoading">
          <ui-spinner />
        </template>

        <template v-else-if="error">
          <div class="alert alert-error shadow-lg">
            <div>
              <i-uil-times-circle /><span>{{ error }}</span>
            </div>
          </div>
        </template>

        <template v-else>
          <div
            v-if="problemStats.length > 0"
            class="card border-base-200 bg-base-100 mb-8 border shadow-sm transition-all"
          >
            <div
              class="hover:bg-base-200/50 flex cursor-pointer items-center justify-between rounded-t-lg p-4 transition-colors select-none"
              @click="isChartExpanded = !isChartExpanded"
            >
              <div class="text-base-content/80 flex items-center gap-3 font-bold">
                <span
                  class="transform text-xl transition-transform duration-200"
                  :class="{ 'rotate-90': isChartExpanded }"
                >
                  ▸
                </span>
                <span class="text-lg">{{ t("course.aisetting.usage.problemUsageAnalysis") }}</span>
              </div>
              <div class="text-base-content/50 font-mono text-xs">
                {{
                  isChartExpanded
                    ? t("course.aisetting.usage.clickToCollapse")
                    : t("course.aisetting.usage.clickToExpand")
                }}
              </div>
            </div>

            <transition name="fade">
              <div v-if="isChartExpanded" class="card-body border-base-200 border-t p-4">
                <div class="mb-4 flex items-center justify-end">
                  <div class="btn-group">
                    <button
                      class="btn btn-sm"
                      :class="{ 'btn-primary': chartType === 'bar' }"
                      @click="chartType = 'bar'"
                    >
                      {{ t("course.aisetting.usage.barChart") }}
                    </button>
                    <button
                      class="btn btn-sm"
                      :class="{ 'btn-primary': chartType === 'bubble' }"
                      @click="chartType = 'bubble'"
                    >
                      {{ t("course.aisetting.usage.PackedBubble") }}
                    </button>
                  </div>
                </div>

                <div class="relative h-[500px] w-full">
                  <v-chart class="h-full w-full" :option="chartOption" :key="chartType" autoresize />
                  <div
                    v-if="chartType === 'bubble'"
                    class="text-base-content/40 bg-base-100/80 absolute right-2 bottom-2 rounded px-2 py-1 text-xs"
                  >
                    {{ t("course.aisetting.usage.dragBubbleStoPlayPhysics") }}
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <div v-if="data?.keys.length" class="mt-8 mb-4 flex items-center gap-3 px-1">
            <span class="text-2xl">🔑</span>
            <h3 class="text-base-content/80 text-lg font-bold">
              {{ t("course.aisetting.usage.keyUsageBreakdown") }}
            </h3>
            <div class="bg-base-300 ml-2 h-px flex-grow opacity-50"></div>
          </div>

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
                  <span
                    class="inline-block transform text-xl transition-transform duration-200"
                    :class="{ 'rotate-90': expandedKeys[keyItem.id] }"
                  >
                    ▸
                  </span>

                  {{ keyItem.key_name }}
                </div>
                <div class="text-sm">
                  {{ t("course.aisetting.usage.used_by_summary", { count: keyItem.problem_usages.length }) }}
                  {{ keyItem.all_total_token.toLocaleString() }}
                  {{ t("course.aisetting.usage.created_by_summary", { name: keyItem.created_by }) }}
                </div>
              </div>

              <transition name="fade">
                <div v-if="expandedKeys[keyItem.id]" class="border-base-300 mt-4 border-t pt-4">
                  <div
                    v-if="!keyItem.is_flat && keyItem.problem_usages.length > 0"
                    class="text-base-content/60 mb-2 text-xs"
                  >
                    {{ t("course.aisetting.usage.Average") }}:
                    {{ Math.round(keyItem.average_token).toLocaleString() }}
                    {{ t("course.aisetting.usage.tokensProblem") }}
                  </div>

                  <table class="table-compact table w-full">
                    <thead>
                      <tr>
                        <th class="w-16">{{ t("course.aisetting.usage.rank") }}</th>
                        <th>{{ t("course.aisetting.usage.problemName") }}</th>
                        <th class="text-right">{{ t("course.aisetting.usage.tokenUsed") }}</th>
                        <th class="text-right">{{ t("course.aisetting.usage.cycleTokenUsed") }}</th>
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
                                >TOP 1</span
                              >
                              <span
                                v-else-if="(usage.total_token || 0) > keyItem.average_token * 1.5"
                                class="badge badge-warning badge-sm text-xs"
                                >High</span
                              >
                            </template>
                          </div>
                        </td>
                        <td class="text-right font-mono">
                          <span :class="{ 'text-base-content font-bold': index === 0 && !keyItem.is_flat }">
                            {{ usage.total_token?.toLocaleString?.() || 0 }}
                          </span>
                        </td>
                        <td class="text-right font-mono text-sm opacity-70">
                          {{ usage.cycle_token?.toLocaleString?.() || 0 }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </transition>
            </div>
          </div>
          <p v-else class="text-base-content/70 italic">{{ t("course.aisetting.usage.noData") }}</p>
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
