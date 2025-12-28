<script setup lang="ts">
import { computed, ref, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { useTheme } from "@/stores/theme";
import { useDark, useToggle, useStorage } from "@vueuse/core";
import { useSession } from "@/stores/session";
import { LOCAL_STORAGE_KEY } from "@/constants";
import useInteractions from "@/composables/useInteractions";

const { isDesktop } = useInteractions();

const isDark = useDark({
  selector: "html",
  attribute: "data-theme",
  valueDark: "dark",
  valueLight: "light",
});
const toggleDark = useToggle(isDark);

const isMiniSidebarToggled = useStorage(LOCAL_STORAGE_KEY.MINI_SIDEBAR, false);

const isMini = computed(() => isMiniSidebarToggled.value && isDesktop.value);

const theme = useTheme();

// Animation States
const flySun = ref(false);
const flyMoon = ref(false);
const showCoder = ref(false);
const particles = ref<Array<{ id: number; x: number; y: number }>>([]);

watch(
  () => isDark.value,
  (newVal, oldVal) => {
    // Only animate if value actually changed and it's not the initial load
    if (newVal === oldVal) return;

    // Generate particles
    particles.value = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
    }));

    // Switch to Light (false) -> Sun flies
    // Switch to Dark (true) -> Moon flies
    if (newVal === false) {
      showCoder.value = true;
      flySun.value = true;
      setTimeout(() => {
        flySun.value = false;
        particles.value = [];
      }, 2000);
      setTimeout(() => {
        showCoder.value = false;
      }, 2500);
    } else {
      showCoder.value = true;
      flyMoon.value = true;
      setTimeout(() => {
        flyMoon.value = false;
        particles.value = [];
      }, 2000);
      setTimeout(() => {
        showCoder.value = false;
      }, 2500);
    }

    theme.setIsDark(newVal);
  },
);

watchEffect(() => {
  theme.setIsDark(isDark.value);
});

const route = useRoute();
const matchRoute = (path: string) => {
  return route.matched.some((r) => r.path === path);
};

const session = useSession();
</script>

