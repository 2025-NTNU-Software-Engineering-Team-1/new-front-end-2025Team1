<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { fetcher } from "@/models/api";
import { useSession } from "@/stores/session";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { getCourseColor, getCourseEmoji } from "@/utils/courseAppearance";
import CourseAvatar from "@/components/Course/CourseAvatar.vue";

dayjs.extend(relativeTime);

const session = useSession();

// ---- Data & State ----
const courses = ref<CourseList>([]);
const homeworksRaw = ref<{ courseName: string; hw: HomeworkListItem }[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

// ---- Fetch Logic ----
async function fetchData() {
  isLoading.value = true;
  error.value = null;
  courses.value = [];
  homeworksRaw.value = [];

  try {
    // 1. Get Courses
    const { data: courseData } = await fetcher.get<CourseList>("/course");

    // [DEBUG] Log the fetched course list to inspect the API response
    console.log("=== [1] API Response: Course List ===", courseData);

    courses.value = courseData;

    // 2. Get Homeworks for each course (Parallel)
    const hwPromises = courses.value.map(async (c) => {
      try {
        const { data: hwData } = await fetcher.get<HomeworkList>(`/course/${c.course}/homework`);

        // [DEBUG] Log the homework list fetched for a specific course
        console.log(`=== [2] API Response: Homework for ${c.course} ===`, hwData);

        return hwData.map((h) => ({
          courseName: c.course,
          hw: h,
        }));
      } catch (e) {
        console.error(`Failed to fetch homework for ${c.course}`, e);
        return [];
      }
    });

    const results = await Promise.all(hwPromises);
    const flattenedResults = results.flat();

    // [DEBUG] Log all aggregated homeworks before filtering logic
    console.log("=== [3] Aggregated Raw Homework Data ===", flattenedResults);

    homeworksRaw.value = flattenedResults;
  } catch (e: unknown) {
    console.error("Dashboard fetch error", e);
    error.value = e instanceof Error ? e.message : "Failed to load dashboard data";
  } finally {
    isLoading.value = false;
  }
}

// ---- Computed ----
const upcomingDeadlines = computed(() => {
  const now = dayjs().unix();
  const result = homeworksRaw.value
    .map((item) => ({
      ...item.hw,
      courseName: item.courseName,
    }))
    .filter((h) => h.end > now)
    .sort((a, b) => a.end - b.end)
    .slice(0, 5);

  // [DEBUG] Log the final computed deadlines (filtered, sorted, and sliced)
  // This helps verify if the filter logic (e.g. h.end > now) is working correctly
  console.log("=== [4] Computed: Upcoming Deadlines (Final Display) ===", result);

  return result;
});

// ---- Helpers ----
function formatTime(timestamp: number) {
  return dayjs.unix(timestamp).format("YYYY-MM-DD HH:mm");
}

function getRelativeTime(timestamp: number) {
  return dayjs.unix(timestamp).fromNow();
}

function getTimeStatus(timestamp: number) {
  const now = dayjs().unix();
  const diffHours = (timestamp - now) / 3600;
  return {
    urgent: diffHours < 24 && diffHours > 0,
    expired: diffHours < 0,
  };
}

// ---- Lifecycle ----
onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-base-content text-2xl font-bold">
          {{ $t("components.studentDashboard.welcome", { user: session.displayedName }) }}
        </h1>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div class="space-y-4 lg:col-span-3">
        <h2 class="text-base-content flex items-center gap-2 text-xl font-bold">
          <i-uil-clock />
          {{ $t("components.studentDashboard.upcomingDeadlines") }}
        </h2>

        <div v-if="isLoading" class="space-y-3">
          <skeleton-card />
        </div>

        <div v-else-if="upcomingDeadlines.length > 0" class="flex flex-col gap-3">
          <div
            v-for="h in upcomingDeadlines"
            :key="h.id"
            class="card bg-base-100 border-l-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            :style="{
              borderLeftColor: getCourseColor(
                h.courseName,
                courses.find((c) => c.course === h.courseName)?.color,
              ),
            }"
          >
            <div class="card-body p-4">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-xl font-bold">
                    <router-link
                      :to="`/course/${h.courseName}/homework/${h.id}`"
                      class="decoration-2 underline-offset-2 hover:underline"
                      :style="{
                        color: getCourseColor(
                          h.courseName,
                          courses.find((c) => c.course === h.courseName)?.color,
                        ),
                      }"
                    >
                      {{ h.name }}
                    </router-link>
                  </h3>
                  <p class="text-base-content/70 mt-1 flex items-center gap-1 text-xs">
                    <span
                      class="text-sm"
                      :style="{
                        color: getCourseColor(
                          h.courseName,
                          courses.find((c) => c.course === h.courseName)?.color,
                        ),
                      }"
                    >
                      {{
                        getCourseEmoji(h.courseName, courses.find((c) => c.course === h.courseName)?.emoji)
                      }}
                    </span>
                    {{ h.courseName }}
                  </p>
                </div>
                <div class="text-right">
                  <div
                    class="badge gap-1 border-0"
                    :class="
                      getTimeStatus(h.end).urgent
                        ? 'bg-error/10 text-error'
                        : 'bg-base-200 text-base-content/70'
                    "
                  >
                    <i-uil-clock class="h-3 w-3" />
                    {{ getRelativeTime(h.end) }}
                  </div>
                  <div class="text-base-content/60 mt-1 font-mono text-xs">
                    {{ formatTime(h.end) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="alert bg-base-100 border-base-200 border shadow-sm">
          <i-uil-check-circle class="text-success text-xl" />
          <div>
            <h3 class="text-base-content font-bold">
              {{ $t("components.studentDashboard.noPendingHomework") }}
            </h3>
            <div class="text-base-content/70 text-xs">
              {{ $t("components.studentDashboard.noPendingHomeworkDesc") }}
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4 lg:col-span-2">
        <h2 class="text-base-content flex items-center gap-2 text-xl font-bold">
          <i-uil-book-open />
          {{ $t("components.studentDashboard.myCourses") }}
        </h2>

        <div v-if="isLoading">
          <div class="skeleton mb-2 h-14 w-full" v-for="i in 3" :key="i"></div>
        </div>

        <div v-else-if="courses.length > 0" class="flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-2">
            <router-link
              v-for="c in courses"
              :key="c.course"
              :to="`/course/${c.course}`"
              class="card bg-base-100 border-base-200 group border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div class="card-body flex flex-row items-center gap-3 p-4">
                <course-avatar
                  :course-name="c.course"
                  :course-color="c.color"
                  :course-emoji="c.emoji"
                  size="md"
                  class="group-hover:scale-110"
                />
                <div class="min-w-0">
                  <h3 class="group-hover:text-primary truncate text-base font-bold transition-colors">
                    {{ c.course }}
                  </h3>
                  <p class="text-base-content/60 truncate text-xs">
                    {{ c.teacher?.displayedName || c.teacher }}
                  </p>
                </div>
              </div>
            </router-link>
          </div>

          <router-link
            to="/courses"
            class="btn btn-ghost btn-sm btn-block text-base-content/70 mt-2 font-normal"
          >
            {{ $t("components.studentDashboard.viewAllCourses") }}
          </router-link>
        </div>

        <div v-else class="alert bg-base-100 shadow-sm">
          <div>
            <div class="text-base-content text-sm">{{ $t("components.studentDashboard.noCourses") }}</div>
            <router-link to="/courses" class="btn btn-sm btn-primary mt-2 w-full">
              {{ $t("components.studentDashboard.joinCourse") }}
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
