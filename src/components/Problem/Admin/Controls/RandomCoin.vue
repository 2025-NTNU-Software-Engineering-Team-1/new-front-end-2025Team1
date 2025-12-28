<script setup lang="ts">
/**
 * ==========================================
 * Cyberpunk Random Coin Component
 * ==========================================
 * - Displays a coin with cyberpunk visual effects
 * - Neon glow, glitch effects, and matrix rain
 * - Generates random integer between min and max
 * - Customizable size
 */
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps({
  min: {
    type: Number,
    default: 500,
  },
  max: {
    type: Number,
    default: 100000,
  },
  size: {
    type: Number,
    default: 35, // 預設 48px
  },
});

const emit = defineEmits<{
  (e: "generated", value: number): void;
}>();

const isSpinning = ref(false);
const matrixChars = ref<Array<{ id: number; char: string; x: number; delay: number }>>([]);

// 計算相關尺寸
const sizeVars = computed(() => ({
  "--coin-size": `${props.size}px`,
  "--glow-size": `${props.size + 32}px`,
  "--matrix-fall-distance": `${props.size + 12}px`,
  "--font-size": `${props.size * 0.5}px`,
  "--matrix-font-size": `${props.size * 0.25}px`,
  "--border-width": `${Math.max(2, props.size * 0.04)}px`,
}));

function spinCoin() {
  if (isSpinning.value) return;

  isSpinning.value = true;
  generateMatrixRain();

  setTimeout(() => {
    const randomVal = Math.floor(Math.random() * (props.max - props.min + 1)) + props.min;
    emit("generated", randomVal);
    isSpinning.value = false;

    // Clear matrix after animation
    setTimeout(() => {
      matrixChars.value = [];
    }, 1000);
  }, 1200);
}

function generateMatrixRain() {
  const chars = "01アイウエオカキクケコサシスセソタチツテト";
  const count = 15;
  const spreadRange = props.size * 0.8; // 根據大小調整散布範圍

  matrixChars.value = Array.from({ length: count }, (_, i) => ({
    id: Date.now() + i,
    char: chars[Math.floor(Math.random() * chars.length)],
    x: Math.random() * spreadRange - spreadRange / 2,
    delay: Math.random() * 0.3,
  }));
}
</script>

<template>
  <div class="coin-wrapper" :class="{ disabled: isSpinning }" :style="sizeVars">
    <div class="tooltip" :data-tip="t('course.problems.randomizeToken')">
      <!-- Matrix rain container -->
      <div class="matrix-container">
        <div
          v-for="item in matrixChars"
          :key="item.id"
          class="matrix-char"
          :style="{
            left: `calc(50% + ${item.x}px)`,
            animationDelay: `${item.delay}s`,
          }"
        >
          {{ item.char }}
        </div>
      </div>

      <button type="button" class="coin-btn" @click="spinCoin" :disabled="isSpinning">
        <!-- Neon glow rings -->
        <div class="glow-ring ring-1" :class="{ active: isSpinning }"></div>
        <div class="glow-ring ring-2" :class="{ active: isSpinning }"></div>

        <div class="coin-inner" :class="{ spinning: isSpinning }">
          <div class="coin-front">
            <div class="coin-content">
              <span class="currency-symbol">T</span>
              <div class="scan-line"></div>
            </div>
          </div>
          <div class="coin-back">
            <div class="coin-content">
              <span class="currency-symbol glitch" data-text="?">?</span>
              <div class="scan-line"></div>
            </div>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Container */
.coin-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.coin-wrapper.disabled {
  cursor: not-allowed;
}

/* Matrix rain */
.matrix-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.matrix-char {
  position: absolute;
  top: -10px;
  color: #0f0;
  font-family: "Courier New", monospace;
  font-size: var(--matrix-font-size);
  font-weight: bold;
  text-shadow: 0 0 5px #0f0;
  animation: matrixFall 1s ease-out forwards;
  opacity: 0;
}

@keyframes matrixFall {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(var(--matrix-fall-distance));
    opacity: 0;
  }
}

