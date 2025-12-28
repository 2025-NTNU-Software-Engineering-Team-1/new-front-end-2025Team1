<script setup lang="ts">
import { computed } from "vue";
import { useSession } from "@/stores/session";
import { formatTime } from "@/utils/formatTime";
import { useI18n } from "vue-i18n";
import useInteractions from "@/composables/useInteractions";

import type { ProblemId2Meta } from "@/composables/useProblemSelection";

const { t } = useI18n();
const { isDesktop } = useInteractions();

interface Props {
  homework: HomeworkListItem | HomeworkPreviewForm;
  problems: ProblemId2Meta;
  preview?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  preview: false,
});

const session = useSession();
const STATUS_LABEL = {
  RUNNING: t("components.hw.card.statusLabel.running"),
  NOT_START: t("components.hw.card.statusLabel.notStart"),
  OVER: t("components.hw.card.statusLabel.over"),
};
const STATUS_CLASS = {
  [STATUS_LABEL.RUNNING]: "badge-success",
  [STATUS_LABEL.NOT_START]: "",
  [STATUS_LABEL.OVER]: "badge-error",
};

const state = computed(() => {
  const { start, end } = props.homework;
  const now = Date.now();
  if (now < start * 1000) {
    return STATUS_LABEL.NOT_START;
  }
  if (now > end * 1000) {
    return STATUS_LABEL.OVER;
  }
  return STATUS_LABEL.RUNNING;
});
</script>

<template>
  <div class="card bg-base-100 mx-auto w-full shadow-xl">
    <div class="card-body">
      <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div class="lg:text-2x card-title md:mb-8 md:text-xl">
          <router-link
            v-if="homework.id && !preview"
            :to="`/course/${$route.params.name}/homework/${homework.id}`"
            class="hover:underline"
          >
            {{ homework.name }}
          </router-link>
          <span v-else>{{ homework.name }}</span>
          <div :class="['badge', STATUS_CLASS[state]]">{{ state }}</div>
        </div>
        <div class="flex items-center gap-3">
          <router-link
            v-if="homework.id && !preview"
            class="btn whitespace-nowrap px-4 text-base"
            :to="`/course/${$route.params.name}/homeworks/${homework.id}/stats`"
          >
            <i-uil-chart-line class="mr-1 lg:h-5 lg:w-5" /> {{ t("components.hw.card.description.stats") }}
          </router-link>
          <due-countdown v-if="state === STATUS_LABEL.RUNNING" class="mt-2" :due="homework.end" />
        </div>
      </div>

      <div class="flex flex-wrap lg:flex-nowrap lg:gap-x-8">
        <div class="mb-8 w-full lg:flex-[2_1_0%]">
          <div class="card-title">{{ t("components.hw.card.availability.text") }}</div>
          <div class="mt-2 text-sm">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col">
                <span class="text-base-content/60 mb-1 text-xs font-bold uppercase">{{
                  t("components.hw.card.availability.from")
                }}</span>
                <span class="font-mono text-base">{{ formatTime(homework.start) }}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-base-content/60 mb-1 text-xs font-bold uppercase">{{
                  t("components.hw.card.availability.due")
                }}</span>
                <span class="font-mono text-base">{{ formatTime(homework.end) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mb-8 w-full lg:flex-[3_1_0%]">
          <div class="card-title">{{ t("components.hw.card.problems.text") }}</div>
          <homework-problems v-if="isDesktop" :homework="homework" :problems="problems" />
          <div v-else class="w-full py-1">
            <div class="flex w-full flex-wrap justify-center gap-1 sm:justify-start">
              <template v-for="pid in homework.problemIds">
                <problem-info-card
                  class="w-full sm:w-72"
                  :name="problems[pid.toString()]?.name || '-'"
                  :id="pid"
                  :quota="problems[pid.toString()]?.quota || '-'"
                  :score="
                    (
                      homework.studentStatus[session.username] &&
                      homework.studentStatus[session.username][pid.toString()]
                    )?.score || '-'
                  "
                  :show-stats="session.isAdmin"
                  :show-copycat="session.isAdmin"
                />
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap lg:flex-nowrap lg:gap-x-8">
        <div class="w-full lg:flex-1">
          <div class="card-title">{{ t("components.hw.card.description.text") }}</div>
          <markdown-renderer class="mt-2" :md="homework.markdown" />
        </div>
      </div>

      <div v-if="homework.id && !preview && session.isAdmin" class="card-actions justify-end">
        <router-link class="btn mr-3" :to="`/course/${$route.params.name}/homeworks/${homework.id}/edit`">
          <i-uil-edit class="mr-1 lg:h-5 lg:w-5" /> {{ t("components.hw.card.description.edit") }}
        </router-link>
      </div>
    </div>
  </div>
</template>
