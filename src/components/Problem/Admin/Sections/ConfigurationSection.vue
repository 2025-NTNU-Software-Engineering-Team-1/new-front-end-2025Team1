<script setup lang="ts">
import { inject, Ref, ref, watch, nextTick } from "vue";
import LanguageMultiSelect from "../../Forms/LanguageMultiSelect.vue";
import MultiStringInput from "../Controls/MultiStringInput.vue";

const rawProblem = inject<Ref<ProblemForm> | undefined>("problem");
if (!rawProblem || !rawProblem.value) throw new Error("ConfigurationSection requires problem injection");
const problem = rawProblem as Ref<ProblemForm>;

const quotaError = ref("");
const localQuota = ref<number | "">(problem.value?.quota ?? "");

// --- 代幣動效 state ---
const isFlipping = ref(false);
const flyNumber = ref<number | null>(null);
const showParticles = ref(false);

function spinAndRandomToken() {
  if (isFlipping.value) return;
  isFlipping.value = true;
  setTimeout(async () => {
    const randomToken = Math.floor(2000 + Math.random() * 7000);
    flyNumber.value = randomToken;
    problem.value.config!.aiVTuberMaxToken = randomToken;
    showParticles.value = false;
    await nextTick();
    showParticles.value = true;
    setTimeout(() => {
      showParticles.value = false;
    }, 900);
    setTimeout(() => {
      flyNumber.value = null;
    }, 1200);
    isFlipping.value = false;
  }, 320 + Math.random() * 330);
}

watch(
  () => problem.value,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      localQuota.value = newVal?.quota ?? "";
      quotaError.value = "";
    }
  },
  { deep: false },
);

function ensureConfig() {
  if (!problem.value.config) {
    problem.value.config = {
      trialMode: false,
      aiVTuber: false,
      acceptedFormat: "code",
      maxStudentZipSizeMB: 50,
      aiVTuberMaxToken: 0,
      aiVTuberMode: "guided",
      networkAccessRestriction: {
        enabled: false,
        firewallExtranet: { enabled: false, whitelist: [], blacklist: [] },
        connectWithLocal: { enabled: false, whitelist: [], blacklist: [], localServiceZip: null },
      },
      artifactCollection: [],
    };
  }
}
ensureConfig();

function onQuotaInput(e: Event) {
  const inputEl = e.target as HTMLInputElement;
  const valStr = inputEl.value;
  if (valStr === "") {
    localQuota.value = "";
    quotaError.value = "";
    return;
  }
  const val = Number(valStr);
  if (val === -1 || (val >= 1 && val <= 500)) {
    localQuota.value = val;
    quotaError.value = "";
    problem.value.quota = val;
  } else {
    inputEl.value = "";
    localQuota.value = "";
    quotaError.value = "Quota must be -1 (unlimited) or between 1 and 500";
  }
}

