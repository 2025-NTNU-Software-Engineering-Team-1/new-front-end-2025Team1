<script setup lang="ts">
interface Props {
  to: string;
}
defineProps<Props>();
</script>

<template>
  <router-link
    class="sidebar-link btn btn-ghost w-full justify-center rounded-none px-0 text-white hover:bg-[#26568c] hover:text-white"
    :to="to"
  >
    <div class="flex flex-col items-center">
      <slot />
    </div>
  </router-link>
</template>