<template>
  <label for="noj-drawer" class="drawer-overlay"></label>
  <ul
    :class="[
      'menu bg-primary h-full w-40 flex-col gap-2 px-0 py-6 text-white',
      isMini ? 'overflow-hidden lg:w-14' : 'overflow-y-auto lg:w-28',
    ]"
  >
    <router-link class="my-2 flex cursor-pointer justify-center" to="/">
      <img src="../assets/logo.svg" alt="NOJ Logo" :class="['mb-2', isMini ? 'w-10' : 'w-14']" />
    </router-link>

    <li>
      <side-bar-link :class="{ 'btn-lg': !isMini, 'sidebar-active': matchRoute('/') }" to="/">
        <i-uil-home class="h-6 w-6" />
        <span v-show="!isMini" class="text-base">{{ $t("components.sideBar.home") }}</span>
      </side-bar-link>
    </li>

    <li v-if="session.isLogin">
      <side-bar-link :class="{ 'btn-lg': !isMini, 'sidebar-active': matchRoute('/courses') }" to="/courses">
        <i-uil-book-alt class="h-6 w-6" />
        <span v-show="!isMini" class="text-base">{{ $t("components.sideBar.course") }}</span>
      </side-bar-link>
    </li>

    <li>
      <side-bar-link :class="{ 'btn-lg': !isMini, 'sidebar-active': matchRoute('/about') }" to="/about">
        <i-uil-map-marker-info class="h-6 w-6" />
        <span v-show="!isMini" class="text-base">{{ $t("components.sideBar.about") }}</span>
      </side-bar-link>
    </li>

    <div class="flex-1" />

    <li v-if="session.isAdmin">
      <side-bar-link :class="{ 'btn-lg': !isMini, 'sidebar-active': matchRoute('/admin') }" to="/admin">
        <i-uil-constructor class="h-6 w-6" />
        <span v-show="!isMini" class="text-base">{{ $t("components.sideBar.admin") }}</span>
      </side-bar-link>
    </li>

    <li v-if="session.isLogin">
      <side-bar-link :class="{ 'btn-lg': !isMini, 'sidebar-active': matchRoute('/profile') }" to="/profile">
        <i-uil-user class="h-6 w-6" />
        <span v-show="!isMini" class="text-base">{{ $t("components.sideBar.profile") }}</span>
      </side-bar-link>
    </li>

    <li>
      <side-bar-link :class="{ 'btn-lg': !isMini, 'sidebar-active': matchRoute('/settings') }" to="/settings">
        <i-uil-language class="h-6 w-6" />
      </side-bar-link>
    </li>

    <li>
      <label class="btn btn-primary w-full justify-center rounded-none p-2">
        <div class="swap swap-rotate">
          <input type="checkbox" v-model="isDark" />
          <i-uil-sun class="swap-on h-6 w-6" />
          <i-uil-moon class="swap-off h-6 w-6" />
        </div>
      </label>
    </li>

    <li v-if="isDesktop">
      <label
        class="swap swap-rotate w-full cursor-pointer justify-center py-2 transition-colors hover:bg-[#26568c] hover:text-white"
      >
        <input v-model="isMiniSidebarToggled" type="checkbox" />
        <i-uil-angle-double-right class="swap-on h-6 w-6" />
        <i-uil-angle-double-left class="swap-off h-6 w-6" />
      </label>
    </li>
  </ul>

  <Teleport to="body">
    <div v-if="showCoder" class="coder-container">
      <div class="coder-scene">
        <div class="lamp">
          <div class="lamp-base"></div>
          <div class="lamp-neck"></div>
          <div class="lamp-head"></div>
          <div class="lamp-light"></div>
        </div>

        <div class="desk">
          <div class="laptop">
            <div class="laptop-screen">
              <div class="logo-glow"></div>
              <div class="code-lines">
                <div class="code-line"></div>
                <div class="code-line short"></div>
                <div class="code-line"></div>
                <div class="code-line medium"></div>
              </div>
            </div>
            <div class="laptop-base"></div>
          </div>

          <div class="coffee-cup">
            <div class="steam"></div>
            <div class="steam"></div>
          </div>
        </div>

        <div class="student">
          <div class="head-group">
            <div class="head">
              <div class="hair-back"></div>
              <div class="face">
                <div class="glasses"></div>
                <div class="blush left"></div>
                <div class="blush right"></div>
              </div>
              <div class="hair-front"></div>
              <div class="headphones">
                <div class="ear-cup left"></div>
                <div class="ear-cup right"></div>
                <div class="band"></div>
              </div>
            </div>
            <div class="hood"></div>
          </div>

          <div class="body">
            <div class="hoodie-pocket"></div>
            <div class="hoodie-strings"></div>
          </div>
          <div class="arm left"></div>
          <div class="arm right"></div>
        </div>

        <div class="text-bubble">
          <div class="dots"><span>.</span><span>.</span><span>.</span></div>
          Debugging...
        </div>
      </div>
    </div>

    <div v-if="flySun" class="fly-object sun">
      <div class="glow-ring sun-glow"></div>
      <i-uil-sun class="celestial-icon text-warning h-24 w-24" />
    </div>

    <div v-if="flyMoon" class="fly-object moon">
      <div class="glow-ring moon-glow"></div>
      <i-uil-moon class="celestial-icon text-info h-24 w-24" />
    </div>

    <div
      v-for="particle in particles"
      :key="particle.id"
      class="particle"
      :style="{
        '--particle-x': `${particle.x}px`,
        '--particle-y': `${particle.y}px`,
      }"
    >
      ✨
    </div>
  </Teleport>
</template>

<style scoped>
/* --- Original Functional Styles (Kept) --- */
.fly-object {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  right: -80px;
  bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.celestial-icon {
  position: relative;
  z-index: 2;
  animation: icon-spin 2s ease-in-out forwards;
  filter: drop-shadow(0 0 20px currentColor);
}

.glow-ring {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  opacity: 0;
  animation: pulse-glow 2s ease-in-out forwards;
}

.sun-glow {
  background: radial-gradient(circle, rgba(255, 193, 7, 0.6) 0%, rgba(255, 193, 7, 0) 70%);
  box-shadow: 0 0 60px 20px rgba(255, 193, 7, 0.5);
}

.moon-glow {
  background: radial-gradient(circle, rgba(96, 165, 250, 0.6) 0%, rgba(96, 165, 250, 0) 70%);
  box-shadow: 0 0 60px 20px rgba(96, 165, 250, 0.5);
}

.sun {
  animation: fly-arc-sun 2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.moon {
  animation: fly-arc-moon 2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.particle {
  position: fixed;
  z-index: 9998;
  pointer-events: none;
  font-size: 20px;
  left: 50%;
  top: 50%;
  animation: particle-burst 1.5s ease-out forwards;
}

@keyframes fly-arc-sun {
  0% {
    transform: translate(0, 0) scale(0.3) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  50% {
    transform: translate(-50vw, -45vh) scale(2) rotate(360deg);
  }
  85% {
    opacity: 1;
  }
  100% {
    transform: translate(-100vw, 10vh) scale(0.3) rotate(720deg);
    opacity: 0;
  }
}

@keyframes fly-arc-moon {
  0% {
    transform: translate(0, 0) scale(0.3) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  50% {
    transform: translate(-50vw, -45vh) scale(2) rotate(-360deg);
  }
  85% {
    opacity: 1;
  }
  100% {
    transform: translate(-100vw, 10vh) scale(0.3) rotate(-720deg);
    opacity: 0;
  }
}

@keyframes icon-spin {
  0% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(1.2);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.5);
  }
}

@keyframes particle-burst {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--particle-x), var(--particle-y)) scale(0);
    opacity: 0;
  }
}