function getAIFileExtensions(): string[] {
  const lang = problem.value.allowedLanguage;
  const list: string[] = [];
  if (lang & 1) list.push(".c");
  if (lang & 2) list.push(".cpp");
  if (lang & 4) list.push(".py");
  return list;
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <!-- Allowed Languages -->
    <div class="form-control w-full max-w-xs">
      <label class="label"><span class="label-text">Allowed Languages</span></label>
      <language-multi-select
        :model-value="problem.allowedLanguage"
        @update:model-value="(v) => (problem.allowedLanguage = v)"
      />
    </div>

    <!-- Tags -->
    <div class="form-control w-full max-w-xs">
      <label class="label"><span class="label-text">Tags</span></label>
      <input
        type="text"
        class="input input-bordered w-full max-w-xs"
        :value="problem.tags.join(',')"
        @input="
          problem.tags = ($event.target as HTMLInputElement).value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        "
      />
      <label class="label"><span class="label-text-alt">Comma separated</span></label>
    </div>

    <!-- Quota -->
    <div class="form-control w-full max-w-xs">
      <label class="label"><span class="label-text">Quota</span></label>
      <input
        type="number"
        :min="-1"
        :max="500"
        step="1"
        :class="['input input-bordered w-full max-w-xs', quotaError && 'input-error']"
        :value="localQuota"
        @input="onQuotaInput"
        placeholder="-1 (unlimited) or 1–500"
      />
      <label v-if="quotaError" class="label">
        <span class="label-text-alt text-error">{{ quotaError }}</span>
      </label>
      <label v-else class="label">
        <span class="label-text-alt">-1 means unlimited</span>
      </label>
    </div>

    <!-- Accepted Format -->
    <div class="form-control mt-2 w-full max-w-xs md:mt-0">
      <label class="label"><span class="label-text">Accepted Format</span></label>
      <div class="ml-2 flex flex-wrap items-center gap-6">
        <label class="label cursor-pointer gap-2">
          <input type="radio" class="radio" value="code" v-model="(problem.config!.acceptedFormat as any)" />
          <span class="label-text">code</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input type="radio" class="radio" value="zip" v-model="(problem.config!.acceptedFormat as any)" />
          <span class="label-text">zip</span>
        </label>
        <div v-if="problem.config!.acceptedFormat === 'zip'" class="ml-4 flex items-center gap-2">
          <span class="label-text">Max Student's ZIP Size (MB)</span>
          <input
            type="number"
            class="input input-bordered input-sm w-28 text-center"
            min="1"
            max="1000"
            step="1"
            :value="problem.config!.maxStudentZipSizeMB ?? 50"
            @input="
              problem.config!.maxStudentZipSizeMB = Math.min(
                1000,
                Math.max(1, Number(($event.target as HTMLInputElement).value)),
              )
            "
          />
          <span class="whitespace-nowrap text-xs opacity-70">(default 50 MB)</span>
        </div>
      </div>
    </div>

    <!-- AI VTuber區 -->
    <div class="col-span-2 mt-4 space-y-3 rounded-lg border border-base-300 p-4">
      <div class="flex items-center justify-start gap-4">
        <label class="label cursor-pointer justify-start gap-x-4">
          <span class="label-text">AI VTuber</span>
          <input type="checkbox" class="toggle toggle-primary" v-model="problem.config!.aiVTuber" />
        </label>
      </div>
      <transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div v-if="problem.config!.aiVTuber" class="mt-2 space-y-3">
          <!-- Upload & Mode 對齊 -->
          <div class="flex flex-col md:flex-row md:items-start md:gap-6">
            <!-- Upload AC files -->
            <div class="form-control w-full max-w-xs">
              <label class="label mb-1"><span class="label-text">Upload AC files</span></label>
              <input
                type="file"
                multiple
                :accept="getAIFileExtensions().join(',')"
                class="file-input file-input-bordered file-input-sm w-full"
                @change="
                  (e: any) =>
                    problem.assets!.aiVTuberACFiles = (Array.from(e.target.files ?? []) as File[])
                      .filter((f) => getAIFileExtensions().some((ext) => f.name.endsWith(ext)))
                "
              />
              <label class="label">
                <span class="label-text-alt text-sm opacity-70">
                  Allowed: {{ getAIFileExtensions().join(", ") }}
                </span>
              </label>
            </div>

            <!-- AI Conversation Mode -->
            <div class="form-control w-full max-w-xs">
              <label class="label mb-1"><span class="label-text">AI Conversation Mode</span></label>
              <select class="select select-bordered w-full max-w-xs" v-model="problem.config!.aiVTuberMode">
                <option value="guided">Guided Mode</option>
                <option value="unlimited">Unlimited Mode</option>
              </select>
            </div>
          </div>

          <!-- Max Token -->
          <div class="mt-2 inline-block w-fit rounded-md border border-gray-400/60 p-3">
            <div class="relative mb-2 flex select-none items-center" style="min-width: 186px">
              <span class="label-text mr-2">Max Token</span>
              <input
                type="number"
                min="0"
                class="input input-bordered input-sm w-20 text-center"
                :value="problem.config!.aiVTuberMaxToken"
                @input="problem.config!.aiVTuberMaxToken = Number(($event.target as HTMLInputElement).value)"
              />
              <!-- 代幣icon（翻轉） -->
              <button
                class="btn btn-ghost btn-xs relative ml-2 flex items-center"
                :disabled="isFlipping"
                @click="spinAndRandomToken"
                style="position: relative; width: 34px; height: 34px"
                aria-label="Roll random token"
              >
                <span class="relative block" style="width: 22px; height: 22px">
                  <svg
                    :class="{ 'flip-y': isFlipping }"
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    style="display: block"
                  >
                    <defs>
                      <radialGradient id="coinGradient">
                        <stop offset="0%" style="stop-color: #aaa; stop-opacity: 1" />
                        <stop offset="50%" style="stop-color: #666; stop-opacity: 1" />
                        <stop offset="100%" style="stop-color: #333; stop-opacity: 1" />
                      </radialGradient>
                      <radialGradient id="coinShine">
                        <stop offset="0%" style="stop-color: #fff; stop-opacity: 0.4" />
                        <stop offset="100%" style="stop-color: #fff; stop-opacity: 0" />
                      </radialGradient>
                    </defs>
                    <circle cx="12" cy="12" r="10" fill="url(#coinGradient)" />
                    <circle cx="12" cy="12" r="10" fill="none" stroke="#222" stroke-width="0.5" />
                    <ellipse cx="9" cy="8" rx="4" ry="3" fill="url(#coinShine)" opacity="0.6" />
                    <text
                      x="50%"
                      y="62%"
                      text-anchor="middle"
                      fill="#fff"
                      font-size="13"
                      font-weight="bold"
                      font-family="monospace"
                      style="filter: drop-shadow(0 1px 2px #000)"
                    >
                      T
                    </text>
                  </svg>
                  <!-- 數字與粒子在icon正上方 -->
                  <transition name="fly-up-token">
                    <div
                      v-if="flyNumber !== null"
                      class="number-fx absolute -top-6 left-1/2 z-30"
                      style="transform: translate(-50%, -100%); pointer-events: none"
                    >
                      <span class="fly-digit">{{ flyNumber }}</span>
                      <template v-if="showParticles">
                        <span
                          v-for="i in 18"
                          :key="i"
                          class="particle"
                          :style="{
                            '--angle': (i - 1) * 20 + 10 + 'deg',
                            '--distance': 40 + Math.random() * 24 + 'px',
                            '--delay': Math.random() * 0.15 + 's',
                            '--size': 8 + Math.random() * 10 + 'px',
                            '--color': Math.random() > 0.6 ? '#ddd' : Math.random() > 0.3 ? '#888' : '#222',
                          }"
                        />
                      </template>
                    </div>
                  </transition>
                </span>
              </button>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Trial Mode -->
    <div class="form-control col-span-2 mt-4">
      <label class="label ml-1 cursor-pointer justify-start gap-x-4">
        <span class="label-text">Trial Mode</span>
        <input type="checkbox" class="toggle toggle-primary" v-model="problem.config!.trialMode" />
      </label>
    </div>

    <!-- Network Access Restriction -->
    <div class="form-control col-span-2">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Network Access Restriction</span>
        <input type="checkbox" class="toggle" v-model="problem.config!.networkAccessRestriction!.enabled" />
      </label>

      <div v-if="problem.config!.networkAccessRestriction!.enabled" class="mt-2 grid grid-cols-1 gap-3">
        <div class="rounded bg-base-300 p-3">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Firewall Extranet</span>
            <input
              type="checkbox"
              class="toggle"
              v-model="problem.config!.networkAccessRestriction!.firewallExtranet!.enabled"
            />
          </label>
          <div
            v-if="problem.config!.networkAccessRestriction!.firewallExtranet!.enabled"
            class="mt-2 grid gap-3 md:grid-cols-2"
          >
            <MultiStringInput
              v-model="problem.config!.networkAccessRestriction!.firewallExtranet!.whitelist"
              placeholder="Add whitelist host/IP"
            />
            <MultiStringInput
              v-model="problem.config!.networkAccessRestriction!.firewallExtranet!.blacklist"
              placeholder="Add blacklist host/IP"
            />
          </div>
        </div>

        <div class="rounded bg-base-300 p-3">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Connect With Local</span>
            <input
              type="checkbox"
              class="toggle"
              v-model="problem.config!.networkAccessRestriction!.connectWithLocal!.enabled"
            />
          </label>
          <div
            v-if="problem.config!.networkAccessRestriction!.connectWithLocal!.enabled"
            class="mt-2 grid gap-3 md:grid-cols-2"
          >
            <MultiStringInput
              v-model="problem.config!.networkAccessRestriction!.connectWithLocal!.whitelist"
              placeholder="Add whitelist host/IP/URL"
            />
            <MultiStringInput
              v-model="problem.config!.networkAccessRestriction!.connectWithLocal!.blacklist"
              placeholder="Add blacklist host/IP/URL"
            />
          </div>
          <div
            v-if="problem.config!.networkAccessRestriction!.connectWithLocal!.enabled"
            class="form-control mt-2"
          >
            <label class="label"><span class="label-text">Upload local_service.zip</span></label>
            <input
              type="file"
              accept=".zip"
              class="file-input file-input-bordered"
              @change="(e: any) => problem.assets!.localServiceZip = e.target.files?.[0] || null"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Spin 速度 */
