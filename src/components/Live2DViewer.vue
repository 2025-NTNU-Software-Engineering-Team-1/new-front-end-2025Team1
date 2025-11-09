<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";

import { LAppDelegate } from "@/live2d/Framework/src/lappdelegate";

onMounted(() => {
  const app = LAppDelegate.getInstance();

  if (!app.initialize()) {
    console.error("LAppDelegate.initialize() 失敗");
    return;
  }

  app.run();
});

onBeforeUnmount(() => {
  LAppDelegate.releaseInstance();
});
</script>

<template>
  <div id="live2d-container" class="h-full w-full" style="position: relative; overflow: hidden"></div>
</template>
