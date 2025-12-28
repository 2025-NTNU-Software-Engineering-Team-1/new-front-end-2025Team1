<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
defineProps(["name"]);
router.replace(`/course/${route.params.name}/announcements`);
</script>

<template><span>redirecting...</span></template>
