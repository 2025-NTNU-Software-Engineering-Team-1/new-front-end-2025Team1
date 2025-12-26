<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import api, { type VtuberSkinInfo } from "@/models/api";
import { setSkinConfig } from "@/live2d/Framework/src/lappdefine";
import { LAppDelegate } from "@/live2d/Framework/src/lappdelegate";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  currentSkinId: string;
  currentUsername?: string; // Used to determine if user can edit/delete a skin
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "skin-changed", skinId: string): void;
}>();

// State
const skins = ref<VtuberSkinInfo[]>([]);
const loading = ref(false);
const uploading = ref(false);
const error = ref<string | null>(null);
const selectedSkinId = ref(props.currentSkinId);

// Upload state
const showUploadForm = ref(false);
const uploadName = ref("");
const uploadFile = ref<File | null>(null);
const uploadError = ref<string | null>(null);
const uploadEmotions = ref(""); // JSON string for emotion mappings
const uploadThumbnail = ref<File | null>(null);
const thumbnailPreview = ref<string | null>(null);

// Edit modal state
const editingSkin = ref<VtuberSkinInfo | null>(null);
const editName = ref("");
const editEmotions = ref("");
const editThumbnail = ref<File | null>(null);
const editThumbnailPreview = ref<string | null>(null);
const saving = ref(false);

// Computed
const isOpen = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

// Check if current user can edit/delete a skin
const canEditSkin = (skin: VtuberSkinInfo) => {
  if (skin.is_builtin) return false;
  if (!props.currentUsername) return false;
  // Only the uploader can edit/delete their own skin
  return skin.uploaded_by === props.currentUsername;
};

// Load skins
const loadSkins = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.VtuberSkin.list();
    // res.data is the array directly (HTTPResponse wraps in 'data' but fetcher may unwrap)
    skins.value = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
  } catch (e) {
    error.value = t("skinSelector.loadError");
    console.error("[SkinSelector] loadSkins error:", e);
  } finally {
    loading.value = false;
  }
};

// Select skin
const selectSkin = async (skinId: string) => {
  if (skinId === selectedSkinId.value) return;

  try {
    // Get skin details
    const res = await api.VtuberSkin.get(skinId);
    const skin = Array.isArray(res.data) ? undefined : (res.data?.data ?? res.data);

    if (!skin) {
      error.value = t("skinSelector.switch.error");
      return;
    }

    // Update preference on server
    await api.VtuberSkin.setPreference(skinId);

    // Apply skin locally
    setSkinConfig(skin.model_path, skin.model_json_name);

    // Reload Live2D model
    try {
      const app = LAppDelegate.getInstance();
      if (
        app &&
        (
          app as unknown as {
            _subdelegates: {
              at: (i: number) => { getLive2DManager: () => { reloadModel?: () => void } | null } | null;
              getSize: () => number;
            };
          }
        )._subdelegates?.getSize() > 0
      ) {
        const subdelegate = (
          app as unknown as {
            _subdelegates: {
              at: (i: number) => { getLive2DManager: () => { reloadModel?: () => void } | null } | null;
            };
          }
        )._subdelegates.at(0);
        if (subdelegate) {
          const manager = subdelegate.getLive2DManager();
          if (manager?.reloadModel) {
            manager.reloadModel();
          }
        }
      }
    } catch (e) {
      console.warn("[SkinSelector] reloadModel error:", e);
    }

    selectedSkinId.value = skinId;
    emit("skin-changed", skinId);
  } catch (e) {
    error.value = t("skinSelector.switch.error");
    console.error("[SkinSelector] selectSkin error:", e);
  }
};

// Handle file selection
const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  uploadFile.value = target.files?.[0] ?? null;
  uploadError.value = null;

  // Validate file
  if (uploadFile.value) {
    if (!uploadFile.value.name.endsWith(".zip")) {
      uploadError.value = t("skinSelector.upload.errorZip");
      uploadFile.value = null;
      return;
    }
    if (uploadFile.value.size > 50 * 1024 * 1024) {
      uploadError.value = t("skinSelector.upload.errorSize");
      uploadFile.value = null;
      return;
    }
  }
};

