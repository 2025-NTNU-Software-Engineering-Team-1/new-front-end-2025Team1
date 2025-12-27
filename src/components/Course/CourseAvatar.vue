<script setup lang="ts">
import { computed } from "vue";
import { getCourseColor, getCourseEmoji } from "@/utils/courseAppearance";

const props = defineProps<{
  courseName: string;
  courseColor?: string;
  courseEmoji?: string;
  size?: "sm" | "md" | "lg" | "xl";
}>();

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "w-8 h-8 rounded text-lg";
    case "lg":
      return "w-16 h-16 rounded-xl"; // For preview/header
    case "xl":
      return "w-24 h-24 rounded-2xl";
    case "md":
    default:
      return "w-12 h-12 rounded-lg text-2xl"; // Default for lists
  }
});

const displayEmoji = computed(() => getCourseEmoji(props.courseName, props.courseEmoji));
const displayColor = computed(() => getCourseColor(props.courseName, props.courseColor));

const fontSizeClass = computed(() => {
  if (props.size === "sm") return ""; // sm fixed size

  const len = [...displayEmoji.value].length;
  // Base size for md/lg
  if (props.size === "lg") {
    if (len <= 1) return "text-4xl";
    if (len <= 2) return "text-3xl";
    if (len <= 3) return "text-2xl";
    return "text-xl";
  }

  // Default (md)
  if (len <= 1) return "text-2xl";
  if (len <= 2) return "text-xl";
  return "text-base";
});
</script>

<template>
  <div
    class="grid shrink-0 place-items-center pb-1 leading-none text-white shadow-sm transition-transform select-none"
    :class="[sizeClasses, fontSizeClass]"
    :style="{ backgroundColor: displayColor }"
  >
    {{ displayEmoji }}
  </div>
</template>
