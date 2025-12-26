<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount, onMounted } from "vue";
import { LAppDelegate } from "@/live2d/Framework/src/lappdelegate";
import { setSkinConfig } from "@/live2d/Framework/src/lappdefine";
import api from "@/models/api";
import MarkdownRenderer from "./MarkdownRenderer.vue";
import SkinSelector from "./SkinSelector.vue";

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

// ====== TTS (Text-to-Speech) ======
const speakingMsgId = ref<number | null>(null);

const pickVoice = (lang = "zh-TW") => {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const exact = voices.find((v) => v.lang === lang);
  if (exact) return exact;

  const fallback = voices.find((v) => v.lang?.startsWith("zh"));
  return fallback ?? null;
};

const speakText = (msgId: number, text: string) => {
  if (!("speechSynthesis" in window)) {
    console.warn("[TTS] browser not supported");
    return;
  }

  const cleaned = (text ?? "").trim();
  if (!cleaned) return;

  if (speakingMsgId.value === msgId && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    speakingMsgId.value = null;
    return;
  }

  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.lang = "zh-TW";
  const voice = pickVoice("zh-TW");
  if (voice) utter.voice = voice;

  utter.rate = 1.0; // 語速 0.1 ~ 10
  utter.pitch = 1.0; // 音高 0 ~ 2
  utter.volume = 1.0;

  speakingMsgId.value = msgId;

  utter.onend = () => {
    if (speakingMsgId.value === msgId) speakingMsgId.value = null;
  };
  utter.onerror = () => {
    if (speakingMsgId.value === msgId) speakingMsgId.value = null;
  };

  window.speechSynthesis.speak(utter);
};

// 關聊天窗時也停掉語音
const stopSpeak = () => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  speakingMsgId.value = null;
};

// ====== 聊天 UI 狀態 ======
const isOpen = ref(false);
const showTrigger = ref(true);
const draft = ref("");
const live2dInited = ref(false);
const isAwaitingReply = ref(false);

const currentExpression = ref<string | null>(null);

const chatScale = ref(1.15);

// ====== 皮膚選擇 ======
const showSkinSelector = ref(false);
const currentSkinId = ref("builtin_hiyori");
const avatarPath = ref("/live2d/hiyori_avatar.png");

// Emotion mappings for current skin
const currentEmotionMappings = ref<Record<string, string | null>>({
  smile: "F05",
  unhappy: "F03",
  tired: "F08",
  surprised: "F06",
});

const openSkinSelector = () => {
  showSkinSelector.value = true;
};

const onSkinChanged = async (skinId: string) => {
  currentSkinId.value = skinId;
  // Update avatar thumbnail and emotion mappings
  try {
    const res = await api.VtuberSkin.get(skinId);
    const skin = Array.isArray(res.data) ? undefined : (res.data?.data ?? res.data);
    if (skin) {
      if (skin.thumbnail_path) {
        avatarPath.value = skin.thumbnail_path;
      }
      // Update emotion mappings
      currentEmotionMappings.value = skin.emotion_mappings ?? {};
    }
  } catch {
    // Ignore
  }
};

// Load user's skin preference on mount
const loadSkinPreference = async () => {
  try {
    const res = await api.VtuberSkin.getPreference();
    const data = Array.isArray(res.data) ? undefined : (res.data?.data ?? res.data);
    const skinId = data?.selected_skin_id ?? "builtin_hiyori";
    currentSkinId.value = skinId;

    if (skinId !== "builtin_hiyori") {
      const skinRes = await api.VtuberSkin.get(skinId);
      const skin = Array.isArray(skinRes.data) ? undefined : (skinRes.data?.data ?? skinRes.data);
      if (skin) {
        avatarPath.value = skin.thumbnail_path ?? "/live2d/hiyori_avatar.png";
        // Load emotion mappings
        currentEmotionMappings.value = skin.emotion_mappings ?? {};
        setSkinConfig(skin.model_path, skin.model_json_name);
      }
    }
  } catch (e) {
    console.warn("[AIChatbot] loadSkinPreference error:", e);
  }
};

// 聊天紀錄：一開始不要� �設訊息，等 history 載入
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

