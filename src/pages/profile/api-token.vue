<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useClipboard } from '@vueuse/core';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// --- 主要資料與函式 ---
const tokens = ref([
  { id: 1, name: 'test 1', status: 'active', created: '2025-09-18', lastUsed: '2025-09-18', dueTime: '2025-12-18', scope: 'Read-only' },
  { id: 2, name: 'test 2', status: 'deactivated', created: '2025-09-18', lastUsed: '2025-09-18', dueTime: '2025-12-18', scope: 'Read-only, Read/Write' },
]);

const getStatusClass = (status: string) => {
  if (status === 'active') return 'badge-success';
  return 'badge-ghost';
};

const scopeOptions = computed(() => ['Read-only', 'Read/Write', 'Admin', 'None']);


// --- 新增 Token 的邏輯 ---
const isCreateModalOpen = ref(false);
const newApiTokenForm = reactive({ name: '', scopes: ['Read-only'], date: '' });

function openCreateModal() {
  newApiTokenForm.name = '';
  newApiTokenForm.scopes = ['Read-only'];
  newApiTokenForm.date = '';
  isCreateModalOpen.value = true;
}


// --- 新增成功後的邏輯 ---
const isSuccessModalOpen = ref(false);
const newSecretKey = ref('');
const { copy, copied, isSupported } = useClipboard({ source: newSecretKey });

function handleCreate() {
  console.log('正在建立新的 Token:', newApiTokenForm);
  newSecretKey.value = 'sk-' + Math.random().toString(36).substring(2, 15);
  isCreateModalOpen.value = false;
  isSuccessModalOpen.value = true;
}


// --- 編輯 Token 的邏輯 ---
const isEditModalOpen = ref(false);
const editingToken = ref<any>(null);
const editApiTokenForm = reactive({ name: '', scopes: [''], date: '' });

function openEditModal(token: any) {
  editingToken.value = token;
  editApiTokenForm.name = token.name;
  editApiTokenForm.scopes = token.scope.split(', ');
  editApiTokenForm.date = token.dueTime;
  isEditModalOpen.value = true;
}

function handleUpdate() {
  console.log('正在更新 Token:', editingToken.value?.id, '新資料:', editApiTokenForm);
  isEditModalOpen.value = false;
}


// --- 共用的 Scope 加減邏輯 ---
function addScope(form: 'create' | 'edit') {
  const targetForm = form === 'create' ? newApiTokenForm : editApiTokenForm;
  targetForm.scopes.push('Read-only');
}

function removeScope(index: number, form: 'create' | 'edit') {
  const targetForm = form === 'create' ? newApiTokenForm : editApiTokenForm;
  if (targetForm.scopes.length > 1) {
    targetForm.scopes.splice(index, 1);
  }
}

// --- 查看 Scope 彈窗邏輯 ---
const isViewScopeModalOpen = ref(false);
const viewingScopes = ref<string[]>([]);

function openViewScopeModal(token: any) {
  viewingScopes.value = token.scope.split(', ');
  isViewScopeModalOpen.value = true;
}

// --- 停用 Token 的邏輯 ---
const isDeactivateModalOpen = ref(false);

function openDeactivateModal(token: any) {
  editingToken.value = token;
  isDeactivateModalOpen.value = true;
}

