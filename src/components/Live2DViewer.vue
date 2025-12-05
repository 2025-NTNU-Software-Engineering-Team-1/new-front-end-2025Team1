<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { LAppDelegate } from "@/live2d/Framework/src/lappdelegate";

// 定義妳剛剛加入的表情列表
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
  // @ts-ignore
  if (app.setExpression) {
    // @ts-ignore
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

    <div class="absolute bottom-4 left-4 p-4 bg-white/80 backdrop-blur-sm rounded-lg shadow-lg z-10 max-w-xs border border-gray-200">
      <h3 class="text-sm font-bold text-gray-700 mb-2">✨ 表情測試區</h3>
      <div class="text-xs text-blue-600 mb-2 font-mono">
        當前表情: {{ currentExpression }}
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="exp in expressions"
          :key="exp.id"
          @click="changeExpression(exp.id)"
          class="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
          :class="{ 'ring-2 ring-blue-500 font-bold': currentExpression === exp.id }"
        >
          {{ exp.id }}
        </button>
      </div>
    </div>
  </div>
</template>