<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import api, { type VtuberSkinInfo } from "@/models/api";

const { t } = useI18n();

// Dialog refs
const uploadDialogRef = ref<HTMLDialogElement | null>(null);
const editDialogRef = ref<HTMLDialogElement | null>(null);
const previewDialogRef = ref<HTMLDialogElement | null>(null);

// CONSTANT: Maximum number of skins allowed
const MAX_SKINS = 500;

// =========================================
// State Management
// =========================================
const skins = ref<VtuberSkinInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// --- Image Preview State ---
// Stores the URL of the image currently being previewed
const previewImageUrl = ref<string | null>(null);

// Open the preview modal with the specific image URL
const openPreview = (url: string | undefined) => {
  if (url) {
    previewImageUrl.value = url;
    nextTick(() => {
      previewDialogRef.value?.showModal();
    });
  }
};

// Close the preview modal
const closePreview = () => {
  previewDialogRef.value?.close();
  previewImageUrl.value = null;
};

// =========================================
// Edit Modal State
// =========================================
const editingSkin = ref<VtuberSkinInfo | null>(null);
const editName = ref("");
const editEmotions = ref("");
const editThumbnail = ref<File | null>(null);
const thumbnailPreview = ref<string | null>(null);
const saving = ref(false);

// =========================================
// Upload Modal State
// =========================================
const showUpload = ref(false);
const uploadName = ref("");
const uploadFile = ref<File | null>(null);
const uploadThumbnail = ref<File | null>(null);
const uploadThumbnailPreview = ref<string | null>(null);
const uploadEmotions = ref("");
const uploadError = ref<string | null>(null);
const uploading = ref(false);

// =========================================
// Upload Logic
// =========================================

const openUpload = () => {
  // CHECK: Check if the number of skins has reached the limit
  if (skins.value.length >= MAX_SKINS) {
    alert(`Maximum limit of ${MAX_SKINS} skins reached.`);
    return;
  }

  showUpload.value = true;
  // Reset form
  uploadName.value = "";
  uploadFile.value = null;
  uploadThumbnail.value = null;
  uploadThumbnailPreview.value = null;
  uploadEmotions.value = "";
  uploadError.value = null;
  nextTick(() => {
    uploadDialogRef.value?.showModal();
  });
};

const closeUpload = () => {
  uploadDialogRef.value?.close();
  showUpload.value = false;
  if (uploadThumbnailPreview.value) {
    URL.revokeObjectURL(uploadThumbnailPreview.value);
    uploadThumbnailPreview.value = null;
  }
};

const onUploadFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  uploadFile.value = target.files?.[0] ?? null;
  uploadError.value = null;
};

const onUploadThumbnailChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && file.type.startsWith("image/")) {
    uploadThumbnail.value = file;
    uploadThumbnailPreview.value = URL.createObjectURL(file);
  }
};

// Handle pasting image into upload modal
const onUploadThumbnailPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = (items as unknown as Record<number, DataTransferItem>)[i];
    if (!item) continue;
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        uploadThumbnail.value = file;
        uploadThumbnailPreview.value = URL.createObjectURL(file);
        e.preventDefault(); // Prevent default paste behavior
        break; // Only take the first image found
      }
    }
  }
};

const uploadSkin = async () => {
  // CHECK: Double check limit before uploading
  if (skins.value.length >= MAX_SKINS) {
    uploadError.value = `Maximum limit of ${MAX_SKINS} skins reached.`;
    return;
  }

  if (!uploadFile.value) {
    uploadError.value = t("skinSelector.upload.errorFile");
    return;
  }

  uploading.value = true;
  uploadError.value = null;

  try {
    const formData = new FormData();
    formData.append("file", uploadFile.value);
    if (uploadName.value.trim()) {
      formData.append("name", uploadName.value.trim());
    }
    if (uploadEmotions.value.trim()) {
      formData.append("emotion_mappings", uploadEmotions.value.trim());
    }
    if (uploadThumbnail.value) {
      formData.append("thumbnail", uploadThumbnail.value);
    }

    await api.VtuberSkin.upload(formData);
    closeUpload();
    await loadSkins();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    uploadError.value = err.response?.data?.message ?? t("skinSelector.upload.errorFile");
    console.error("[Course Skins] uploadSkin error:", e);
  } finally {
    uploading.value = false;
  }
};

// =========================================
// Data Loading & Management
// =========================================

// Load skins list from API
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

// Delete a skin
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

