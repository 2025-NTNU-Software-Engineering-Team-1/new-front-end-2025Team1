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
const filterStatus = ref<"all" | "active" | "inactive">("all");

const filteredApiKeys = computed(() => {
  let keys = apiKeys.value;

  // 1. Filter by Status
  if (filterStatus.value === "active") {
    keys = keys.filter((k) => k.is_active);
  } else if (filterStatus.value === "inactive") {
    keys = keys.filter((k) => !k.is_active);
  }

  // 2. Filter by Search
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return keys;

  return keys.filter(
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
  <div class="px-6 py-8">
    <div class="mx-auto max-w-7xl">
      <!-- Page Header -->
      <div class="border-base-content/10 mb-10 flex flex-col gap-2 border-b pb-6">
        <h1 class="text-base-content text-3xl font-bold tracking-tight">
          {{ t("course.aisetting.setup.title") }}
        </h1>
        <p class="text-base-content/60 text-base">{{ t("course.aisetting.setup.subtitle") }}</p>
      </div>

      <!-- Toast Configuration -->
      <div class="toast toast-end toast-bottom z-50">
        <transition-group name="fade">
          <div v-if="errorMsg" key="error" class="alert alert-error shadow-lg" role="alert">
            <i-uil-times-circle class="h-5 w-5" />
            <span class="font-medium">{{ errorMsg }}</span>
          </div>
          <div v-if="successMsg" key="success" class="alert alert-success shadow-lg" role="alert">
            <i-uil-check-circle class="h-5 w-5" />
            <span class="font-medium">{{ successMsg }}</span>
          </div>
        </transition-group>
      </div>

      <!-- New Key Section -->
      <div class="bg-base-100 border-base-200 mb-10 rounded-xl border p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between">
          <h2 class="text-base-content text-lg font-semibold">
            {{ t("course.aisetting.setup.subtitleNewKey") }}
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-end">
          <!-- Name Input -->
          <div class="md:col-span-4">
            <label class="text-base-content/50 mb-2 block text-xs font-semibold tracking-wider uppercase">
              {{ t("course.aisetting.setup.input.name") }}
            </label>
            <input
              type="text"
              v-model="newKey.name"
              :placeholder="t('course.aisetting.setup.input.name')"
              class="input input-bordered focus:input-primary w-full transition-all"
              maxlength="50"
            />
          </div>

          <!-- Value Input -->
          <div class="md:col-span-5">
            <label class="text-base-content/50 mb-2 block text-xs font-semibold tracking-wider uppercase">
              {{ t("course.aisetting.setup.input.value") }}
            </label>
            <input
              type="text"
              v-model="newKey.value"
              :placeholder="t('course.aisetting.setup.input.value')"
              class="input input-bordered focus:input-primary w-full font-mono text-sm transition-all"
              maxlength="50"
            />
          </div>

          <!-- Add Button -->
          <div class="md:col-span-3">
            <button
              class="btn btn-primary w-full gap-2 font-medium normal-case"
              :class="{ loading: isAddingKey }"
              :disabled="isAddingKey"
              @click="addKey"
            >
              <i-uil-plus v-if="!isAddingKey" class="h-5 w-5" />
              {{ t("course.aisetting.setup.input.addKey") }}
            </button>
          </div>
        </div>

        <!-- Masked ID Feedback -->
        <div
          v-if="newKey.maskedDisplay"
          class="bg-success/10 text-success mt-4 flex items-center gap-2 rounded-lg p-3 text-sm"
        >
          <i-uil-shield-check class="h-5 w-5" />
          <span
            >{{ t("course.aisetting.setup.successmsg") }}
            <span class="font-mono font-bold">{{ newKey.maskedDisplay }}</span></span
          >
        </div>
      </div>

      <!-- Existing Keys Table -->
      <div class="border-base-200 bg-base-100 flex flex-col overflow-hidden rounded-xl border shadow-sm">
        <!-- Toolbar: Tabs & Search -->
        <div
          class="border-base-200 bg-base-50/50 flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <!-- Filter Tabs -->
          <div class="tabs tabs-boxed bg-base-200/50 rounded-lg p-1">
            <a
              class="tab tab-sm rounded-md transition-all duration-200"
              :class="{ 'tab-active text-primary bg-white font-semibold shadow-sm': filterStatus === 'all' }"
              @click="filterStatus = 'all'"
            >
              {{ t("course.aisetting.setup.filter.all") }}
            </a>
            <a
              class="tab tab-sm rounded-md transition-all duration-200"
              :class="{
                'tab-active text-success bg-white font-semibold shadow-sm': filterStatus === 'active',
              }"
              @click="filterStatus = 'active'"
            >
              {{ t("course.aisetting.setup.filter.active") }}
            </a>
            <a
              class="tab tab-sm rounded-md transition-all duration-200"
              :class="{
                'tab-active text-base-content/50 bg-white font-semibold shadow-sm':
                  filterStatus === 'inactive',
              }"
              @click="filterStatus = 'inactive'"
            >
              {{ t("course.aisetting.setup.filter.inactive") }}
            </a>
          </div>

          <!-- Search & Count -->
          <div class="flex w-full items-center gap-3 lg:w-auto">
            <div class="text-base-content/40 hidden text-xs font-semibold tracking-wider uppercase md:block">
              {{ t("course.aisetting.setup.total") }}{{ filteredApiKeys.length }}
            </div>
            <div class="relative w-full lg:w-64">
              <div
                class="text-base-content/40 pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
              >
                <i-uil-search class="h-4 w-4" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                class="input input-bordered input-sm focus:input-primary w-full pl-10"
                :placeholder="t('course.aisetting.setup.input.searchPlaceholder')"
              />
            </div>
          </div>
        </div>

        <!-- Table Content -->
        <div class="min-h-[300px] overflow-x-auto">
          <table class="table w-full whitespace-nowrap">
            <!-- Head -->
            <thead
              class="bg-base-100 border-base-200 text-base-content/50 border-b text-xs font-bold tracking-wider uppercase"
            >
              <tr>
                <th class="pl-6">{{ t("course.aisetting.setup.display.keyName") }}</th>
                <th>{{ t("course.aisetting.setup.display.masked") }}</th>
                <th>{{ t("course.aisetting.setup.display.createdBy") }}</th>
                <th class="w-24 text-center">{{ t("course.aisetting.setup.display.active") }}</th>
                <th class="w-24 pr-6 text-center">{{ t("course.aisetting.setup.display.action") }}</th>
              </tr>
            </thead>

            <tbody>
              <!-- Loading State -->
              <tr v-if="isLoading && apiKeys.length === 0">
                <td colspan="5" class="text-base-content/50 h-40 text-center">
                  <div class="flex flex-col items-center justify-center gap-3">
                    <ui-spinner class="text-primary h-6 w-6" />
                    <span class="text-sm font-medium">Loading keys...</span>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else-if="apiKeys.length === 0">
                <td colspan="5" class="text-base-content/40 h-64 text-center">
                  <div class="flex flex-col items-center justify-center gap-3">
                    <div class="bg-base-200/50 rounded-full p-4">
                      <i-uil-key-skeleton class="h-8 w-8 opacity-40" />
                    </div>
                    <p class="text-sm font-medium">{{ t("course.aisetting.setup.display.noKey") }}</p>
                  </div>
                </td>
              </tr>

              <!-- Items -->
              <tr
                v-for="(k, index) in filteredApiKeys"
                :key="k.id"
                class="group border-base-100 hover:bg-base-300/60 border-b transition-all duration-300 ease-in-out last:border-0 hover:scale-[1.002] hover:shadow-sm"
                :class="{ 'bg-base-50/50 opacity-60 saturate-0': !k.is_active }"
                :style="{ transitionDelay: '0ms' }"
              >
                <!-- Key Name (Editable) -->
                <td class="pl-6">
                  <input
                    type="text"
                    v-model="k.key_name"
                    class="input input-ghost input-sm focus:input-bordered w-full text-sm font-semibold focus:bg-white focus:shadow-sm"
                    maxlength="50"
                  />
                </td>

                <!-- Masked Value -->
                <td>
                  <div
                    class="bg-base-200/50 text-base-content/70 group-hover:bg-base-200 inline-flex items-center gap-2 rounded-md px-2.5 py-1 font-mono text-xs transition-colors"
                  >
                    <i-uil-padlock class="h-3 w-3 opacity-50" />
                    {{ k.masked_value }}
                  </div>
                </td>

                <!-- Created By -->
                <td>
                  <div class="text-base-content/70 flex items-center gap-2 text-sm">
                    <i-uil-user class="h-4 w-4 opacity-50" />
                    <span class="font-medium">{{ k.created_by }}</span>
                  </div>
                </td>

                <!-- Active Toggle -->
                <td class="text-center">
                  <input
                    type="checkbox"
                    class="toggle toggle-success toggle-sm"
                    v-model="k.is_active"
                    @change="updateKey(k)"
                  />
                </td>

                <!-- Actions -->
                <td class="pr-6 text-center">
                  <div class="flex justify-center gap-1 opacity-100 transition-opacity duration-200">
                    <button
                      class="btn btn-sm btn-square text-primary bg-primary/10"
                      @click="updateKey(k)"
                      :title="t('course.aisetting.setup.display.save')"
                    >
                      <i-uil-save class="h-4.5 w-4.5" />
                    </button>
                    <button
                      class="btn btn-sm btn-square bg-error/10 text-error"
                      @click="deleteKey(k.id)"
                      :title="t('course.aisetting.setup.display.delete')"
                    >
                      <i-uil-trash-alt class="h-4.5 w-4.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Optional: specific transition for toast notifications */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
