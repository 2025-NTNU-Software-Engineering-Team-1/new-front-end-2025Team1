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
import "./vue-datepicker-override.css";
import PatManualModal from "@/components/Profile/PatManualModal.vue";
import { containsInvisible } from "@/utils/validators";

const { t } = useI18n();
const session = useSession();

// DatePicker configuration: Always show on top (disable flip modifier)
const datePickerPlacement = "top";
const datePickerPopperOptions = {
  modifiers: [
    {
      name: "flip",
      enabled: false,
    },
  ],
};

// --- Main Data & State ---
const allTokens = ref<APIToken[]>([]); // Raw data from backend
const isLoading = ref(true);
const searchQuery = ref(""); // Search input text

// --- Computed: Filtered Token List ---
const filteredTokens = computed(() => {
  if (!searchQuery.value) {
    return allTokens.value;
  }
  // Filter tokens by name (case-insensitive)
  return allTokens.value.filter((token) =>
    token.Name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

// --- Lifecycle: Backend Integration Point (1/5) - Fetch All Tokens ---
onMounted(async () => {
  try {
    isLoading.value = true;
    const response = await api.APIToken.getAll();
    allTokens.value = response.data.Tokens;
  } catch (error) {
    console.error("Failed to fetch API Token list:", error);
  } finally {
    isLoading.value = false;
  }

  await getScopeOptions();
});

// Helper: Determine badge class based on status
const getStatusClass = (status: string) => {
  if (status === "Active") return "badge-success";
  return "badge-ghost";
};

// --- Scope Options ---
const scopeOptions = ref<string[]>([]);

// Backend Integration Point (2/5) - Fetch Available Scopes
async function getScopeOptions() {
  try {
    const response = await api.APIToken.getScopes();
    scopeOptions.value = response.data.Scope;
  } catch (error) {
    console.error("Failed to fetch Scope options:", error);
    // Fallback options
    scopeOptions.value = ["Read-only", "Read/Write", "Admin", "None"];
  }
}

// --- Create Token Logic ---
const isCreateModalOpen = ref(false);
const newApiTokenForm = reactive({ name: "", scopes: ["Read-only"], date: "" });

function openCreateModal() {
  // Reset form
  newApiTokenForm.name = "";
  newApiTokenForm.scopes = ["Read-only"];
  newApiTokenForm.date = "";
  isCreateModalOpen.value = true;
}

// Success Modal State
const isSuccessModalOpen = ref(false);
const newSecretKey = ref("");
const { copy, copied, isSupported } = useClipboard({ source: newSecretKey });

// Backend Integration Point (3/5) - Create API Token
async function handleCreate() {
  // Validation
  if (!newApiTokenForm.name.trim()) {
    alert(t("profile.apiToken.create_modal.name_required_alert"));
    return;
  }
  if (containsInvisible(newApiTokenForm.name)) {
    alert(t("profile.apiToken.create_modal.name_contains_invisible"));
    return;
  }

  // Debug log for creation attempt
  console.log("Creating new Token with data:", newApiTokenForm);

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

      // Refresh list
      const tokenListResponse = await api.APIToken.getAll();
      allTokens.value = tokenListResponse.data.Tokens;
    } else {
      alert(`Create failed: ${response.data.Message}`);
    }
  } catch (error) {
    console.error("API Token creation failed:", error);
    alert("Creation failed, please check console.");
  }
}

// --- Edit Token Logic ---
const isEditModalOpen = ref(false);
const editingToken = ref<APIToken | null>(null);
const editApiTokenForm = reactive({ name: "", scopes: [] as string[], date: "" });

function openEditModal(token: APIToken) {
  editingToken.value = token;
  // Populate form with existing data
  editApiTokenForm.name = token.Name;
  editApiTokenForm.scopes = [...token.Scope];
  editApiTokenForm.date = token.Due_Time;
  isEditModalOpen.value = true;
}

// Backend Integration Point (4/5) - Update API Token
async function handleUpdate() {
  if (!editingToken.value) return;

  if (containsInvisible(editApiTokenForm.name)) {
    alert(t("profile.apiToken.edit_modal.name_contains_invisible"));
    return;
  }

  // Debug log for update attempt
  console.log("Updating Token ID:", editingToken.value?.ID, "New Data:", editApiTokenForm);

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
      // Refresh list
      const tokenListResponse = await api.APIToken.getAll();
      allTokens.value = tokenListResponse.data.Tokens;
    } else {
      alert(`Update failed: ${response.data.Message}`);
    }
  } catch (error) {
    console.error("API Token update failed:", error);
    alert("Update failed, please check console.");
  }
}

// --- Helper: Add/Remove Scopes in Form ---
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

// --- View Scope Logic ---
const isViewScopeModalOpen = ref(false);
const viewingScopes = ref<string[]>([]);

function openViewScopeModal(token: APIToken) {
  viewingScopes.value = token.Scope;
  isViewScopeModalOpen.value = true;
}

// --- Deactivate Token Logic ---
const isDeactivateModalOpen = ref(false);

function openDeactivateModal(token: APIToken) {
  editingToken.value = token;
  isDeactivateModalOpen.value = true;
}

