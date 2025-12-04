<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api from "@/models/api";
import { useI18n } from "vue-i18n";

const route = useRoute();
const { t } = useI18n();
useTitle(`AI Usage - ${route.params.name} | Normal OJ`);

const data = ref<any>(null);
const isLoading = ref(false);
const error = ref<unknown>(null);
const expandedKeys = ref<Record<string, boolean>>({});

onMounted(async () => {
  isLoading.value = true;
  try {
    const res = await api.CourseAPIUsage.getCourseUsage(route.params.name as string);
    const resultData = res?.data ?? {};
    data.value = {
      totalToken: resultData.totalToken ?? 0,
      keys: Array.isArray(resultData.keys) ? resultData.keys : [],
    };
    if (data.value.keys.length > 0) {
      data.value.keys.forEach((k: any) => (expandedKeys.value[k.key_id] = false));
    }
  } catch (err) {
    console.error("Failed to load API usage data:", err);
    error.value = err;
    data.value = null;
  } finally {
    isLoading.value = false;
  }
});

const toggleExpand = (id: string) => {
  expandedKeys.value[id] = !expandedKeys.value[id];
};
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
              <span>Failed to load API usage data.</span>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="data?.keys?.length">
            <div
              v-for="keyItem in data.keys"
              :key="keyItem.key_id"
              class="mb-6 rounded-lg border border-base-200 bg-base-100 p-4 shadow"
            >
              <div
                class="flex cursor-pointer select-none flex-wrap items-center justify-between gap-3"
                @click="toggleExpand(keyItem.key_id)"
              >
                <div class="flex items-center gap-2 text-lg font-semibold">
                  <span>
                    {{ expandedKeys[keyItem.key_id] ? "▼" : "▸" }}
                  </span>
                  {{ keyItem.key_name }}
                </div>
                <div class="text-sm">
                  Used by {{ keyItem.problem_usages.length }} problems • Token {{
                    keyItem.total_token.toLocaleString()
                  }}
                  • Created by {{ keyItem.created_by }}
                </div>
              </div>
              <transition name="fade">
                <div v-if="expandedKeys[keyItem.key_id]" class="mt-4 border-t border-base-300 pt-4">
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
                          <span v-if="usage.problem_id === keyItem.max_problem?.problem_id"> (Max) </span>
                          <span v-else-if="usage.problem_id === keyItem.min_problem?.problem_id">
                            (Min)
                          </span>
                        </td>
                        <td>{{ usage.token.toLocaleString() }}</td>
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