/* --- NEW BEAUTIFIED STYLES --- */

.coder-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9997;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: fade-in-out 2.5s ease-in-out forwards;
  backdrop-filter: blur(2px);
  background: rgba(0, 0, 0, 0.2);
}

.coder-scene {
  position: relative;
  transform: translateY(-20px);
  animation: scene-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
}

/* Desk */
.desk {
  position: relative;
  width: 240px;
  height: 12px;
  background: #a05a2c;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  z-index: 10;
}
.desk::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 20px;
  right: 20px;
  height: 60px;
  background: #8b4513;
  border-radius: 0 0 20px 20px;
  opacity: 0.8;
}

/* Lamp */
.lamp {
  position: absolute;
  left: -40px;
  bottom: 12px;
  z-index: 5;
}
.lamp-base {
  width: 30px;
  height: 8px;
  background: #444;
  border-radius: 4px;
}
.lamp-neck {
  width: 4px;
  height: 60px;
  background: #444;
  margin-left: 13px;
  transform: rotate(-10deg);
  transform-origin: bottom center;
}
.lamp-head {
  position: absolute;
  top: -60px;
  left: -10px;
  width: 40px;
  height: 25px;
  background: #444;
  border-radius: 20px 20px 0 0;
  transform: rotate(20deg);
}
.lamp-light {
  position: absolute;
  top: -35px;
  left: 25px;
  width: 100px;
  height: 100px;
  background: radial-gradient(circle, rgba(255, 255, 200, 0.3) 0%, rgba(255, 255, 200, 0) 70%);
  pointer-events: none;
  z-index: 20;
}

