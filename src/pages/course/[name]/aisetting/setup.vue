<script setup lang="ts">
import { useTitle } from "@vueuse/core";
import { useRoute } from "vue-router";

const route = useRoute();
useTitle(`AI Setting - ${route.params.name} | Normal OJ`);
</script>

<template>
  <div class="card-container pb-20">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-4">AI Setting – Set Up</div>
        <p class="opacity-70">這裡是 AI 設定（Set Up）頁面，可放置建立金鑰、權限、配額設定等內容。</p>
      </div>
    </div>
  </div>
</template>
