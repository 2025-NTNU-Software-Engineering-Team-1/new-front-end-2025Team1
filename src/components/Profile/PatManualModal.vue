<script setup lang="ts">
/**
 * PatManualModal.vue
 *
 * A read-only API Reference manual modal for Personal Access Token users.
 * Similar to AdminManualModal, supports:
 * - Grouped markdown pages (Categories -> Pages)
 * - 3-column layout (Sitemap | TOC | Content) for Desktop
 * - Drawer layout for Mobile
 */

import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import slugify from "@/utils/slugify";
import { PAT_MANUAL_CATEGORIES, PAT_MANUAL_CATEGORIES_ZH } from "@/docs/personal-access-token/index";

const open = ref(false);
const lang = ref<"en" | "zh">("en");

// Data Source
const categories = computed(() => (lang.value === "en" ? PAT_MANUAL_CATEGORIES : PAT_MANUAL_CATEGORIES_ZH));

const { locale } = useI18n();

// Static Title Map
const titles = {
  en: "API Reference",
  zh: "API 參考手冊",
};

// Selection State
const activeCategoryId = ref(categories.value[0]?.id ?? "getting-started");
const activePageId = ref(categories.value[0]?.pages[0]?.id ?? "overview");

// Mobile Drawer State
const mobileDrawerOpen = ref(false);
const mobileTab = ref<"sitemap" | "toc">("sitemap");

// DOM Refs
const contentRef = ref<HTMLElement | null>(null);

// Scroll Memory
const scrollMemory = new Map<string, number>();

// Helpers
const activeCategory = computed(() => categories.value.find((c) => c.id === activeCategoryId.value));
const activePage = computed(() => activeCategory.value?.pages.find((p) => p.id === activePageId.value));

// TOC State
const activeTocId = ref<string>("");

// Helper to strip markdown inline formatting for consistent slugification
function stripMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/__([^_]+)__/g, "$1") // bold alt
    .replace(/_([^_]+)_/g, "$1"); // italic alt
}

// TOC Generation
const tableOfContents = computed(() => {
  if (!activePage.value?.md) return [];
  const headers: { level: number; text: string; id: string; parentId?: string }[] = [];
  const regex = /^(#{2,3})\s+(.*)$/gm;
  let match;
  let lastH2Id = "";

  while ((match = regex.exec(activePage.value.md)) !== null) {
    const level = match[1].length;
    const rawText = match[2].trim();
    const cleanText = stripMarkdown(rawText);
    const id = slugify(cleanText);

    if (level === 2) {
      lastH2Id = id;
      headers.push({ level, text: cleanText, id });
    } else if (level === 3) {
      headers.push({ level, text: cleanText, id, parentId: lastH2Id });
    }
  }
  return headers;
});

// Actions
function setLang(newLang: "en" | "zh") {
  if (lang.value === newLang) return;
  lang.value = newLang;
  validateSelection();
  activeTocId.value = "";
  saveScroll();
  restoreScroll();
}

function openManual() {
  lang.value = locale.value === "english" ? "en" : "zh";
  validateSelection();
  restoreScroll();
  open.value = true;
}

function closeManual() {
  open.value = false;
  mobileDrawerOpen.value = false;
}

// Local Localization Strings
const uiText = computed(() => ({
  onThisPage: lang.value === "zh" ? "本頁目錄" : "ON THIS PAGE",
  noSections: lang.value === "zh" ? "無章節" : "No sections",
  pageNotFound: lang.value === "zh" ? "找不到頁面" : "Page not found",
  open: lang.value === "zh" ? "使用說明" : "API Docs",
  menu: lang.value === "zh" ? "選單" : "Menu",
  contents: lang.value === "zh" ? "目錄" : "Contents",
}));

function scrollToId(id: string) {
  if (window.innerWidth < 1024) {
    mobileDrawerOpen.value = false;
  }

  nextTick(() => {
    const el = document.getElementById(id);
    if (el && contentRef.value) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      activeTocId.value = id;
    }
  });
}

// Navigation

async function switchPage(pageId: string) {
  if (activePageId.value === pageId) return;

  const parentCat = categories.value.find((c) => c.pages.some((p) => p.id === pageId));
  if (parentCat && parentCat.id !== activeCategoryId.value) {
    activeCategoryId.value = parentCat.id;
  }

  saveScroll();
  activePageId.value = pageId;
  await nextTick();
  restoreScroll();
  activeTocId.value = "";
}

function toggleDrawer() {
  mobileDrawerOpen.value = !mobileDrawerOpen.value;
}

