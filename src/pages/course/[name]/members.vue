<script setup lang="ts">
import { useAxios } from "@vueuse/integrations/useAxios";
import { computed, ref, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import api, { fetcher } from "@/models/api";
import { ROLE } from "@/constants";
import { useTitle } from "@vueuse/core";
import { useSession, UserRole } from "@/stores/session";
import axios, { type AxiosError } from "axios";
import { useI18n } from "vue-i18n";
import { hover_zh } from "../../../components/Problem/Hovers/hover-zh-tw";
import { hover_en } from "../../../components/Problem/Hovers/hover-en";
const route = useRoute();
const router = useRouter();
const session = useSession();
const { t, locale } = useI18n();
const hover = computed(() => {
  console.log("當前語系代碼:", locale.value);
  console.log("英文資源內容:", hover_en);
  return locale.value === "english" ? hover_en : hover_zh;
});

useTitle(`Members - ${route.params.name} | Normal OJ`);

// Course code management
const courseCode = ref<string | null>(null);
const courseCodeLoading = ref(false);
const courseCodeError = ref("");

const canManageCode = computed(() => session.isAdmin || session.isTeacher || session.isTA);

async function fetchCourseCode() {
  if (!canManageCode.value) return;
  courseCodeLoading.value = true;
  courseCodeError.value = "";
  try {
    const response = await api.Course.getCode(route.params.name as string);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    courseCode.value = (response as any).data.course_code;
  } catch {
    courseCodeError.value = t("course.members.courseCode.errorFetch");
  } finally {
    courseCodeLoading.value = false;
  }
}

async function generateCourseCode() {
  courseCodeLoading.value = true;
  courseCodeError.value = "";
  try {
    const response = await api.Course.generateCode(route.params.name as string);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    courseCode.value = (response as any).data.course_code;
  } catch {
    courseCodeError.value = t("course.members.courseCode.errorGenerate");
  } finally {
    courseCodeLoading.value = false;
  }
}

async function removeCourseCode() {
  courseCodeLoading.value = true;
  courseCodeError.value = "";
  try {
    await api.Course.removeCode(route.params.name as string);
    courseCode.value = null;
  } catch {
    courseCodeError.value = t("course.members.courseCode.errorRemove");
  } finally {
    courseCodeLoading.value = false;
  }
}

function copyCourseCode() {
  if (courseCode.value) {
    navigator.clipboard.writeText(courseCode.value);
  }
}

onMounted(() => {
  fetchCourseCode();
});

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
const {
  data,
  error,
  isLoading,
  execute: refetchMembers,
} = useAxios<Course>(`/course/${route.params.name}`, fetcher);

// Check if user is course teacher (not just MODIFY permission, specifically teacher)
const canChangeRoles = computed(() => {
  // Only course teacher or admin can change roles (not TAs)
  if (session.isAdmin) return true;
  if (!data.value) return false;
  return data.value.teacher?.username === session.username;
});

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

// Role change functionality
const roleChangeLoading = ref<string | null>(null); // username being changed
const roleChangeError = ref("");

const editingUser = ref<string | null>(null);
async function handleRoleChange(member: any, newRole: "student" | "ta") {
  editingUser.value = null;

  if (!data.value) return;

  // Store original state for potential rollback
  const originalStudents = [...(data.value.students || [])];
  const originalTAs = [...(data.value.TAs || [])];

  // Move member between arrays based on new role
  if (newRole === "ta") {
    // Move from students to TAs
    const studentIndex = data.value.students?.findIndex((s) => s.username === member.username);
    if (studentIndex !== undefined && studentIndex >= 0) {
      const [movedMember] = data.value.students!.splice(studentIndex, 1);
      data.value.TAs = data.value.TAs || [];
      data.value.TAs.push(movedMember);
    }
  } else {
    // Move from TAs to students
    const taIndex = data.value.TAs?.findIndex((ta) => ta.username === member.username);
    if (taIndex !== undefined && taIndex >= 0) {
      const [movedMember] = data.value.TAs!.splice(taIndex, 1);
      data.value.students = data.value.students || [];
      data.value.students.push(movedMember);
    }
  }

  try {
    await changeMemberRole(member.username, newRole);
  } catch (err) {
    // Rollback on error - restore original arrays
    if (data.value) {
      data.value.students = originalStudents;
      data.value.TAs = originalTAs;
    }
  }
}

// Determine member's course role (student, ta, teacher)
function getCourseRole(member: UserInfo): "teacher" | "ta" | "student" {
  if (!data.value) return "student";
  if (member.username === data.value.teacher?.username) return "teacher";
  if (data.value.TAs?.some((ta) => ta.username === member.username)) return "ta";
  return "student";
}

async function changeMemberRole(username: string, newRole: "student" | "ta") {
  roleChangeLoading.value = username;
  roleChangeError.value = "";
  try {
    await api.Course.changeMemberRole(route.params.name as string, username, newRole);
    // Don't refetch - we've already updated the local state optimistically
  } catch (err: unknown) {
    const axiosError = err as AxiosError<{ message: string }>;
    roleChangeError.value = axiosError.response?.data?.message || t("course.members.roleChange.error");
    // Rethrow so caller can handle rollback
    throw err;
  } finally {
    roleChangeLoading.value = null;
  }
}

// Member removal functionality
const removingMember = ref<string | null>(null);
const removeError = ref("");

// Confirm dialog state
const showRemoveConfirmDialog = ref(false);
const memberToRemove = ref<any>(null);

function openRemoveConfirmDialog(member: any) {
  memberToRemove.value = member;
  showRemoveConfirmDialog.value = true;
}

function closeRemoveConfirmDialog() {
  showRemoveConfirmDialog.value = false;
  memberToRemove.value = null;
}

async function confirmRemoveMember() {
  if (!memberToRemove.value || !data.value) return;

  const member = memberToRemove.value;
  removingMember.value = member.username;
  removeError.value = "";

  try {
    await api.Course.removeMember(route.params.name as string, member.username);
    // Refetch members to update the list
    await refetchMembers();
    closeRemoveConfirmDialog();
  } catch (err: unknown) {
    const axiosError = err as AxiosError<{ message: string }>;
    removeError.value = axiosError.response?.data?.message || t("course.members.removeError");
  } finally {
    removingMember.value = null;
  }
}

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
      errorMsg.value = t("course.members.errors.needAtLeastOne");
      return;
    }
  }

  // Validate role values before sending
  if (inputMode.value === "manual") {
    for (const u of manualUsers.value) {
      if (!u.username.trim() || !u.email.trim() || !u.password.trim()) continue; // skip empty rows
      if (!isValidRole(u.role)) {
        errorMsg.value = t("course.members.errors.invalidRoleForUser", {
          role: u.role,
          username: u.username,
        });
        return;
      }
    }

    // Check for duplicates in manual input
    const d = findDuplicatesInManual();
    if (d.username.length || d.email.length) {
      errorMsg.value = t("course.members.errors.duplicatesInInput", {
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
          errorMsg.value = t("course.members.errors.invalidRoleOnLine", {
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
      errorMsg.value = t("course.members.errors.duplicatesInCSV", {
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
      course: route.params.name as string,
    });

    // If backend returned skipped entries (duplicates), show them as an error message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skipped = (res as any).data?.skipped ?? (res as any).skipped;
    if (skipped && skipped.length > 0) {
      const skippedStr = skipped
        .map(
          (s: unknown) =>
            `${(s as { username?: string; email?: string }).username || ""}${(s as { username?: string; email?: string }).email ? ` (${(s as { username?: string; email?: string }).email})` : ""}`,
        )
        .join(", ");
      errorMsg.value = t("course.members.errors.skippedEntries", {
        users: skippedStr,
      });
      return;
    }

    router.go(0);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      errorMsg.value = error.response.data.message;
    } else {
      errorMsg.value = t("course.members.errors.unknown-error-occurred");
    }
    // don't rethrow to keep UI stable; error is shown in the modal
    return;
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

        <!-- Course Code Management Section -->
        <div v-if="canManageCode" class="border-base-300 bg-base-200/50 mb-4 rounded-lg border p-4">
          <h3 class="mb-3 font-semibold">{{ $t("course.members.courseCode.title") }}</h3>

          <div v-if="courseCodeLoading" class="flex items-center gap-2">
            <span class="loading loading-spinner loading-sm"></span>
            <span class="text-sm opacity-70">{{ $t("course.members.courseCode.loading") }}</span>
          </div>

          <div v-else-if="courseCode" class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div class="flex items-center gap-2">
              <span class="text-sm opacity-70">{{ $t("course.members.courseCode.current") }}</span>
              <code class="bg-base-300 rounded px-3 py-1 font-mono text-lg">{{ courseCode }}</code>
              <button
                class="btn btn-sm btn-ghost"
                @click="copyCourseCode"
                :title="$t('course.members.courseCode.copy')"
              >
                <i-uil-copy />
              </button>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-primary" @click="generateCourseCode">
                <i-uil-refresh /> {{ $t("course.members.courseCode.regenerate") }}
              </button>
              <button class="btn btn-sm btn-error btn-outline" @click="removeCourseCode">
                <i-uil-trash-alt /> {{ $t("course.members.courseCode.remove") }}
              </button>
            </div>
          </div>

          <div v-else class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <span class="text-sm opacity-70">{{ $t("course.members.courseCode.none") }}</span>
            <button class="btn btn-sm btn-primary" @click="generateCourseCode">
              <i-uil-plus /> {{ $t("course.members.courseCode.generate") }}
            </button>
          </div>

          <div v-if="courseCodeError" class="alert alert-error mt-2 py-2">
            <i-uil-exclamation-triangle />
            <span>{{ courseCodeError }}</span>
          </div>
        </div>

        <div class="mb-4">
          <div class="form-control w-full max-w-xs">
            <label class="label">
              <span class="label-text">{{ $t("course.members.sortBy") }}</span>
            </label>
            <select v-model="sortBy" class="select-bordered select w-full max-w-xs">
              <option :value="MemberTableColumn.USERNAME">{{ $t("course.members.optionUsername") }}</option>
              <option :value="MemberTableColumn.DISPLAYED_NAME">
                {{ $t("course.members.optionDisplayName") }}
              </option>
              <option :value="MemberTableColumn.ROLE">{{ $t("course.members.optionRole") }}</option>
            </select>
          </div>
        </div>
        <data-status-wrapper :error="error as AxiosError" :is-loading="isLoading">
          <template #loading>
            <skeleton-table :col="3" :row="5" />
          </template>
          <template #data>
            <!-- Role change error message -->
            <div v-if="roleChangeError" class="alert alert-error mb-4 py-2">
              <i-uil-exclamation-triangle />
              <span>{{ roleChangeError }}</span>
              <button class="btn btn-sm btn-ghost" @click="roleChangeError = ''">×</button>
            </div>

            <!-- Remove error message -->
            <div v-if="removeError" class="alert alert-error mb-4 py-2">
              <i-uil-exclamation-triangle />
              <span>{{ removeError }}</span>
              <button class="btn btn-sm btn-ghost" @click="removeError = ''">×</button>
            </div>

            <table class="table w-full">
              <thead>
                <tr>
                  <th>{{ $t("course.members.tableUsername") }}</th>
                  <th>{{ $t("course.members.tableDisplayedName") }}</th>
                  <th>{{ $t("course.members.tableRole") }}</th>
                  <th v-if="canChangeRoles">{{ $t("course.members.tableCourseRole") }}</th>
                  <th v-if="canChangeRoles">{{ $t("course.members.tableActions") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in members" :key="member.username" class="hover">
                  <td>{{ member.username }}</td>
                  <td>{{ member.displayedName }}</td>
                  <td>{{ ROLE[member.role] }}</td>
                  <td v-if="canChangeRoles">
                    <template v-if="getCourseRole(member) === 'teacher'">
                      <span class="badge badge-primary">{{ $t("course.members.roleTeacher") }}</span>
                    </template>
                    <template v-else>
                      <div class="flex h-10 items-center gap-2">
                        <template v-if="roleChangeLoading === member.username">
                          <span class="loading loading-spinner loading-sm text-primary"></span>
                        </template>

                        <select
                          v-else
                          class="select select-bordered select-sm w-32"
                          :value="getCourseRole(member)"
                          @change="
                            handleRoleChange(
                              member,
                              ($event.target as HTMLSelectElement).value as 'student' | 'ta',
                            )
                          "
                        >
                          <option value="student">{{ $t("course.members.roleStudent") }}</option>
                          <option value="ta">{{ $t("course.members.roleTA") }}</option>
                        </select>
                      </div>
                    </template>
                  </td>
                  <td v-if="canChangeRoles">
                    <template v-if="getCourseRole(member) !== 'teacher'">
                      <button
                        class="btn btn-sm btn-ghost btn-error"
                        :disabled="removingMember === member.username"
                        @click="openRemoveConfirmDialog(member)"
                        :title="$t('course.members.removeMember')"
                      >
                        <template v-if="removingMember === member.username">
                          <span class="loading loading-spinner loading-xs"></span>
                        </template>
                        <template v-else>
                          <i-uil-trash-alt />
                        </template>
                      </button>
                    </template>
                  </td>
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

    <!-- Remove Member Confirm Dialog -->
    <div v-if="showRemoveConfirmDialog" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">{{ $t("course.members.removeConfirmTitle") }}</h3>
        <p class="py-4">
          {{ $t("course.members.confirmRemove", { username: memberToRemove?.username }) }}
        </p>
        <div v-if="removeError" class="alert alert-error mb-4">
          <i-uil-exclamation-triangle />
          <span>{{ removeError }}</span>
        </div>
        <div class="modal-action">
          <button class="btn btn-error" @click="confirmRemoveMember" :disabled="removingMember !== null">
            <span v-if="removingMember !== null" class="loading loading-spinner loading-sm"></span>
            {{ $t("course.members.confirmButton") }}
          </button>
          <button class="btn btn-ghost" @click="closeRemoveConfirmDialog" :disabled="removingMember !== null">
            {{ $t("course.members.cancel") }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeRemoveConfirmDialog"></div>
    </div>
  </div>
</template>
