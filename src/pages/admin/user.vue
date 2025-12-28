<script setup lang="ts">
import api, { fetcher } from "../../models/api";
import useVuelidate from "@vuelidate/core";
import { required, maxLength, between, integer, minLength, helpers } from "@vuelidate/validators";
import axios, { type AxiosError } from "axios";
import { computed, ref, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { containsInvisible } from "../../utils/validators";
import { ROLE } from "../../constants";
import { useTitle } from "@vueuse/core";

useTitle("Admin - User | Normal OJ");
const { t } = useI18n();

interface User {
  username: string;
  displayedName: string;
  role: number;
}

const users = ref<User[] | undefined>([]);
const fetchError = ref<unknown>(null);
const fetchLoading = ref<boolean>(false);
async function execute() {
  fetchLoading.value = true;
  try {
    const res = await fetcher.get("/user");
    // API response could be { data: [...] } or the array directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (res as any).data;
    if (Array.isArray(data)) {
      users.value = data;
    } else if (data && Array.isArray(data.data)) {
      users.value = data.data;
    } else if (Array.isArray(res)) {
      // access response directly if interceptor merged it?
      // actually fetcher.get returns AxiosResponse, but interceptor spreads .data
      // simpler to trust .data or the object itself if interceptor worked
      users.value = res as unknown as User[];
    }
  } catch (e) {
    fetchError.value = e;
  } finally {
    fetchLoading.value = false;
  }
}
// initial fetch
execute();
const searchName = ref<string>("");
const searchRole = ref<number | null>(null);
const filteredUsers = computed(() =>
  users.value
    ?.filter((d) => d.username.includes(searchName.value) || d.displayedName.includes(searchName.value))
    .filter((d) => searchRole.value == null || d.role === searchRole.value),
);

const edittingUsername = ref<string>("");
const isLoading = ref<boolean>(false);
const errorMsg = ref<string>("");
const initialUserForm = {
  displayedName: "",
  role: 0,
  password: "",
};
const userForm = reactive({ ...initialUserForm });
const noInvisible = helpers.withMessage(
  () => t("components.validation.contains_invisible"),
  (value: unknown) => typeof value !== "string" || !containsInvisible(value),
);

const rules = {
  displayedName: { maxLength: maxLength(16), noInvisible },
  role: { required, between: between(0, 3), integer },
  password: { minLength: minLength(1) },
};
const v$ = useVuelidate(rules, userForm);
function editUser(username: string) {
  const originalData = users.value?.find((d) => d.username === username);
  if (!originalData) return;
  userForm.displayedName = originalData.displayedName;
  userForm.role = originalData.role;
  userForm.password = "";
  edittingUsername.value = username;
}
function closeEditor() {
  edittingUsername.value = "";
}
async function submit() {
  if (!(await v$.value.$validate())) return;

  isLoading.value = true;
  try {
    if (!userForm.password) userForm.password = "";
    await api.User.modify(edittingUsername.value, { ...userForm });
    execute();
    Object.assign(userForm, initialUserForm);
    edittingUsername.value = "";
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      errorMsg.value = error.response.data.message;
    } else {
      errorMsg.value = t("admin.unknown-error-occurred");
    }
    throw error;
  } finally {
    isLoading.value = false;
  }
}
const editingTitle = computed(() => t("admin.user.editing", { user: edittingUsername.value }));

// ==========================================
// Add User Modal Logic (Ported from members.vue)
// ==========================================
const isOpen = ref(false);
const newMembers = ref<File | null>();
const shouldStandardizeUsername = ref(true);
const newMembersCSVString = ref("");
const forceUpdate = ref(false);
const isProcessingSignup = ref(false);
const addUserErrorMsg = ref("");
const previewCSV = ref<{ headers?: string[]; body?: string[][] }>({});

// Manual input mode
type InputMode = "csv" | "manual";
const inputMode = ref<InputMode>("csv");

interface ManualUser {
  username: string;
  email: string;
  password: string;
  displayedName: string;
  role: string;
}

const createEmptyUser = (): ManualUser => ({
  username: "",
  email: "",
  password: "",
  displayedName: "",
  // Default to Student (backend Role.STUDENT === 2)
  role: "2",
});

const manualUsers = ref<ManualUser[]>([createEmptyUser()]);

function addManualUser() {
  manualUsers.value.push(createEmptyUser());
}

function removeManualUser(index: number) {
  if (manualUsers.value.length > 1) {
    manualUsers.value.splice(index, 1);
  }
}

