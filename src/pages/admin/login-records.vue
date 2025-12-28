<script setup lang="ts">
import { fetcher } from "@/models/api";
import api from "@/models/api";
import { useAxios } from "@vueuse/integrations/useAxios";
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useTitle } from "@vueuse/core";
import type { AxiosError } from "axios";

useTitle("Admin - Login Records | Normal OJ");
const { t } = useI18n();

// Pagination state
const currentPage = ref(1);
const pageSize = ref(20);
const searchName = ref("");
const initialLoading = ref(true);

const {
  data,
  error: fetchError,
  isLoading: fetchLoading,
  execute,
} = useAxios<{ data: { records: LoginRecord[]; total: number } }>("/login-records", fetcher, {
  immediate: false,
});

// Combined loading state to prevent FOUC
const isLoading = computed(() => initialLoading.value || fetchLoading.value);

// Initial fetch and re-fetch when params change
async function fetchData() {
  const offset = (currentPage.value - 1) * pageSize.value;
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: pageSize.value.toString(),
  });
  if (searchName.value) {
    params.set("username", searchName.value);
  }
  await execute(`/login-records?${params.toString()}`);
  initialLoading.value = false;
}

// Re-fetch when page changes
watch([currentPage, pageSize], fetchData);

// Initial fetch
onMounted(fetchData);

// Data is already { records, total } after interceptor merge
const records = computed(() => {
  const d = data.value as { records?: LoginRecord[]; total?: number } | undefined;
  return d?.records || [];
});
const totalRecords = computed(() => {
  const d = data.value as { records?: LoginRecord[]; total?: number } | undefined;
  return d?.total || 0;
});
const totalPages = computed(() => Math.ceil(totalRecords.value / pageSize.value));

// Refresh function
function refresh() {
  fetchData();
}

// Download CSV
function downloadCsv() {
  const baseUrl = (import.meta.env.VITE_APP_API_BASE_URL as string) || "/api";
  window.open(`${baseUrl}/login-records/download`, "_blank");
}

// Pagination
function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

// Format timestamp
function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}

// Type definition
interface LoginRecord {
  id: string;
  username: string;
  ipAddress: string;
  success: boolean;
  timestamp: string;
}

// =========== IP Ban Management ===========
interface BannedIP {
  ip: string;
  remaining_seconds: number;
  failure_count: number;
}

const bannedIPs = ref<BannedIP[]>([]);
const bannedIPsLoading = ref(true);
const bannedIPsError = ref<string | null>(null);
const unbanningIP = ref<string | null>(null);
let refreshInterval: ReturnType<typeof setInterval> | null = null;

async function fetchBannedIPs() {
  bannedIPsLoading.value = true;
  bannedIPsError.value = null;
  try {
    const response = await api.Admin.getBannedIPs();
    // Response is merged by interceptor, so data.banned_ips is at top level
    const responseData = response as unknown as { banned_ips?: BannedIP[] };
    bannedIPs.value = responseData.banned_ips || [];
  } catch {
    bannedIPsError.value = t("loginRecords.bannedIPs.unbanFailed");
  } finally {
    bannedIPsLoading.value = false;
  }
}

async function unbanIP(ip: string) {
  unbanningIP.value = ip;
  try {
    await api.Admin.unbanIP(ip);
    // Remove from local list
    bannedIPs.value = bannedIPs.value.filter((b) => b.ip !== ip);
  } catch {
    bannedIPsError.value = t("loginRecords.bannedIPs.unbanFailed");
  } finally {
    unbanningIP.value = null;
  }
}

function formatRemainingTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} ${t("loginRecords.bannedIPs.seconds")}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Auto-refresh countdown timer
function decrementCountdowns() {
  bannedIPs.value = bannedIPs.value
    .map((b) => ({
      ...b,
      remaining_seconds: Math.max(0, b.remaining_seconds - 1),
    }))
    .filter((b) => b.remaining_seconds > 0);
}

