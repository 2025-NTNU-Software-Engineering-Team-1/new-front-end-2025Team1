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

// const toggleDark = useToggle(isDark);

const isMiniSidebarToggled = useStorage(LOCAL_STORAGE_KEY.MINI_SIDEBAR, false);

const isMini = computed(() => isMiniSidebarToggled.value && isDesktop.value);

const theme = useTheme();

// Animation States
const flySun = ref(false);
const flyMoon = ref(false);
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
      flySun.value = true;
      setTimeout(() => {
        flySun.value = false;
        particles.value = [];
      }, 2000);
    } else {
      flyMoon.value = true;
      setTimeout(() => {
        flyMoon.value = false;
        particles.value = [];
      }, 2000);
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
  <!-- Main Sidebar Content -->
  <label for="noj-drawer" class="drawer-overlay"></label>
  <ul
    :class="[
      'menu bg-primary h-full w-40 flex-col gap-2 px-0 py-6 text-white',
      isMini ? 'overflow-hidden lg:w-14' : 'overflow-y-auto lg:w-28',
    ]"
  >
    <!-- ... existing menu items ... -->
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

  <!-- Teleported Animations -->
  <Teleport to="body">
    <!-- Sun Animation -->
    <div v-if="flySun" class="fly-object sun">
      <div class="glow-ring sun-glow"></div>
      <i-uil-sun class="celestial-icon text-warning h-24 w-24" />
    </div>

    <!-- Moon Animation -->
    <div v-if="flyMoon" class="fly-object moon">
      <div class="glow-ring moon-glow"></div>
      <i-uil-moon class="celestial-icon text-info h-24 w-24" />
    </div>

    <!-- Particles -->
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

/* Add a subtle background flash effect */
@keyframes bg-flash {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 0.1;
  }
}
</style>