// � �設表情：F01
const setDefaultExpression = () => {
  try {
    const app = LAppDelegate.getInstance();
    app.setExpression("F01");
    currentExpression.value = "F01";
  } catch (e) {
    console.warn("[ExpressionDebug] 無法重置表情:", e);
  }
};

// emotion → expression ID 對應 (使用動態映射)
const emotionToExpressionId = (emotion?: string): string | null => {
  if (!emotion) return null;
  const mappings = currentEmotionMappings.value;
  return mappings[emotion] ?? null;
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

// ====== � �設訊息 & 歷史紀錄 ======

// const isLoadingHistory = ref(false);

const loadHistory = async () => {
  try {
    const res = await api.Chatbot.getHistory({
      course_name: props.courseName,
      username: props.username,
    });

    const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];

    messages.value = [];
    let id = 0;

    for (const item of list) {
      let text = item.text ?? "";
      let emotion: string | undefined = undefined;

      try {
        const obj = JSON.parse(text);
        if (Array.isArray(obj?.data)) {
          text = obj.data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((x: any) => {
              if (x?.text) {
                emotion ||= x.emotion;
                return x.text;
              }
              return "";
            })
            .join("\n")
            .trim();
        }
      } catch {
        // 不是 JSON，當正常文字
      }

      messages.value.push({
        id: id++,
        from: item.role === "user" ? "me" : "ai",
        text,
        displayText: text,
        phase: "done",
        emotion,
      });
    }

    nextId = id;
    scrollToBottom();
  } catch (e) {
    console.error("[AIChat] 讀取歷史失敗:", e);
  }
};

const typeAiMessage = (fullText: string, emotion?: string) => {
  return new Promise<void>((resolve) => {
    const id = nextId++;
    const prevExpressionId = currentExpression.value ?? "F01";
    let completed = false;

    const finish = () => {
      if (completed) return;
      completed = true;
      typingTimers.delete(id);
      thinkingTimers.delete(id);
      setLive2DTalking(false);
      changeExpression(prevExpressionId ?? "F01");
      resolve();
    };

    messages.value.push({
      id,
      from: "ai",
      text: fullText,
      displayText: "",
      phase: "thinking",
      emotion,
      prevExpressionId,
    });

    scrollToBottom();

    const thinkingDelay = 400;
    const thinkingTimer = window.setTimeout(() => {
      const msgIndex = messages.value.findIndex((m) => m.id === id);
      if (msgIndex === -1) {
        finish();
        return;
      }

      const speed = 90;
      let index = 0;

      messages.value[msgIndex].phase = "typing";

      applyEmotion(emotion);
      setLive2DTalking(true);

      const timer = window.setInterval(() => {
        const idx = messages.value.findIndex((m) => m.id === id);
        if (idx === -1) {
          clearInterval(timer);
          finish();
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
          finish();
        }
      }, speed);

      typingTimers.set(id, timer);
      thinkingTimers.delete(id);
    }, thinkingDelay);

    thinkingTimers.set(id, thinkingTimer);
  });
};

// 測試用

/* const simulateAiReply = () => {
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
}; */

const requestAiReply = async (userText: string) => {
  isAwaitingReply.value = true;
  const thinkingId = nextId++;
  messages.value.push({
    id: thinkingId,
    from: "ai",
    text: "",
    displayText: "",
    phase: "thinking",
  });
  scrollToBottom();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractPayload = (res: any) => {
    const a = res?.data;
    const b = res?.data?.data;
    const c = res?.data?.data?.data;

    if (Array.isArray(a)) return a;
    if (Array.isArray(b)) return b;
    if (Array.isArray(c)) return c;
    return [];
  };

  try {
    const res = await api.Chatbot.ask({
      message: userText,
      current_code: props.currentCode ?? "",
      course_name: props.courseName ?? "",
      problem_id: String(props.problemId ?? ""),
    });

    const data = extractPayload(res);

    messages.value = messages.value.filter((m) => m.id !== thinkingId);

    if (!data.length) {
      await typeAiMessage("AI 沒有回傳內容，請稍後再試");
      setLive2DTalking(false);
      setDefaultExpression();
      return;
    }

    let emotion: string | undefined = undefined;
    const parts: string[] = [];

    for (const item of data) {
      const t = String(item?.text ?? "").trim();
      if (t) parts.push(t);
      if (!emotion && item?.emotion) emotion = item.emotion;
    }

    const mergedText = parts.join("\n\n").trim();

    await typeAiMessage(mergedText || "AI 沒有回傳內容，請稍後再試", emotion);

    setLive2DTalking(false);
    setDefaultExpression();
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

    setLive2DTalking(false);
    setDefaultExpression();
  } finally {
    isAwaitingReply.value = false;
  }
};

