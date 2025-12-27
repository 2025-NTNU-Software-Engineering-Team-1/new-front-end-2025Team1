<script setup lang="ts">
import { SUBMISSION_STATUS_REPR } from "@/constants";

interface Props {
  status: SubmissionStatusCodes;
}
const props = defineProps<Props>();
</script>

<template>
  <span
    :style="{ color: (SUBMISSION_STATUS_REPR as any)[props.status as unknown as number]?.color ?? '#666666' }"
  >
    {{ (SUBMISSION_STATUS_REPR as any)[props.status as unknown as number]?.label ?? "Unknown" }}
  </span>
</template>
