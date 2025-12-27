<script setup lang="ts">
import { useTitle } from "@vueuse/core";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

useTitle("Profile | Normal OJ");
const route = useRoute();
const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col lg:flex-row">
    <aside class="w-full shrink-0 lg:w-64">
      <ul class="menu bg-base-100 text-base-content p-2 text-lg lg:sticky lg:top-4">
        <li class="menu-title text-base">
          <span>{{ t("profile.menu.accountInfo") }}</span>
        </li>
        <li>
          <router-link
            to="/profile"
            class="rounded-lg py-3"
            :class="{ 'bg-base-300 font-semibold': route.path === '/profile' }"
          >
            {{ t("profile.menu.user_information") }}
          </router-link>
        </li>
        <li>
          <router-link
            to="/profile/api-token"
            class="rounded-lg py-3"
            :class="{ 'bg-base-300 font-semibold': route.path === '/profile/api-token' }"
          >
            {{ t("profile.menu.api_token") }}
          </router-link>
        </li>
        <li>
          <router-link
            to="/profile/login-records"
            class="rounded-lg py-3"
            :class="{ 'bg-base-300 font-semibold': route.path === '/profile/login-records' }"
          >
            {{ t("profile.menu.login_records") }}
          </router-link>
        </li>
      </ul>
    </aside>

    <div class="flex-1">
      <div class="breadcrumbs border-base-300 border-b p-4 text-sm">
        <ul>
          <li>
            <router-link to="/profile">{{ t("profile.breadcrumb.profile") }}</router-link>
          </li>
          <li v-if="route.path === '/profile/api-token'">{{ t("profile.menu.api_token") }}</li>
          <li v-if="route.path === '/profile/login-records'">{{ t("profile.menu.login_records") }}</li>
        </ul>
      </div>

      <router-view />
    </div>
  </div>
</template>