const pushUserMessage = (text: string) => {
  messages.value.push({
    id: nextId++,
    from: "me",
    text,
    displayText: text,
    phase: "done",
  });

  scrollToBottom();
  requestAiReply(text);
};

const send = () => {
  if (isAwaitingReply.value) return;
  const text = draft.value.trim();
  if (!text) return;

  draft.value = "";
  pushUserMessage(text);
};

const sendExplain = () => {
  if (isAwaitingReply.value) return;
  pushUserMessage("解釋這題");
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

  // 初始化完套上� �設表情 F01
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
  stopSpeak();
};

const onAfterLeave = () => {
  showTrigger.value = true;
};

// Initialize skin preference on mount
onMounted(() => {
  loadSkinPreference();
});

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
  <!-- 背景遮罩 -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-40 bg-black/30 backdrop-blur-md transition-all duration-300"
    @click="closeChat"
  />

  <!-- 右下角聊天區（整個一起 scale） -->
  <div class="fixed right-6 bottom-6 z-50 origin-bottom-right" :style="{ transform: `scale(${chatScale})` }">
    <!-- 開啟按鈕 -->
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

    <!-- 聊天窗 -->
    <Transition name="chat-pop" @after-leave="onAfterLeave">
      <div
        v-show="isOpen"
        class="chat-panel flex overflow-hidden rounded-3xl border border-white/30 bg-white/20 shadow-[0_0_40px_rgba(150,120,255,0.25)] backdrop-blur-lg"
        style="width: 900px; height: 520px; max-width: calc(100vw - 48px); max-height: calc(100vh - 48px)"
        @click.stop
      >
        <!-- Live2D -->
        <div
          class="relative flex w-2/5 flex-col items-center justify-center border-r border-white/30 bg-gradient-to-br from-purple-200/30 to-indigo-200/20"
        >
          <canvas id="live2d-canvas" class="live2d-canvas absolute inset-0"></canvas>
          <div class="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/30"></div>
        </div>

        <!-- 聊天內容 -->
        <div class="flex w-3/5 flex-col">
          <!-- Header -->
          <header
            class="flex items-center justify-between bg-gradient-to-r from-purple-400 to-indigo-400 px-5 py-3 text-white shadow-md"
          >
            <div class="flex items-center gap-2">
              <div
                class="h-9 w-9 cursor-pointer overflow-hidden rounded-full border border-white/70 shadow transition-transform hover:scale-110 hover:ring-2 hover:ring-white/50"
                title="點擊更換外觀"
                @click="openSkinSelector"
              >
                <img :src="avatarPath" class="h-full w-full object-cover" />
              </div>
              <p class="text-xs opacity-80">AI 助教</p>
            </div>

            <button
              class="chat-icon-btn flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              @click="closeChat"
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

          <!-- 訊息區 -->
          <main
            ref="chatBodyEl"
            class="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-indigo-50/30 to-purple-50/30 px-5 pt-3 pb-6"
          >
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex"
              :class="msg.from === 'ai' ? 'justify-start' : 'justify-end'"
            >
              <!-- AI 訊息 -->
              <div v-if="msg.from === 'ai'" class="flex max-w-[85%] items-start gap-1">
                <div class="flex items-start gap-1">
                  <div
                    class="rounded-2xl rounded-tl-sm border border-white/40 bg-white/40 px-3 py-2 text-sm text-slate-800 shadow-md backdrop-blur-sm"
                    style="box-shadow: 0 0 15px rgba(180, 140, 255, 0.2)"
                  >
                    <div v-if="msg.phase === 'thinking'" class="typing-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <div v-else-if="msg.phase === 'typing'" class="leading-relaxed whitespace-pre-wrap">
                      {{ msg.displayText ?? "" }}
                    </div>
                    <div v-else class="markdown-body ai-msg leading-relaxed">
                      <MarkdownRenderer :md="String(msg.text ?? '')" />
                    </div>
                  </div>

                  <!-- 🔊 語音播放按鈕 -->
                  <button
                    v-if="msg.phase === 'done' && String(msg.text ?? '').trim()"
                    class="tts-btn mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-white/30 backdrop-blur-sm hover:bg-white/50"
                    @click="speakText(msg.id, String(msg.text ?? ''))"
                    :title="speakingMsgId === msg.id ? '停止朗讀' : '播放語音'"
                  >
                    <svg
                      v-if="speakingMsgId === msg.id"
                      class="h-4 w-4 text-slate-700"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="7" y="7" width="10" height="10" rx="2" />
                    </svg>
                    <svg
                      v-else
                      class="h-4 w-4 text-slate-700"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M11 5L6 9H3v6h3l5 4V5z" />
                      <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" />
                      <path d="M18 6a8 8 0 0 1 0 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 使用者訊息 -->
              <div v-else class="max-w-[85%]">
                <div
                  class="rounded-2xl rounded-tr-sm bg-gradient-to-r from-indigo-400 to-purple-500 px-3 py-2 text-sm text-white shadow-md"
                >
                  <div class="markdown-body user-msg text-white/95">
                    <MarkdownRenderer :md="String(msg.displayText ?? msg.text)" />
                  </div>
                </div>
              </div>
            </div>
          </main>

          <!-- 輸入區 -->
          <footer
            class="relative flex items-center gap-2 border-t border-white/30 bg-gradient-to-b from-indigo-50/50 to-purple-50/50 px-4 py-2 backdrop-blur-md"
          >
            <button
              class="chat-icon-btn no-shift-btn absolute -top-8 right-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-md"
              :disabled="isAwaitingReply"
              @click="sendExplain"
            >
              解釋這題
            </button>
            <textarea
              v-model="draft"
              rows="2"
              class="flex-1 resize-none rounded-2xl border border-white/40 bg-white/50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:ring-2 focus:ring-purple-300 focus:outline-none"
              placeholder="輸入訊息…（Enter 送出，Shift+Enter 換行）"
              @keydown.enter.exact.prevent="send"
              @keydown.enter.shift.stop
            />
            <button
              class="chat-icon-btn flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 text-white shadow-md"
              :disabled="!draft.trim() || isAwaitingReply"
              @click="send"
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

  <!-- Skin Selector Modal -->
  <SkinSelector
    v-model:visible="showSkinSelector"
    :current-skin-id="currentSkinId"
    :current-username="props.username"
    @skin-changed="onSkinChanged"
  />