// =========================================
// Edit Logic
// =========================================

// Open edit modal and populate data
const openEdit = async (skin: VtuberSkinInfo) => {
  editingSkin.value = skin;
  editName.value = skin.name;

  try {
    // Fetch detailed info to get emotion mappings
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
  nextTick(() => {
    editDialogRef.value?.showModal();
  });
};

const closeEdit = () => {
  editDialogRef.value?.close();
  editingSkin.value = null;
  if (thumbnailPreview.value) {
    URL.revokeObjectURL(thumbnailPreview.value);
    thumbnailPreview.value = null;
  }
};

const onThumbnailChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && file.type.startsWith("image/")) {
    editThumbnail.value = file;
    thumbnailPreview.value = URL.createObjectURL(file);
  }
};

// Handle pasting image into edit modal
const onThumbnailPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = (items as unknown as Record<number, DataTransferItem>)[i];
    if (!item) continue;
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

// Save changes to existing skin
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

// =========================================
// Utility Functions
// =========================================

// Format file size for display
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Toggle public/private status
const toggleVisibility = async (skin: VtuberSkinInfo) => {
  try {
    const newIsPublic = !skin.is_public;
    await api.VtuberSkin.updateVisibility(skin.skin_id, newIsPublic);
    await loadSkins();
  } catch (e) {
    console.error("[Course Skins] toggleVisibility error:", e);
  }
};

