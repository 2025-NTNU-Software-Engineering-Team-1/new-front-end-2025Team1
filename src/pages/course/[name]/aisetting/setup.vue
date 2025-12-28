<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api from "@/models/api";
import { useSession } from "@/stores/session";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// ==========================================
// [CONFIG] Console Debug Mode
// 1 = Enable Logs, 0 = Disable Logs
const DEBUG_MODE = 1;

// [CONFIG] Maximum number of keys allowed
// Defined strictly as 100 per user request
const MAX_KEY_LIMIT = 100;
// ==========================================

// --- Logger Utility ---
const logger = {
  log: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Log] ${label}`, "color: #3b82f6; font-weight: bold;", data || "");
  },
  success: (label: string, data?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Success] ${label}`, "color: #10b981; font-weight: bold;", data || "");
  },
  error: (label: string, error?: unknown) => {
    if (!DEBUG_MODE) return;
    console.log(`%c[Error] ${label}`, "color: #ef4444; font-weight: bold;", error || "");
  },
  group: (label: string) => {
    if (!DEBUG_MODE) return;
    console.group(`%c[Group] ${label}`, "color: #8b5cf6; font-weight: bold;");
  },
  groupCollapsed: (label: string) => {
    if (!DEBUG_MODE) return;
    console.groupCollapsed(`%c[Detail] ${label}`, "color: #6366f1; font-weight: bold;");
  },
  groupEnd: () => {
    if (!DEBUG_MODE) return;
    console.groupEnd();
  },
};

const route = useRoute();
useTitle(`AI Setting - ${route.params.name} | Normal OJ`);

const isLoading = ref(false);
const isAddingKey = ref(false);
const errorMsg = ref("");
const successMsg = ref("");

// Auto-dismiss success/error messages after 3 seconds
watch(successMsg, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      successMsg.value = "";
    }, 3000);
  }
});

watch(errorMsg, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      errorMsg.value = "";
    }, 5000);
  }
});
const session = useSession();

// Interface definition for API Keys
interface ApiKey {
  id: string;
  key_name: string;
  masked_value: string;
  is_active: boolean;
  created_by: string;
}

const apiKeys = ref<ApiKey[]>([]);

const searchQuery = ref("");

const filteredApiKeys = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return apiKeys.value;
  return apiKeys.value.filter(
    (k) => k.key_name.toLowerCase().includes(query) || (k.created_by || "").toLowerCase().includes(query),
  );
});

// State for the new key input form
const newKey = ref({
  name: "",
  value: "",
  maskedDisplay: "",
});

/**
 * Helper to normalize API responses.
 * Extracts status, message, and data safely.
 */
function parseApiResponse(res: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res as any)?.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawStatus = data?.status || (res as any)?.status;
  const statusStr = String(rawStatus || "").toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = data?.message || (res as any)?.message || "Unknown response from server";
  const isSuccess = statusStr === "ok" || statusStr === "success" || rawStatus === 200;
  return { isSuccess, message, data, rawStatus };
}

/**
 * Fetch all existing keys for the current course.
 */