function manualUsersToCSV(): string {
  const headers = "username,email,password,displayedName,role";
  const rows = manualUsers.value
    .filter((u) => u.username.trim() && u.email.trim() && u.password.trim())
    .map((u) => `${u.username},${u.email},${u.password},${u.displayedName || ""},${u.role?.trim() || "2"}`);
  return [headers, ...rows].join("\n");
}

function isValidRole(value: unknown): boolean {
  return typeof value === "string" && /^[0-3]$/.test(value.trim());
}

// Reset form when modal opens/closes
watch(isOpen, (open) => {
  if (!open) {
    // Reset form when modal closes
    newMembers.value = null;
    newMembersCSVString.value = "";
    previewCSV.value = {};
    manualUsers.value = [createEmptyUser()];
    addUserErrorMsg.value = "";
  }
});

const standardizeUsername = (csv: string): string => {
  const rows = csv.split("\n");
  const header = rows[0];
  const body = rows.slice(1).map((r) => r.split(","));
  const usernameFieldIndex = header.split(",").findIndex((v) => v === "username");
  if (usernameFieldIndex < 0) {
    return csv;
  }

  body.forEach((data) => {
    data[usernameFieldIndex] = data[usernameFieldIndex]?.toUpperCase();
  });

  const bodyString = body.map((data) => data.join(","));
  return [header, ...bodyString].join("\n");
};

// Validate duplicate usernames/emails in CSV content
function findDuplicatesInCSV(csv: string) {
  const rows = csv.split("\n").filter((r) => r.trim() !== "");
  if (rows.length < 2) return { username: [], email: [] };
  const headerCols = rows[0].split(",").map((h) => h.trim());
  const usernameIdx = headerCols.findIndex((h) => h === "username");
  const emailIdx = headerCols.findIndex((h) => h === "email");

  const usernameCount: Record<string, number> = {};
  const emailCount: Record<string, number> = {};

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(",");
    if (usernameIdx >= 0) {
      const u = (cols[usernameIdx] || "").trim();
      if (u) usernameCount[u] = (usernameCount[u] || 0) + 1;
    }
    if (emailIdx >= 0) {
      const e = (cols[emailIdx] || "").trim();
      if (e) emailCount[e] = (emailCount[e] || 0) + 1;
    }
  }

  const dupUsernames = Object.keys(usernameCount).filter((k) => usernameCount[k] > 1);
  const dupEmails = Object.keys(emailCount).filter((k) => emailCount[k] > 1);
  return { username: dupUsernames, email: dupEmails };
}

function findDuplicatesInManual() {
  const usernameCount: Record<string, number> = {};
  const emailCount: Record<string, number> = {};
  for (const u of manualUsers.value) {
    const username = (u.username || "").trim();
    const email = (u.email || "").trim();
    if (username) usernameCount[username] = (usernameCount[username] || 0) + 1;
    if (email) emailCount[email] = (emailCount[email] || 0) + 1;
  }
  const dupUsernames = Object.keys(usernameCount).filter((k) => usernameCount[k] > 1);
  const dupEmails = Object.keys(emailCount).filter((k) => emailCount[k] > 1);
  return { username: dupUsernames, email: dupEmails };
}

function formatDuplicateMessage(dups: { username: string[]; email: string[] }) {
  const parts: string[] = [];
  if (dups.username.length)
    parts.push(`${t("course.members.errors.dupUsernames")} ${dups.username.join(", ")}`);
  if (dups.email.length) parts.push(`${t("course.members.errors.dupEmails")} ${dups.email.join(", ")}`);
  return parts.join("；");
}

watch(newMembers, () => {
  if (!newMembers.value) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    if (typeof evt.target?.result !== "string") return;
    newMembersCSVString.value = evt.target?.result;

    const rows = newMembersCSVString.value.split("\n");
    previewCSV.value.headers = rows[0].split(",");
    previewCSV.value.body = rows.slice(1).map((r) => r.split(","));
  };
  reader.readAsText(newMembers.value);
});

