<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useClipboard } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import api from "@/models/api";
import type { APIToken } from "@/types/api-token";
import { useSession } from "@/stores/session";
import { formatTime } from "@/utils/formatTime";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

const { t } = useI18n();
const session = useSession();

// 主要資料與函式
const allTokens = ref<APIToken[]>([]); // 從後端取得的原始資料
const isLoading = ref(true);
const searchQuery = ref(""); // 搜尋框的文字

// 篩選後的 Token 列表
const filteredTokens = computed(() => {
  if (!searchQuery.value) {
    return allTokens.value;
  }
  return allTokens.value.filter((token) =>
    token.Name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

// 後端串接點 (1/5) 取得所有 API Token
onMounted(async () => {
  // 真實 API 請求
  try {
    isLoading.value = true;
    const response = await api.APIToken.getAll();
    allTokens.value = response.data.Tokens;
  } catch (error) {
    console.error("無法取得 API Token 列表:", error);
  } finally {
    isLoading.value = false;
  }

  await getScopeOptions();
});

const getStatusClass = (status: string) => {
  if (status === "Active") return "badge-success";
  return "badge-ghost";
};

const scopeOptions = ref<string[]>([]);
// 後端串接點 (2/5) - 取得可用的 Scope 選項
async function getScopeOptions() {
  try {
    const response = await api.APIToken.getScopes();
    scopeOptions.value = response.data.Scope;
  } catch (error) {
    console.error("無法取得 Scope 選項:", error);
    scopeOptions.value = ["Read-only", "Read/Write", "Admin", "None"];
  }
}

// 新增 Token
const isCreateModalOpen = ref(false);
const newApiTokenForm = reactive({ name: "", scopes: ["Read-only"], date: "" });

function openCreateModal() {
  newApiTokenForm.name = "";
  newApiTokenForm.scopes = ["Read-only"];
  newApiTokenForm.date = "";
  isCreateModalOpen.value = true;
}

// 新增成功
const isSuccessModalOpen = ref(false);
const newSecretKey = ref("");
const { copy, copied, isSupported } = useClipboard({ source: newSecretKey });

// 後端串接點 (3/5) - 新增 API Token
async function handleCreate() {
  if (!newApiTokenForm.name.trim()) {
    alert(t("profile.apiToken.create_modal.name_required_alert"));
    return;
  }
  console.log("正在建立新的 Token:", newApiTokenForm);

  try {
    const response = await api.APIToken.create({
      Name: newApiTokenForm.name,
      Due_Time: newApiTokenForm.date,
      Scope: newApiTokenForm.scopes,
    });

    if (response.data.Type === "OK") {
      newSecretKey.value = response.data.Token;
      isCreateModalOpen.value = false;
      isSuccessModalOpen.value = true;
      const tokenListResponse = await api.APIToken.getAll();
      allTokens.value = tokenListResponse.data.Tokens;
    } else {
      alert(`建立失敗: ${response.data.Message}`);
    }
  } catch (error) {
    console.error("建立 API Token 失敗:", error);
    alert("建立失敗，請查看 console");
  }
}

// 編輯 Token
const isEditModalOpen = ref(false);
const editingToken = ref<APIToken | null>(null);
const editApiTokenForm = reactive({ name: "", scopes: [] as string[], date: "" });

function openEditModal(token: APIToken) {
  editingToken.value = token;
  editApiTokenForm.name = token.Name;
  editApiTokenForm.scopes = [...token.Scope];
  editApiTokenForm.date = token.Due_Time;
  isEditModalOpen.value = true;
}

// 後端串接點 (4/5) - 編輯 API Token
async function handleUpdate() {
  if (!editingToken.value) return;
  console.log("正在更新 Token:", editingToken.value?.ID, "新資料:", editApiTokenForm);

  try {
    const response = await api.APIToken.edit(editingToken.value.ID, {
      data: {
        Name: editApiTokenForm.name,
        Due_Time: editApiTokenForm.date,
        Scope: editApiTokenForm.scopes,
      },
    });
    if (response.data.Type === "OK") {
      isEditModalOpen.value = false;
      const tokenListResponse = await api.APIToken.getAll();
      allTokens.value = tokenListResponse.data.Tokens;
    } else {
      alert(`更新失敗: ${response.data.Message}`);
    }
  } catch (error) {
    console.error("更新 API Token 失敗:", error);
    alert("更新失敗，請查看 console");
  }
}

// Scope 加減
function addScope(form: "create" | "edit") {
  const targetForm = form === "create" ? newApiTokenForm : editApiTokenForm;
  targetForm.scopes.push("Read-only");
}

function removeScope(index: number, form: "create" | "edit") {
  const targetForm = form === "create" ? newApiTokenForm : editApiTokenForm;
  if (targetForm.scopes.length > 1) {
    targetForm.scopes.splice(index, 1);
  }
}

// 查看 Scope 彈窗
const isViewScopeModalOpen = ref(false);
const viewingScopes = ref<string[]>([]);

function openViewScopeModal(token: APIToken) {
  viewingScopes.value = token.Scope;
  isViewScopeModalOpen.value = true;
}

// 停用 Token
const isDeactivateModalOpen = ref(false);

function openDeactivateModal(token: APIToken) {
  editingToken.value = token;
  isDeactivateModalOpen.value = true;
}

// 後端串接點 (5/5) - 停用 API Token
async function handleDeactivate() {
  if (!editingToken.value) return;
  console.log("正在停用 Token:", editingToken.value?.ID);

  try {
    const response = await api.APIToken.deactivate(editingToken.value.ID);
    if (response.data.Type === "OK") {
      isDeactivateModalOpen.value = false;
      const tokenListResponse = await api.APIToken.getAll();
      allTokens.value = tokenListResponse.data.Tokens;
    } else {
      alert(`停用失敗: ${response.data.Message}`);
    }
  } catch (error) {
    console.error("停用 API Token 失敗:", error);
    alert("停用失敗，請查看 console");
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="card-title text-2xl">{{ t("profile.apiToken.title") }}</h2>
          <button class="btn btn-primary" @click="openCreateModal">
            <i-uil-plus class="mr-2 h-5 w-5" />
            {{ t("profile.apiToken.create_new_key") }}
          </button>
        </div>
        <p class="mt-4 text-sm text-base-content/70">
          {{ t("profile.apiToken.description") }}
        </p>
        <div class="form-control mt-4">
          <div class="input-group">
            <input
              type="text"
              v-model="searchQuery"
              :placeholder="t('profile.apiToken.search_placeholder')"
              class="input input-bordered w-full"
            />
            <button class="btn btn-square" aria-label="Search">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        <data-status-wrapper :is-loading="isLoading">
          <template #loading>
            <skeleton-table :col="session.isAdmin ? 8 : 7" :row="3" />
          </template>
          <template #data>
            <div class="mt-4 overflow-x-auto">
              <table class="table w-full">
                <thead>
                  <tr>
                    <th>{{ t("profile.apiToken.table.name") }}</th>
                    <th v-if="session.isAdmin">{{ t("profile.apiToken.table.owner") }}</th>
                    <th>{{ t("profile.apiToken.table.status") }}</th>
                    <th>{{ t("profile.apiToken.table.created") }}</th>
                    <th>{{ t("profile.apiToken.table.last_used") }}</th>
                    <th>{{ t("profile.apiToken.table.due_time") }}</th>
                    <th>{{ t("profile.apiToken.table.scope") }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="token in filteredTokens" :key="token.ID" class="hover">
                    <td class="font-mono">{{ token.Name }}</td>
                    <td v-if="session.isAdmin">{{ token.Owner }}</td>
                    <td>
                      <div class="badge" :class="getStatusClass(token.Status)">
                        {{
                          token.Status === "Active"
                            ? t("profile.apiToken.status_active")
                            : t("profile.apiToken.status_deactivated")
                        }}
                      </div>
                    </td>
                    <td>{{ formatTime(token.Created) }}</td>
                    <td>{{ formatTime(token.Last_Used) }}</td>
                    <td>{{ formatTime(token.Due_Time) }}</td>
                    <td>
                      <button class="btn btn-ghost btn-xs" @click="openViewScopeModal(token)">
                        {{ t("profile.apiToken.view_scopes") }}
                      </button>
                    </td>
                    <td class="flex gap-1">
                      <button class="btn btn-ghost btn-xs" aria-label="Edit" @click="openEditModal(token)">
                        <i-uil-pen />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs"
                        aria-label="Deactivate"
                        @click="openDeactivateModal(token)"
                      >
                        <i-uil-ban />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </data-status-wrapper>
      </div>
    </div>
  </div>

  <!-- 創建 Token 彈窗 -->
  <ui-dialog v-model="isCreateModalOpen">
    <template #title>
      <div class="rounded-t-box -m-6 bg-primary p-6 text-primary-content">
        {{ t("profile.apiToken.create_modal.title") }}
      </div>
    </template>
    <template #content>
      <div class="-m-6 bg-primary p-6 pt-0 text-primary-content">
        <div class="space-y-4">
          <div class="form-control w-full">
            <label class="label"
              ><span class="label-text text-primary-content">{{
                t("profile.apiToken.create_modal.name_label")
              }}</span></label
            >
            <input
              type="text"
              v-model="newApiTokenForm.name"
              :placeholder="t('profile.apiToken.create_modal.name_placeholder')"
              class="input bg-base-200 text-base-content"
            />
          </div>
          <div v-for="(scope, index) in newApiTokenForm.scopes" :key="index" class="form-control w-full">
            <label class="label" v-if="index === 0"
              ><span class="label-text text-primary-content">{{
                t("profile.apiToken.create_modal.scope_label")
              }}</span></label
            >
            <div class="flex items-center gap-2">
              <select
                class="select flex-grow bg-base-200 text-base-content"
                v-model="newApiTokenForm.scopes[index]"
              >
                <option v-for="option in scopeOptions" :key="option" :value="option">{{ option }}</option>
              </select>
              <button class="btn btn-sm" @click="addScope('create')" aria-label="Add scope">
                <i-uil-plus />
              </button>
              <button
                class="btn btn-sm"
                @click="removeScope(index, 'create')"
                :disabled="newApiTokenForm.scopes.length <= 1"
                aria-label="Remove scope"
              >
                <i-uil-minus />
              </button>
            </div>
          </div>
          <div class="form-control w-full">
            <label class="label"
              ><span class="label-text text-primary-content">{{
                t("profile.apiToken.create_modal.date_label")
              }}</span></label
            >
            <VueDatePicker
              v-model="newApiTokenForm.date"
              :placeholder="t('profile.apiToken.create_modal.date_label')"
              format="yyyy-MM-dd HH:mm"
              time-picker-inline
              enable-time-picker
            />
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isCreateModalOpen = false">
            {{ t("profile.apiToken.create_modal.cancel") }}
          </button>
          <button class="btn btn-link font-bold text-primary-content" @click="handleCreate">
            {{ t("profile.apiToken.create_modal.create") }}
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <!-- 編輯 Token 的彈窗 -->
  <ui-dialog v-model="isEditModalOpen">
    <template #title>
      <div class="rounded-t-box -m-6 bg-primary p-6 text-primary-content">
        {{ t("profile.apiToken.edit_modal.title") }}
      </div>
    </template>
    <template #content>
      <div class="-m-6 bg-primary p-6 pt-0 text-primary-content">
        <div class="space-y-4">
          <div class="form-control w-full">
            <label class="label"
              ><span class="label-text text-primary-content/70">{{
                t("profile.apiToken.edit_modal.original_info")
              }}</span></label
            >
            <div class="rounded bg-base-300/20 p-2 font-mono text-sm">
              {Name: "{{ editingToken?.Name }}"; Scope: {{ editingToken?.Scope.join(", ") }}}
            </div>
          </div>
          <div class="form-control w-full">
            <label class="label"
              ><span class="label-text text-primary-content">{{
                t("profile.apiToken.edit_modal.new_name_label")
              }}</span></label
            >
            <input type="text" v-model="editApiTokenForm.name" class="input bg-base-200 text-base-content" />
          </div>
          <div v-for="(scope, index) in editApiTokenForm.scopes" :key="index" class="form-control w-full">
            <label class="label" v-if="index === 0"
              ><span class="label-text text-primary-content">{{
                t("profile.apiToken.create_modal.scope_label")
              }}</span></label
            >
            <div class="flex items-center gap-2">
              <select
                class="select flex-grow bg-base-200 text-base-content"
                v-model="editApiTokenForm.scopes[index]"
              >
                <option v-for="option in scopeOptions" :key="option" :value="option">{{ option }}</option>
              </select>
              <button class="btn btn-sm" @click="addScope('edit')" aria-label="Add scope">
                <i-uil-plus />
              </button>
              <button
                class="btn btn-sm"
                @click="removeScope(index, 'edit')"
                :disabled="editApiTokenForm.scopes.length <= 1"
                aria-label="Remove scope"
              >
                <i-uil-minus />
              </button>
            </div>
          </div>
          <div class="form-control w-full">
            <label class="label"
              ><span class="label-text text-primary-content">{{
                t("profile.apiToken.create_modal.date_label")
              }}</span></label
            >
            <VueDatePicker
              v-model="editApiTokenForm.date"
              :placeholder="t('profile.apiToken.create_modal.date_label')"
              format="yyyy-MM-dd HH:mm"
              time-picker-inline
              enable-time-picker
            />
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isEditModalOpen = false">
            {{ t("profile.apiToken.create_modal.cancel") }}
          </button>
          <button class="btn btn-link font-bold text-primary-content" @click="handleUpdate">
            {{ t("profile.apiToken.edit_modal.update") }}
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <!-- 創建成功後顯示的彈窗 -->
  <ui-dialog v-model="isSuccessModalOpen">
    <template #content>
      <div class="flex flex-col items-center gap-4 text-center">
        <h3 class="flex items-center gap-2 text-xl font-bold">
          <i-uil-exclamation-triangle class="text-warning" />
          {{ t("profile.apiToken.success_modal.warning") }}
          <i-uil-exclamation-triangle class="text-warning" />
        </h3>
        <p class="text-sm font-semibold text-warning">
          {{ t("profile.apiToken.success_modal.message") }}
        </p>
        <div class="input-group w-full max-w-xs">
          <input type="text" :value="newSecretKey" readonly class="input input-bordered w-full" />
          <button v-if="isSupported" class="btn" @click="copy()">
            {{
              copied ? t("profile.apiToken.success_modal.copied") : t("profile.apiToken.success_modal.copy")
            }}
          </button>
        </div>
        <button class="btn" @click="isSuccessModalOpen = false">
          {{ t("profile.apiToken.success_modal.ok") }}
        </button>
      </div>
    </template>
  </ui-dialog>

  <!-- 查看 Scope 的彈出視窗 -->
  <ui-dialog v-model="isViewScopeModalOpen">
    <template #title>
      <div class="rounded-t-box -m-6 bg-primary p-6 text-primary-content">
        {{ t("profile.apiToken.view_scope_modal.title") }}
      </div>
    </template>
    <template #content>
      <div class="-m-6 bg-primary p-6 pt-0 text-primary-content">
        <div class="space-y-2">
          <label class="label"
            ><span class="label-text text-primary-content">{{
              t("profile.apiToken.create_modal.scope_label")
            }}</span></label
          >
          <div v-for="scope in viewingScopes" :key="scope" class="rounded bg-base-200 p-3 text-base-content">
            {{ scope }}
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-link font-bold text-primary-content" @click="isViewScopeModalOpen = false">
            {{ t("profile.apiToken.success_modal.ok") }}
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <!-- 停用 Token 的確認彈窗 -->
  <ui-dialog v-model="isDeactivateModalOpen">
    <template #title>
      <div class="rounded-t-box -m-6 bg-primary p-6 text-primary-content">
        {{ t("profile.apiToken.deactivate_modal.title") }}
      </div>
    </template>
    <template #content>
      <div class="-m-6 bg-primary p-6 pt-0 text-primary-content">
        <div class="form-control w-full">
          <label class="label"
            ><span class="label-text text-primary-content/70">{{
              t("profile.apiToken.deactivate_modal.token_info")
            }}</span></label
          >
          <div class="rounded bg-base-300/20 p-2 text-left font-mono text-sm">
            {Name: "{{ editingToken?.Name }}"; Scope: {{ editingToken?.Scope.join(", ") }}}
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isDeactivateModalOpen = false">
            {{ t("profile.apiToken.create_modal.cancel") }}
          </button>
          <button class="btn btn-link font-bold text-error" @click="handleDeactivate">
            {{ t("profile.apiToken.deactivate_modal.deactivate") }}
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>
</template>