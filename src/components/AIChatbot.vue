<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount } from "vue";
import { LAppDelegate } from "@/live2d/Framework/src/lappdelegate";
import api from "@/models/api";

// ------- Props：從外層傳進來課程 / 題目 / 使用者資訊 -------
const props = defineProps<{
  courseId: string;
  courseName: string;
  problemId: string | number;
  currentCode: string;
  username: string;
}>();

type ChatMessage = {
  id: number;
  from: "me" | "ai";
  text: string;
  displayText?: string;
  phase?: "thinking" | "typing" | "done";
  emotion?: string;
  prevExpressionId?: string | null;
};

// ====== 聊天 UI 狀態 ======
const isOpen = ref(false);
const showTrigger = ref(true);
const draft = ref("");
const live2dInited = ref(false);

const currentExpression = ref<string | null>(null);

// 聊天紀錄：一開始不要預設訊息，等 history 載入
let nextId = 1;
const messages = ref<ChatMessage[]>([]);
const chatBodyEl = ref<HTMLElement | null>(null);

const typingTimers = new Map<number, number>();
const thinkingTimers = new Map<number, number>();

// ====== Live2D & 表情 ======

const scrollToBottom = () => {
  nextTick(() => {
    const el = chatBodyEl.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
};

const changeExpression = (expId: string) => {
  try {
    const app = LAppDelegate.getInstance();
    app.setExpression(expId);
    currentExpression.value = expId;
  } catch (e) {
    console.warn("[ExpressionDebug] 無法切換表情:", e);
  }
};

// 預設表情：F01
const setDefaultExpression = () => {
  try {
    const app = LAppDelegate.getInstance();
    app.setExpression("F01");
    currentExpression.value = "F01";
  } catch (e) {
    console.warn("[ExpressionDebug] 無法重置表情:", e);
  }
};

// emotion → expression ID 對應
const emotionToExpressionId = (emotion?: string): string | null => {
  if (!emotion) return null;

  switch (emotion) {
    case "smile":
      return "F05";
    case "unhappy":
      return "F03";
    case "tired":
      return "F08";
    case "surprised":
      return "F06";
    default:
      return null;
  }
};

const applyEmotion = (emotion?: string) => {
  const expId = emotionToExpressionId(emotion);
  if (expId) {
    changeExpression(expId);
  }
};

const setLive2DTalking = (isTalking: boolean) => {
  if (!live2dInited.value) {
    console.warn("[Live2D] 嘗試 setTalking，但 Live2D 尚未初始化，略過。isTalking =", isTalking);
    return;
  }
  try {
    LAppDelegate.setTalking(isTalking);
  } catch (e) {
    console.error("[Live2D] setTalking 發生錯誤:", e);
  }
};

// ====== 預設訊息 & 歷史紀錄 ======

const pushDefaultGreeting = () => {
  if (messages.value.length > 0) return;
  messages.value.push({
    id: nextId++,
    from: "ai",
    text: "嗨～有需要什麼幫助嗎？",
    displayText: "嗨～有需要什麼幫助嗎？",
    phase: "done",
  });
};

const isLoadingHistory = ref(false);

const loadHistory = async () => {
  if (!api.Chatbot || !api.Chatbot.getHistory) {
    console.error("[AIChat] Chatbot API 尚未設定，略過載入歷史紀錄");
    pushDefaultGreeting();
    return;
  }

  if (!props.courseId || !props.username) {
    console.warn("[AIChat] 缺少 courseId 或 username，無法載入歷史紀錄");
    pushDefaultGreeting();
    return;
  }

  isLoadingHistory.value = true;
  try {
    const res = await api.Chatbot.getHistory({
      course_id: props.courseId,
      username: props.username,
    });

    const list = res.data ?? [];
    messages.value = [];

    if (Array.isArray(list) && list.length > 0) {
      for (const item of list) {
        messages.value.push({
          id: nextId++,
          from: item.role === "user" ? "me" : "ai",
          text: item.text,
          displayText: item.text,
          phase: "done",
        });
      }
    } else {
      pushDefaultGreeting();
    }
  } catch (e) {
    console.error("[AIChat] 讀取歷史紀錄失敗:", e);
    pushDefaultGreeting();
  } finally {
    isLoadingHistory.value = false;
    scrollToBottom();
  }
};

const typeAiMessage = (fullText: string, emotion?: string) => {
  const id = nextId++;

  const prevExpressionId = currentExpression.value ?? "F01";

  messages.value.push({
    id,
    from: "ai",
    text: fullText,
    displayText: "",
    phase: "thinking", // 一開始先顯示點點點
    emotion,
    prevExpressionId,
  });

  scrollToBottom();

  const thinkingDelay = 400; // 開始打字前的小停頓
  const thinkingTimer = window.setTimeout(() => {
    const msgIndex = messages.value.findIndex((m) => m.id === id);
    if (msgIndex === -1) return;

    const speed = 80; // 打字速度
    let index = 0;

    // 進入打字階段
    messages.value[msgIndex].phase = "typing";

    applyEmotion(emotion);
    setLive2DTalking(true);

    const timer = window.setInterval(() => {
      const idx = messages.value.findIndex((m) => m.id === id);
      if (idx === -1) {
        clearInterval(timer);
        typingTimers.delete(id);

        setLive2DTalking(false);
        const brokenMsg = messages.value.find((m) => m.id === id);
        const prev = brokenMsg?.prevExpressionId ?? "F01";
        changeExpression(prev);
        return;
      }

      index++;
      const msg = messages.value[idx];

      if (index <= fullText.length) {
        msg.displayText = fullText.slice(0, index);
      }

      scrollToBottom();

      if (index >= fullText.length) {
        msg.phase = "done";
        clearInterval(timer);
        typingTimers.delete(id);

        // 打完：嘴巴停＋表情切回原本（預設 F01）
        setLive2DTalking(false);
        const prev = msg.prevExpressionId ?? "F01";
        changeExpression(prev);
      }
    }, speed);

    typingTimers.set(id, timer);
    thinkingTimers.delete(id);
  }, thinkingDelay);

  thinkingTimers.set(id, thinkingTimer);
};

// 測試用

const simulateAiReply = () => {
  const replies = [
    // { text: "gugvvvjvhjbhkbkbjhvgchfchgchgcfch", emotion: "smile" },
    {
      text: "cytftfutugugygihivjvjgvvjvuvuvuvtvtvutvutvutvtuvtuv",
      emotion: "unhappy",
    },
    // { text: "yufutftyfugigihukhiuguyf", emotion: "tired" },
    // { text: "ufufiygiugigiygigiguyguffyyugiuuihi", emotion: "surprised" },
  ];

  for (const r of replies) {
    typeAiMessage(r.text, r.emotion);
  }
};

const requestAiReply = async (userText: string) => {
  const thinkingId = nextId++;
  messages.value.push({
    id: thinkingId,
    from: "ai",
    text: "",
    displayText: "",
    phase: "thinking",
  });
  scrollToBottom();

  try {
    const res = await api.Chatbot.ask({
      message: userText,
      current_code: props.currentCode ?? "",
      course_name: props.courseName ?? "",
      problem_id: String(props.problemId ?? ""),
    });

    const data = res.data ?? [];

    messages.value = messages.value.filter((m) => m.id !== thinkingId);

    if (!Array.isArray(data) || data.length === 0) {
      typeAiMessage("（AI 沒有回傳內容，請稍後再試）");
      return;
    }

    for (const item of data) {
      typeAiMessage(item.text, item.emotion);
    }
  } catch (e) {
    console.error("[AIChat] ask 發生錯誤:", e);

    const idx = messages.value.findIndex((m) => m.id === thinkingId);
    if (idx !== -1) {
      messages.value[idx].phase = "done";
      messages.value[idx].from = "ai";
      messages.value[idx].text = "AI 助教暫時無法回應，請稍後再試。";
      messages.value[idx].displayText = "AI 助教暫時無法回應，請稍後再試。";
    } else {
      messages.value.push({
        id: nextId++,
        from: "ai",
        text: "AI 助教暫時無法回應，請稍後再試。",
        displayText: "AI 助教暫時無法回應，請稍後再試。",
        phase: "done",
      });
    }

    // 發生錯誤時也回到預設表情 F01 並停嘴
    setLive2DTalking(false);
    setDefaultExpression();
  }
};

const send = () => {
  const text = draft.value.trim();
  if (!text) return;

  messages.value.push({
    id: nextId++,
    from: "me",
    text,
    displayText: text,
    phase: "done",
  });

  draft.value = "";
  scrollToBottom();

  // 測試：使用假資料，不打後端
  //simulateAiReply();

  // 之後要接後端的時候，改回這行
  requestAiReply(text);
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
  console.log("[Live2D] 初始化完成");

  // 初始化完套上預設表情 F01
  setDefaultExpression();
};

const openChat = () => {
  isOpen.value = true;
  showTrigger.value = false;

  nextTick(async () => {
    initLive2D();
    // 開啟時載入歷史紀錄
    await loadHistory();
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

  setLive2DTalking(false);
  setDefaultExpression();

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
        <!-- === Live2D 區塊 === -->
        <div
          class="relative flex w-2/5 flex-col items-center justify-center border-r border-white/30 bg-gradient-to-br from-purple-200/30 to-indigo-200/20"
        >
          <canvas id="live2d-canvas" class="live2d-canvas absolute inset-0"></canvas>
          <div class="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/30"></div>
        </div>

        <!-- === 聊天區塊 === -->
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
              <!-- AI 訊息 -->
              <div v-if="msg.from === 'ai'" class="flex max-w-[85%] items-start gap-2">
                <div class="h-7 w-7 overflow-hidden rounded-full border border-purple-200 shadow">
                  <img src="/live2d/hiyori_avatar.png" alt="" class="h-full w-full object-cover" />
                </div>
                <div
                  class="rounded-2xl rounded-tl-sm border border-white/40 bg-white/40 px-3 py-2 text-sm text-slate-800 shadow-md backdrop-blur-sm"
                  style="box-shadow: 0 0 15px rgba(180, 140, 255, 0.2)"
                >
                  <div class="flex flex-col gap-1">
                    <!-- 思考中：顯示點點點動畫 -->
                    <div v-if="msg.phase === 'thinking'" class="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>

                    <!-- 已開始打字 / 完成：顯示文字 -->
                    <div v-else class="whitespace-pre-wrap text-sm leading-relaxed">
                      {{ msg.displayText ?? msg.text }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 使用者訊息 -->
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