async function fetchKeys() {
  logger.group(`Fetch Keys: ${route.params.name}`);
  isLoading.value = true;
  errorMsg.value = "";

  try {
    const res = await api.AIVTuber.getCourseKeys(route.params.name as string);

    const rawKeys = res?.data?.keys || [];
    logger.log(`Found ${rawKeys.length} keys`);

    // Data cleaning and safety checks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiKeys.value = rawKeys.map((k: any, index: number) => {
      const missing: string[] = [];
      if (!k.id) missing.push("id");
      if (!k.key_name) missing.push("key_name");
      if (k.is_active === undefined) missing.push("is_active");

      if (missing.length > 0) {
        logger.error(`Key at index ${index} missing fields:`, missing);
      }

      // Return a safe object structure
      return {
        id: k.id || `temp-id-${index}-${Date.now()}`,
        key_name: k.key_name || "(Unnamed Key)",
        masked_value: k.masked_value || "******",
        is_active: !!k.is_active,
        created_by: k.created_by || "Unknown",
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error("Fetch Failed", err);
    errorMsg.value = err?.response?.data?.message ?? "Failed to load keys.";
  } finally {
    isLoading.value = false;
    logger.groupEnd();
  }
}

// === Action: Add New Key ===
async function addKey() {
  logger.group("Action: Add Key");

  // [NEW] 0. Quantity Limit Check
  // Ensure the user cannot exceed 100 keys.
  if (apiKeys.value.length >= MAX_KEY_LIMIT) {
    errorMsg.value = `Limit reached: You cannot add more than ${MAX_KEY_LIMIT} keys.`;
    logger.error("Validation Error", "Max key limit reached (100)");
    logger.groupEnd();
    return;
  }

  // 1. Basic Empty Check
  if (!newKey.value.name.trim() || !newKey.value.value.trim()) {
    errorMsg.value = "Key name and value are required.";
    logger.error("Validation Error", "Empty fields");
    logger.groupEnd();
    return;
  }

  // 2. Length Validation (Safety Check)
  // Ensure inputs do not exceed 50 characters
  if (newKey.value.name.length > 50 || newKey.value.value.length > 50) {
    errorMsg.value = "Key name and value must be 50 characters or less.";
    logger.error("Validation Error", "Input length exceeded 50 chars");
    logger.groupEnd();
    return;
  }

  errorMsg.value = "";
  successMsg.value = "";
  isAddingKey.value = true;

  const payload = {
    key_name: newKey.value.name,
    value: newKey.value.value,
    is_active: true,
    created_by: session.username,
  };

  try {
    const res = await api.AIVTuber.addKey(route.params.name as string, payload);
    logger.log("API Response", res);

    const { isSuccess, message, data } = parseApiResponse(res);

    if (isSuccess) {
      logger.success("Add Success", message);
      successMsg.value = message;

      // Update masked display for feedback
      newKey.value.maskedDisplay = data?.masked_id || "";

      // Reset form
      newKey.value.value = "";
      newKey.value.name = "";

      await fetchKeys();
    } else {
      logger.error("Add Failed", message);
      errorMsg.value = message;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error("Add Exception", err);
    errorMsg.value = err?.response?.data?.message ?? "Failed to add key.";
  } finally {
    isAddingKey.value = false;
    logger.groupEnd();
  }
}

// === Action: Update Key ===
async function updateKey(key: ApiKey) {
  logger.group(`Action: Update Key [${key.id}]`);

  // Length Validation
  if (key.key_name.length > 50) {
    errorMsg.value = "Key name must be 50 characters or less.";
    logger.error("Validation Error", "Key name length exceeded 50 chars");

    // Refresh keys to revert invalid change
    await fetchKeys();
    logger.groupEnd();
    return;
  }

  isLoading.value = true;
  successMsg.value = "";
  errorMsg.value = "";

  const payload = {
    key_name: key.key_name,
    is_active: key.is_active,
  };
  logger.log("Payload", payload);

  try {
    const res = await api.AIVTuber.updateKey(route.params.name as string, key.id, payload);
    logger.log("API Response Object", res);

    const { isSuccess, message, rawStatus } = parseApiResponse(res);

    if (isSuccess) {
      logger.success(`Update Success (Status: ${rawStatus})`, message);
      successMsg.value = message;
    } else {
      logger.error(`Update Failed (Status: ${rawStatus})`, message);
      errorMsg.value = message || "Failed to update key.";
      await fetchKeys();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error("Update Exception", err);
    errorMsg.value = err?.response?.data?.message ?? "Failed to update key.";
    await fetchKeys();
  } finally {
    isLoading.value = false;
    logger.groupEnd();
  }
}

// === Action: Delete Key ===
async function deleteKey(keyId: string) {
  logger.group(`Action: Delete Key [${keyId}]`);

  if (!confirm("Are you sure to delete this key?")) {
    logger.log("User Cancelled");
    logger.groupEnd();
    return;
  }

  successMsg.value = "";
  errorMsg.value = "";
  isLoading.value = true;

  try {
    const res = await api.AIVTuber.deleteKey(route.params.name as string, keyId);
    logger.log("API Response", res);

    const { isSuccess, message } = parseApiResponse(res);

    if (isSuccess) {
      logger.success("Delete Success", message);
      successMsg.value = message;
      await fetchKeys();
    } else {
      logger.error("Delete Failed", message);
      errorMsg.value = message || "Failed to delete key.";
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    logger.error("Delete Exception", err);
    errorMsg.value = err?.response?.data?.message ?? "Failed to delete key.";
  } finally {
    isLoading.value = false;
    logger.groupEnd();
  }
}

onMounted(fetchKeys);
</script>

<template>
  <div class="card-container pb-20">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-4">{{ t("course.aisetting.setup.title") }}</div>

        <div class="toast toast-end toast-bottom z-50">
          <div v-if="errorMsg" class="alert alert-error px-4 py-2 text-sm">
            <i-uil-times-circle class="h-4 w-4" />
            <span>{{ errorMsg }}</span>
          </div>
          <div v-if="successMsg" class="alert alert-success px-4 py-2 text-sm">
            <i-uil-check-circle class="h-4 w-4" />
            <span>{{ successMsg }}</span>
          </div>
        </div>

        <div class="border-base-300 bg-base-200/30 dark:bg-base-200/10 mb-8 rounded-lg border p-5">
          <h3 class="mb-4 text-lg font-semibold">{{ t("course.aisetting.setup.subtitleNewKey") }}</h3>

          <div class="grid gap-4 md:grid-cols-3">
            <div class="form-control">
              <label class="label pb-1">
                <span class="label-text text-sm font-medium">{{
                  t("course.aisetting.setup.input.name")
                }}</span>
              </label>
              <input
                type="text"
                v-model="newKey.name"
                :placeholder="t('course.aisetting.setup.input.name')"
                class="input input-bordered bg-base-100 w-full"
                maxlength="50"
              />
            </div>

            <div class="form-control">
              <label class="label pb-1">
                <span class="label-text text-sm font-medium">{{
                  t("course.aisetting.setup.input.value")
                }}</span>
              </label>
              <input
                type="text"
                v-model="newKey.value"
                :placeholder="t('course.aisetting.setup.input.value')"
                class="input input-bordered bg-base-100 w-full"
                maxlength="50"
              />
            </div>

            <div class="form-control">
              <label class="label pb-1">
                <span class="label-text text-sm font-medium">{{
                  t("course.aisetting.setup.display.createdBy")
                }}</span>
              </label>
              <input
                type="text"
                :value="session.displayedName || session.username"
                class="input input-bordered bg-base-300 dark:bg-base-300/50 text-base-content/70 w-full cursor-not-allowed"
                disabled
              />
            </div>
          </div>

          <div class="mt-5 flex justify-end">
            <button
              class="btn btn-success gap-2"
              :class="{ loading: isAddingKey }"
              :disabled="isAddingKey"
              @click="addKey"
            >
              <i-uil-plus v-if="!isAddingKey" />
              {{ t("course.aisetting.setup.input.addKey") }}
            </button>
          </div>

          <div v-if="newKey.maskedDisplay" class="text-success mt-3 font-mono text-sm">
            Masked ID: {{ newKey.maskedDisplay }}
          </div>
        </div>

        <div class="border-base-300 rounded-lg border p-5">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ t("course.aisetting.setup.subtitleExistingKey") }}</h3>
            <input
              v-model="searchQuery"
              type="text"
              class="input input-bordered input-sm w-64"
              :placeholder="t('course.aisetting.setup.input.searchPlaceholder')"
            />
          </div>

          <div v-if="isLoading && apiKeys.length === 0" class="py-4 text-center opacity-60">
            <ui-spinner />
          </div>

          <div v-else-if="apiKeys.length === 0" class="py-4 text-center italic opacity-70">
            {{ t("course.aisetting.setup.display.noKey") }}
          </div>

          <div v-else class="max-h-[600px] space-y-4 overflow-y-auto pr-2">
            <div
              v-for="k in filteredApiKeys"
              :key="k.id"
              class="border-base-300 bg-base-100 dark:bg-base-200/20 grid grid-cols-1 gap-4 rounded-lg border p-4 md:grid-cols-12 md:items-end"
            >
              <div class="md:col-span-3">
                <label class="label pb-1">
                  <span class="label-text text-xs opacity-70">{{
                    t("course.aisetting.setup.display.keyName")
                  }}</span>
                </label>
                <input
                  type="text"
                  v-model="k.key_name"
                  class="input input-bordered input-sm bg-base-100 w-full"
                  maxlength="50"
                />
              </div>

              <div class="md:col-span-3">
                <label class="label pb-1">
                  <span class="label-text text-xs opacity-70">{{
                    t("course.aisetting.setup.display.masked")
                  }}</span>
                </label>
                <div
                  class="input input-bordered input-sm bg-base-300 dark:bg-base-300/50 text-base-content/70 flex w-full cursor-not-allowed items-center font-mono"
                >
                  {{ k.masked_value }}
                </div>
              </div>

              <div class="md:col-span-2">
                <label class="label pb-1">
                  <span class="label-text text-xs opacity-70">{{
                    t("course.aisetting.setup.display.createdBy")
                  }}</span>
                </label>
                <input
                  type="text"
                  :value="k.created_by"
                  class="input input-bordered input-sm bg-base-300 dark:bg-base-300/50 text-base-content/70 w-full cursor-not-allowed"
                  disabled
                />
              </div>

              <div class="md:col-span-2">
                <label class="label pb-1">
                  <span class="label-text text-xs opacity-70">{{
                    t("course.aisetting.setup.display.active")
                  }}</span>
                </label>
                <div class="flex h-8 items-center">
                  <input
                    type="checkbox"
                    class="toggle toggle-success toggle-sm"
                    v-model="k.is_active"
                    @change="updateKey(k)"
                  />
                </div>
              </div>

              <div class="flex justify-end gap-2 md:col-span-2">
                <button class="btn btn-success btn-sm" @click="updateKey(k)">
                  {{ t("course.aisetting.setup.display.save") }}
                </button>
                <button class="btn btn-error btn-sm" @click="deleteKey(k.id)">
                  {{ t("course.aisetting.setup.display.delete") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
