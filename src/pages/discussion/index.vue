<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script >
<template>
  <div class="card min-w-full">
    <div class="card-body">
      <div class="">
        <!--header上半部-->
        <div class="w-full flex gap-4">
          <!--搜尋欄-->
          <div class=" flex items-center bg-slate-200  w-3/4 h-12 border rounded-xl justify-between px-4 max-w-2xl">
              <!--input text -->
              <div class="w-5/6">
                <input 
                  type="search" 
                  :placeholder="t('discussion.placeholder')"
                  class="bg-transparent focus:outline-none rounded-xl w-full "
                >
              </div>
              <!--search button-->
              <div class="w-1/6 flex justify-end items-center" >
                <button type="button" class=" ml-auto px-1 py-1 items-center rounded-full hover:bg-gray-300 transitions ">
                  <svg
                    viewBox="0 0 24.00 24.00"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                  >
                    <path
                      d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="#000000" stroke-width="1.008" stroke-linecap="round" stroke-linejoin="round"
                    ></path>
                  </svg>
                </button>
              </div>
          </div>
          <!--post/problems button-->
          <div class="flex gap-4">
            <router-link
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/discussion/Post`"
            >
            <i-uil-file-upload-alt /> {{ $t("discussion.post") }}
            </router-link>
            <router-link
              class="btn md:btn-md lg:btn-lg"
              :to="`/course/${$route.params.name}/discussion/Problems`"
            >
            <i-uil-file-upload-alt /> {{ $t("discussion.problems") }}
            </router-link>
          </div>

           <div></div>
        </div>
        <!--header下半部-->
        <div></div>
      </div>
    </div>
  </div>











</template>