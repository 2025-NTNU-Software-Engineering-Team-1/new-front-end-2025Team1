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
  "💻", "📚", "🔢", "🧪", "🧬", "⚡", "🎨", "🎵", 
  "📝", "📊", "📉", "📁", "🏫", "🎓", "📐", "🔬",
  "🧠", "🤖", "🌍", "🏛️", "⚖️", "💼", "💹", "🗣️"
];

const selectedColor = ref(props.initialColor || MORANDI_PALETTE[0]);
const selectedEmoji = ref(props.initialEmoji || COURSE_EMOJIS[0]);

watch(selectedColor, (val) => emit("update:color", val));
watch(selectedEmoji, (val) => emit("update:emoji", val));

// Initialize
emit("update:color", selectedColor.value);
emit("update:emoji", selectedEmoji.value);

</script>

<template>
  <div class="space-y-4">
    <!-- Preview -->
    <div class="flex items-center gap-4 p-4 bg-base-100 rounded-lg border border-base-200">
      <course-avatar 
        course-name="Preview" 
        :course-color="selectedColor" 
        :course-emoji="selectedEmoji" 
        size="lg" 
      />
      <div>
        <div class="font-bold text-lg">{{ t("course.settings.preview") }}</div>
        <div class="text-sm opacity-60">{{ t("course.settings.previewDesc") }}</div>
      </div>
    </div>

    <!-- Color Selector -->
    <div>
      <label class="label font-bold text-sm">{{ t("course.settings.courseColor") }}</label>
      
      <!-- Standard -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.standard") }}</div>
      <div class="grid grid-cols-5 md:grid-cols-10 gap-2 mb-4">
        <button 
          v-for="color in RAINBOW_PALETTE" 
          :key="color"
          type="button"
          class="w-8 h-8 md:w-10 md:h-10 rounded-full transition-transform hover:scale-110 focus:outline-none ring-offset-2 ring-offset-base-100"
          :class="{ 'ring-2 ring-primary': selectedColor === color }"
          :style="{ backgroundColor: color }"
          @click="selectedColor = color"
        />
      </div>

      <!-- Morandi -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.morandi") }}</div>
      <div class="grid grid-cols-6 gap-2 mb-4">
        <button 
          v-for="color in MORANDI_PALETTE" 
          :key="color"
          type="button"
          class="w-8 h-8 md:w-10 md:h-10 rounded-full transition-transform hover:scale-110 focus:outline-none ring-offset-2 ring-offset-base-100"
          :class="{ 'ring-2 ring-primary': selectedColor === color }"
          :style="{ backgroundColor: color }"
          @click="selectedColor = color"
        />
      </div>

      <!-- Custom Color -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.custom") }}</div>
      <div class="flex items-center gap-3">
        <div class="relative w-12 h-12 rounded-full overflow-hidden border border-base-300 shadow-sm cursor-pointer">
           <input 
             type="color" 
             v-model="selectedColor"
             class="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"
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
      <label class="label font-bold text-sm">{{ t("course.settings.courseEmoji") }}</label>
      
      <!-- Presets -->
      <div class="mb-2 text-xs opacity-70">{{ t("course.settings.presets") }}</div>
      <div class="grid grid-cols-8 gap-2 mb-4">
        <button 
          v-for="emoji in COURSE_EMOJIS" 
          :key="emoji"
          type="button"
          class="w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-base-200 transition-colors"
          :class="{ 'bg-primary/20 ring-2 ring-primary ring-inset': selectedEmoji === emoji }"
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
            class="input input-bordered w-full md:w-1/2 text-center"
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
