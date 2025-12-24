<script setup lang="ts">
import { watchEffect } from "vue"; // 1. 匯入 computed
//import { useRoute } from "vue-router"; // 2. 匯入 useRoute
import { useGlobal } from "@/stores/global";
import { TransitionRoot } from "@headlessui/vue";
import { useI18n } from "vue-i18n";
import dayjs from "dayjs";

const global = useGlobal();
//const route = useRoute(); // 4. 取得當前路由

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
</script>

<template>
  <div class="drawer lg:drawer-open h-screen w-screen">
    <input id="noj-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content">
      <top-bar class="sticky top-0 z-20 lg:hidden" />
      <router-view />
    </div>
    <div class="drawer-side z-50 h-full">
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
  </div>
</template>
