<script setup lang="ts">
import { watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTitle } from "@vueuse/core";

const route = useRoute();
const router = useRouter();
// const { t } = useI18n();
useTitle(`AI Setting - ${route.params.name} | Normal OJ`);

// � �設 redirect 到 setup
watchEffect(() => {
  // 僅當路徑剛好在 /apisetting 結尾時才 redirect
  if (route.path.endsWith("/aisetting") || route.path.endsWith("/aisetting/")) {
    router.replace(`/course/${route.params.name}/aisetting/setup`);
  }
});
</script>

<template>
  <div class="card-container pb-20">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="tabs mb-4">
          <router-link
            :to="`/course/${route.params.name}/aisetting/setup`"
            :class="['tab tab-bordered', route.path.endsWith('/setup') && 'tab-active']"
            >Set Up</router-link
          >
          <router-link
            :to="`/course/${route.params.name}/aisetting/usage`"
            :class="['tab tab-bordered', route.path.endsWith('/usage') && 'tab-active']"
            >Usage</router-link
          >
        </div>

        <router-view />
      </div>
    </div>
  </div>
</template>