async function submitBatchUsers() {
  let csvData = "";
  // Clear previous errors
  addUserErrorMsg.value = "";

  if (inputMode.value === "csv") {
    if (!newMembersCSVString.value) return;
    csvData = shouldStandardizeUsername.value
      ? standardizeUsername(newMembersCSVString.value)
      : newMembersCSVString.value;
  } else {
    // Manual input mode
    csvData = manualUsersToCSV();
    if (shouldStandardizeUsername.value) {
      csvData = standardizeUsername(csvData);
    }
    // Validate that we have at least one valid user
    const lines = csvData.split("\n");
    if (lines.length < 2) {
      addUserErrorMsg.value = t("course.members.errors.needAtLeastOne");
      return;
    }
  }

  // Validate role values before sending
  if (inputMode.value === "manual") {
    for (const u of manualUsers.value) {
      if (!u.username.trim() || !u.email.trim() || !u.password.trim()) continue; // skip empty rows
      if (!isValidRole(u.role)) {
        addUserErrorMsg.value = t("course.members.errors.invalidRoleForUser", {
          role: u.role,
          username: u.username,
        });
        return;
      }
    }

    // Check for duplicates in manual input
    const d = findDuplicatesInManual();
    if (d.username.length || d.email.length) {
      addUserErrorMsg.value = t("course.members.errors.duplicatesInInput", {
        details: formatDuplicateMessage(d),
      });
      return;
    }
  } else {
    // CSV mode: if role column present, validate values
    const rows = csvData.split("\n").filter((r) => r.trim() !== "");
    const headerCols = rows[0].split(",").map((h) => h.trim());
    const roleIdx = headerCols.findIndex((h) => h === "role");
    if (roleIdx >= 0) {
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",");
        const val = (cols[roleIdx] || "").trim();
        if (!val) continue; // optional
        if (!/^[0-3]$/.test(val)) {
          addUserErrorMsg.value = t("course.members.errors.invalidRoleOnLine", {
            val,
            line: i + 1,
          });
          return;
        }
      }
    }

    // Check for duplicates in CSV file (username/email)
    const dup = findDuplicatesInCSV(csvData);
    if (dup.username.length || dup.email.length) {
      addUserErrorMsg.value = t("course.members.errors.duplicatesInCSV", {
        details: formatDuplicateMessage(dup),
      });
      return;
    }
  }

  isProcessingSignup.value = true;

  try {
    const res = await api.Auth.batchSignup({
      newUsers: csvData,
      force: forceUpdate.value,
      course: null, // Global user addition, no course context
    });

    // If backend returned skipped entries (duplicates), show them as an error message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skipped = (res as any).data?.skipped ?? (res as any).skipped;
    if (skipped && skipped.length > 0) {
      const skippedStr = skipped
        .map(
          (s: unknown) =>
            `${(s as { username?: string; email?: string }).username || ""}${
              (s as { username?: string; email?: string }).email
                ? ` (${(s as { username?: string; email?: string }).email})`
                : ""
            }`,
        )
        .join(", ");
      addUserErrorMsg.value = t("course.members.errors.skippedEntries", {
        users: skippedStr,
      });
      return;
    }

    // Close modal and refresh list
    isOpen.value = false;
    execute(); // Refresh user list
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      addUserErrorMsg.value = error.response.data.message;
    } else {
      addUserErrorMsg.value = t("course.members.errors.unknown-error-occurred");
    }
  } finally {
    isProcessingSignup.value = false;
  }
}
</script>

