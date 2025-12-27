/**
 * Kokoro TTS Client
 *
 * 負責與 Web Worker 通訊，並在主執行緒處理 AudioContext 播放
 */
import type { WorkerMessage, WorkerResponse } from "../workers/kokoro.worker";

// RawAudio 介面 (與 Worker 共用概念)
interface RawAudio {
  audio: Float32Array;
  sampling_rate: number;
}

// 狀態變數
let worker: Worker | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;
let useFallback = false;

// 當前語音
let currentVoice: string = "af_heart";

// AudioContext & Source
let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

// 基礎語速
const BASE_SPEED = 0.8;

// 進度回調
type ProgressCallback = (progress: number, status: string) => void;
let progressCallback: ProgressCallback | null = null;

/**
 * 可用語音列表
 */
export const AVAILABLE_VOICES = [
  // English
  { id: "af_heart", name: "Heart (女聲)", gender: "female" },
  { id: "af_bella", name: "Bella (女聲)", gender: "female" },
  { id: "af_nicole", name: "Nicole (女聲)", gender: "female" },
  { id: "af_sarah", name: "Sarah (女聲)", gender: "female" },
  { id: "am_adam", name: "Adam (男聲)", gender: "male" },
  { id: "am_michael", name: "Michael (男聲)", gender: "male" },
  // Chinese
  { id: "zf_xiaobei", name: "小北 (女聲)", gender: "female" },
  { id: "zf_xiaoni", name: "小妮 (女聲)", gender: "female" },
  { id: "zm_yunjian", name: "雲健 (男聲)", gender: "male" },
  { id: "zm_yunxi", name: "雲希 (男聲)", gender: "male" },
];

/**
 * Emotion 對應語速調整
 */
const EMOTION_SPEED_MULTIPLIER: Record<string, number> = {
  smile: 1.1,
  unhappy: 0.85,
  tired: 0.8,
  surprised: 1.2,
};

// 存儲 speak 的 resolve 函數
let currentSpeakResolver: (() => void) | null = null;
let currentSpeakRejecter: ((err: Error) => void) | null = null;

/**
 * 初始化 Worker 與 Kokoro
 */
export async function initKokoro(): Promise<void> {
  if (useFallback) return;
  if (worker) return; // 已初始化
  if (isInitializing && initPromise) return initPromise;

  isInitializing = true;
  progressCallback?.(0, "正在啟動語音引擎...");

  initPromise = new Promise<void>((resolve, reject) => {
    try {
      // 建立 Worker
      worker = new Worker(new URL("../workers/kokoro.worker.ts", import.meta.url), { type: "module" });

      // 設定訊息監聽
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        switch (msg.type) {
          case "init-success":
            console.log("[KokoroClient] Worker initialized successfully");
            progressCallback?.(100, "語音引擎就緒");
            resolve();
            break;

          case "init-fail":
            console.error("[KokoroClient] Worker failed to init:", msg.error);
            useFallback = true;
            worker?.terminate();
            worker = null;
            reject(new Error(msg.error));
            break;

          case "progress":
            progressCallback?.(msg.percent, msg.text);
            break;

          case "audio":
            playRawAudio({ audio: msg.audio, sampling_rate: msg.sampling_rate });
            // 解析等待中的 speak Promise
            if (currentSpeakResolver) {
              currentSpeakResolver();
              currentSpeakResolver = null;
              currentSpeakRejecter = null;
            }
            break;

          case "error":
            console.error("[KokoroClient] Worker error:", msg.error);
            // 拒絕等待中的 Promise
            if (currentSpeakRejecter) {
              currentSpeakRejecter(new Error(msg.error));
              currentSpeakResolver = null;
              currentSpeakRejecter = null;
            }
            break;
        }
      };

      // 發送初始化指令
      const initMsg: WorkerMessage = { type: "init" };
      worker.postMessage(initMsg);
    } catch (err) {
      // safe cast error
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[KokoroClient] Failed to create worker:", error);
      useFallback = true;
      reject(error);
    } finally {
      isInitializing = false;
    }
  });

  return initPromise;
}

