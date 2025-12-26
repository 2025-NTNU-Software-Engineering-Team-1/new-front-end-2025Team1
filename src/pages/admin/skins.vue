<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useTitle } from "@vueuse/core";
import api, { type VtuberSkinInfo, type EmotionMappings } from "@/models/api";

useTitle("Admin - AI Skins | Normal OJ");
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

// Storage stats
const storageStats = ref<{
  total_size: number;
  total_count: number;
  per_user: { username: string; size: number; count: number }[];
} | null>(null);

// Load skins
const loadSkins = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.VtuberSkin.list();
    skins.value = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    
    // Also load storage stats
    try {
      const statsRes = await api.VtuberSkin.getStorageStats();
      storageStats.value = statsRes.data?.data ?? null;
    } catch {
      // Ignore stats error
    }
  } catch (e) {
    error.value = "載入失敗";
    console.error("[Admin Skins] loadSkins error:", e);
  } finally {
    loading.value = false;
  }
};

// Delete skin
const deleteSkin = async (skinId: string, skinName: string) => {
  if (!confirm(t("skinSelector.delete.confirm"))) return;
  try {
    await api.VtuberSkin.delete(skinId);
    await loadSkins();
  } catch (e) {
    alert("刪除失敗");
    console.error("[Admin Skins] deleteSkin error:", e);
  }
};

// Open edit modal
const openEdit = async (skin: VtuberSkinInfo) => {
  editingSkin.value = skin;
  editName.value = skin.name;
  
  // Fetch full details to get emotion_mappings
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
  editName.value = "";
  editEmotions.value = "";
  editThumbnail.value = null;
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
    alert("儲存失敗");
    console.error("[Admin Skins] saveEdit error:", e);
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

onMounted(() => {
  loadSkins();
});
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="mb-6 text-2xl font-bold">{{ $t("admin.skins.title") }}</h1>

    <!-- Storage Stats -->
    <div v-if="storageStats" class="mb-6 rounded-lg bg-base-200 p-4">
      <h2 class="mb-2 font-semibold">{{ $t("admin.skins.storageStats") }}</h2>
      <p>{{ $t("admin.skins.totalSkins") }}: {{ storageStats.total_count }}</p>
      <p>{{ $t("admin.skins.totalSize") }}: {{ formatSize(storageStats.total_size) }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center">
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
              <div class="h-12 w-12 overflow-hidden rounded-lg bg-gray-200">
                <img
                  v-if="skin.thumbnail_path"
                  :src="skin.thumbnail_path"
                  class="h-full w-full object-cover"
                  alt=""
                />
                <span v-else class="flex h-full items-center justify-center text-2xl">🎭</span>
              </div>
            </td>
            <td class="font-medium">{{ skin.name }}</td>
            <td>{{ skin.uploaded_by ?? "-" }}</td>
            <td>{{ formatSize(skin.file_size) }}</td>
            <td>
              <span v-if="skin.is_builtin" class="badge badge-primary">
                {{ $t("skinSelector.builtin") }}
              </span>
              <span v-else-if="skin.is_public" class="badge badge-success">
                {{ $t("admin.skins.public") }}
              </span>
              <span v-else class="badge badge-ghost">
                {{ $t("admin.skins.private") }}
              </span>
            </td>
            <td>
              <div class="flex gap-2">
                <button
                  v-if="!skin.is_builtin"
                  class="btn btn-sm btn-ghost"
                  @click="openEdit(skin)"
                >
                  {{ $t("admin.skins.edit") }}
                </button>
                <button
                  v-if="!skin.is_builtin"
                  class="btn btn-sm btn-error btn-ghost"
                  @click="deleteSkin(skin.skin_id, skin.name)"
                >
                  {{ $t("admin.skins.delete") }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Modal -->
    <div v-if="editingSkin" class="modal modal-open">
      <div class="modal-box" @paste="onThumbnailPaste" tabindex="0">
        <h3 class="text-lg font-bold">{{ $t("admin.skins.editTitle") }}</h3>
        
        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.name") }}</span>
          </label>
          <input v-model="editName" type="text" class="input input-bordered" />
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.emotions") }}</span>
          </label>
          <textarea
            v-model="editEmotions"
            rows="4"
            class="textarea textarea-bordered font-mono text-xs"
            :placeholder='`{"smile": "F05", "unhappy": "F03", ...}`'
          />
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.thumbnail") }}</span>
          </label>
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 overflow-hidden rounded-lg bg-gray-200">
              <img
                v-if="thumbnailPreview || editingSkin.thumbnail_path"
                :src="thumbnailPreview || editingSkin.thumbnail_path || ''"
                class="h-full w-full object-cover"
                alt=""
              />
              <span v-else class="flex h-full items-center justify-center text-2xl">🎭</span>
            </div>
            <input type="file" accept="image/*" class="file-input file-input-sm" @change="onThumbnailChange" />
          </div>
          <p class="mt-1 text-xs text-gray-500">{{ $t("skinSelector.upload.thumbnailHint") }}</p>
        </div>

        <div class="modal-action">
          <button class="btn" @click="closeEdit">{{ $t("skinSelector.upload.cancel") }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
            <span v-if="saving" class="loading loading-spinner loading-sm"></span>
            {{ $t("admin.skins.save") }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeEdit"></div>
    </div>
  </div>
</template>
