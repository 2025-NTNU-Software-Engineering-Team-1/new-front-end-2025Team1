<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useTitle } from "@vueuse/core";
import api from "@/models/api";
import { useI18n } from "vue-i18n";
import { useSession } from "@/stores/session";

const route = useRoute();
const { t } = useI18n();
useTitle(`AI Setting - ${route.params.name} | Normal OJ`);

const isLoading = ref(false);
const errorMsg = ref("");
const successMsg = ref("");
const session = useSession();

// === 現有 API Keys ===
const apiKeys = ref<
  {
    key_id: string;
    key_name: string;
    masked_value: string;
    is_active: boolean;
    created_by: string;
  }[]
>([]);

// === 新增 key 表單 ===
const newKey = ref({
  name: "",
  value: "",
  maskedDisplay: "",
});

// === 載入資料 ===
async function fetchKeys() {
  try {
    isLoading.value = true;
    const { data } = await api.AIVTuber.getCourseKeys(route.params.name as string);
    apiKeys.value = data.keys || [];
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? "Failed to load keys.";
  } finally {
    isLoading.value = false;
  }
}

// === 新增 Key ===
async function addKey() {
  if (!newKey.value.name.trim() || !newKey.value.value.trim()) {
    errorMsg.value = "Key name and value are required.";
    return;
  }

  errorMsg.value = "";
  successMsg.value = "";
  isLoading.value = true;

  try {
    // 使用目前登入者的 username 當作建立者
    const res = await api.AIVTuber.addKey(route.params.name as string, {
      key_name: newKey.value.name,
      value: newKey.value.value,
      is_active: true,
      created_by: session.username,
    });
    const data = res.data;

    if (data.status === "OK") {
      successMsg.value = data.message;
      // 顯示回傳的 masked_id
      if (data.masked_id) {
        newKey.value.maskedDisplay = data.masked_id;
      } else {
        newKey.value.maskedDisplay = "";
      }
      // 清空輸入欄位
      newKey.value.value = "";
      newKey.value.name = "";
      await fetchKeys();
    } else {
      errorMsg.value = data.message || "Failed to add key.";
    }
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? "Failed to add key.";
  } finally {
    isLoading.value = false;
  }
}

// === 更新 Key ===
async function updateKey(key: any) {
  isLoading.value = true;
  successMsg.value = "";
  errorMsg.value = "";

  try {
    const { data } = await api.AIVTuber.updateKey(route.params.name as string, key.id, {
      key_name: key.key_name,
      is_active: key.is_active,
    });

    if (data.status === "OK") {
      successMsg.value = data.message;
      await fetchKeys();
    } else {
      errorMsg.value = data.message || "Failed to update key.";
    }
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? "Failed to update key.";
  } finally {
    isLoading.value = false;
  }
}

// === 刪除 Key ===
async function deleteKey(keyId: string) {
  if (!confirm("Are you sure to delete this key?")) return;

  successMsg.value = "";
  errorMsg.value = "";
  isLoading.value = true;

  try {
    const { data } = await api.AIVTuber.deleteKey(route.params.name as string, keyId);

    if (data.status === "OK") {
      successMsg.value = data.message;
      await fetchKeys();
    } else {
      errorMsg.value = data.message || "Failed to delete key.";
    }
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? "Failed to delete key.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchKeys);
</script>

<template>
  <div class="card-container pb-20">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title mb-4">AI Setting – Set Up</div>

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

        <!-- === 新增 Key 表單 === -->
        <div class="mb-8 rounded-lg border border-base-300 p-4">
          <h3 class="mb-2 text-lg font-semibold">Add New API Key</h3>

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
            <!-- 自動顯示登入使用者 -->
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

          <!-- 顯示後端回傳 masked_id -->
          <div v-if="newKey.maskedDisplay" class="mt-3 font-mono text-sm text-success">
            Masked ID: {{ newKey.maskedDisplay }}
          </div>
        </div>

        <!-- === 現有 Keys === -->
        <div class="rounded-lg border border-base-300 p-4">
          <h3 class="mb-4 text-lg font-semibold">Existing Keys</h3>
          <div v-if="isLoading" class="text-center opacity-60">
            <ui-spinner />
          </div>
          <div v-else-if="apiKeys.length === 0" class="italic opacity-70">No keys yet.</div>
          <div v-else class="space-y-3">
            <div
              v-for="k in apiKeys"
              :key="k.key_id"
              class="grid grid-cols-1 gap-2 rounded-lg border border-base-200 bg-base-100 p-3 md:grid-cols-7 md:items-center"
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
                <button class="btn btn-error btn-xs" @click="deleteKey(k.key_id)">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
