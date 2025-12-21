<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api from "@/models/api";
import { useSession } from "@/stores/session";

// ==========================================
// [CONFIG] Console Debug Mode
// 1 = Enable Logs, 0 = Disable Logs
const DEBUG_MODE = 1;
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
// const { t } = useI18n();
useTitle(`AI Setting - ${route.params.name} | Normal OJ`);

const isLoading = ref(false);
const errorMsg = ref("");
const successMsg = ref("");
const session = useSession();

interface ApiKey {
  id: string;
  key_name: string;
  masked_value: string;
  is_active: boolean;
  created_by: string;
}

const apiKeys = ref<ApiKey[]>([]);

const newKey = ref({
  name: "",
  value: "",
  maskedDisplay: "",
});

function parseApiResponse(res: unknown) {
  const data = (res as any)?.data;
  const rawStatus = data?.status || (res as any)?.status;
  const statusStr = String(rawStatus || "").toLowerCase();
  const message = data?.message || (res as any)?.message || "Unknown response from server";
  const isSuccess = statusStr === "ok" || statusStr === "success" || rawStatus === 200;
  return { isSuccess, message, data, rawStatus };
}

async function fetchKeys() {
  logger.group(`Fetch Keys: ${route.params.name}`);
  isLoading.value = true;
  errorMsg.value = "";

  try {
    const res = await api.AIVTuber.getCourseKeys(route.params.name as string);

    const rawKeys = res?.data?.keys || [];
    logger.log(`Found ${rawKeys.length} keys`);

    // clean
    apiKeys.value = rawKeys.map((k: any, index: number) => {
      const missing: string[] = [];
      if (!k.id) missing.push("id");
      if (!k.key_name) missing.push("key_name");
      if (k.is_active === undefined) missing.push("is_active");

      if (missing.length > 0) {
        logger.error(`Key at index ${index} missing fields:`, missing);
      }

      // safe object
      return {
        id: k.id || `temp-id-${index}-${Date.now()}`,
        key_name: k.key_name || "(Unnamed Key)",
        masked_value: k.masked_value || "******",
        is_active: !!k.is_active,
        created_by: k.created_by || "Unknown",
      };
    });
  } catch (err: any) {
    logger.error("Fetch Failed", err);
    errorMsg.value = err?.response?.data?.message ?? "Failed to load keys.";
  } finally {
    isLoading.value = false;
    logger.groupEnd();
  }
}

// === 新增 Key ===
async function addKey() {
  logger.group("Action: Add Key");

  // 前端驗證
  if (!newKey.value.name.trim() || !newKey.value.value.trim()) {
    errorMsg.value = "Key name and value are required.";
    logger.error("Validation Error", "Empty fields");
    logger.groupEnd();
    return;
  }

  errorMsg.value = "";
  successMsg.value = "";
  isLoading.value = true;

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

      newKey.value.maskedDisplay = data?.masked_id || "";

      newKey.value.value = "";
      newKey.value.name = "";

      await fetchKeys();
    } else {
      logger.error("Add Failed", message);
      errorMsg.value = message;
    }
  } catch (err: any) {
    logger.error("Add Exception", err);
    errorMsg.value = err?.response?.data?.message ?? "Failed to add key.";
  } finally {
    isLoading.value = false;
    logger.groupEnd();
  }
}

// === 更新 Key ===
async function updateKey(key: ApiKey) {
  logger.group(`Action: Update Key [${key.id}]`);
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
  } catch (err: any) {
    logger.error("Update Exception", err);
    errorMsg.value = err?.response?.data?.message ?? "Failed to update key.";
    await fetchKeys();
  } finally {
    isLoading.value = false;
    logger.groupEnd();
  }
}

// === 刪除 Key ===
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
        <div class="card-title mb-4">AI Setting – Set Up</div>

        <div v-if="errorMsg" class="alert alert-error shadow-lg">
          <div>
            <i-uil-times-circle /> <span>{{ errorMsg }}</span>
          </div>
        </div>
        <div v-if="successMsg" class="alert alert-success shadow-lg">
          <div>
            <i-uil-check-circle /> <span>{{ successMsg }}</span>
          </div>
        </div>

        <div class="border-base-300 mb-8 rounded-lg border p-4">
          <h3 class="mb-2 text-lg font-semibold">Add New API Key</h3>

          <div class="grid gap-3 md:grid-cols-3">
            <input
              type="text"
              v-model="newKey.name"
              placeholder="Key Name *"
              class="input input-bordered w-full"
            />
            <input
              type="text"
              v-model="newKey.value"
              placeholder="API Key Value *"
              class="input input-bordered w-full"
            />
            <input
              type="text"
              :value="session.displayedName || session.username"
              class="input input-bordered w-full text-gray-500"
              disabled
            />
          </div>

          <div class="mt-4 flex justify-end">
            <button class="btn btn-success" :class="{ loading: isLoading }" @click="addKey">
              <i-uil-plus class="mr-1" /> Add Key
            </button>
          </div>

          <div v-if="newKey.maskedDisplay" class="text-success mt-3 font-mono text-sm">
            Masked ID: {{ newKey.maskedDisplay }}
          </div>
        </div>

        <div class="border-base-300 rounded-lg border p-4">
          <h3 class="mb-4 text-lg font-semibold">Existing Keys</h3>

          <div v-if="isLoading && apiKeys.length === 0" class="py-4 text-center opacity-60">
            <ui-spinner />
          </div>

          <div v-else-if="apiKeys.length === 0" class="py-2 italic opacity-70">No keys yet.</div>

          <div v-else class="space-y-3">
            <div
              v-for="k in apiKeys"
              :key="k.id"
              class="border-base-200 bg-base-100 grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-7 md:items-center"
            >
              <div class="col-span-2">
                <label class="text-xs opacity-70">Name</label>
                <input type="text" v-model="k.key_name" class="input input-bordered input-sm w-full" />
              </div>
              <div class="col-span-2 text-sm">
                <label class="text-xs opacity-70">Masked</label>
                <div class="font-mono">{{ k.masked_value }}</div>
              </div>
              <div class="col-span-1">
                <label class="text-xs opacity-70">Created By</label>
                <input
                  type="text"
                  v-model="k.created_by"
                  class="input input-bordered input-sm w-full"
                  disabled
                />
              </div>
              <div class="flex items-center gap-2">
                <label class="label-text mr-2 text-xs opacity-70">Active</label>
                <input
                  type="checkbox"
                  class="toggle toggle-success toggle-sm"
                  v-model="k.is_active"
                  @change="updateKey(k)"
                />
              </div>
              <div class="flex justify-end gap-2">
                <button class="btn btn-success btn-xs" @click="updateKey(k)">Save</button>
                <button class="btn btn-error btn-xs" @click="deleteKey(k.id)">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
