<script setup lang="ts">
import renderMarkdown from "@/utils/renderMarkdown";

interface Props {
  md?: string;
}
withDefaults(defineProps<Props>(), {
  md: "",
});
</script>

<template>
  <div
    v-if="md"
    class="prose prose-sm md:prose-base prose-pre:bg-zinc-800 prose-pre:text-white min-w-full whitespace-pre-wrap break-words"
    v-html="renderMarkdown(md)"
  />
  <span v-else class="italic opacity-70">{{ $t("components.markdownRenderer.noContent") }}</span>
</template>