// Backend Integration Point (5/5) - Deactivate API Token
async function handleDeactivate() {
  if (!editingToken.value) return;

  // Debug log for deactivation
  console.log("Deactivating Token ID:", editingToken.value?.ID);

  try {
    const response = await api.APIToken.deactivate(editingToken.value.ID);
    if (response.data.Type === "OK") {
      isDeactivateModalOpen.value = false;
      // Refresh list
      const tokenListResponse = await api.APIToken.getAll();
      allTokens.value = tokenListResponse.data.Tokens;
    } else {
      alert(`Deactivation failed: ${response.data.Message}`);
    }
  } catch (error) {
    console.error("API Token deactivation failed:", error);
    alert("Deactivation failed, please check console.");
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="card-title text-2xl">{{ t("profile.apiToken.title") }}</h2>
          <div class="flex items-center gap-2">
            <PatManualModal />
            <button class="btn btn-primary" @click="openCreateModal">
              <i-uil-plus class="mr-2 h-5 w-5" />
              {{ t("profile.apiToken.create_new_key") }}
            </button>
          </div>
        </div>
        <p class="text-base-content/70 mt-4 text-sm">
          {{ t("profile.apiToken.description") }}
        </p>

        <div class="form-control mt-4">
          <div class="join w-full">
            <input
              type="text"
              v-model="searchQuery"
              :placeholder="t('profile.apiToken.search_placeholder')"
              class="input input-bordered join-item w-full"
            />

            <button class="btn btn-square join-item" aria-label="Search">
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

  <ui-dialog v-model="isCreateModalOpen">
    <template #title>
      <div class="rounded-t-box bg-primary text-primary-content -m-6 p-6">
        {{ t("profile.apiToken.create_modal.title") }}
      </div>
    </template>
    <template #content>
      <div class="bg-primary text-primary-content -m-6 p-6 pt-0">
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
                class="select bg-base-200 text-base-content flex-grow"
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
              :teleport="'body'"
              :auto-position="false"
              :placement="datePickerPlacement"
              :popper-options="datePickerPopperOptions"
            />
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isCreateModalOpen = false">
            {{ t("profile.apiToken.create_modal.cancel") }}
          </button>
          <button class="btn btn-link text-primary-content font-bold" @click="handleCreate">
            {{ t("profile.apiToken.create_modal.create") }}
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <ui-dialog v-model="isEditModalOpen">
    <template #title>
      <div class="rounded-t-box bg-primary text-primary-content -m-6 p-6">
        {{ t("profile.apiToken.edit_modal.title") }}
      </div>
    </template>
    <template #content>
      <div class="bg-primary text-primary-content -m-6 p-6 pt-0">
        <div class="space-y-4">
          <div class="form-control w-full">
            <label class="label"
              ><span class="label-text text-primary-content/70">{{
                t("profile.apiToken.edit_modal.original_info")
              }}</span></label
            >
            <div class="bg-base-300/20 rounded p-2 font-mono text-sm">
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
                class="select bg-base-200 text-base-content flex-grow"
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
              :teleport="'body'"
              :auto-position="false"
              :placement="datePickerPlacement"
              :popper-options="datePickerPopperOptions"
            />
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isEditModalOpen = false">
            {{ t("profile.apiToken.create_modal.cancel") }}
          </button>
          <button class="btn btn-link text-primary-content font-bold" @click="handleUpdate">
            {{ t("profile.apiToken.edit_modal.update") }}
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <ui-dialog v-model="isSuccessModalOpen">
    <template #content>
      <div class="flex flex-col items-center gap-4 text-center">
        <h3 class="flex items-center gap-2 text-xl font-bold">
          <i-uil-exclamation-triangle class="text-warning" />
          {{ t("profile.apiToken.success_modal.warning") }}
          <i-uil-exclamation-triangle class="text-warning" />
        </h3>
        <p class="text-warning text-sm font-semibold">
          {{ t("profile.apiToken.success_modal.message") }}
        </p>
        <div class="input-group w-full max-w-xs">
          <input type="text" :value="newSecretKey" readonly class="input-bordered input w-full" />
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

  <ui-dialog v-model="isViewScopeModalOpen">
    <template #title>
      <div class="rounded-t-box bg-primary text-primary-content -m-6 p-6">
        {{ t("profile.apiToken.view_scope_modal.title") }}
      </div>
    </template>
    <template #content>
      <div class="bg-primary text-primary-content -m-6 p-6 pt-0">
        <div class="space-y-2">
          <label class="label"
            ><span class="label-text text-primary-content">{{
              t("profile.apiToken.create_modal.scope_label")
            }}</span></label
          >
          <div v-for="scope in viewingScopes" :key="scope" class="bg-base-200 text-base-content rounded p-3">
            {{ scope }}
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-link text-primary-content font-bold" @click="isViewScopeModalOpen = false">
            {{ t("profile.apiToken.success_modal.ok") }}
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <ui-dialog v-model="isDeactivateModalOpen">
    <template #title>
      <div class="rounded-t-box bg-primary text-primary-content -m-6 p-6">
        {{ t("profile.apiToken.deactivate_modal.title") }}
      </div>
    </template>
    <template #content>
      <div class="bg-primary text-primary-content -m-6 p-6 pt-0">
        <div class="form-control w-full">
          <label class="label"
            ><span class="label-text text-primary-content/70">{{
              t("profile.apiToken.deactivate_modal.token_info")
            }}</span></label
          >
          <div class="bg-base-300/20 rounded p-2 text-left font-mono text-sm">
            {Name: "{{ editingToken?.Name }}"; Scope: {{ editingToken?.Scope.join(", ") }}}
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isDeactivateModalOpen = false">
            {{ t("profile.apiToken.create_modal.cancel") }}
          </button>
          <button class="btn btn-link text-error font-bold" @click="handleDeactivate">
            {{ t("profile.apiToken.deactivate_modal.deactivate") }}
          </button>
        </div>
      </div>
    </template>
  </ui-dialog>
</template>