// Handle thumbnail file selection
const onThumbnailChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && file.type.startsWith("image/")) {
    uploadThumbnail.value = file;
    thumbnailPreview.value = URL.createObjectURL(file);
  }
};

// Handle Ctrl+V paste for thumbnail
const onThumbnailPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        uploadThumbnail.value = file;
        thumbnailPreview.value = URL.createObjectURL(file);
        e.preventDefault();
        break;
      }
    }
  }
};

// Clear thumbnail
const clearThumbnail = () => {
  uploadThumbnail.value = null;
  if (thumbnailPreview.value) {
    URL.revokeObjectURL(thumbnailPreview.value);
    thumbnailPreview.value = null;
  }
};

// Upload skin
const uploadSkin = async () => {
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
    // Add emotion mappings if provided
    if (uploadEmotions.value.trim()) {
      formData.append("emotion_mappings", uploadEmotions.value.trim());
    }
    // Add thumbnail if provided
    if (uploadThumbnail.value) {
      formData.append("thumbnail", uploadThumbnail.value);
    }

    await api.VtuberSkin.upload(formData);

    // Reset form and reload
    showUploadForm.value = false;
    uploadName.value = "";
    uploadFile.value = null;
    uploadEmotions.value = "";
    clearThumbnail();
    await loadSkins();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    uploadError.value = err.response?.data?.message ?? t("skinSelector.upload.errorFile");
    console.error("[SkinSelector] uploadSkin error:", e);
  } finally {
    uploading.value = false;
  }
};

// Delete skin
const deleteSkin = async (skinId: string) => {
  if (!confirm(t("skinSelector.delete.confirm"))) return;

  try {
    await api.VtuberSkin.delete(skinId);
    await loadSkins();

    // If deleted current skin, switch to default
    if (skinId === selectedSkinId.value) {
      await selectSkin("builtin_hiyori");
    }
  } catch (e) {
    error.value = t("skinSelector.delete.error");
    console.error("[SkinSelector] deleteSkin error:", e);
  }
};

// Open edit modal
const openEditSkin = async (skin: VtuberSkinInfo) => {
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
  editThumbnailPreview.value = null;
};

// Close edit modal
const closeEditSkin = () => {
  editingSkin.value = null;
  if (editThumbnailPreview.value) {
    URL.revokeObjectURL(editThumbnailPreview.value);
    editThumbnailPreview.value = null;
  }
};

// Handle edit thumbnail
const onEditThumbnailChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && file.type.startsWith("image/")) {
    editThumbnail.value = file;
    editThumbnailPreview.value = URL.createObjectURL(file);
  }
};

// Handle edit thumbnail paste
const onEditThumbnailPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        editThumbnail.value = file;
        editThumbnailPreview.value = URL.createObjectURL(file);
        e.preventDefault();
        break;
      }
    }
  }
};

