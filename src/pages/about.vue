<script setup lang="ts">
import { useTitle } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import ScrollMagic from "scrollmagic";
import { onMounted, ref } from "vue";

useTitle("About | Normal OJ");
const { t } = useI18n();
const teams = [
  {
    title: t("about.maintainer"),
    people: ["AlaRduTP", "as535364", "asef18766", "Bogay", "skps2010", "uier"],
  },
  {
    title: t("about.serviceLearning2022"),
    people: ["180079995", "aokblast", "howard9199", "laporchen", "Misawai"],
  },
  {
    title: t("about.serviceLearning2021"),
    people: [
      "Alanasdw",
      "BirkhoffLee",
      "eoleedi",
      "jw910731",
      "littlepenguin89106",
      "PoHsien-Liu",
      "QQ1010",
      "RuiRabbit",
      "RUJRSJ",
      "simon5955687",
      "sophie8909",
      "toto6038",
      "YingMuo",
    ],
  },
  {
    title: t("about.swe2019"),
    people: [
      "aisu-programming",
      "AlaRduTP",
      "as535364",
      "asef18766",
      "Bogay",
      "brianchangtw",
      "Dynzer",
      "fuji37450",
      "hackbabu9033",
      "Ikaros1110",
      "shangchiwu",
      "skps2010",
      "Snowball0409",
      "uier",
    ],
  },
];

const teamRefs = ref<Array<HTMLElement>>([]);
const setTeamRefs = (el: unknown) => {
  teamRefs.value.push(el as HTMLElement);
};
let scrollController = new ScrollMagic.Controller();
function updateScrollAnimation() {
  scrollController.destroy(true);
  scrollController = new ScrollMagic.Controller();
  teams.forEach((team, idx) => {
    const id = `#team-${idx}`;
    const duration = `${(teamRefs.value[idx].clientHeight / window.innerHeight) * 100 + 25}%`;
    new ScrollMagic.Scene({
      triggerElement: id,
      triggerHook: 0.65,
      duration: duration,
    })
      .setClassToggle(id, "visible")
      .addTo(scrollController);
    if (idx == 0) {
      new ScrollMagic.Scene({
        triggerElement: id,
        triggerHook: 0.65,
        duration: duration,
      })
        .setClassToggle("#scroll-hint", "visible")
        .addTo(scrollController);
    }
  });
}
onMounted(() => {
  updateScrollAnimation();
  window.addEventListener("resize", updateScrollAnimation);
});
</script>

<template>
  <div class="flex h-screen">
    <div class="flex-1 overflow-y-scroll">
      <div class="prose mx-auto mt-10 w-full pb-60 font-mono" id="links">
        <div class="flex w-full flex-col items-center">
          <h1 class="uppercase">{{ t("about.links") }}</h1>
          <div class="flex gap-12">
            <a href="https://fb.me/noj.tw" class="mx-12" target="_blank" rel="noopener noreferrer">
              <i-uil-facebook class="h-28 w-28" color="var(--icon-color)" aria-label="facebook" />
            </a>
            <a
              href="https://github.com/Normal-OJ/Normal-OJ"
              class="mx-12"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i-uil-github class="h-28 w-28" color="var(--icon-color)" aria-label="github" />
            </a>
          </div>
        </div>

        <div class="mt-16 flex w-full flex-col items-center">
          <h1 class="uppercase">{{ t("about.contributor") }}</h1>
          <div id="scroll-hint" class="reveal visible absolute bottom-16">
            <i-uil-angle-double-down class="h-16 w-16" />
          </div>
          <div
            v-for="(team, index) in teams"
            class="reveal flex w-100 flex-col items-center"
            :ref="setTeamRefs"
            :id="`team-${index}`"
          >
            <h3>{{ team.title }}</h3>
            <div class="w-fix my-4 grid grid-cols-2 gap-x-40 gap-y-8 md:grid-cols-4 lg:grid-cols-6">
              <div v-for="name in team.people" class="not-prose flex flex-col items-center">
                <div class="avatar">
                  <div class="mask mask-squircle w-16">
                    <img :src="`https://github.com/${name}.png`" :alt="`${name}'s github profile avatar`" />
                  </div>
                </div>
                <span class="mt-2 text-sm">{{ name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:root {
  --icon-color-light: hsl(224, 70%, 6%);
  --icon-color-dark: hsl(0 0% 100%);
  --icon-color: var(--icon-color-light);
}

/* Respect system preference */
@media (prefers-color-scheme: dark) {
  :root {
    --icon-color: var(--icon-color-dark);
  }
}

/* Respect app data-theme attribute if used */
:root[data-theme="dark"] {
  --icon-color: var(--icon-color-dark);
}
:root[data-theme="light"] {
  --icon-color: var(--icon-color-light);
}

/* Ensure icon components pick up color; use ::v-deep for scoped style */
::v-deep i-uil-github,
::v-deep i-uil-facebook {
  color: var(--icon-color);
}
::v-deep i-uil-github svg,
::v-deep i-uil-facebook svg {
  fill: currentColor;
}

.reveal {
  opacity: 0;
  -webkit-transform: scale(0.8);
  -moz-transform: scale(0.8);
  -ms-transform: scale(0.8);
  -o-transform: scale(0.8);
  transform: scale(0.8);
  -webkit-transition: all 400ms ease-in-out;
  -moz-transition: all 400ms ease-in-out;
  -ms-transition: all 400ms ease-in-out;
  -o-transition: all 400ms ease-in-out;
  transition: all 400ms ease-in-out;
}

.visible {
  opacity: 1;
  -webkit-transform: none;
  -moz-transform: none;
  -ms-transform: none;
  -o-transform: none;
  transform: none;
}

.prose h1 {
  font-size: 2.25rem; /* Ensure h1 is larger than other text */
  font-weight: bold;
  text-transform: uppercase;
  color: rgb(1, 11, 37);
}
.prose h3 {
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: 2rem;
  color: rgb(1, 11, 37);
}

/* Dark mode overrides (use theme variables for contrast) */
[data-theme="dark"] .prose h1,
:root[data-theme="dark"] .prose h1 {
  color: var(--color-base-content) !important;
}
[data-theme="dark"] .prose h3,
:root[data-theme="dark"] .prose h3 {
  color: var(--color-base-content) !important;
}
</style>
