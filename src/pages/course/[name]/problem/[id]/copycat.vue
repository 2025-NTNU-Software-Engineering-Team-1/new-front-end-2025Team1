<script setup lang="ts">
import { useAxios } from "@vueuse/integrations/useAxios";
import { useRoute } from "vue-router";
import api, { fetcher } from "@/models/api";
import { useIntervalFn, useTitle } from "@vueuse/core";
import { ref, watchEffect, computed } from "vue";
import { useI18n } from "vue-i18n";

const route = useRoute();
const { t } = useI18n();
useTitle(`${t("course.problem.copycat.title", { id: route.params.id })} - ${route.params.name} | Normal OJ`);
const { data: course, error } = useAxios<Course>(`/course/${route.params.name}`, fetcher);
const { data, execute } = useAxios<MossReport>(
  `/copycat?course=${route.params.name}&problemId=${route.params.id}`,
  fetcher,
);
const isReportGenerated = computed(() => data.value && Object.values(data.value).some(Boolean));
const isReportGenerationFailed = ref(false);
const { pause, resume, isActive } = useIntervalFn(execute, 10000, { immediate: false });
watchEffect(() => {
  if (isReportGenerated.value) {
    pause();
  } else if (!isActive.value) {
    generateReport();
  }
});
async function generateReport() {
  if (!course.value) return;
  isReportGenerationFailed.value = false;
  const studentNicknames = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    course.value.students.map((student: any) => [student.username, student.displayedName]),
  );
  const body = {
    course: route.params.name as string,
    problemId: Number(route.params.id),
    studentNicknames,
  };
  try {
    await api.Copycat.detect(body);
    resume();
  } catch {
    isReportGenerationFailed.value = true;
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title md:text-2xl lg:text-3xl">
          {{ t("course.problem.copycat.title", { id: $route.params.id }) }}
        </div>

        <div v-if="error" class="alert alert-error shadow-lg">
          <div>
            <i-uil-times-circle />
            <span>{{ t("course.problem.copycat.loadError") }}</span>
          </div>
        </div>

        <div v-if="isReportGenerationFailed">
          <button class="btn" @click="generateReport">
            <i-uil-file-upload-alt class="mr-1 h-5 w-5" />{{ t("course.problem.copycat.generateReport") }}
          </button>
        </div>

        <div v-if="!data || (!data.cpp_report && !data.python_report)">
          {{ t("course.problem.copycat.generating") }}
        </div>
        <div v-else v-html="data.cpp_report" />
      </div>
    </div>
  </div>
</template>
