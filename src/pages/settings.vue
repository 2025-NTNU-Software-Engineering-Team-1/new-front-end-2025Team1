<script setup lang="ts">
import { watchEffect } from "vue";
import { useRouter } from "vue-router";
import { useStorage } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useTitle } from "@vueuse/core";
import { LOCAL_STORAGE_KEY } from "@/constants";

const { t, locale } = useI18n();
useTitle(`${t("settings.title")} | ${t("general.title_tag")}`);

const router = useRouter();
const localeInStorate = useStorage(LOCAL_STORAGE_KEY.LOCALE, "english");

// initialize with the one in storage
locale.value = localeInStorate.value;

// if user change the value, update the storage
watchEffect(() => {
  localeInStorate.value = locale.value;
});

const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="card-container">
    <div class="card">
      <div class="card-body">
        <div class="card-title">{{ t("settings.title") }}</div>

        <div class="my-2" />

        <div class="form-control w-full max-w-xs gap-4">
          <div>
            <label class="label">
              <span class="label-text">{{ t("settings.languageLabel") }}</span>
            </label>
            <select v-model="locale" class="select-bordered select w-full">
              <option value="english">English</option>
              <option value="chinese">繁體中文</option>
              <option value="taiwanese">台灣話</option>
            </select>
            <label class="label">
              <span class="label-text-alt">{{ t("settings.selectLang") }}</span>
            </label>
          </div>

          <button class="btn btn-outline flex w-full items-center gap-2" @click="goBack">
            <i-uil-arrow-left class="h-5 w-5" />
            {{ t("general.back") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
