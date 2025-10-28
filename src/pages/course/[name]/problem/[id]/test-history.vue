<script setup lang="ts">
import { ref } from "vue";
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import { fetcher } from "@/models/api";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";

const route = useRoute();
const { t } = useI18n();

useTitle(`Test History - ${route.params.id} - ${route.params.name} | Normal OJ`);

const { data: testHistory, error, isLoading } = useAxios(`/test-history/${route.params.id}`, fetcher);

// Define a typed shape for the history items so TypeScript knows what properties exist
type TestHistoryItem = {
  id: number | string;
  result: string;
  score: number;
  timestamp: string;
  detail?: string;
};

const selectedHistoryItem = ref<TestHistoryItem | null>(null);

function viewDetail(item: any) {
  selectedHistoryItem.value = item;
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex justify-between items-center">
          <div class="card-title">{{ t("course.problem.test.historyModal.title") }}</div>
          <router-link
            :to="`/course/${route.params.name}/problem/${route.params.id}/test`"
            class="btn"
          >
            {{ t("course.problem.test.back") }}
          </router-link>
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
                    <th>{{ t("course.problem.test.historyModal.table.result") }}</th>
                    <th>{{ t("course.problem.test.historyModal.table.score") }}</th>
                    <th>{{ t("course.problem.test.historyModal.table.time") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in testHistory" :key="item.id" 
                      class="hover:bg-base-200 cursor-pointer"
                      @click="viewDetail(item)">
                    <td>{{ item.id }}</td>
                    <td>{{ item.result }}</td>
                    <td>{{ item.score }}</td>
                    <td>{{ dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="selectedHistoryItem" class="mt-4">
              <div class="divider">{{ t("course.problem.test.historyModal.detail") }}</div>
              <div class="bg-base-200 p-4 rounded-lg">
                <pre><code>{{ selectedHistoryItem.detail }}</code></pre>
              </div>
            </div>
          </template>
        </data-status-wrapper>
      </div>
    </div>
  </div>
</template>