.spin-crazy {
  animation: crazy-spin 0.4s linear infinite;
}
@keyframes crazy-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 炫酷飛數字+黑白粒子動畫 */
.fly-up-token-enter-active {
  transition: all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 30;
}
.fly-up-token-leave-active {
  transition: all 0.4s;
}
.fly-up-token-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.7);
}
.fly-up-token-enter-to {
  opacity: 1;
  transform: translateY(-15px) scale(1.14);
}
.fly-up-token-leave-from {
  opacity: 1;
  transform: translateY(-15px) scale(1.14);
}
.fly-up-token-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.95);
}

/* 字體白色+黑色描邊 */
.fly-digit {
  font-size: 2.4rem;
  font-family: "Menlo", "Consolas", monospace;
  font-weight: 900;
  color: #fff;
  text-shadow: -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, -3px 0 0 #000, 3px 0 0 #000,
    0 -3px 0 #000, 0 3px 0 #000, -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000,
    1.5px 1.5px 0 #000, 0 6px 20px rgba(0, 0, 0, 0.8), 0 3px 10px rgba(255, 255, 255, 0.3),
    0 0 30px rgba(200, 200, 200, 0.4);
  letter-spacing: 3px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
  pointer-events: none;
  animation: digit-pulse 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 硬幣翻轉動畫*/
.flip-y {
  animation: coin-flip 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  transform-style: preserve-3d;
}

@keyframes coin-flip {
  0% {
    transform: rotateY(0deg) scale(1) rotateZ(0deg);
    filter: brightness(1) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }
  10% {
    transform: rotateY(180deg) scale(1.2) rotateZ(15deg);
    filter: brightness(1.3) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
  }
  25% {
    transform: rotateY(360deg) scale(1.35) rotateZ(30deg);
    filter: brightness(1.5) drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
  }
  40% {
    transform: rotateY(540deg) scale(1.4) rotateZ(20deg);
    filter: brightness(1.4) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5));
  }
  60% {
    transform: rotateY(720deg) scale(1.25) rotateZ(5deg);
    filter: brightness(1.2) drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
  }
  80% {
    transform: rotateY(900deg) scale(1.1) rotateZ(-3deg);
    filter: brightness(1.1) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
  }
  90% {
    transform: rotateY(1000deg) scale(1.05) rotateZ(2deg);
    filter: brightness(1.05) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3));
  }
  100% {
    transform: rotateY(1080deg) scale(1) rotateZ(0deg);
    filter: brightness(1) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }
}

