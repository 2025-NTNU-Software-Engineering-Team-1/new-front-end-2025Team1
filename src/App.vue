<script setup lang="ts">
import { watchEffect, computed } from "vue"; // 1. 匯入 computed
import { useRoute } from "vue-router"; // 2. 匯入 useRoute
import { useGlobal } from "@/stores/global";
import { TransitionRoot } from "@headlessui/vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";
import AIChatbot from "@/components/AIChatbot.vue"; // 3. 匯入我們的新元件

const global = useGlobal();
const route = useRoute(); // 4. 取得當前路由

const { locale } = useI18n();
watchEffect(() => {
  switch (locale.value) {
    case "chinese":
      dayjs.locale("zh-tw");
      break;
    case "english":
      dayjs.locale("en");
      break;
    case "taiwanese":
      dayjs.locale("zh-tw");
      break;
  }
});

// 5. 加入這個 computed 屬性
const showChatbot = computed(() => {
  const path = route.path;
  // 檢查路徑是否包含 /problem/ 或 /submission
  // 這樣 /course/[name]/problem/[id] 和 /course/[name]/submission/[id] 都會觸發
  return path.includes("/problem/") || path.includes("/submission");
});
</script>

<template>
  <div class="drawer drawer-mobile h-screen w-screen">
    <input id="noj-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content">
      <top-bar class="sticky top-0 z-50 lg:hidden" />
      <router-view />
    </div>
    <div class="drawer-side">
      <side-bar />
    </div>

    <TransitionRoot
      :show="global.isServerError"
      as="template"
      enter="duration-300 ease-out"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="duration-200 ease-in"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div class="absolute bottom-8 right-4">
        <div class="alert alert-error shadow-lg">
          <div>
            <i-uil-times-circle />
            <span>Oops! Our server failed to respond.</span>
          </div>
        </div>
      </div>
    </TransitionRoot>

    <AIChatbot v-if="showChatbot" />
  </div>
</template>
