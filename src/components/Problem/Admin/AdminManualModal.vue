<script setup lang="ts">
/**
 * AdminManualModal.vue
 *
 * A front-end only, read-only manual modal that supports:
 * - Multiple markdown pages
 * - Left sidebar navigation to switch pages
 * - Independent scroll per page (scroll position is remembered)
 * - Wheel scrolling inside each page content area
 * - ESC / backdrop click to close
 *
 * Notes:
 * - This implementation intentionally does NOT use <dialog> to avoid CSS/layout issues
 *   where the backdrop appears but the modal box becomes invisible in some layouts.
 */

import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import { PROBLEM_ADMIN_MANUAL_PAGES } from "@/docs/problem-admin-manual/index";

const open = ref(false);
const activeId = ref(PROBLEM_ADMIN_MANUAL_PAGES[0]?.id ?? "basic");

// The scrollable content container on the right side
const contentRef = ref<HTMLElement | null>(null);

// Remember scrollTop per page id, so switching pages keeps the previous scroll position
const scrollMemory = new Map<string, number>();

// The currently active manual page object
const activePage = computed(() => PROBLEM_ADMIN_MANUAL_PAGES.find((p) => p.id === activeId.value));

function openManual() {
  open.value = true;
}

function closeManual() {
  open.value = false;
}

// Close on ESC key
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") closeManual();
}

window.addEventListener("keydown", onKeydown);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});

// Prevent background scrolling while the modal is open
watch(open, (v) => {
  document.body.style.overflow = v ? "hidden" : "";
});

// Switch page:
// 1) Save current page scrollTop
// 2) Change active page id
// 3) Wait for DOM update
// 4) Restore new page scrollTop (or 0 if never visited)
async function switchPage(id: string) {
  if (contentRef.value) scrollMemory.set(activeId.value, contentRef.value.scrollTop);

  activeId.value = id;
  await nextTick();

  if (contentRef.value) contentRef.value.scrollTop = scrollMemory.get(id) ?? 0;
}
</script>

<template>
  <button type="button" class="btn btn-sm btn-outline" @click.stop="openManual">Manual</button>

  <teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[9999]">
      <!-- Backdrop layer (click to close) -->
      <div class="absolute inset-0 bg-black/60" @click="closeManual" />

      <!-- Modal wrapper -->
      <div class="absolute inset-0 flex items-center justify-center p-4">
        <!-- Modal box -->
        <div class="bg-base-100 w-full max-w-6xl overflow-hidden rounded-lg shadow-2xl">
          <!-- Header -->
          <div class="border-base-300 flex items-center justify-between border-b px-4 py-3">
            <div class="text-lg font-bold">Problem Admin Manual</div>
            <button type="button" class="btn btn-sm btn-circle" @click="closeManual">✕</button>
          </div>

          <!-- Body: left navigation + right content
               Key detail:
               - We must set min-h-0 on grid container and grid items to allow the inner overflow areas
                 to actually scroll (CSS grid/flex default min-height:auto can block scrolling).
               - The grid container has a fixed height (75vh), and each side has its own scroll.
          -->
          <div class="grid h-[75vh] min-h-0 grid-cols-12 overflow-hidden">
            <!-- Left: navigation (scrollable) -->
            <aside class="border-base-300 bg-base-200/50 col-span-3 min-h-0 border-r">
              <div class="h-full min-h-0 overflow-y-auto p-2">
                <button
                  v-for="p in PROBLEM_ADMIN_MANUAL_PAGES"
                  :key="p.id"
                  type="button"
                  class="btn btn-ghost btn-sm w-full justify-start"
                  :class="p.id === activeId ? 'btn-active' : ''"
                  @click="switchPage(p.id)"
                >
                  {{ p.title }}
                </button>
              </div>
            </aside>

            <!-- Right: content (scrollable per page) -->
            <main class="col-span-9 min-h-0 min-w-0">
              <div ref="contentRef" class="h-full min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
                <template v-if="activePage">
                  <MarkdownRenderer :md="activePage.md" />
                </template>
                <template v-else>
                  <div class="opacity-70">Page not found.</div>
                </template>
              </div>
            </main>
          </div>

          <!-- Footer -->
          <div class="border-base-300 flex justify-end border-t px-4 py-3">
            <button type="button" class="btn" @click="closeManual">Close</button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>