@keyframes digit-pulse {
  0%,
  100% {
    transform: scale(1);
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
  }
  50% {
    transform: scale(1.08);
    filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 15px rgba(255, 255, 255, 0.3));
  }
}

@keyframes coin-flip {
  0% {
    transform: rotateY(0deg) scale(1);
  }
  15% {
    transform: rotateY(90deg) scale(1.15);
  }
  50% {
    transform: rotateY(450deg) scale(1.2);
  }
  85% {
    transform: rotateY(720deg) scale(1.05);
  }
  100% {
    transform: rotateY(720deg) scale(1);
  }
}

/* 粒子爆炸黑白灰 */
.particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--size, 10px);
  height: var(--size, 10px);
  border-radius: 50%;
  background: var(--color, #222);
  opacity: 0;
  pointer-events: none;
  animation: explode-particle 0.8s cubic-bezier(0.25, 1.5, 0.5, 0.9) forwards;
  animation-delay: var(--delay, 0s);
  z-index: 0;
  box-shadow: 0 0 8px var(--color, #222), inset 0 0 4px rgba(255, 255, 255, 0.3);
}

.particle::before {
  content: "";
  position: absolute;
  width: 200%;
  height: 40%;
  background: linear-gradient(90deg, transparent, var(--color, #222), transparent);
  top: 50%;
  left: -50%;
  transform: translateY(-50%);
  opacity: 0.4;
  filter: blur(2px);
}

@keyframes explode-particle {
  0% {
    transform: translate(-50%, -50%) scale(0.3) rotate(var(--angle, 0deg));
    opacity: 0;
  }
  15% {
    opacity: 0.7;
    transform: translate(-50%, -50%) scale(1.4) rotate(var(--angle, 0deg)) translateY(-8px);
  }
  40% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1.2) rotate(var(--angle, 0deg)) translateY(-15px);
  }
  70% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(0.9) rotate(var(--angle, 0deg))
      translateY(calc(var(--distance, 30px) * 0.7));
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5) rotate(var(--angle, 0deg)) translateY(var(--distance, 40px));
  }
}
</style>
