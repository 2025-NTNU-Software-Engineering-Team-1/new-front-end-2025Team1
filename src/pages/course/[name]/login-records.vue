<script setup lang="ts">
import { fetcher } from "@/models/api";
import { useAxios } from "@vueuse/integrations/useAxios";
import { computed, ref, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import type { AxiosError } from "axios";

const route = useRoute();
const courseName = computed(() => route.params.name as string);
useTitle(() => `Login Records - ${courseName.value} | Normal OJ`);
useI18n();

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

// Fetch data with current params
async function fetchData() {
  const offset = (currentPage.value - 1) * pageSize.value;
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: pageSize.value.toString(),
  });
  if (searchName.value) {
    params.set("username", searchName.value);
  }
  await execute(`/course/${courseName.value}/login-records?${params.toString()}`);
  initialLoading.value = false;
}

// Re-fetch when page changes or course changes
watch([currentPage, pageSize, courseName], fetchData);

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
  window.open(`${baseUrl}/course/${courseName.value}/login-records/download`, "_blank");
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
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <h2 class="card-title">{{ $t("loginRecords.title") }}</h2>

        <!-- Header with search and actions -->
        <div class="my-4 flex flex-wrap items-center gap-4">
          <input
            v-model="searchName"
            :placeholder="$t('admin.user.search-name')"
            type="text"
            maxlength="50"
            class="input input-bordered"
            @keyup.enter="
              currentPage = 1;
              fetchData();
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
                          record.success
                            ? $t("loginRecords.status.success")
                            : $t("loginRecords.status.failed")
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
      </div>
    </div>
  </div>
</template>
