<script setup lang="ts">
import { useSession } from "@/stores/session";
import { useI18n } from "vue-i18n";

defineProps<{
  displayType?: "side" | "tab";
}>();

const { t } = useI18n();

const session = useSession();

const generalNavs = [
  { name: t("components.courseSideBar.ann"), path: "/announcements" },
  { name: t("components.courseSideBar.hw"), path: "/homeworks" },
  { name: t("components.courseSideBar.problems"), path: "/problems" },
  { name: t("components.courseSideBar.submissions"), path: "/submissions" },
  { name: t("components.courseSideBar.discussion"), path: "/discussion" },
];

const adminNavs =
  session.isAdmin || session.isTeacher || session.isTA
    ? [
        { name: t("components.courseSideBar.members"), path: "/members" },
        { name: t("components.courseSideBar.aisetting"), path: "/aisetting" },
        { name: t("components.courseSideBar.loginRecords"), path: "/login-records" },
        { name: t("components.courseSideBar.settings"), path: "/settings" },
      ]
    : [];
</script>

<template>
  <ul v-if="displayType === 'side'" class="menu-compact lg:menu-normal menu bg-base-100 w-40 p-2 text-base">
    <li class="text-base-content/60 px-3 py-2 text-xs font-semibold tracking-wide">
      {{ t("components.courseSideBar.general") }}
    </li>

    <li
      v-for="{ name, path } in generalNavs"
      :class="[
        $route.path.startsWith(`/course/${$route.params.name}${path}`) && 'border-l-4 border-blue-500',
      ]"
    >
      <router-link :to="`/course/${$route.params.name}${path}`">{{ name }}</router-link>
    </li>

    <template v-if="adminNavs.length">
      <li
        class="text-base-content/60 border-base-300 mt-3 border-t px-3 pt-2 text-xs font-semibold tracking-wide"
      >
        {{ t("components.courseSideBar.admin") }}
      </li>
      <li
        v-for="{ name, path } in adminNavs"
        :class="[
          $route.path.startsWith(`/course/${$route.params.name}${path}`) && 'border-l-4 border-blue-500',
        ]"
      >
        <router-link :to="`/course/${$route.params.name}${path}`">{{ name }}</router-link>
      </li>
    </template>
  </ul>
  <div v-else class="w-full overflow-scroll">
    <div class="tabs mx-auto flex w-max items-center">
      <template v-for="{ name, path } in generalNavs">
        <a
          class="tab-bordered tab h-10 w-32"
          :class="{ 'tab-active': $route.path === `/course/${$route.params.name}${path}` }"
        >
          <router-link :to="`/course/${$route.params.name}${path}`">{{ name }}</router-link>
        </a>
      </template>

      <template v-if="adminNavs.length">
        <span class="text-base-content/50 mx-2 self-center text-xs">|</span>
        <template v-for="{ name, path } in adminNavs">
          <a
            class="tab-bordered tab h-8 w-28 text-sm"
            :class="{ 'tab-active': $route.path === `/course/${$route.params.name}${path}` }"
          >
            <router-link :to="`/course/${$route.params.name}${path}`">{{ name }}</router-link>
          </a>
        </template>
      </template>
    </div>
  </div>
</template>