function saveScroll() {
  if (contentRef.value) {
    scrollMemory.set(`${lang.value}:${activePageId.value}`, contentRef.value.scrollTop);
  }
}

function restoreScroll() {
  nextTick(() => {
    if (contentRef.value) {
      contentRef.value.scrollTop = scrollMemory.get(`${lang.value}:${activePageId.value}`) ?? 0;
    }
  });
}

function validateSelection() {
  const catExists = categories.value.find((c) => c.id === activeCategoryId.value);
  if (!catExists) {
    activeCategoryId.value = categories.value[0]?.id ?? "getting-started";
  }

  const validCat = categories.value.find((c) => c.id === activeCategoryId.value);

  if (validCat) {
    const pageExists = validCat.pages.find((p) => p.id === activePageId.value);
    if (!pageExists) {
      activePageId.value = validCat.pages[0]?.id ?? "overview";
    }
  }
}

// Keys & Watchers
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") closeManual();
}
window.addEventListener("keydown", onKeydown);
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
watch(open, (v) => (document.body.style.overflow = v ? "hidden" : ""));
</script>

<template>
  <!-- Trigger Button -->
  <button type="button" class="btn btn-sm lg:btn-md btn-outline" @click.stop="openManual">
    <i-uil-book-open class="mr-1" />
    {{ uiText.open }}
  </button>

  <teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[9999] flex items-center justify-center p-0 lg:p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60" @click="closeManual" />

      <!-- Main Container -->
      <div
        class="bg-base-100 relative z-10 flex h-full w-full flex-col overflow-hidden shadow-2xl lg:h-[95vh] lg:max-w-[95vw] lg:rounded-xl"
      >
        <!-- Header -->
        <div class="border-base-300 flex items-center justify-between border-b px-4 py-3 lg:px-6 lg:py-4">
          <div class="flex items-center gap-4">
            <h2 class="text-xl font-bold lg:text-3xl">{{ titles[lang] }}</h2>

            <!-- Language Switcher -->
            <div class="join hidden lg:flex">
              <button
                type="button"
                class="join-item btn btn-sm"
                :class="lang === 'en' ? 'btn-active btn-neutral' : ''"
                @click="setLang('en')"
              >
                EN
              </button>
              <button
                type="button"
                class="join-item btn btn-sm"
                :class="lang === 'zh' ? 'btn-active btn-neutral' : ''"
                @click="setLang('zh')"
              >
                中文
              </button>
            </div>
            <!-- Mobile Lang Switcher -->
            <button
              type="button"
              class="btn btn-sm font-bold lg:hidden"
              @click="setLang(lang === 'en' ? 'zh' : 'en')"
            >
              {{ lang === "en" ? "EN" : "中" }}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <!-- Mobile Menu Toggle -->
            <button class="btn btn-square btn-ghost lg:hidden" @click="toggleDrawer">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <!-- Close Button -->
            <button type="button" class="btn btn-ghost btn-circle" @click="closeManual">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Body Grid -->
        <div class="relative flex min-h-0 flex-1">
          <!-- Desktop Column 1: Sitemap -->
          <aside class="border-base-300 bg-base-200/50 hidden w-56 flex-col overflow-y-auto border-r lg:flex">
            <div class="p-6">
              <div :key="lang">
                <template v-for="cat in categories" :key="cat.id">
                  <div class="mb-8">
                    <div
                      class="text-base-content/70 mb-3 px-2 text-base font-extrabold uppercase tracking-widest"
                    >
                      {{ cat.title }}
                    </div>
                    <div class="space-y-1">
                      <button
                        v-for="p in cat.pages"
                        :key="p.id"
                        class="btn btn-ghost w-full justify-start text-lg font-normal capitalize"
                        :class="p.id === activePageId ? 'btn-active' : ''"
                        @click="switchPage(p.id)"
                      >
                        {{ p.title }}
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </aside>

          <!-- Desktop Column 2: TOC -->
          <aside class="border-base-300 bg-base-100 hidden w-64 flex-col overflow-y-auto border-r lg:flex">
            <div class="sticky top-0 p-6">
              <div class="mb-4 text-xs font-bold uppercase tracking-wider opacity-60">
                {{ uiText.onThisPage }}
              </div>
              <nav class="space-y-1">
                <template v-for="h in tableOfContents" :key="h.id">
                  <button
                    class="hover:bg-base-200 block w-full truncate rounded px-3 py-1.5 text-left transition-colors"
                    :class="[
                      h.level === 3 ? 'text-base-content/70 pl-8 text-sm' : 'pl-3 text-base font-medium',
                      activeTocId === h.id ? 'bg-base-300 text-base-content font-bold' : '',
                    ]"
                    @click="scrollToId(h.id)"
                  >
                    {{ h.text }}
                  </button>
                </template>

                <div v-if="tableOfContents.length === 0" class="px-2 text-xs italic opacity-50">
                  {{ uiText.noSections }}
                </div>
              </nav>
            </div>
          </aside>

          <!-- Desktop/Mobile Content -->
          <main class="bg-base-100 flex-1 overflow-y-auto scroll-smooth pb-20 lg:pb-0" ref="contentRef">
            <div class="mx-auto max-w-4xl px-4 py-8 lg:px-12 lg:py-12">
              <!-- Breadcrumbs Mobile -->
              <div class="breadcrumbs mb-4 text-sm opacity-50 lg:hidden">
                <ul>
                  <li>{{ activeCategory?.title }}</li>
                  <li>{{ activePage?.title }}</li>
                </ul>
              </div>

              <template v-if="activePage">
                <MarkdownRenderer :md="activePage.md" :preserve-whitespace="false" />
              </template>
              <div v-else class="mt-10 text-center opacity-50">{{ uiText.pageNotFound }}</div>

              <div class="h-32 lg:hidden"></div>
            </div>
          </main>

          <!-- Mobile Drawer (Slide Over) -->
          <div v-if="mobileDrawerOpen" class="absolute inset-0 z-50 flex lg:hidden">
            <!-- Drawer Overlay -->
            <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="toggleDrawer" />

            <!-- Drawer Content -->
            <div
              class="bg-base-100 relative flex h-full w-4/5 max-w-sm flex-col shadow-2xl transition-transform"
            >
              <!-- Mobile Tabs -->
              <div class="tabs tabs-boxed bg-base-200 m-2 p-1">
                <a
                  class="tab tab-lg flex-1 text-lg font-bold"
                  :class="{ 'tab-active': mobileTab === 'sitemap' }"
                  @click="mobileTab = 'sitemap'"
                  >{{ uiText.menu }}</a
                >
                <a
                  class="tab tab-lg flex-1 text-lg font-bold"
                  :class="{ 'tab-active': mobileTab === 'toc' }"
                  @click="mobileTab = 'toc'"
                  >{{ uiText.contents }}</a
                >
              </div>

              <div class="flex-1 overflow-y-auto p-4">
                <!-- Tab: Sitemap -->
                <div v-if="mobileTab === 'sitemap'" class="space-y-8">
                  <template v-for="cat in categories" :key="cat.id">
                    <div>
                      <div
                        class="text-base-content mb-3 px-2 text-sm font-extrabold uppercase tracking-widest"
                      >
                        {{ cat.title }}
                      </div>
                      <ul class="menu bg-base-200 rounded-box w-full">
                        <li v-for="p in cat.pages" :key="p.id">
                          <a
                            class="py-3 text-lg font-medium"
                            :class="{ active: p.id === activePageId }"
                            @click="
                              switchPage(p.id);
                              toggleDrawer();
                            "
                          >
                            {{ p.title }}
                          </a>
                        </li>
                      </ul>
                    </div>
                  </template>
                </div>

                <!-- Tab: TOC -->
                <div v-if="mobileTab === 'toc'">
                  <div class="mb-4 px-2 text-sm font-bold uppercase tracking-wider opacity-60">
                    {{ uiText.onThisPage }}
                  </div>
                  <div class="space-y-2">
                    <template v-for="h in tableOfContents" :key="h.id">
                      <button
                        class="bg-base-200 hover:bg-base-300 block w-full rounded-xl px-4 py-4 text-left transition-colors"
                        :class="h.level === 3 ? 'pl-8 text-base opacity-90' : 'text-lg font-bold'"
                        @click="
                          scrollToId(h.id);
                          toggleDrawer();
                        "
                      >
                        {{ h.text }}
                      </button>
                    </template>
                  </div>
                  <div
                    v-if="tableOfContents.length === 0"
                    class="py-8 text-center text-base italic opacity-50"
                  >
                    {{ uiText.noSections }}
                  </div>
                </div>
              </div>

              <!-- Drawer Footer: Language Switch -->
              <div class="border-base-300 bg-base-200/50 border-t p-4">
                <button
                  class="btn btn-outline w-full text-lg font-bold"
                  @click="setLang(lang === 'en' ? 'zh' : 'en')"
                >
                  Change Language to {{ lang === "en" ? "中文" : "English" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>