onMounted(() => {
  fetchBannedIPs();
  // Update countdown every second
  refreshInterval = setInterval(decrementCountdowns, 1000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<template>
  <div class="space-y-4">
    <!-- Header with search and actions -->
    <div class="flex flex-wrap items-center gap-4">
      <input
        v-model="searchName"
        :placeholder="$t('admin.user.search-name')"
        type="text"
        class="input input-bordered"
        @keyup.enter="
          currentPage = 1;
          execute();
        "
      />

      <button class="btn btn-ghost btn-sm" @click="refresh">
        <i-uil-sync />
        {{ $t("loginRecords.refresh") }}
      </button>

      <button class="btn btn-primary btn-sm" @click="downloadCsv">
        <i-uil-file-download />
        {{ $t("loginRecords.download") }}
      </button>

      <span class="text-base-content/70 text-sm">
        {{ $t("loginRecords.rowCount", { n: totalRecords }) }}
      </span>
    </div>

    <!-- Table -->
    <data-status-wrapper :error="fetchError as AxiosError" :is-loading="isLoading">
      <template #loading>
        <skeleton-table :col="4" :row="10" />
      </template>
      <template #data>
        <div class="overflow-x-auto">
          <table class="table-compact table w-full">
            <thead>
              <tr>
                <th>{{ $t("loginRecords.table.username") }}</th>
                <th>{{ $t("loginRecords.table.ipAddress") }}</th>
                <th>{{ $t("loginRecords.table.success") }}</th>
                <th>{{ $t("loginRecords.table.timestamp") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="records.length === 0">
                <td colspan="4" class="text-base-content/50 text-center">
                  {{ $t("loginRecords.noRecords") }}
                </td>
              </tr>
              <tr v-for="record in records" :key="record.id" class="hover">
                <td>{{ record.username }}</td>
                <td>{{ record.ipAddress }}</td>
                <td>
                  <span
                    :class="[
                      'badge badge-outline',
                      record.success ? 'border-success text-success' : 'border-error text-error',
                    ]"
                  >
                    {{
                      record.success ? $t("loginRecords.status.success") : $t("loginRecords.status.failed")
                    }}
                  </span>
                </td>
                <td>{{ formatTime(record.timestamp) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-4 flex justify-center">
          <div class="btn-group">
            <button class="btn btn-sm" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">
              «
            </button>
            <button class="btn btn-sm">{{ currentPage }} / {{ totalPages }}</button>
            <button
              class="btn btn-sm"
              :disabled="currentPage === totalPages"
              @click="goToPage(currentPage + 1)"
            >
              »
            </button>
          </div>
        </div>
      </template>
    </data-status-wrapper>

    <!-- Banned IPs Section -->
    <div class="divider"></div>
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">{{ $t("loginRecords.bannedIPs.title") }}</h2>

      <div v-if="bannedIPsError" class="alert alert-error">
        <span>{{ bannedIPsError }}</span>
      </div>

      <div v-if="bannedIPsLoading" class="flex items-center gap-2">
        <span class="loading loading-spinner loading-sm"></span>
        <span>Loading...</span>
      </div>

      <div v-else-if="bannedIPs.length === 0" class="text-base-content/50">
        {{ $t("loginRecords.bannedIPs.noBannedIPs") }}
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table-compact table w-full">
          <thead>
            <tr>
              <th>{{ $t("loginRecords.bannedIPs.ip") }}</th>
              <th>{{ $t("loginRecords.bannedIPs.remainingTime") }}</th>
              <th>{{ $t("loginRecords.bannedIPs.failureCount") }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="banned in bannedIPs" :key="banned.ip" class="hover">
              <td class="font-mono">{{ banned.ip }}</td>
              <td>
                <span class="badge badge-warning">
                  {{ formatRemainingTime(banned.remaining_seconds) }}
                </span>
              </td>
              <td>{{ banned.failure_count }}</td>
              <td>
                <button
                  class="btn btn-error btn-xs"
                  :disabled="unbanningIP === banned.ip"
                  @click="unbanIP(banned.ip)"
                >
                  <span v-if="unbanningIP === banned.ip" class="loading loading-spinner loading-xs"></span>
                  <span v-else>{{ $t("loginRecords.bannedIPs.unban") }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="btn btn-ghost btn-sm" @click="fetchBannedIPs">
        <i-uil-sync />
        {{ $t("loginRecords.refresh") }}
      </button>
    </div>
  </div>
</template>
