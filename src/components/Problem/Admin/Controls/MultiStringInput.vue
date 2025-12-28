<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// Define props with types
const props = defineProps<{
  modelValue: string[];
  placeholder?: string;
  badgeClass?: string;
  maxLength?: number;
  collapseThreshold?: number;
  isLink?: boolean;
}>();

// Define emits
const emits = defineEmits<{ (e: "update:modelValue", v: string[]): void }>();

const buf = ref("");
const isExpanded = ref(false);

// --- CONFIGURATION ---
// Global variable to control badge appearance (Padding & Font Size).
// Options for size:
// - 'text-xs': Extra small text (12px)
// - 'text-sm': Small text (14px)
// - 'text-base': Normal text (16px)
// Current setting: tight padding + extra small text
const badgeStyle = "px-1.5 py-0.5 text-xs";
// MAX: 10
const COLLAPSE_THRESHOLD = props.collapseThreshold ?? 10;
// ---------------------

// 计算是否应该显示收合功能
const shouldShowCollapse = computed(() => props.modelValue.length > COLLAPSE_THRESHOLD);

// 计算显示的badge列表（包含值和原始索引）
const displayedBadges = computed(() => {
  if (!shouldShowCollapse.value || isExpanded.value) {
    // 展开时显示所有项
    return props.modelValue.map((value, index) => ({ value, originalIndex: index }));
  }
  // 收合时只显示前N个，但保持原始索引
  return props.modelValue
    .slice(0, COLLAPSE_THRESHOLD)
    .map((value, index) => ({ value, originalIndex: index }));
});

// 计算隐藏的badge数量
const hiddenCount = computed(() => {
  if (!shouldShowCollapse.value || isExpanded.value) {
    return 0;
  }
  return props.modelValue.length - COLLAPSE_THRESHOLD;
});

// 切换展开/收合状态
function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

// Add a new item to the list
function add() {
  const v = buf.value.trim();
  if (!v) return;
  if (props.modelValue.includes(v)) {
    return;
  }
  emits("update:modelValue", [...props.modelValue, v]);
  buf.value = "";
}

// Remove an item by index
function remove(i: number) {
  const next = [...props.modelValue];
  next.splice(i, 1);
  emits("update:modelValue", next);
}

function getHref(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://${value}`;
}
</script>

<template>
  <div>
    <div class="flex gap-2">
      <input
        v-model="buf"
        :placeholder="placeholder || 'Add item'"
        class="input-bordered input input-sm w-full"
        @keydown.enter.prevent="add"
        :maxlength="maxLength"
      />
      <button class="btn btn-sm" @click="add">Add</button>
    </div>

    <div class="mt-2">
      <div class="flex flex-wrap gap-1">
        <div
          v-for="item in displayedBadges"
          :key="`${item.value}-${item.originalIndex}`"
          class="badge h-auto min-h-0 gap-1 text-left break-all whitespace-normal"
          :class="[badgeClass || 'badge-info', badgeStyle]"
        >
          <a
            v-if="isLink"
            :href="getHref(item.value)"
            target="_blank"
            rel="noopener noreferrer"
            class="cursor-pointer hover:underline"
          >
            {{ item.value }}
          </a>
          <span v-else>{{ item.value }}</span>
          <button class="btn btn-ghost btn-xs h-auto min-h-0" @click="remove(item.originalIndex)">
            <i-uil-times />
          </button>
        </div>
      </div>
      <div v-if="shouldShowCollapse" class="mt-2">
        <button class="btn btn-ghost btn-xs gap-1" @click="toggleExpand">
          <i-uil-angle-down v-if="!isExpanded" class="h-3 w-3" />
          <i-uil-angle-up v-else class="h-3 w-3" />
          <span v-if="!isExpanded">
            {{ t("course.problems.expandMore") }}
          </span>
          <span v-else>
            {{ t("course.problems.collapse") }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
