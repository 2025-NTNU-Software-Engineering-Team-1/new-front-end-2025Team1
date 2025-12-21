<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { LAppDelegate } from "@/live2d/Framework/src/lappdelegate";

// 定義妳剛剛� 入的表情列表
const expressions = [
  { id: "F01", name: "F01 (微笑)" },
  { id: "F02", name: "F02 (認真)" },
  { id: "F03", name: "F03 (驚訝)" },
  { id: "F04", name: "F04 (生氣)" },
  { id: "F05", name: "F05 (害羞)" },
  { id: "F06", name: "F06 (悲傷)" },
  { id: "F07", name: "F07 (閉眼)" },
  { id: "F08", name: "F08 (開心)" },
];

const currentExpression = ref("F01");

// 切換表情的函式
const changeExpression = (expId: string) => {
  currentExpression.value = expId;
  const app = LAppDelegate.getInstance();

  // 呼叫剛剛在 LAppDelegate 新增的方法
  // @ts-expect-error - Dynamic method from LAppDelegate
  if (app.setExpression) {
    // @ts-expect-error - Dynamic method from LAppDelegate
    app.setExpression(expId);
  } else {
    console.warn("還沒在 LAppDelegate 裡實作 setExpression 喔！");
  }
};

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
  <div class="relative h-full w-full">
    <div id="live2d-container" class="h-full w-full" style="position: relative; overflow: hidden"></div>

    <div
      class="absolute bottom-4 left-4 z-10 max-w-xs rounded-lg border border-gray-200 bg-white/80 p-4 shadow-lg backdrop-blur-sm"
    >
      <h3 class="mb-2 text-sm font-bold text-gray-700">✨ 表情測試區</h3>
      <div class="mb-2 font-mono text-xs text-blue-600">當前表情: {{ currentExpression }}</div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="exp in expressions"
          :key="exp.id"
          @click="changeExpression(exp.id)"
          class="rounded bg-blue-100 px-3 py-1 text-xs text-blue-800 transition-colors hover:bg-blue-200"
          :class="{ 'font-bold ring-2 ring-blue-500': currentExpression === exp.id }"
        >
          {{ exp.id }}
        </button>
      </div>
    </div>
  </div>
</template>
