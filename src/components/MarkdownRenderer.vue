<script setup lang="ts">
import renderMarkdown from "@/utils/renderMarkdown";

interface Props {
  md?: string;
  preserveWhitespace?: boolean;
}
withDefaults(defineProps<Props>(), {
  md: "",
  preserveWhitespace: true,
});
</script>

<template>
  <div
    v-if="md"
    class="prose prose-sm md:prose-base prose-pre:bg-zinc-800 prose-pre:text-white min-w-full break-words"
    :class="{ 'whitespace-pre-wrap': preserveWhitespace }"
    v-html="renderMarkdown(md)"
  />
  <span v-else class="italic opacity-70">{{ $t("components.markdownRenderer.noContent") }}</span>
</template>
