<script setup lang="ts">
import { useSession, UserRole } from "@/stores/session";
import { useI18n } from "vue-i18n";
import type { ProblemId2Meta } from "@/composables/useProblemSelection";
import { isQuotaUnlimited } from "@/constants";

interface Props {
  homework: HomeworkListItem | HomeworkPreviewForm;
  problems: ProblemId2Meta;
}

const props = defineProps<Props>();

const { t } = useI18n();
const session = useSession();

/**
 * Get the score for a specific problem in the homework.
 * Handles different studentStatus structures:
 * - For admin/teacher (role < 2): studentStatus is { username: { pid: { score } } }
 * - For student (role >= 2): studentStatus is { pid: { score } } (already filtered to current user)
 */
function getScore(pid: number): number | string {
  const studentStatus = props.homework.studentStatus;
  if (!studentStatus) return "-";

  const pidStr = pid.toString();

  // Check if user is admin or teacher (role < 2)
  if (session.role < UserRole.Student) {
    // Admin/Teacher: studentStatus is nested by username
    const userStatus = studentStatus[session.username];
    if (userStatus && userStatus[pidStr]) {
      return userStatus[pidStr].score ?? "-";
    }
  } else {
    // Student: studentStatus is directly the user's status (pid -> status)
    // The backend already returns only this user's status
    const problemStatus = (studentStatus as Record<string, { score?: number }>)[pidStr];
    if (problemStatus) {
      return problemStatus.score ?? "-";
    }
  }

  return "-";
}
</script>

<template>
  <table class="table-compact mt-2 table w-full">
    <thead>
      <tr>
        <th>{{ t("components.hw.card.problems.id") }}</th>
        <th>{{ t("components.hw.card.problems.pid") }}</th>
        <th>{{ t("components.hw.card.problems.name") }}</th>
        <th>{{ t("components.hw.card.problems.quota") }}</th>
        <th>{{ t("components.hw.card.problems.score") }}</th>
        <th>{{ t("components.hw.card.problems.stats") }}</th>
        <th v-if="session.isAdmin">{{ t("components.hw.card.problems.copycat") }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(pid, index) in homework.problemIds">
        <td>{{ index + 1 }}</td>
        <td>
          <router-link class="link" :to="`/course/${$route.params.name}/problem/${pid}`">
            {{ pid }}
          </router-link>
        </td>
        <td>
          <span v-if="!problems[pid.toString()]">
            {{ t("components.hw.card.problems.unknown") }} ({{ pid }})
          </span>
          <span v-else>{{ problems[pid.toString()].name }}</span>
        </td>
        <td>
          <span v-if="!problems[pid.toString()]">-</span>
          <span v-else-if="isQuotaUnlimited(problems[pid.toString()].quota)" class="text-sm">{{
            $t("components.problem.card.unlimited")
          }}</span>
          <span v-else>{{ problems[pid.toString()].quota }}</span>
        </td>
        <td>
          {{ getScore(pid) }}
        </td>
        <td>
          <div class="tooltip" :data-tip="$t('course.problems.stats')">
            <router-link
              class="btn btn-ghost btn-xs"
              :to="`/course/${$route.params.name}/problem/${pid}/stats`"
            >
              <i-uil-chart-line class="lg:h-5 lg:w-5" />
            </router-link>
          </div>
        </td>
        <td v-if="session.isAdmin">
          <div class="tooltip" :data-tip="$t('course.problems.copycat')">
            <router-link
              class="btn btn-ghost btn-xs"
              :to="`/course/${$route.params.name}/problem/${pid}/copycat`"
            >
              <i-uil-file-exclamation-alt class="lg:h-5 lg:w-5" />
            </router-link>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