// Initial load
onMounted(() => {
  loadSkins();
});
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-bold">{{ $t("admin.skins.title") }}</h2>

      <button
        class="btn btn-primary btn-sm"
        :disabled="skins.length >= MAX_SKINS"
        :title="skins.length >= MAX_SKINS ? `Limit of ${MAX_SKINS} skins reached` : ''"
        @click="openUpload"
      >
        <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ skins.length >= MAX_SKINS ? `Limit Reached (${MAX_SKINS})` : $t("skinSelector.upload.button") }}
      </button>
    </div>

    <div v-if="loading" class="py-8 text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="error" class="alert alert-error">{{ error }}</div>

    <div v-else class="overflow-x-auto">
      <table class="table w-full">
        <thead>
          <tr>
            <th>{{ $t("admin.skins.thumbnail") }}</th>
            <th>{{ $t("admin.skins.name") }}</th>
            <th class="hidden md:table-cell">{{ $t("admin.skins.uploadedBy") }}</th>
            <th class="hidden md:table-cell">{{ $t("admin.skins.size") }}</th>
            <th>{{ $t("admin.skins.type") }}</th>
            <th>{{ $t("admin.skins.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="skin in skins" :key="skin.skin_id">
            <td>
              <div class="bg-base-200 h-10 w-10 overflow-hidden rounded-lg">
                <img
                  v-if="skin.thumbnail_path"
                  :src="skin.thumbnail_path"
                  class="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-80"
                  @click="openPreview(skin.thumbnail_path)"
                  alt="Thumbnail"
                  title="Click to preview"
                />
                <span v-else class="flex h-full items-center justify-center text-lg">🎭</span>
              </div>
            </td>
            <td class="font-medium">
              <div class="max-w-[150px] truncate">{{ skin.name }}</div>
            </td>
            <td class="hidden md:table-cell">{{ skin.uploaded_by ?? "-" }}</td>
            <td class="hidden md:table-cell">{{ formatSize(skin.file_size) }}</td>
            <td>
              <span v-if="skin.is_builtin" class="badge badge-primary badge-sm">
                {{ $t("skinSelector.builtin") }}
              </span>
              <div v-else class="flex items-center gap-2">
                <input
                  type="checkbox"
                  class="toggle toggle-xs toggle-success"
                  :checked="skin.is_public"
                  @change="toggleVisibility(skin)"
                />
                <span class="text-xs" :class="skin.is_public ? 'text-success' : 'text-base-content/70'">
                  {{ skin.is_public ? $t("admin.skins.public") : $t("admin.skins.private") }}
                </span>
              </div>
            </td>
            <td>
              <div class="flex gap-2">
                <button v-if="!skin.is_builtin" class="btn btn-sm btn-ghost" @click="openEdit(skin)">
                  {{ $t("admin.skins.edit") }}
                </button>
                <button
                  v-if="!skin.is_builtin"
                  class="btn btn-sm btn-error btn-ghost"
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

    <dialog ref="previewDialogRef" class="modal">
      <div
        class="modal-box relative flex max-w-2xl items-center justify-center overflow-visible border-none bg-transparent p-0 shadow-none"
      >
        <button
          class="btn btn-sm btn-circle bg-base-100 text-base-content absolute right-2 top-2 z-10"
          @click="closePreview"
        >
          ✕
        </button>
        <img
          :src="previewImageUrl ?? ''"
          class="bg-base-100 max-h-[80vh] w-auto rounded-lg object-contain shadow-2xl"
          alt="Preview"
        />
      </div>
      <form method="dialog" class="modal-backdrop bg-black/80">
        <button @click="closePreview">close</button>
      </form>
    </dialog>

    <dialog ref="editDialogRef" class="modal">
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
            :placeholder="`{&quot;smile&quot;: &quot;F05&quot;, &quot;unhappy&quot;: &quot;F03&quot;, ...}`"
          />
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.thumbnail") }}</span>
          </label>
          <div class="flex items-center gap-3">
            <div class="bg-base-200 h-12 w-12 overflow-hidden rounded-lg">
              <img
                v-if="thumbnailPreview || editingSkin?.thumbnail_path"
                :src="thumbnailPreview || editingSkin?.thumbnail_path || ''"
                class="h-full w-full object-cover"
                alt=""
              />
              <span v-else class="flex h-full items-center justify-center text-lg">🎭</span>
            </div>
            <input
              type="file"
              accept="image/*"
              class="file-input file-input-sm file-input-bordered"
              @change="onThumbnailChange"
            />
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
      <form method="dialog" class="modal-backdrop">
        <button @click="closeEdit">close</button>
      </form>
    </dialog>
    <dialog ref="uploadDialogRef" class="modal">
      <div class="modal-box" @paste="onUploadThumbnailPaste" tabindex="0">
        <h3 class="text-lg font-bold">{{ $t("skinSelector.upload.title") }}</h3>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.name") }}</span>
          </label>
          <input
            v-model="uploadName"
            type="text"
            :placeholder="$t('skinSelector.upload.namePlaceholder')"
            class="input input-bordered input-sm w-full"
          />
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.file") }}</span>
          </label>
          <input
            type="file"
            accept=".zip"
            class="file-input file-input-bordered file-input-sm w-full"
            @change="onUploadFileChange"
          />
          <label class="label">
            <span class="label-text-alt">{{ $t("skinSelector.upload.hint") }}</span>
          </label>
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.thumbnail") }}</span>
            <span class="label-text-alt">({{ $t("skinSelector.upload.optional") }})</span>
          </label>
          <div class="flex items-center gap-4">
            <div class="bg-base-200 h-16 w-16 overflow-hidden rounded-lg">
              <img
                v-if="uploadThumbnailPreview"
                :src="uploadThumbnailPreview"
                class="h-full w-full object-cover"
              />
              <span v-else class="flex h-full items-center justify-center text-2xl">🎭</span>
            </div>
            <input
              type="file"
              accept="image/*"
              class="file-input file-input-bordered file-input-sm w-full max-w-xs"
              @change="onUploadThumbnailChange"
            />
          </div>
          <label class="label">
            <span class="label-text-alt">{{ $t("skinSelector.upload.thumbnailHint") }}</span>
          </label>
        </div>

        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">{{ $t("skinSelector.upload.emotions") }}</span>
            <span class="label-text-alt">({{ $t("skinSelector.upload.optional") }})</span>
          </label>
          <textarea
            v-model="uploadEmotions"
            class="textarea textarea-bordered font-mono text-xs"
            rows="3"
            :placeholder="`{&quot;smile&quot;: &quot;F05&quot;, &quot;unhappy&quot;: &quot;F03&quot;, ...}`"
          ></textarea>
          <label class="label">
            <span class="label-text-alt">{{ $t("skinSelector.upload.emotionsHint") }}</span>
          </label>
        </div>

        <div v-if="uploadError" class="alert alert-error mt-4 text-sm">
          {{ uploadError }}
        </div>

        <div class="modal-action">
          <button class="btn btn-sm" @click="closeUpload">{{ $t("skinSelector.upload.cancel") }}</button>
          <button class="btn btn-sm btn-primary" :disabled="uploading || !uploadFile" @click="uploadSkin">
            <span v-if="uploading" class="loading loading-spinner loading-xs"></span>
            {{ $t("skinSelector.upload.submit") }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeUpload">close</button>
      </form>
    </dialog>
  </div>
</template>
