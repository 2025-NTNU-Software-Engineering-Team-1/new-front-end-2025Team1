<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount } from "vue";
import { LAppDelegate } from "@/live2d/Framework/src/lappdelegate";

type ChatMessage = {
  id: number;
  from: "me" | "ai";
  text: string;
  displayText?: string;
  phase?: "thinking" | "typing" | "done";
};

// ====== 聊天 UI 狀態 ======
const isOpen = ref(false);
const showTrigger = ref(true);
const draft = ref("");

const live2dInited = ref(false);

// 用來讓 key 不撞到
let nextId = 2;

// 訊息列表
const messages = ref<ChatMessage[]>([
  {
    id: 1,
    from: "ai",
    text: "嗨～有需要什麼幫助嗎？",
    displayText: "嗨～有需要什麼幫助嗎？",
  },
]);

const chatBodyEl = ref<HTMLElement | null>(null);

const typingTimers = new Map<number, number>();
const thinkingTimers = new Map<number, number>();

const scrollToBottom = () => {
  nextTick(() => {
    const el = chatBodyEl.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
};

const typeAiMessage = (fullText: string) => {
  const id = nextId++;

  //  push 一個「思考中」的空訊息
  messages.value.push({
    id,
    from: "ai",
    text: fullText,
    displayText: "",
    phase: "thinking",
  });

  scrollToBottom();

  const thinkingDelay = 600; // 思考時間（毫秒）

  const thinkingTimer = window.setTimeout(() => {
    const msgIndex = messages.value.findIndex((m) => m.id === id);
    if (msgIndex === -1) return;

    const speed = 18; // 打字速度
    let index = 0;

    messages.value[msgIndex].phase = "typing";

    const timer = window.setInterval(() => {
      const idx = messages.value.findIndex((m) => m.id === id);
      if (idx === -1) {
        clearInterval(timer);
        typingTimers.delete(id);
        return;
      }

      index++;
      const msg = messages.value[idx];
      msg.displayText = fullText.slice(0, index);
      scrollToBottom();

      if (index >= fullText.length) {
        msg.phase = "done";
        clearInterval(timer);
        typingTimers.delete(id);
      }
    }, speed);

    typingTimers.set(id, timer);
    thinkingTimers.delete(id);
  }, thinkingDelay);

  thinkingTimers.set(id, thinkingTimer);
};

// 測試效果
const simulateAiReply = () => {
  const reply = "這是一段模擬的 AI 回覆 FHLJEHGJKEHFJKSFHFEHFIUEHIUWBEFBEFGIWBFI";
  typeAiMessage(reply);
};

// 送出訊息
const send = () => {
  const text = draft.value.trim();
  if (!text) return;

  messages.value.push({
    id: nextId++,
    from: "me",
    text,
    displayText: text,
  });

  draft.value = "";
  scrollToBottom();

  // TODO：串接 AI API，API 回來後改成：
  // typeAiMessage(apiResponseText)
  simulateAiReply();
};

// ====== Live2D 初始化 ======
const initLive2D = () => {
  if (live2dInited.value) {
    console.log("[Live2D] 已初始化，略過 initLive2D");
    return;
  }

  console.log("[Live2D] initLive2D 被呼叫");

  const app = LAppDelegate.getInstance();
  if (!app.initialize()) {
    console.error("[Live2D] LAppDelegate.initialize() 失敗");
    return;
  }

  app.run();
  live2dInited.value = true;
};

const openChat = () => {
  isOpen.value = true;
  showTrigger.value = false;

  nextTick(() => {
    initLive2D();
    scrollToBottom();
  });
};

const closeChat = () => {
  isOpen.value = false;
};

const onAfterLeave = () => {
  showTrigger.value = true;
};

onBeforeUnmount(() => {
  isOpen.value = false;
  showTrigger.value = false;

  typingTimers.forEach((timerId) => clearInterval(timerId));
  typingTimers.clear();

  thinkingTimers.forEach((timerId) => clearTimeout(timerId));
  thinkingTimers.clear();
});
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-40 bg-black/30 backdrop-blur-md transition-all duration-300"
    @click="closeChat"
  />

  <div class="fixed bottom-6 right-6 z-50">
    <button
      v-if="showTrigger && !isOpen"
      class="chat-icon-btn chat-holo relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 shadow-lg"
      @click.stop="openChat"
      aria-label="開啟助教聊天"
    >
      <svg
        class="relative z-[1] h-8 w-8 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-3.5 3.5A1 1 0 0 1 8 18v-3H6a2 2 0 0 1-2-2V6z"
        />
      </svg>
    </button>

    <Transition name="chat-pop" @after-leave="onAfterLeave">
      <div
        v-show="isOpen"
        class="chat-panel flex overflow-hidden rounded-3xl border border-white/30 bg-white/20 shadow-[0_0_40px_rgba(150,120,255,0.25)] backdrop-blur-lg"
        style="width: 900px; height: 520px"
        @click.stop
      >
        <!-- 左：Live2D 區 -->
        <div
          class="relative flex w-2/5 items-center justify-center border-r border-white/30 bg-gradient-to-br from-purple-200/30 to-indigo-200/20"
        >
          <canvas id="live2d-canvas" class="live2d-canvas"></canvas>
          <div class="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/30"></div>
        </div>

        <!-- 右：對話區 -->
        <div class="flex w-3/5 flex-col">
          <header
            class="flex items-center justify-between bg-gradient-to-r from-purple-400 to-indigo-400 px-5 py-3 text-white shadow-md"
          >
            <div class="flex items-center gap-2">
              <div class="h-9 w-9 overflow-hidden rounded-full border border-white/70 shadow">
                <img src="/live2d/hiyori_avatar.png" alt="" class="h-full w-full object-cover" />
              </div>
              <div>
                <p class="text-xs opacity-80">AI 助教</p>
              </div>
            </div>

            <!-- 關閉 / 縮小 -->
            <button
              type="button"
              class="chat-icon-btn flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              @click="closeChat"
              aria-label="關閉聊天窗"
            >
              <svg
                class="h-4 w-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <!-- 訊息列表 -->
          <main
            ref="chatBodyEl"
            class="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-indigo-50/30 to-purple-50/30 px-5 py-3"
          >
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex"
              :class="msg.from === 'ai' ? 'justify-start' : 'justify-end'"
            >
              <!-- AI -->
              <div v-if="msg.from === 'ai'" class="flex max-w-[85%] items-start gap-2">
                <div class="h-7 w-7 overflow-hidden rounded-full border border-purple-200 shadow">
                  <img src="/live2d/hiyori_avatar.png" alt="" class="h-full w-full object-cover" />
                </div>
                <div
                  class="rounded-2xl rounded-tl-sm border border-white/40 bg-white/40 px-3 py-2 text-sm text-slate-800 shadow-md backdrop-blur-sm"
                  style="box-shadow: 0 0 15px rgba(180, 140, 255, 0.2)"
                >
                  <div class="flex flex-col gap-1">
                    <div v-if="msg.phase === 'thinking'" class="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>

                    <div v-else class="whitespace-pre-wrap text-sm leading-relaxed">
                      {{ msg.displayText ?? msg.text }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 自己 -->
              <div v-else class="flex max-w-[85%] justify-end">
                <div
                  class="rounded-2xl rounded-tr-sm bg-gradient-to-r from-indigo-400 to-purple-500 px-3 py-2 text-sm text-white shadow-md"
                  style="box-shadow: 0 0 15px rgba(150, 120, 255, 0.3)"
                >
                  {{ msg.displayText ?? msg.text }}
                </div>
              </div>
            </div>
          </main>

          <!-- 輸入區 -->
          <footer
            class="flex items-center gap-2 border-t border-white/30 bg-white/40 px-4 py-2 backdrop-blur-md"
          >
            <input
              v-model="draft"
              type="text"
              placeholder="輸入訊息..."
              class="flex-1 rounded-2xl border border-white/40 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              @keydown.enter.prevent="send"
            />

            <button
              type="button"
              class="chat-icon-btn flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 text-white shadow-md disabled:cursor-default disabled:opacity-40"
              @click="send"
              :disabled="!draft.trim()"
              aria-label="送出訊息"
            >
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12L19 5l-3 14-3.5-5L9 17l1.5-5z" />
              </svg>
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 開啟 / 關閉聊天框動畫 */
.chat-pop-enter-active,
.chat-pop-leave-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
  transform-origin: bottom right;
}
.chat-pop-enter-from,
.chat-pop-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

.chat-icon-btn {
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out, background-color 0.15s ease-out,
    opacity 0.15s ease-out;
}
.chat-icon-btn:hover:not(:disabled) {
  transform: translateY(-1px) scale(1.08);
  box-shadow: 0 0 15px rgba(180, 140, 255, 0.4);
}
.chat-icon-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.95);
  box-shadow: 0 0 8px rgba(180, 140, 255, 0.3);
}

.chat-holo::before {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.8), rgba(200, 182, 255, 0));
  opacity: 0.7;
  filter: blur(4px);
  z-index: 0;
}
.chat-holo::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 2px solid rgba(220, 200, 255, 0.8);
  box-shadow: 0 0 25px rgba(190, 160, 255, 0.6);
  opacity: 0.8;
  animation: holo-pulse 2.4s infinite ease-out;
}
.live2d-canvas {
  width: 100%;
  height: 100%;
  display: block;
  background-color: transparent;
}

#live2d-chat-container {
  position: relative;
  overflow: hidden;
}

#live2d-chat-container canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
@keyframes holo-pulse {
  0% {
    transform: scale(0.7);
    opacity: 0.9;
  }
  60% {
    transform: scale(1.25);
    opacity: 0;
  }
  100% {
    transform: scale(1.25);
    opacity: 0;
  }
}
.typing-dots {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  margin-top: 2px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background-color: rgba(80, 60, 140, 0.9);
  animation: typing-dot-bounce 1s infinite ease-in-out;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-dot-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