export function isReady(): boolean {
  return useFallback || worker !== null;
}

export function setVoice(voiceId: string): void {
  currentVoice = voiceId;
}

export function getCurrentVoice(): string {
  return currentVoice;
}

export function setProgressCallback(callback: ProgressCallback | null): void {
  progressCallback = callback;
}

/**
 * 合成並播放 (發送指令給 Worker)
 */
export async function speak(text: string, emotion?: string): Promise<void> {
  const cleaned = (text ?? "").trim();
  if (!cleaned) return;

  // 中文支援目前 kokoro-js 缺少字典檔，會讀成 "Chinese letter"
  // 因此暫時強制使用瀏覽器 TTS 處理中文
  if (isChineseText(cleaned)) {
    console.log("[KokoroClient] 檢測到中文，強制使用瀏覽器 TTS (kokoro-js 暫不支援中文)");
    // 嘗試尋找中文語音
    speakWithBrowserTTS(cleaned, emotion);
    return;
  }

  if (!isReady()) {
    try {
      await initKokoro();
    } catch {
      speakWithBrowserTTS(cleaned, emotion);
      return;
    }
  }

  if (useFallback || !worker) {
    speakWithBrowserTTS(cleaned, emotion);
    return;
  }

  stop(); // 停止目前播放

  const speedMultiplier = EMOTION_SPEED_MULTIPLIER[emotion ?? ""] ?? 1.0;
  const speed = BASE_SPEED * speedMultiplier;

  // 發送合成請求
  const msg: WorkerMessage = {
    type: "speak",
    text: cleaned,
    voice: currentVoice,
    speed,
  };

  worker.postMessage(msg);
  console.log(`[KokoroClient] Sent speak request: "${cleaned.substring(0, 10)}..."`);

  return new Promise<void>((resolve, reject) => {
    currentSpeakResolver = resolve;
    currentSpeakRejecter = reject;
  });
}

/**
 * 停止播放
 */
export function stop(): void {
  // 停止 AudioContext 播放
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      /* ignore */
    }
    currentSource = null;
  }

  // 通知 Worker 停止 (如果需要)
  if (worker) {
    worker.postMessage({ type: "stop" });
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function dispose(): void {
  stop();
  if (worker) {
    worker.terminate();
    worker = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  useFallback = false;
}

// --- 播放與輔助函數 ---

async function playRawAudio(audio: RawAudio): Promise<void> {
  if (!audioContext) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const { audio: samples, sampling_rate: sampleRate } = audio;
  const audioBuffer = audioContext.createBuffer(1, samples.length, sampleRate);

  try {
    audioBuffer.getChannelData(0).set(samples);
  } catch (e) {
    console.error("[KokoroClient] Buffer error:", e);
    return;
  }

  currentSource = audioContext.createBufferSource();
  currentSource.buffer = audioBuffer;
  currentSource.onended = () => {
    currentSource = null;
  };
  currentSource.connect(audioContext.destination);
  currentSource.start();
}

function speakWithBrowserTTS(text: string, emotion?: string): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-TW";
  const voices = window.speechSynthesis.getVoices?.() ?? [];
  const voice = voices.find((v) => v.lang === "zh-TW") ?? voices.find((v) => v.lang?.startsWith("zh"));
  if (voice) utter.voice = voice;

  const multiplier = EMOTION_SPEED_MULTIPLIER[emotion ?? ""] ?? 1.0;
  utter.rate = BASE_SPEED * multiplier;
  window.speechSynthesis.speak(utter);
}

function isChineseText(text: string): boolean {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const totalChars = text.replace(/\s/g, "").length;
  return totalChars > 0 && chineseChars / totalChars > 0.3;
}

export default {
  initKokoro,
  isReady,
  speak,
  stop,
  dispose,
  setProgressCallback,
  setVoice,
  getCurrentVoice,
  AVAILABLE_VOICES,
};