</template>

<style scoped>
/* 開啟 / 關閉聊天框動畫 */
.chat-pop-enter-active,
.chat-pop-leave-active {
  transition:
    opacity 0.25s ease-out,
    transform 0.25s ease-out;
  transform-origin: bottom right;
}
.chat-pop-enter-from,
.chat-pop-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

.chat-icon-btn {
  transition:
    transform 0.15s ease-out,
    box-shadow 0.15s ease-out,
    background-color 0.15s ease-out,
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
.markdown-body :deep(*) {
  color: inherit;
}
.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(pre) {
  margin: 0.25rem 0;
}
.tts-btn {
  transition:
    transform 0.12s ease-out,
    box-shadow 0.12s ease-out,
    background-color 0.12s ease-out;
}
.tts-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 10px rgba(180, 140, 255, 0.25);
}
.tts-btn:active {
  transform: translateY(0) scale(0.96);
}
.no-shift-btn,
.no-shift-btn:hover,
.no-shift-btn:active {
  transform: none !important;
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

/* Markdown 表格樣式 + hover（scoped 必須用 :deep） */
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 8px 10px;
  vertical-align: top;
}

.markdown-body :deep(tbody tr:hover) {
  background: rgba(255, 255, 255, 0.12);
}

/* Inline code background in chat */
.ai-msg :deep(code) {
  background-color: rgba(255, 255, 255, 0.6) !important;
  color: #0f172a !important; /* slate-900 */
  padding: 0.2em 0.4em;
  border-radius: 0.375rem; /* rounded-md */
  font-weight: 500;
}
.user-msg :deep(code) {
  background-color: rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
  padding: 0.2em 0.4em;
  border-radius: 0.375rem;
  font-weight: 500;
}
</style>