/* Button */
.coin-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  perspective: 1000px;
  width: var(--coin-size);
  height: var(--coin-size);
  position: relative;
  transition: transform 0.2s;
}

.coin-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.coin-btn:disabled {
  cursor: not-allowed;
}

/* Neon glow rings */
.glow-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: var(--border-width) solid;
  opacity: 0;
  pointer-events: none;
}

.ring-1 {
  width: var(--coin-size);
  height: var(--coin-size);
  border-color: #06b6d4;
  box-shadow:
    0 0 10px #06b6d4,
    inset 0 0 10px #06b6d4;
}

.ring-2 {
  width: var(--coin-size);
  height: var(--coin-size);
  border-color: #ec4899;
  box-shadow:
    0 0 10px #ec4899,
    inset 0 0 10px #ec4899;
}

.glow-ring.active {
  animation: pulseRing 1.2s ease-out forwards;
}

@keyframes pulseRing {
  0% {
    width: var(--coin-size);
    height: var(--coin-size);
    opacity: 1;
  }
  100% {
    width: var(--glow-size);
    height: var(--glow-size);
    opacity: 0;
  }
}

/* Coin */
.coin-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.coin-inner.spinning {
  animation: cyberpunkFlip 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
}

.coin-front,
.coin-back {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  backface-visibility: hidden;
  overflow: hidden;
  border: var(--border-width) solid;
}

.coin-front {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  border-color: #06b6d4;
  box-shadow:
    0 0 20px rgba(6, 182, 212, 0.6),
    inset 0 0 20px rgba(6, 182, 212, 0.2),
    0 4px 10px rgba(0, 0, 0, 0.5);
}

.coin-back {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%);
  border-color: #ec4899;
  box-shadow:
    0 0 20px rgba(236, 72, 153, 0.6),
    inset 0 0 20px rgba(236, 72, 153, 0.2),
    0 4px 10px rgba(0, 0, 0, 0.5);
  transform: rotateY(180deg);
}

.coin-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Scan line effect */
.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.8), transparent);
  animation: scan 2s linear infinite;
}

@keyframes scan {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(var(--coin-size));
  }
}

/* Currency symbol */
.currency-symbol {
  font-family: "Courier New", monospace;
  font-size: var(--font-size);
  font-weight: bold;
  color: #06b6d4;
  text-shadow:
    0 0 10px currentColor,
    0 0 20px currentColor,
    0 0 30px currentColor;
  position: relative;
  z-index: 1;
}

.coin-back .currency-symbol {
  color: #ec4899;
}

/* Glitch effect */
.glitch {
  position: relative;
}

.spinning .glitch::before,
.spinning .glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.spinning .glitch::before {
  animation: glitch1 0.3s infinite;
  color: #06b6d4;
  z-index: -1;
}

.spinning .glitch::after {
  animation: glitch2 0.3s infinite;
  color: #ec4899;
  z-index: -2;
}

@keyframes glitch1 {
  0%,
  100% {
    transform: translate(0);
    opacity: 0.8;
  }
  33% {
    transform: translate(-2px, 2px);
    opacity: 0.6;
  }
  66% {
    transform: translate(2px, -2px);
    opacity: 0.7;
  }
}

@keyframes glitch2 {
  0%,
  100% {
    transform: translate(0);
    opacity: 0.7;
  }
  33% {
    transform: translate(2px, -2px);
    opacity: 0.5;
  }
  66% {
    transform: translate(-2px, 2px);
    opacity: 0.6;
  }
}

/* Flip animation with RGB split */
@keyframes cyberpunkFlip {
  0% {
    transform: rotateY(0);
  }
  25% {
    filter: hue-rotate(0deg) brightness(1.2);
  }
  50% {
    transform: rotateY(540deg);
    filter: hue-rotate(180deg) brightness(1.5);
  }
  75% {
    filter: hue-rotate(360deg) brightness(1.2);
  }
  100% {
    transform: rotateY(1080deg);
    filter: hue-rotate(0deg) brightness(1);
  }
}
</style>