/* Laptop */
.laptop {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  z-index: 15;
}
.laptop-screen {
  width: 100px;
  height: 65px;
  background: #2d2d2d;
  border: 4px solid #d1d5db;
  border-radius: 6px;
  position: relative;
  box-shadow: 0 0 15px rgba(100, 200, 255, 0.1);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.code-lines {
  width: 80%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.code-line {
  height: 3px;
  background: #569cd6;
  border-radius: 2px;
  animation: typing 1s infinite alternate;
}
.code-line:nth-child(2) {
  background: #ce9178;
  animation-delay: 0.2s;
}
.code-line:nth-child(3) {
  background: #4ec9b0;
  animation-delay: 0.4s;
}
.laptop-base {
  height: 6px;
  background: #e5e7eb;
  border-radius: 0 0 4px 4px;
  margin-top: -2px;
  border-bottom: 2px solid #9ca3af;
}

/* Coffee */
.coffee-cup {
  position: absolute;
  right: 30px;
  bottom: 12px;
  width: 20px;
  height: 24px;
  background: #fff;
  border-radius: 0 0 4px 4px;
  z-index: 15;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}
.coffee-cup::after {
  content: "";
  position: absolute;
  top: 6px;
  right: -5px;
  width: 6px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 0 4px 4px 0;
}
.steam {
  position: absolute;
  top: -10px;
  left: 50%;
  width: 4px;
  height: 10px;
  background: #fff;
  opacity: 0.6;
  border-radius: 50%;
  filter: blur(1px);
  animation: steam-rise 1.5s infinite;
}
.steam:nth-child(2) {
  animation-delay: 0.5s;
  top: -15px;
}

/* Student */
.student {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.head-group {
  position: relative;
  z-index: 6;
  animation: head-bob 1.5s ease-in-out infinite;
}
.head {
  position: relative;
  width: 60px;
  height: 55px;
  background: #ffdbac;
  border-radius: 14px;
  box-shadow: 0 4px 5px rgba(0, 0, 0, 0.1);
}
.hair-back {
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: 20px;
  background: #3e2723;
  border-radius: 18px 18px 10px 10px;
  z-index: -1;
}
.hair-front {
  position: absolute;
  top: -8px;
  left: -2px;
  width: 105%;
  height: 25px;
  background: #3e2723;
  border-radius: 16px 16px 0 16px;
}
.face {
  position: relative;
  top: 22px;
  width: 100%;
  text-align: center;
}
.glasses {
  display: inline-block;
  width: 40px;
  height: 12px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 2px;
  margin-bottom: 2px;
}
.blush {
  position: absolute;
  top: 14px;
  width: 6px;
  height: 3px;
  background: #ffab91;
  border-radius: 50%;
  opacity: 0.6;
}
.blush.left {
  left: 10px;
}
.blush.right {
  right: 10px;
}
.headphones {
  position: absolute;
  width: 100%;
  top: 0;
  bottom: 0;
  pointer-events: none;
}
.ear-cup {
  position: absolute;
  top: 15px;
  width: 12px;
  height: 35px;
  background: #333;
  border-radius: 6px;
  z-index: 10;
}
.ear-cup.left {
  left: -12px;
  border-right: 2px solid #555;
}
.ear-cup.right {
  right: -12px;
  border-left: 2px solid #555;
}
.band {
  position: absolute;
  top: -12px;
  left: -5px;
  right: -5px;
  height: 20px;
  border: 4px solid #333;
  border-bottom: none;
  border-radius: 50px 50px 0 0;
  z-index: 10;
}
.hood {
  position: absolute;
  bottom: -5px;
  left: -5px;
  right: -5px;
  height: 20px;
  background: #546e7a;
  border-radius: 20px;
  z-index: -2;
}
.body {
  position: relative;
  width: 70px;
  height: 50px;
  background: #607d8b;
  border-radius: 20px 20px 0 0;
  margin-top: -5px;
  z-index: 5;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
}
.hoodie-pocket {
  position: absolute;
  bottom: 0;
  left: 15px;
  right: 15px;
  height: 20px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px 10px 0 0;
}
.hoodie-strings {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
}
.hoodie-strings::before,
.hoodie-strings::after {
  content: "";
  position: absolute;
  top: 0;
  width: 2px;
  height: 15px;
  background: #fff;
}
.hoodie-strings::before {
  left: 5px;
}
.hoodie-strings::after {
  right: 5px;
}
.arm {
  position: absolute;
  width: 12px;
  height: 35px;
  background: #607d8b;
  border-radius: 6px;
  bottom: 15px;
  z-index: 11;
}
.arm::after {
  content: "";
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 12px;
  height: 10px;
  background: #ffdbac;
  border-radius: 50%;
}
.arm.left {
  left: -5px;
  transform-origin: top right;
  animation: typing-left 0.4s ease-in-out infinite alternate;
}
.arm.right {
  right: -5px;
  transform-origin: top left;
  animation: typing-right 0.4s ease-in-out infinite alternate-reverse;
}

/* Bubble */
.text-bubble {
  position: absolute;
  top: -30px;
  right: -90px;
  background: #fff;
  color: #333;
  padding: 6px 12px;
  border-radius: 12px;
  border-bottom-left-radius: 0;
  font-size: 12px;
  font-weight: 800;
  font-family: monospace;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  animation: bubble-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  opacity: 0;
  animation-delay: 0.5s;
  animation-fill-mode: forwards;
  display: flex;
  align-items: center;
  gap: 4px;
}
.dots span {
  animation: blink-dot 1.4s infinite both;
}
.dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.dots span:nth-child(3) {
  animation-delay: 0.4s;
}

/* Animations */
@keyframes fade-in-out {
  0% {
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
@keyframes scene-pop {
  0% {
    transform: translateY(20px) scale(0.8);
    opacity: 0;
  }
  100% {
    transform: translateY(-20px) scale(1);
    opacity: 1;
  }
}
@keyframes steam-rise {
  0% {
    transform: translateY(0);
    opacity: 0.8;
  }
  100% {
    transform: translateY(-15px);
    opacity: 0;
  }
}
@keyframes head-bob {
  0%,
  100% {
    transform: rotate(0deg) translateY(0);
  }
  50% {
    transform: rotate(2deg) translateY(2px);
  }
}
@keyframes typing-left {
  from {
    transform: rotate(15deg);
  }
  to {
    transform: rotate(25deg);
  }
}
@keyframes typing-right {
  from {
    transform: rotate(-15deg);
  }
  to {
    transform: rotate(-25deg);
  }
}
@keyframes bubble-pop {
  from {
    opacity: 0;
    transform: scale(0.5) translate(-10px, 10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translate(0, 0);
  }
}
@keyframes blink-dot {
  0% {
    opacity: 0.2;
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0.2;
  }
}
</style>