// Save edit
const saveEditSkin = async () => {
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
    closeEditSkin();
    await loadSkins();
  } catch (e) {
    console.error("[SkinSelector] saveEditSkin error:", e);
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

// Close modal
const close = () => {
  isOpen.value = false;
  showUploadForm.value = false;
  uploadError.value = null;
};

onMounted(() => {
  if (props.visible) {
    loadSkins();
  }
});

// Watch visibility
watch(
  () => props.visible,
  (val) => {
    if (val) {
      // Sync selectedSkinId with current preference when opening
      selectedSkinId.value = props.currentSkinId;
      loadSkins();
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="close"
      >
        <div
          class="relative max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          @click.stop
        >
          <!-- Header -->
          <header
            class="flex items-center justify-between bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-4 text-white"
          >
            <h2 class="text-lg font-bold">🎨 {{ $t("skinSelector.title") }}</h2>
            <button class="rounded-full p-1 hover:bg-white/20" @click="close">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </header>

          <!-- Content -->
          <div class="max-h-[60vh] overflow-y-auto p-6">
            <!-- Error -->
            <div v-if="error" class="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-900/30">
              {{ error }}
            </div>

            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-12">
              <div
                class="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"
              ></div>
            </div>

            <!-- Skin Grid -->
            <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div
                v-for="skin in skins"
                :key="skin.skin_id"
                class="group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all hover:shadow-lg"
                :class="
                  selectedSkinId === skin.skin_id
                    ? 'border-purple-500 ring-2 ring-purple-300'
                    : 'border-gray-200 hover:border-purple-300 dark:border-gray-600'
                "
                @click="selectSkin(skin.skin_id)"
              >
                <!-- Thumbnail -->
                <div
                  class="aspect-square bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-gray-700 dark:to-gray-600"
                >
                  <img
                    v-if="skin.thumbnail_path"
                    :src="skin.thumbnail_path"
                    :alt="skin.name"
                    class="h-full w-full object-cover"
                  />
                  <div v-else class="flex h-full items-center justify-center text-4xl">🎭</div>
                </div>

                <!-- Info -->
                <div class="p-2">
                  <p class="truncate text-sm font-medium dark:text-white">{{ skin.name }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    <span v-if="skin.is_builtin">{{ $t("skinSelector.builtin") }}</span>
                    <span v-else>{{ formatSize(skin.file_size) }}</span>
                  </p>
                </div>

                <!-- Selected badge -->
                <div
                  v-if="selectedSkinId === skin.skin_id"
                  class="absolute right-2 top-2 rounded-full bg-purple-500 p-1"
                >
                  <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                <!-- Delete button (only for own skins) -->
                <button
                  v-if="canEditSkin(skin)"
                  class="absolute left-2 top-2 hidden rounded-full bg-red-500 p-1 text-white hover:bg-red-600 group-hover:block"
                  @click.stop="deleteSkin(skin.skin_id)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

                <!-- Edit button (only for own skins) -->
                <button
                  v-if="canEditSkin(skin)"
                  class="absolute left-9 top-2 hidden rounded-full bg-blue-500 p-1 text-white hover:bg-blue-600 group-hover:block"
                  @click.stop="openEditSkin(skin)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Upload Form -->
            <div
              v-if="showUploadForm"
              class="mt-6 rounded-xl border border-dashed border-purple-300 bg-purple-50 p-4 dark:border-purple-700 dark:bg-purple-900/20"
            >
              <h3 class="mb-3 font-medium text-purple-700 dark:text-purple-300">
                {{ $t("skinSelector.upload.title") }}
              </h3>

              <div class="space-y-3">
                <div>
                  <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">{{
                    $t("skinSelector.upload.name")
                  }}</label>
                  <input
                    v-model="uploadName"
                    type="text"
                    :placeholder="$t('skinSelector.upload.namePlaceholder')"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">{{
                    $t("skinSelector.upload.file")
                  }}</label>
                  <input
                    type="file"
                    accept=".zip"
                    class="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-purple-500 file:px-4 file:py-2 file:text-white file:hover:bg-purple-600"
                    @change="onFileChange"
                  />
                  <p class="mt-1 text-xs text-gray-500">{{ $t("skinSelector.upload.hint") }}</p>
                </div>

                <!-- Thumbnail (Optional) -->
                <div>
                  <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                    {{ $t("skinSelector.upload.thumbnail") }}
                    <span class="text-gray-400">({{ $t("skinSelector.upload.optional") }})</span>
                  </label>
                  <div
                    class="relative flex min-h-[80px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-3 transition hover:border-purple-400 dark:border-gray-600 dark:bg-gray-700/50 dark:hover:border-purple-500"
                    @paste="onThumbnailPaste"
                    tabindex="0"
                  >
                    <div v-if="thumbnailPreview" class="relative">
                      <img :src="thumbnailPreview" alt="Thumbnail preview" class="max-h-20 rounded" />
                      <button
                        type="button"
                        class="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                        @click="clearThumbnail"
                      >
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    <div v-else class="text-center">
                      <p class="mb-2 text-xs text-gray-500">{{ $t("skinSelector.upload.thumbnailHint") }}</p>
                      <label
                        class="cursor-pointer rounded-lg bg-purple-100 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
                      >
                        {{ $t("skinSelector.upload.chooseFile") }}
                        <input type="file" accept="image/*" class="hidden" @change="onThumbnailChange" />
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Emotion Mappings (Optional) -->
                <div>
                  <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                    {{ $t("skinSelector.upload.emotions") }}
                    <span class="text-gray-400">({{ $t("skinSelector.upload.optional") }})</span>
                  </label>
                  <textarea
                    v-model="uploadEmotions"
                    rows="3"
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-700"
                    :placeholder="`{&quot;smile&quot;: &quot;F05&quot;, &quot;unhappy&quot;: &quot;F03&quot;, &quot;tired&quot;: &quot;F08&quot;, &quot;surprised&quot;: &quot;F06&quot;}`"
                  />
                  <p class="mt-1 text-xs text-gray-400">{{ $t("skinSelector.upload.emotionsHint") }}</p>
                </div>

                <div v-if="uploadError" class="text-sm text-red-600">{{ uploadError }}</div>

                <div class="flex gap-2">
                  <button
                    class="flex-1 rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:opacity-50"
                    :disabled="uploading || !uploadFile"
                    @click="uploadSkin"
                  >
                    <span v-if="uploading">{{ $t("skinSelector.upload.uploading") }}</span>
                    <span v-else>{{ $t("skinSelector.upload.submit") }}</span>
                  </button>
                  <button
                    class="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                    @click="showUploadForm = false"
                  >
                    {{ $t("skinSelector.upload.cancel") }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <footer
            class="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700"
          >
            <button
              v-if="!showUploadForm"
              class="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-white hover:from-purple-600 hover:to-indigo-600"
              @click="showUploadForm = true"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              {{ $t("skinSelector.upload.button") }}
            </button>
            <div v-else></div>

            <button
              class="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
              @click="close"
            >
              {{ $t("skinSelector.close") }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- Edit Modal -->
    <Transition name="modal">
      <div
        v-if="editingSkin"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
        @paste="onEditThumbnailPaste"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
          <h3 class="mb-4 text-lg font-bold dark:text-white">{{ $t("admin.skins.editTitle") }}</h3>

          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                {{ $t("skinSelector.upload.name") }}
              </label>
              <input
                v-model="editName"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                {{ $t("skinSelector.upload.thumbnail") }}
              </label>
              <div class="flex items-center gap-3">
                <div class="h-12 w-12 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
                  <img
                    v-if="editThumbnailPreview || editingSkin.thumbnail_path"
                    :src="editThumbnailPreview || editingSkin.thumbnail_path || ''"
                    class="h-full w-full object-cover"
                    alt=""
                  />
                  <span v-else class="flex h-full items-center justify-center text-lg">🎭</span>
                </div>
                <label
                  class="cursor-pointer rounded-lg bg-purple-100 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300"
                >
                  {{ $t("skinSelector.upload.chooseFile") }}
                  <input type="file" accept="image/*" class="hidden" @change="onEditThumbnailChange" />
                </label>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                {{ $t("skinSelector.upload.emotions") }}
              </label>
              <textarea
                v-model="editEmotions"
                rows="3"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-700"
                :placeholder="`{&quot;smile&quot;: &quot;F05&quot;, &quot;unhappy&quot;: &quot;F03&quot;, ...}`"
              />
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                @click="closeEditSkin"
              >
                {{ $t("skinSelector.upload.cancel") }}
              </button>
              <button
                class="rounded-lg bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
                :disabled="saving"
                @click="saveEditSkin"
              >
                <span
                  v-if="saving"
                  class="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
                ></span>
                {{ $t("admin.skins.save") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95);
}
</style>
