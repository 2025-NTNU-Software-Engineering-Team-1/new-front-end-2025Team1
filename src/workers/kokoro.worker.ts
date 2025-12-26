import { KokoroTTS } from 'kokoro-js';

// 定義 Worker 訊息類型
export type WorkerMessage = 
  | { type: 'init' }
  | { type: 'speak', text: string, voice: string, speed: number }
  | { type: 'stop' };

// 定義回傳訊息類型
export type WorkerResponse = 
  | { type: 'init-success' }
  | { type: 'init-fail', error: string }
  | { type: 'progress', percent: number, text: string }
  | { type: 'audio', audio: Float32Array, sampling_rate: number, text: string }
  | { type: 'error', error: string };

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let kokoro: KokoroTTS | null = null;
let isInitializing = false;

// 監聽主執行緒訊息
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      await handleInit();
      break;
    case 'speak':
      await handleSpeak(msg.text, msg.voice, msg.speed);
      break;
    case 'stop':
      // Worker 端的 stop 通常意味著取消當前的生成任務
      // 目前 kokoro-js 的 generate 是 async 的，一旦開始很難中斷
      // 但我們可以設置一個 flag 讓後續處理停止
      break;
  }
};

async function handleInit() {
  if (kokoro || isInitializing) return;
  
  isInitializing = true;
  postResponse({ type: 'progress', percent: 0, text: '正在載入語音模型...' });

  try {
    // 強制使用 WASM
    const device = 'wasm';
    
    postResponse({ type: 'progress', percent: 10, text: '正在下載模型...' });

    kokoro = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q4',
      device,
      progress_callback: (progress: any) => {
        if (progress.status === 'progress' && progress.total) {
          const percent = Math.round(10 + (progress.loaded / progress.total) * 80);
          postResponse({ type: 'progress', percent, text: `下載中... ${percent}%` });
        }
      },
    });

    // --- Monkey Patch for Chinese Support ---
    // Fix: kokoro-js checks against a hardcoded English voice list. We bypass this for Chinese.
    if (kokoro) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const k = kokoro as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const originalValidate = k._validate_voice?.bind(k);
        
        k._validate_voice = (voice: string) => {
            if (voice.startsWith('z') || voice.startsWith('Z')) {
                // Return the voice ID string directly for Chinese
                // This relies on kokoro-js internally handling string voice ID (or failing later)
                // If it fails, we know we need more hacks.
                return voice;
            }
            return originalValidate ? originalValidate(voice) : voice;
        };
        console.log('[KokoroWorker] Patched _validate_voice for Chinese support');
    }

    postResponse({ type: 'progress', percent: 100, text: '語音引擎就緒' });
    postResponse({ type: 'init-success' });
  } catch (err: any) {
    console.error('[KokoroWorker] Init failed:', err);
    postResponse({ type: 'init-fail', error: err.message || String(err) });
  } finally {
    isInitializing = false;
  }
}

async function handleSpeak(text: string, voice: string, speed: number) {
  if (!kokoro) {
    postResponse({ type: 'error', error: 'Kokoro engine not initialized' });
    return;
  }

  try {
    // 執行合成
    const audioData = await kokoro.generate(text, { 
      voice: voice as any, 
      speed 
    });

    // 將 Float32Array 移轉給主執行緒 (Zero-copy)
    const audio = audioData.audio;
    const sampling_rate = audioData.sampling_rate;
    
    // 注意：postMessage 的第二個參數是 transfer list，我們把 buffer 傳過去
    const response: WorkerResponse = { 
      type: 'audio', 
      audio, 
      sampling_rate,
      text 
    };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).postMessage(response, [audio.buffer] as any);
    
  } catch (err: any) {
    console.error('[KokoroWorker] Speak failed:', err);
    postResponse({ type: 'error', error: err.message || String(err) });
  }
}

function postResponse(msg: WorkerResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).postMessage(msg);
}
