<script setup lang="ts">
import { useTitle } from "@vueuse/core";
import { useSession } from "@/stores/session";
import useInteractions from "@/composables/useInteractions";
import StudentDashboard from "@/components/Home/StudentDashboard.vue";

const { isDesktop } = useInteractions();
const session = useSession();

useTitle("Home | Normal OJ");
</script>

<template>
  <div
    class="mx-auto flex max-w-7xl gap-8 overflow-y-scroll p-4"
    :class="{
      'flex-col-reverse gap-4': !isDesktop,
      'flex-row': isDesktop,
    }"
  >
    <!-- Main Content: Student Dashboard (Logged In) or Login (Logged Out) -->
    <div class="w-full">
      <student-dashboard v-if="session.isLogin" />
      <login-section v-else />
    </div>
  </div>
</template>