function handleDeactivate() {
  console.log('正在停用 Token:', editingToken.value?.id);
  if (editingToken.value) {
    tokens.value = tokens.value.filter(t => t.id !== editingToken.value.id);
  }
  isDeactivateModalOpen.value = false;
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="card-title text-2xl">{{ t('profile.apiToken.title') }}</h2>
          <button class="btn btn-primary" @click="openCreateModal">
            <i-uil-plus class="mr-2 h-5 w-5" />
            {{ t('profile.apiToken.create_new_key') }}
          </button>
        </div>
        <p class="mt-4 text-sm text-base-content/70">
          {{ t('profile.apiToken.description') }}
        </p>
        <div class="form-control mt-4">
          <div class="input-group">
            <input type="text" :placeholder="t('profile.apiToken.search_placeholder')" class="input input-bordered w-full" />
            <button class="btn btn-square" aria-label="Search">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
          </div>
        </div>
        <div class="overflow-x-auto mt-4">
          <table class="table w-full">
            <thead>
              <tr>
                <th>{{ t('profile.apiToken.table.name') }}</th>
                <th>{{ t('profile.apiToken.table.status') }}</th>
                <th>{{ t('profile.apiToken.table.created') }}</th>
                <th>{{ t('profile.apiToken.table.last_used') }}</th>
                <th>{{ t('profile.apiToken.table.due_time') }}</th>
                <th>{{ t('profile.apiToken.table.scope') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="token in tokens" :key="token.id" class="hover">
                <td class="font-mono">{{ token.name }}</td>
                <td><div class="badge" :class="getStatusClass(token.status)">{{ token.status === 'active' ? t('profile.apiToken.status_active') : t('profile.apiToken.status_deactivated') }}</div></td>
                <td>{{ token.created }}</td>
                <td>{{ token.lastUsed }}</td>
                <td>{{ token.dueTime }}</td>
                <td>
                  <button class="btn btn-ghost btn-xs" @click="openViewScopeModal(token)">
                    {{ t('profile.apiToken.view_scopes') }}
                  </button>
                </td>
                <td class="flex gap-1">
                  <button class="btn btn-ghost btn-xs" aria-label="Edit" @click="openEditModal(token)"><i-uil-pen /></button>
                  <button class="btn btn-ghost btn-xs" aria-label="Deactivate" @click="openDeactivateModal(token)"><i-uil-ban /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <ui-dialog v-model="isCreateModalOpen">
    <template #title>
      <div class="bg-primary text-primary-content rounded-t-box -m-6 p-6">{{ t('profile.apiToken.create_modal.title') }}</div>
    </template>
    <template #content>
      <div class="bg-primary text-primary-content -m-6 p-6 pt-0">
        <div class="space-y-4">
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-primary-content">{{ t('profile.apiToken.create_modal.name_label') }}</span></label>
            <input type="text" v-model="newApiTokenForm.name" :placeholder="t('profile.apiToken.create_modal.name_placeholder')" class="input bg-base-200 text-base-content" />
          </div>
          <div v-for="(scope, index) in newApiTokenForm.scopes" :key="index" class="form-control w-full">
            <label class="label" v-if="index === 0"><span class="label-text text-primary-content">{{ t('profile.apiToken.create_modal.scope_label') }}</span></label>
            <div class="flex items-center gap-2">
              <select class="select bg-base-200 text-base-content flex-grow" v-model="newApiTokenForm.scopes[index]">
                <option v-for="option in scopeOptions" :key="option" :value="option">{{ option }}</option>
              </select>
              <button class="btn btn-sm" @click="addScope('create')" aria-label="Add scope"><i-uil-plus /></button>
              <button class="btn btn-sm" @click="removeScope(index, 'create')" :disabled="newApiTokenForm.scopes.length <= 1" aria-label="Remove scope"><i-uil-minus /></button>
            </div>
          </div>
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-primary-content">{{ t('profile.apiToken.create_modal.date_label') }}</span></label>
            <input type="date" v-model="newApiTokenForm.date" class="input bg-base-200 text-base-content" />
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isCreateModalOpen = false">{{ t('profile.apiToken.create_modal.cancel') }}</button>
          <button class="btn btn-link text-primary-content font-bold" @click="handleCreate">{{ t('profile.apiToken.create_modal.create') }}</button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <ui-dialog v-model="isEditModalOpen">
    <template #title>
      <div class="bg-primary text-primary-content rounded-t-box -m-6 p-6">{{ t('profile.apiToken.edit_modal.title') }}</div>
    </template>
    <template #content>
      <div class="bg-primary text-primary-content -m-6 p-6 pt-0">
        <div class="space-y-4">
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-primary-content/70">{{ t('profile.apiToken.edit_modal.original_info') }}</span></label>
            <div class="p-2 rounded bg-base-300/20 font-mono text-sm">
              {Name: "{{ editingToken?.name }}"; Scope: {{ editingToken?.scope }}}
            </div>
          </div>
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-primary-content">{{ t('profile.apiToken.edit_modal.new_name_label') }}</span></label>
            <input type="text" v-model="editApiTokenForm.name" class="input bg-base-200 text-base-content" />
          </div>
          <div v-for="(scope, index) in editApiTokenForm.scopes" :key="index" class="form-control w-full">
            <label class="label" v-if="index === 0"><span class="label-text text-primary-content">{{ t('profile.apiToken.create_modal.scope_label') }}</span></label>
            <div class="flex items-center gap-2">
              <select class="select bg-base-200 text-base-content flex-grow" v-model="editApiTokenForm.scopes[index]">
                <option v-for="option in scopeOptions" :key="option" :value="option">{{ option }}</option>
              </select>
              <button class="btn btn-sm" @click="addScope('edit')" aria-label="Add scope"><i-uil-plus /></button>
              <button class="btn btn-sm" @click="removeScope(index, 'edit')" :disabled="editApiTokenForm.scopes.length <= 1" aria-label="Remove scope"><i-uil-minus /></button>
            </div>
          </div>
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-primary-content">{{ t('profile.apiToken.create_modal.date_label') }}</span></label>
            <input type="date" v-model="editApiTokenForm.date" class="input bg-base-200 text-base-content" />
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isEditModalOpen = false">{{ t('profile.apiToken.create_modal.cancel') }}</button>
          <button class="btn btn-link text-primary-content font-bold" @click="handleUpdate">{{ t('profile.apiToken.edit_modal.update') }}</button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <ui-dialog v-model="isSuccessModalOpen">
    <template #content>
      <div class="flex flex-col items-center gap-4 text-center">
        <h3 class="text-xl font-bold flex items-center gap-2">
          <i-uil-exclamation-triangle class="text-warning"/> {{ t('profile.apiToken.success_modal.warning') }} <i-uil-exclamation-triangle class="text-warning"/>
        </h3>
        <div class="input-group w-full max-w-xs">
          <input type="text" :value="newSecretKey" readonly class="input input-bordered w-full" />
          <button v-if="isSupported" class="btn" @click="copy()">{{ copied ? t('profile.apiToken.success_modal.copied') : t('profile.apiToken.success_modal.copy') }}</button>
        </div>
        <button class="btn" @click="isSuccessModalOpen = false">{{ t('profile.apiToken.success_modal.ok') }}</button>
      </div>
    </template>
  </ui-dialog>

  <ui-dialog v-model="isViewScopeModalOpen">
    <template #title>
      <div class="bg-primary text-primary-content rounded-t-box -m-6 p-6">{{ t('profile.apiToken.view_scope_modal.title') }}</div>
    </template>
    <template #content>
      <div class="bg-primary text-primary-content -m-6 p-6 pt-0">
        <div class="space-y-2">
          <label class="label"><span class="label-text text-primary-content">{{ t('profile.apiToken.create_modal.scope_label') }}</span></label>
          <div v-for="scope in viewingScopes" :key="scope" class="p-3 rounded bg-base-200 text-base-content">
            {{ scope }}
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-link text-primary-content font-bold" @click="isViewScopeModalOpen = false">{{ t('profile.apiToken.success_modal.ok') }}</button>
        </div>
      </div>
    </template>
  </ui-dialog>

  <ui-dialog v-model="isDeactivateModalOpen">
    <template #title>
      <div class="bg-primary text-primary-content rounded-t-box -m-6 p-6">
        {{ t('profile.apiToken.deactivate_modal.title') }}
      </div>
    </template>
    <template #content>
      <div class="bg-primary text-primary-content -m-6 p-6 pt-0">
        <div class="form-control w-full">
          <label class="label"><span class="label-text text-primary-content/70">{{ t('profile.apiToken.deactivate_modal.token_info') }}</span></label>
          <div class="p-2 rounded bg-base-300/20 font-mono text-sm text-left">
            {Name: "{{ editingToken?.name }}"; Scope: {{ editingToken?.scope }}}
          </div>
        </div>
        <div class="mt-8 flex justify-end gap-4">
          <button class="btn btn-link text-primary-content" @click="isDeactivateModalOpen = false">{{ t('profile.apiToken.create_modal.cancel') }}</button>
          <button class="btn btn-link text-error font-bold" @click="handleDeactivate">{{ t('profile.apiToken.deactivate_modal.deactivate') }}</button>
        </div>
      </div>
    </template>
  </ui-dialog>
</template>