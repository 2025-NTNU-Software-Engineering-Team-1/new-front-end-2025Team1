<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import api, { type VtuberSkinInfo } from "@/models/api";

const route = useRoute();
const { t } = useI18n();

// State
const skins = ref<VtuberSkinInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Edit modal state
const editingSkin = ref<VtuberSkinInfo | null>(null);
const editName = ref("");
const editEmotions = ref("");
const editThumbnail = ref<File | null>(null);
const thumbnailPreview = ref<string | null>(null);
const saving = ref(false);

// Load skins
const loadSkins = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.VtuberSkin.list();
    skins.value = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  } catch (e) {
    error.value = t("admin.skins.loadError");
    console.error("[Course Skins] loadSkins error:", e);
  } finally {
    loading.value = false;
  }
};

// Delete skin
const deleteSkin = async (skinId: string) => {
  if (!confirm(t("skinSelector.delete.confirm"))) return;
  try {
    await api.VtuberSkin.delete(skinId);
    await loadSkins();
  } catch (e) {
    alert(t("skinSelector.delete.error"));
    console.error("[Course Skins] deleteSkin error:", e);
  }
};

// Open edit modal
const openEdit = async (skin: VtuberSkinInfo) => {
  editingSkin.value = skin;
  editName.value = skin.name;
  
  try {
    const res = await api.VtuberSkin.get(skin.skin_id);
    const detail = Array.isArray(res.data) ? undefined : (res.data?.data ?? res.data);
    if (detail?.emotion_mappings) {
      editEmotions.value = JSON.stringify(detail.emotion_mappings, null, 2);
    } else {
      editEmotions.value = "";
    }
  } catch {
    editEmotions.value = "";
  }
  
  editThumbnail.value = null;
  thumbnailPreview.value = null;
};

// Close edit modal
const closeEdit = () => {
  editingSkin.value = null;
  if (thumbnailPreview.value) {
    URL.revokeObjectURL(thumbnailPreview.value);
    thumbnailPreview.value = null;
  }
};

// Handle thumbnail file
const onThumbnailChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && file.type.startsWith("image/")) {
    editThumbnail.value = file;
    thumbnailPreview.value = URL.createObjectURL(file);
  }
};

// Handle paste
const onThumbnailPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        editThumbnail.value = file;
        thumbnailPreview.value = URL.createObjectURL(file);
        e.preventDefault();
        break;
      }
    }
  }
};

// Save edit
const saveEdit = async () => {
  if (!editingSkin.value) return;
  saving.value = true;
  try {
    const formData = new FormData();
    if (editName.value.trim()) {
      formData.append("name", editName.value.trim());
    }
    if (editEmotions.value.trim()) {
      formData.append("emotion_mappings", editEmotions.value.trim());
    }
    if (editThumbnail.value) {
      formData.append("thumbnail", editThumbnail.value);
    }
    
    await api.VtuberSkin.update(editingSkin.value.skin_id, formData);
    closeEdit();
    await loadSkins();
  } catch (e) {
    alert(t("admin.skins.saveError"));
    console.error("[Course Skins] saveEdit error:", e);
  } finally {
    saving.value = false;
  }
};

// Format file size
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Toggle public/private
const toggleVisibility = async (skin: VtuberSkinInfo) => {
  try {
    const newIsPublic = !skin.is_public;
    await api.VtuberSkin.updateVisibility(skin.skin_id, newIsPublic);
    await loadSkins();
  } catch (e) {
    console.error("[Course Skins] toggleVisibility error:", e);
  }
};

onMounted(() => {
  loadSkins();
});
</script>

<template>
  <div>
    <h2 class="mb-4 text-lg font-bold">{{ $t("admin.skins.title") }}</h2>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Skins Table -->
    <div v-else class="overflow-x-auto">
      <table class="table w-full">
        <thead>
          <tr>
            <th>{{ $t("admin.skins.thumbnail") }}</th>
            <th>{{ $t("admin.skins.name") }}</th>
            <th>{{ $t("admin.skins.uploadedBy") }}</th>
            <th>{{ $t("admin.skins.size") }}</th>
            <th>{{ $t("admin.skins.type") }}</th>
            <th>{{ $t("admin.skins.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="skin in skins" :key="skin.skin_id">
            <td>
              <div class="h-10 w-10 overflow-hidden rounded-lg bg-base-200">
                <img
                  v-if="skin.thumbnail_path"
                  :src="skin.thumbnail_path"
                  class="h-full w-full object-cover"
                  alt=""
                />
                <span v-else class="flex h-full items-center justify-center text-lg">🎭</span>
              </div>
            </td>
            <td class="font-medium">{{ skin.name }}</td>
            <td>{{ skin.uploaded_by ?? "-" }}</td>
            <td>{{ formatSize(skin.file_size) }}</td>
            <td>
              <span v-if="skin.is_builtin" class="badge badge-primary badge-sm">
                {{ $t("skinSelector.builtin") }}
              </span>
              <span v-else-if="skin.is_public" class="badge badge-success badge-sm">
                {{ $t("admin.skins.public") }}
              </span>
              <span v-else class="badge badge-ghost badge-sm">
                {{ $t("admin.skins.private") }}
              </span>
            </td>
            <td>
              <div class="flex gap-1">
                <button
                  v-if="!skin.is_builtin"
                  class="btn btn-xs"
                  :class="skin.is_public ? 'btn-warning' : 'btn-success'"
                  @click="toggleVisibility(skin)"
                >
                  {{ skin.is_public ? $t("admin.skins.setPrivate") : $t("admin.skins.setPublic") }}
                </button>
                <button
                  v-if="!skin.is_builtin"
                  class="btn btn-xs btn-ghost"
                  @click="openEdit(skin)"
                >
                  {{ $t("admin.skins.edit") }}
                </button>
                <button
                  v-if="!skin.is_builtin"
                  class="btn btn-xs btn-error btn-ghost"
                  @click="deleteSkin(skin.skin_id)"
                >
                  {{ $t("admin.skins.delete") }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="skins.length === 0" class="py-8 text-center text-gray-500">
        {{ $t("admin.skins.noSkins") }}
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editingSkin" class="modal modal-open">
      <div class="modal-box" @paste="onThumbnailPaste" tabindex="0">
        <h3 class="text-lg font-bold">{{ $t("admin.skins.editTitle") }}</h3>
        
        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.name") }}</span>
          </label>
          <input v-model="editName" type="text" class="input input-bordered input-sm" />
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.emotions") }}</span>
          </label>
          <textarea
            v-model="editEmotions"
            rows="3"
            class="textarea textarea-bordered font-mono text-xs"
            :placeholder='`{"smile": "F05", "unhappy": "F03", ...}`'
          />
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.thumbnail") }}</span>
          </label>
          <div class="flex items-center gap-3">
            <div class="h-12 w-12 overflow-hidden rounded-lg bg-base-200">
              <img
                v-if="thumbnailPreview || editingSkin.thumbnail_path"
                :src="thumbnailPreview || editingSkin.thumbnail_path || ''"
                class="h-full w-full object-cover"
                alt=""
              />
              <span v-else class="flex h-full items-center justify-center text-lg">🎭</span>
            </div>
            <input type="file" accept="image/*" class="file-input file-input-sm file-input-bordered" @change="onThumbnailChange" />
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-sm" @click="closeEdit">{{ $t("skinSelector.upload.cancel") }}</button>
          <button class="btn btn-sm btn-primary" :disabled="saving" @click="saveEdit">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            {{ $t("admin.skins.save") }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeEdit"></div>
    </div>
  </div>
</template>
