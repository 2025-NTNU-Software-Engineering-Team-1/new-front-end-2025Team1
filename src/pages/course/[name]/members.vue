<script setup lang="ts">
import { useAxios } from "@vueuse/integrations/useAxios";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import api, { fetcher } from "@/models/api";
import { ROLE } from "@/constants";
import { useTitle } from "@vueuse/core";
import { useSession, UserRole } from "@/stores/session";
import axios, { type AxiosError } from "axios";

const route = useRoute();
const router = useRouter();
const session = useSession();
useTitle(`Members - ${route.params.name} | Normal OJ`);
enum MemberTableColumn {
  USERNAME = "username",
  DISPLAYED_NAME = "displayedName",
  ROLE = "role",
}
const sortBy = ref<MemberTableColumn>(
  Object.values(MemberTableColumn).includes(route.query.sort as MemberTableColumn)
    ? (route.query.sort as MemberTableColumn)
    : MemberTableColumn.USERNAME,
);
watch(sortBy, () => {
  router.replace({ query: { sort: sortBy.value || MemberTableColumn.USERNAME } });
});
const { data, error, isLoading } = useAxios<Course>(`/course/${route.params.name}`, fetcher);
const members = computed(() => {
  if (!data.value) return [];
  return [data.value.teacher, ...data.value.students, ...data.value.TAs].sort((a, b) => {
    if (sortBy.value === "username") {
      return a.username.localeCompare(b.username);
    } else if (sortBy.value === "displayedName") {
      return a.displayedName.localeCompare(b.displayedName);
    } else {
      return a.role - b.role;
    }
  });
});

const rolesCanCreateCourse = [UserRole.Admin];

const isOpen = ref(false);
const newMembers = ref<File | null>();
const shouldStandardizeUsername = ref(true);
const newMembersCSVString = ref("");
const forceUpdate = ref(false);
const isProcessingSignup = ref(false);
const errorMsg = ref("");
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

const roleOptions = [
  { text: "Admin", value: "0" },
  { text: "Teacher", value: "1" },
  { text: "Student", value: "2" },
  { text: "TA", value: "3" },
];

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
    errorMsg.value = "";
  }
});

// no csv validation was handled
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
async function submit() {
  let csvData = "";
  // Clear previous errors
  errorMsg.value = "";

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
      errorMsg.value = "Please fill in at least one user with username, email and password";
      return;
    }
  }

  // Validate role values before sending
  if (inputMode.value === "manual") {
    for (const u of manualUsers.value) {
      if (!u.username.trim() || !u.email.trim() || !u.password.trim()) continue; // skip empty rows
      if (!isValidRole(u.role)) {
        errorMsg.value = `Invalid role "${u.role}" for user "${u.username}". Allowed: 0=Admin,1=Teacher,2=Student,3=TA`;
        return;
      }
    }
  } else {
    // CSV mode: if role column present, validate values
    const rows = csvData.split("\n");
    const headerCols = rows[0].split(",").map((h) => h.trim());
    const roleIdx = headerCols.findIndex((h) => h === "role");
    if (roleIdx >= 0) {
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",");
        const val = (cols[roleIdx] || "").trim();
        if (!val) continue; // optional
        if (!/^[0-3]$/.test(val)) {
          errorMsg.value = `Invalid role "${val}" on CSV line ${i + 1}. Allowed: 0=Admin,1=Teacher,2=Student,3=TA`;
          return;
        }
      }
    }
  }

  isProcessingSignup.value = true;

  try {
    await api.Auth.batchSignup({
      newUsers: csvData,
      force: forceUpdate.value,
      course: route.params.name as string,
    });
    router.go(0);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      errorMsg.value = error.response.data.message;
    } else {
      errorMsg.value = "Unknown error occurred :(";
    }
    throw error;
  } finally {
    isProcessingSignup.value = false;
  }
}
</script>

<template>
  <div class="card-container">
    <div class="card min-w-full">
      <div class="card-body">
        <div class="card-title">
          {{ $t("course.members.title") }}
          <span v-if="data" class="text-sm opacity-70">({{ members.length }})</span>

          <div class="flex-1" />

          <label v-if="rolesCanCreateCourse.includes(session.role)" for="my-modal" class="btn btn-success">
            <i-uil-plus-circle class="mr-1 lg:h-5 lg:w-5" /> {{ $t("course.members.new") }}
          </label>
        </div>

        <div class="mb-4">
          <div class="form-control w-full max-w-xs">
            <label class="label">
              <span class="label-text">{{ $t("course.members.sortBy") }}</span>
            </label>
            <select v-model="sortBy" class="select-bordered select w-full max-w-xs">
              <option :value="MemberTableColumn.USERNAME">Username</option>
              <option :value="MemberTableColumn.DISPLAYED_NAME">Display Name</option>
              <option :value="MemberTableColumn.ROLE">Role</option>
            </select>
          </div>
        </div>
        <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
          <template #loading>
            <skeleton-table :col="3" :row="5" />
          </template>
          <template #data>
            <table class="table w-full">
              <thead>
                <tr>
                  <th>username</th>
                  <th>display name</th>
                  <th>role</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="{ username, displayedName, role } in members" :key="username" class="hover">
                  <td>{{ username }}</td>
                  <td>{{ displayedName }}</td>
                  <td>{{ ROLE[role] }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </data-status-wrapper>
      </div>
    </div>

    <input v-model="isOpen" type="checkbox" id="my-modal" class="modal-toggle" />
    <div class="modal">
      <div class="modal-box max-w-4xl">
        <!-- Header Info -->
        <div>
          {{ $t("course.members.csvUploadHint.header") }}
          <ul class="ml-4 list-disc">
            <li v-for="h in ['username', 'email', 'password']">
              <code>{{ h }}</code>
            </li>
            <li v-for="h in ['displayedName', 'role']">
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
        <div class="alert alert-error shadow-lg" v-if="errorMsg">
          <div>
            <i-uil-times-circle />
            <span>{{ errorMsg }}</span>
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
              <div class="col-span-2">Username *</div>
              <div class="col-span-3">Email *</div>
              <div class="col-span-2">Password *</div>
              <div class="col-span-2">Display Name</div>
              <div class="col-span-2">Role</div>
              <div class="col-span-1"></div>
            </div>

            <!-- User Rows -->
            <div
              v-for="(user, index) in manualUsers"
              :key="index"
              class="grid grid-cols-12 items-center gap-2"
            >
              <input
                v-model="user.username"
                type="text"
                placeholder="username"
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
                placeholder="password"
                class="input input-bordered input-sm col-span-2"
              />
              <input
                v-model="user.displayedName"
                type="text"
                placeholder="(optional)"
                class="input input-bordered input-sm col-span-2"
              />
              <select v-model="user.role" class="select select-bordered select-sm col-span-2">
                <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
                  {{ opt.text }}
                </option>
              </select>
              <div class="col-span-1 flex gap-1">
                <button class="btn btn-sm btn-ghost" @click="addManualUser" aria-label="Add user">
                  <i-uil-plus />
                </button>
                <button
                  class="btn btn-sm btn-ghost"
                  @click="removeManualUser(index)"
                  :disabled="manualUsers.length <= 1"
                  aria-label="Remove user"
                >
                  <i-uil-minus />
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Modal Actions -->
        <div class="modal-action">
          <label for="my-modal" class="btn btn-ghost">{{ $t("course.members.cancel") }}</label>
          <div :class="['btn btn-success ml-3', isProcessingSignup && 'loading']" @click="submit">
            {{ $t("course.members.submit") }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
