<script setup lang="ts">
import { useSession } from "@/stores/session";
import { useI18n } from "vue-i18n";

defineProps<{
  displayType?: "side" | "tab";
}>();

const { t } = useI18n();

const session = useSession();
const navs = [
  {
    name: t("components.courseSideBar.ann"),
    path: "/announcements",
  },
  {
    name: t("components.courseSideBar.hw"),
    path: "/homeworks",
  },
  {
    name: t("components.courseSideBar.problems"),
    path: "/problems",
  },
  {
    name: t("components.courseSideBar.submissions"),
    path: "/submissions",
  },
  {
    name: t("components.courseSideBar.discussion"),
    path: "/discussion",
  },
  ...(session.isAdmin || session.isTeacher || session.isTA
    ? [
        {
          name: t("components.courseSideBar.members"),
          path: "/members",
        },
      ]
    : []),
  ...(session.role === 1 || session.isAdmin ? [{ name: "AI Setting", path: "/aisetting" }] : []),
];
</script>

<template>
  <ul v-if="displayType === 'side'" class="menu menu-compact lg:menu-normal w-40 bg-base-100 p-2">
    <li
      v-for="{ name, path } in navs"
      :class="[
        $route.path.startsWith(`/course/${$route.params.name}${path}`) && 'border-l-4 border-blue-500',
      ]"
    >
      <router-link :to="`/course/${$route.params.name}${path}`">{{ name }}</router-link>
    </li>
  </ul>
  <div v-else class="scrollbar-hide w-full overflow-scroll">
    <div class="tabs mx-auto w-max">
      <template v-for="{ name, path } in navs">
        <a
          class="tab tab-bordered h-10 w-32"
          :class="{
            'tab-active': $route.path === `/course/${$route.params.name}${path}`,
          }"
        >
          <router-link :to="`/course/${$route.params.name}${path}`">{{ name }}</router-link>
        </a>
      </template>
    </div>
  </div>
</template>