<template>
  <div class="mb-4 flex items-center gap-x-4">
    <input
      v-model="searchName"
      :placeholder="t('admin.user.search-name')"
      type="text"
      class="input-bordered input"
    />

    <select v-model="searchRole" class="select-bordered select">
      <option :value="null">{{ t("admin.user.select-role") }}</option>
      <option :value="0">{{ t("admin.user.admin") }}</option>
      <option :value="1">{{ t("admin.user.teacher") }}</option>
      <option :value="2">{{ t("admin.user.student") }}</option>
      <option :value="3">{{ t("admin.user.ta") }}</option>
    </select>

    <span>{{ t("admin.user.row-count", { n: filteredUsers?.length }) }}</span>

    <div class="flex-1"></div>
    <label for="add-user-modal" class="btn btn-success">
      <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ t("course.members.new") }}
    </label>
  </div>

  <data-status-wrapper :error="fetchError as AxiosError" :is-loading="fetchLoading">
    <template #loading>
      <skeleton-table :col="3" :row="5" />
    </template>
    <template #data>
      <table class="table-compact table w-full">
        <thead>
          <tr>
            <th>{{ t("admin.user.username") }}</th>
            <th>{{ t("admin.user.display-name") }}</th>
            <th>{{ t("admin.user.role") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="{ username, displayedName, role } in filteredUsers" :key="username" class="hover">
            <td>{{ username }}</td>
            <td>{{ displayedName }}</td>
            <td>{{ ROLE[role] }}</td>
            <td>
              <div class="btn btn-ghost btn-sm btn-circle" @click="editUser(username)">
                <i-uil-pen />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </data-status-wrapper>

  <ui-dialog :modelValue="!!edittingUsername">
    <template #title> {{ editingTitle }}</template>
    <template #content>
      <div v-if="errorMsg" class="alert alert-error shadow-lg">
        <div>
          <i-uil-times-circle />
          <span>{{ errorMsg }}</span>
        </div>
      </div>

      <div class="form-control w-full max-w-xs">
        <label class="label">
          <span class="label-text">{{ t("admin.user.username") }}</span>
        </label>
        <input
          :value="edittingUsername"
          type="text"
          disabled
          class="disabled input-bordered input w-full max-w-xs"
        />
      </div>

      <div class="form-control w-full max-w-xs">
        <label class="label">
          <span class="label-text">{{ t("admin.user.display-name") }}</span>
        </label>
        <input
          v-model="v$.displayedName.$model"
          type="text"
          :class="['input-bordered input w-full max-w-xs', v$.displayedName.$error && 'input-error']"
        />
        <label class="label" v-show="v$.displayedName.$error">
          <span class="label-text-alt text-error" v-text="v$.displayedName.$errors[0]?.$message" />
        </label>
      </div>

      <div class="form-control w-full max-w-xs">
        <label class="label">
          <span class="label-text">{{ t("admin.user.role") }}</span>
        </label>
        <select v-model="v$.role.$model" class="select-bordered select w-full max-w-xs">
          <option :value="0">{{ t("admin.user.admin") }}</option>
          <option :value="1">{{ t("admin.user.teacher") }}</option>
          <option :value="2">{{ t("admin.user.student") }}</option>
          <option :value="3">{{ t("admin.user.ta") }}</option>
        </select>
      </div>

      <div class="form-control w-full max-w-xs">
        <label class="label">
          <span class="label-text">{{ t("admin.user.password") }}</span>
        </label>
        <input
          v-model="v$.password.$model"
          type="password"
          :class="['input-bordered input w-full max-w-xs', v$.password.$error && 'input-error']"
        />
        <label class="label">
          <span
            :class="[
              'label-text-alt whitespace-normal break-words text-sm',
              v$.password.$error && 'text-error',
            ]"
          >
            {{ v$.password.$error ? v$.password.$errors[0]?.$message : t("admin.user.pwHint") }}
          </span>
        </label>
      </div>

      <div class="mt-8 flex justify-between">
        <button :class="['btn btn-success', isLoading && 'loading']" @click="submit">
          <i-uil-file-upload-alt class="mr-1 lg:h-5 lg:w-5" /> {{ t("admin.user.submit") }}
        </button>
        <button :class="['btn btn-ghost']" @click="closeEditor">
          {{ t("admin.user.cancel") }}
        </button>
      </div>
    </template>
  </ui-dialog>

  <!-- Add User Modal (Ported from members.vue) -->
  <input v-model="isOpen" type="checkbox" id="add-user-modal" class="modal-toggle" />
  <div class="modal">
    <div class="modal-box max-w-4xl">
      <!-- Header Info -->
      <div>
        {{ $t("course.members.csvUploadHint.header") }}
        <ul class="ml-4 list-disc">
          <li v-for="h in ['username', 'email', 'password']" :key="h">
            <code>{{ h }}</code>
          </li>
          <li v-for="h in ['displayedName', 'role']" :key="h">
            <code>{{ h }}</code> (optional)
          </li>
        </ul>
      </div>
      <div>
        {{ $t("course.members.csvUploadHint.content") }}
      </div>

      <div class="mt-2 font-bold">
        {{ $t("course.members.csvUploadHint.caution") }}
      </div>

      <div class="my-4" />

      <!-- Options -->
      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">{{ $t("course.members.standardizeUsername") }}</span>
          <input v-model="shouldStandardizeUsername" type="checkbox" class="checkbox checkbox-primary" />
        </label>
      </div>

      <!-- Error Message -->
      <div class="alert alert-error shadow-lg" v-if="addUserErrorMsg">
        <div>
          <i-uil-times-circle />
          <span>{{ addUserErrorMsg }}</span>
        </div>
      </div>

      <div class="form-control my-4">
        <label class="label cursor-pointer">
          <span class="label-text">{{ $t("course.members.forceUpdate") }}</span>
          <input type="checkbox" class="checkbox checkbox-primary" v-model="forceUpdate" />
        </label>
      </div>

      <!-- Tab Switcher -->
      <div class="tabs tabs-boxed mb-4">
        <a class="tab" :class="{ 'tab-active': inputMode === 'csv' }" @click="inputMode = 'csv'">
          {{ $t("course.members.csvUpload") }}
        </a>
        <a class="tab" :class="{ 'tab-active': inputMode === 'manual' }" @click="inputMode = 'manual'">
          {{ $t("course.members.manualInput") }}
        </a>
      </div>

      <!-- CSV Upload Mode -->
      <template v-if="inputMode === 'csv'">
        <div class="mt-2 overflow-hidden rounded-lg">
          <div class="grid grid-cols-5">
            <!-- Left Label -->
            <div class="bg-base-300 col-span-1 flex items-center justify-center text-sm">
              {{ $t("course.members.csvFiles") }}
            </div>
            <!-- Right Upload Area -->
            <div class="textarea-bordered bg-base-100 col-span-4 p-4">
              <template v-if="!newMembers">
                <div class="mb-2 text-sm opacity-70">{{ $t("course.members.csvUploadInfo") }}</div>
                <input
                  type="file"
                  accept=".csv"
                  class="file-input-bordered file-input file-input-sm w-full"
                  @change="newMembers = ($event.target as HTMLInputElement).files?.[0]"
                />
              </template>
              <template v-else>
                <div class="mb-2 flex items-center gap-2">
                  <span class="font-medium">{{ newMembers.name }}</span>
                  <button class="btn btn-sm btn-ghost" @click="newMembers = null">
                    <i-uil-times />
                  </button>
                </div>
                <div class="max-h-48 overflow-x-auto">
                  <table class="table-compact table w-full">
                    <thead>
                      <tr v-if="previewCSV.headers">
                        <th v-for="h in previewCSV.headers" :key="h">{{ h }}</th>
                      </tr>
                    </thead>
                    <tbody v-if="previewCSV.body">
                      <tr v-for="(r, idx) in previewCSV.body" :key="idx">
                        <td v-for="(c, cidx) in r" :key="cidx">{{ c }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- Manual Input Mode -->
      <template v-else>
        <div class="space-y-3">
          <!-- Header Row -->
          <div class="grid grid-cols-12 gap-2 px-1 text-sm font-semibold opacity-70">
            <div class="col-span-2">{{ t("admin.user.username") }} *</div>
            <div class="col-span-3">{{ t("profile.email") }} *</div>
            <div class="col-span-2">{{ t("admin.user.password") }} *</div>
            <div class="col-span-2">{{ t("admin.user.display-name") }}</div>
            <div class="col-span-2">{{ t("admin.user.role") }}</div>
            <div class="col-span-1"></div>
          </div>

          <!-- User Rows -->
          <div v-for="(user, index) in manualUsers" :key="index" class="grid grid-cols-12 items-center gap-2">
            <input
              v-model="user.username"
              type="text"
              :placeholder="t('admin.user.username')"
              class="input input-bordered input-sm col-span-2"
            />
            <input
              v-model="user.email"
              type="email"
              placeholder="email@example.com"
              class="input input-bordered input-sm col-span-3"
            />
            <input
              v-model="user.password"
              type="text"
              :placeholder="t('admin.user.password')"
              class="input input-bordered input-sm col-span-2"
            />
            <input
              v-model="user.displayedName"
              type="text"
              :placeholder="t('skinSelector.upload.optional')"
              class="input input-bordered input-sm col-span-2"
            />
            <select v-model="user.role" class="select select-bordered select-sm col-span-2">
              <option value="0">Admin</option>
              <option value="1">Teacher</option>
              <option value="2">Student</option>
              <option value="3">TA</option>
            </select>
            <div class="col-span-1 flex justify-center">
              <button
                class="btn btn-ghost btn-xs text-error"
                @click="removeManualUser(index)"
                :disabled="manualUsers.length === 1"
              >
                <i-uil-trash-alt />
              </button>
            </div>
          </div>

          <!-- Add Row Button -->
          <button class="btn btn-ghost btn-sm btn-block border-2 border-dashed" @click="addManualUser">
            <i-uil-plus /> {{ t("course.members.addRow") }}
          </button>
        </div>
      </template>

      <!-- Modal Actions -->
      <div class="modal-action">
        <label for="add-user-modal" class="btn btn-ghost">
          {{ $t("admin.user.cancel") }}
        </label>
        <button
          class="btn btn-primary"
          :class="{ loading: isProcessingSignup }"
          :disabled="
            isProcessingSignup ||
            (inputMode === 'csv' && !newMembers) ||
            (inputMode === 'manual' && !manualUsers.some((u) => u.username))
          "
          @click="submitBatchUsers"
        >
          {{ $t("admin.user.submit") }}
        </button>
      </div>
    </div>
  </div>
</template>
