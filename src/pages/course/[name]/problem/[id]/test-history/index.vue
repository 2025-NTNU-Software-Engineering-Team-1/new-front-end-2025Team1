<script setup lang="ts">
import { ref } from "vue";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute, useRouter } from "vue-router";
import { useTitle } from "@vueuse/core";
import { fetcher } from "@/models/api";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import type { AxiosError } from "axios";
import { SUBMISSION_STATUS_CODE } from "@/constants";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useTitle(`Test History - ${route.params.id} - ${route.params.name} | Normal OJ`);

// ToDo: Replace fake data with real API call
// const { data: testHistory, error, isLoading } = useAxios(`/test-history/${route.params.id}`, fetcher);

// Define a typed shape for the history items so TypeScript knows what properties exist
type TestHistoryItem = {
  id: number | string;
  pid: number | string;
  result: SubmissionStatusCodes;
  score: number;
  lang: string;
  timestamp: string;
};

// 假資料用於預覽
const testHistory = ref<TestHistoryItem[]>([
  {
    id: "T001",
    pid: String(route.params.id),
    result: SUBMISSION_STATUS_CODE.ACCEPTED,
    score: 100,
    lang: "C++",
    timestamp: "2025-11-04T10:30:00",
  },
  {
    id: "T002",
    pid: String(route.params.id),
    result: SUBMISSION_STATUS_CODE.WRONG_ANSWER,
    score: 60,
    lang: "Python",
    timestamp: "2025-11-04T09:15:00",
  },
  {
    id: "T003",
    pid: String(route.params.id),
    result: SUBMISSION_STATUS_CODE.TIME_LIMIT_EXCEED,
    score: 40,
    lang: "C++",
    timestamp: "2025-11-04T08:45:00",
  },
  {
    id: "T004",
    pid: String(route.params.id),
    result: SUBMISSION_STATUS_CODE.RUNTIME_ERROR,
    score: 20,
    lang: "Python",
    timestamp: "2025-11-03T16:20:00",
  },
  {
    id: "T005",
    pid: String(route.params.id),
    result: SUBMISSION_STATUS_CODE.COMPILE_ERROR,
    score: 0,
    lang: "C",
    timestamp: "2025-11-03T14:10:00",
  },
  {
    id: "T006",
    pid: String(route.params.id),
    result: SUBMISSION_STATUS_CODE.ACCEPTED,
    score: 100,
    lang: "C",
    timestamp: "2025-11-03T12:30:00",
  },
  {
    id: "T007",
    pid: String(route.params.id),
    result: SUBMISSION_STATUS_CODE.MEMORY_LIMIT_EXCEED,
    score: 30,
    lang: "C++",
    timestamp: "2025-11-03T10:15:00",
  },
  {
    id: "T008",
    pid: String(route.params.id),
    result: SUBMISSION_STATUS_CODE.PENDING,
    score: 0,
    lang: "Python",
    timestamp: "2025-11-03T09:00:00",
  },
]);

const error = ref<AxiosError | undefined>(undefined);
const isLoading = ref(false);

function viewTestDetail(testId: string | number) {
  const targetPath = `/course/${route.params.name}/problem/${route.params.id}/test-history/${testId}`;
  console.log('Navigating to:', targetPath);
  router.push(targetPath);
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="card-title">{{ t("course.problem.test.historyModal.title") }}</div>
          <div class="flex gap-2">
            <router-link
              :to="`/course/${route.params.name}/problem/${route.params.id}/test`"
              class="btn btn-sm"
            >
              <i-uil-arrow-left class="mr-1" />
              {{ t("course.problem.test.back") }}
            </router-link>
          </div>
        </div>

        <div class="divider"></div>

        <data-status-wrapper :error="error" :is-loading="isLoading">
          <template #loading>
            <skeleton-table />
          </template>
          <template #data>
            <div class="overflow-x-auto">
              <table class="table w-full">
                <thead>
                  <tr>
                    <th>{{ t("course.problem.test.historyModal.table.id") }}</th>
                    <th>PID</th>
                    <th>{{ t("course.problem.test.historyModal.table.result") }}</th>
                    <th>{{ t("course.problem.test.historyModal.table.score") }}</th>
                    <th>{{ t("course.submission.general.lang") }}</th>
                    <th>{{ t("course.problem.test.historyModal.table.time") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in testHistory" :key="item.id" 
                      class="hover:bg-base-200 cursor-pointer"
                      @click="viewTestDetail(item.id)">
                    <td>
                      <router-link :to="`/course/${route.params.name}/problem/${route.params.id}/test-history/${item.id}`" class="link">
                        {{ item.id }}
                      </router-link>
                    </td>
                    <td>{{ item.pid }}</td>
                    <td><judge-status :status="item.result" /></td>
                    <td>{{ item.score }}</td>
                    <td>{{ item.lang }}</td>
                    <td>{{ dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </data-status-wrapper>
      </div>
    </div>
  </div>
</template>