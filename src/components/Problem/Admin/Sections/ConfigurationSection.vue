<script setup lang="ts">
import { inject, Ref, ref, watch } from "vue";
import LanguageMultiSelect from "../../Forms/LanguageMultiSelect.vue";
import MultiStringInput from "../Controls/MultiStringInput.vue";
import SlingshotTokenSetter from "../Controls/SlingshotTokenSetter.vue";

const rawProblem = inject<Ref<ProblemForm> | undefined>("problem");
if (!rawProblem || !rawProblem.value) throw new Error("ConfigurationSection requires problem injection");
const problem = rawProblem as Ref<ProblemForm>;

const quotaError = ref("");
const localQuota = ref<number | "">(problem.value?.quota ?? "");

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

/* 檢查 quota */
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

/* 支援允許語言副檔名判斷 */
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

    <!-- AI VTuber 區域 -->
    <div class="col-span-2 mt-4 space-y-3 rounded-lg border border-base-300 p-4">
      <div class="flex items-center justify-start gap-4">
        <label class="label cursor-pointer justify-start gap-x-4">
          <span class="label-text">AI VTuber</span>
          <input type="checkbox" class="toggle toggle-primary" v-model="problem.config!.aiVTuber" />
        </label>
      </div>

      <!-- 顯示 AI VTuber 設定 -->
      <transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div v-if="problem.config!.aiVTuber" class="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- 上傳 files -->
          <div class="form-control">
            <label class="label"><span class="label-text">Upload AC files</span></label>
            <input
              type="file"
              multiple
              :accept="getAIFileExtensions().join(',')"
              class="file-input file-input-bordered file-input-sm w-full"
              @change="
                (e: any) =>
                  problem.assets!.aiVTuberACFiles = (Array.from(e.target.files ?? []) as File[])
                    .filter((f) =>
                      getAIFileExtensions().some((ext) => f.name.endsWith(ext)),
                    )
              "
            />
            <label class="label">
              <span class="label-text-alt text-sm opacity-70"
                >Allowed: {{ getAIFileExtensions().join(", ") }}</span
              >
            </label>
          </div>

          <!-- Max Token -->
          <div class="form-control w-full max-w-xs">
            <label class="label"><span class="label-text">Max Token</span></label>
            <div class="flex items-center gap-4">
              <input
                type="number"
                min="0"
                class="input input-bordered input-sm w-24 text-center"
                :value="problem.config!.aiVTuberMaxToken"
                @input="problem.config!.aiVTuberMaxToken = Number(($event.target as HTMLInputElement).value)"
              />
              <slingshot-token-setter @update:maxToken="(v) => (problem.config!.aiVTuberMaxToken = v)" />
            </div>
          </div>

          <!-- 對話模式：引導式 / 無限制 -->
          <div class="form-control w-full max-w-xs">
            <label class="label"><span class="label-text">AI Conversation Mode</span></label>
            <select class="select select-bordered w-full max-w-xs" v-model="problem.config!.aiVTuberMode">
              <option value="guided">Guided Mode</option>
              <option value="unlimited">Unlimited Mode</option>
            </select>
          </div>
        </div>
      </transition>
    </div>

    <!-- Trial mode 在 AI VTuber 下方 -->
    <div class="form-control col-span-2 mt-4">
      <label class="label ml-1 cursor-pointer justify-start gap-x-4">
        <span class="label-text">Trial Mode</span>
        <input type="checkbox" class="toggle toggle-primary" v-model="problem.config!.trialMode" />
      </label>
    </div>

    <!-- Accepted Format + Max ZIP Size (inline on the right) -->
    <div class="form-control col-span-2 mt-2">
      <label class="label">
        <span class="label-text">Accepted Format</span>
      </label>

      <!-- 選項與 zip size 同一排 -->
      <div class="ml-2 flex flex-wrap items-center gap-6">
        <!-- radio 選項 -->
        <label class="label cursor-pointer gap-2">
          <input type="radio" class="radio" value="code" v-model="(problem.config!.acceptedFormat as any)" />
          <span class="label-text">code</span>
        </label>

        <label class="label cursor-pointer gap-2">
          <input type="radio" class="radio" value="zip" v-model="(problem.config!.acceptedFormat as any)" />
          <span class="label-text">zip</span>
        </label>

        <!-- zip 格式選取時，顯示右側輸入框 -->
        <div v-if="problem.config!.acceptedFormat === 'zip'" class="ml-4 flex items-center gap-2">
          <span class="label-text">Max Student's ZIP Size (MB)</span>
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
          <span class="whitespace-nowrap text-xs opacity-70">(default 50 MB)</span>
        </div>
      </div>
    </div>

    <!-- Network Access Restriction -->
    <div class="form-control col-span-1 md:col-span-2">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Network access restriction</span>
        <input type="checkbox" class="toggle" v-model="problem.config!.networkAccessRestriction!.enabled" />
      </label>

      <div v-if="problem.config!.networkAccessRestriction!.enabled" class="mt-2 grid grid-cols-1 gap-3">
        <div class="rounded bg-base-300 p-3">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Firewall extranet</span>
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
            <span class="label-text">Connect with local</span>
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
            <label class="label"><span class="label-text">Upload local_service.zip</span></label>
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
