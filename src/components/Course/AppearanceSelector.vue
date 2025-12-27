<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import CourseAvatar from "@/components/Course/CourseAvatar.vue";

const { t } = useI18n();

const props = defineProps<{
  initialColor?: string | null;
  initialEmoji?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:color", value: string): void;
  (e: "update:emoji", value: string): void;
}>();

// Morandi / Muted Earth Tones Palette
const MORANDI_PALETTE = [
  "#B07D7D", // Muted Red
  "#C79E7E", // Muted Orange
  "#D9CD90", // Muted Yellow
  "#95A595", // Sage Green
  "#7D9494", // Muted Teal
  "#899AB0", // Dusty Blue
  "#787D96", // Muted Indigo
  "#9B8EA6", // Muted Purple
  "#BF9CA9", // Dusty Pink
  "#A6968B", // Warm Brown
  "#8F9983", // Olive Green
  "#9E9E9E", // Neutral Grey
];

// Rainbow / Standard Palette
const RAINBOW_PALETTE = [
  "#E53E3E", // Red
  "#DD6B20", // Orange
  "#D69E2E", // Yellow
  "#38A169", // Green
  "#3182CE", // Blue
  "#805AD5", // Purple
  "#D53F8C", // Pink
  "#718096", // Gray
  "#2D3748", // Dark Gray
  "#000000", // Black
];

const COURSE_EMOJIS = [
  "💻",
  "📚",
  "🔢",
  "🧪",
  "🧬",
  "⚡",
  "🎨",
  "🎵",
  "📝",
  "📊",
  "📉",
  "📁",
  "🏫",
  "🎓",
  "📐",
  "🔬",
  "🧠",
  "🤖",
  "🌍",
  "🏛️",
  "⚖️",
  "💼",
  "💹",
  "🗣️",
];

const selectedColor = ref(props.initialColor || MORANDI_PALETTE[0]);
const selectedEmoji = ref(props.initialEmoji || COURSE_EMOJIS[0]);

watch(selectedColor, (val) => emit("update:color", val));
watch(selectedEmoji, (val) => emit("update:emoji", val));

// Initialize
emit("update:color", selectedColor.value);
emit("update:emoji", selectedEmoji.value);

const emojiTextClass = ref("");
</script>

<template>
  <div class="space-y-4">
    <!-- Preview -->
    <div class="bg-base-100 border-base-200 flex items-center gap-4 rounded-lg border p-4">
      <course-avatar
        course-name="Preview"
        :course-color="selectedColor"
        :course-emoji="selectedEmoji"
        size="lg"
      />
      <div>
        <div class="text-lg font-bold">{{ t("course.settings.preview") }}</div>
        <div class="text-sm opacity-60">{{ t("course.settings.previewDesc") }}</div>
      </div>
    </div>

    <!-- Color Selector -->
    <div>
      <label class="label text-sm font-bold">{{ t("course.settings.courseColor") }}</label>

      <!-- Standard -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.standard") }}</div>
      <div class="mb-4 grid grid-cols-5 gap-2 md:grid-cols-10">
        <button
          v-for="color in RAINBOW_PALETTE"
          :key="color"
          type="button"
          class="ring-offset-base-100 h-8 w-8 rounded-full ring-offset-2 transition-transform hover:scale-110 focus:outline-none md:h-10 md:w-10"
          :class="{ 'ring-primary ring-2': selectedColor === color }"
          :style="{ backgroundColor: color }"
          @click="selectedColor = color"
        />
      </div>

      <!-- Morandi -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.morandi") }}</div>
      <div class="mb-4 grid grid-cols-6 gap-2">
        <button
          v-for="color in MORANDI_PALETTE"
          :key="color"
          type="button"
          class="ring-offset-base-100 h-8 w-8 rounded-full ring-offset-2 transition-transform hover:scale-110 focus:outline-none md:h-10 md:w-10"
          :class="{ 'ring-primary ring-2': selectedColor === color }"
          :style="{ backgroundColor: color }"
          @click="selectedColor = color"
        />
      </div>

      <!-- Custom Color -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.custom") }}</div>
      <div class="flex items-center gap-3">
        <div
          class="border-base-300 relative h-12 w-12 cursor-pointer overflow-hidden rounded-full border shadow-sm"
        >
          <input
            type="color"
            v-model="selectedColor"
            class="absolute -left-2 -top-2 h-16 w-16 cursor-pointer border-0 p-0"
          />
        </div>
        <input
          type="text"
          v-model="selectedColor"
          class="input input-bordered w-32 font-mono uppercase"
          placeholder="#000000"
          maxlength="7"
        />
      </div>
    </div>

    <!-- Emoji Selector -->
    <div>
      <label class="label text-sm font-bold">{{ t("course.settings.courseEmoji") }}</label>

      <!-- Presets -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.presets") }}</div>
      <div class="mb-4 grid grid-cols-8 gap-2">
        <button
          v-for="emoji in COURSE_EMOJIS"
          :key="emoji"
          type="button"
          class="hover:bg-base-200 flex h-8 w-8 items-center justify-center rounded text-xl transition-colors"
          :class="{ 'bg-primary/20 ring-primary ring-2 ring-inset': selectedEmoji === emoji }"
          @click="selectedEmoji = emoji"
        >
          {{ emoji }}
        </button>
      </div>

      <!-- Custom Emoji -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.custom") }}</div>
      <div class="form-control">
        <input
          type="text"
          v-model="selectedEmoji"
          class="input input-bordered w-full text-center md:w-1/2"
          :class="emojiTextClass"
          placeholder="👻"
          maxlength="4"
        />
        <label class="label">
          <span class="label-text-alt opacity-60">{{ t("course.settings.emojiPlaceholder") }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
