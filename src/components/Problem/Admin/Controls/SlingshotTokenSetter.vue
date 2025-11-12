<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

// ===== Types =====
interface Point {
  x: number;
  y: number;
}
interface Velocity {
  x: number;
  y: number;
}

// ===== Emits =====
const emits = defineEmits<{
  (e: "update:maxToken", value: number): void;
}>();

// ===== Constants =====
const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 250;
const GROUND_Y = 210;
const SLING_BASE_X = 60;
const SLING_HEIGHT = 50;
const SLING_TOP_Y = GROUND_Y - SLING_HEIGHT;
const SLING_ORIGIN: Point = { x: SLING_BASE_X, y: SLING_TOP_Y };
const PROJECTILE_RADIUS = 7;
const MAX_PULL_DISTANCE = 90;
const GRAVITY = 0.6;
const LAUNCH_FORCE_MULTIPLIER = 2;
const MAX_TOKEN = 4096;
const TRAJECTORY_POINTS = 30;
const DRAG_SENSITIVITY = 0.6;
const METEOR_RADIUS = 20;

// ===== State =====
const canvas = ref<HTMLCanvasElement | null>(null);
const isDragging = ref(false);
const isFlying = ref(false);
const pullPosition = ref<Point>({ ...SLING_ORIGIN });
const projectilePosition = ref<Point>({ ...SLING_ORIGIN });
const velocity = ref<Velocity>({ x: 0, y: 0 });
const trajectoryPoints = ref<Point[]>([]);
let animationFrameId = 0;
let autoReturnTimer: number | null = null;
let landTime = 0;

// ===== Draw Functions =====
function drawGround(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
  ctx.stroke();
}

function drawSlingFrame(ctx: CanvasRenderingContext2D) {
  const armWidth = 10;
  const forkWidth = 14;
  const baseWidth = 20;
  const baseHeight = 8;
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.moveTo(SLING_BASE_X - baseWidth / 2, GROUND_Y);
  ctx.lineTo(SLING_BASE_X + baseWidth / 2, GROUND_Y);
  ctx.lineTo(SLING_BASE_X + armWidth / 2, GROUND_Y - baseHeight);
  ctx.lineTo(SLING_BASE_X - armWidth / 2, GROUND_Y - baseHeight);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // 左柱
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.moveTo(SLING_BASE_X - armWidth / 2, GROUND_Y - baseHeight);
  ctx.quadraticCurveTo(
    SLING_BASE_X - armWidth / 2 - 3,
    (GROUND_Y - baseHeight + SLING_TOP_Y) / 2,
    SLING_BASE_X - forkWidth / 2,
    SLING_TOP_Y,
  );
  ctx.lineTo(SLING_BASE_X - forkWidth / 2 + 2, SLING_TOP_Y);
  ctx.closePath();
  ctx.fill();

  // 右柱
  ctx.beginPath();
  ctx.moveTo(SLING_BASE_X + armWidth / 2, GROUND_Y - baseHeight);
  ctx.quadraticCurveTo(
    SLING_BASE_X + armWidth / 2 + 3,
    (GROUND_Y - baseHeight + SLING_TOP_Y) / 2,
    SLING_BASE_X + forkWidth / 2,
    SLING_TOP_Y,
  );
  ctx.lineTo(SLING_BASE_X + forkWidth / 2 - 2, SLING_TOP_Y);
  ctx.closePath();
  ctx.fill();

  // 叉頭小圓
  ctx.beginPath();
  ctx.arc(SLING_BASE_X - forkWidth / 2 + 1, SLING_TOP_Y, 3.5, 0, 2 * Math.PI);
  ctx.arc(SLING_BASE_X + forkWidth / 2 - 1, SLING_TOP_Y, 3.5, 0, 2 * Math.PI);
  ctx.fill();
}

function drawElastic(ctx: CanvasRenderingContext2D) {
  const stonePos = isDragging.value ? pullPosition.value : SLING_ORIGIN;
  const forkOffset = 5;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(SLING_BASE_X - forkOffset, SLING_TOP_Y);
  ctx.lineTo(stonePos.x, stonePos.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(SLING_BASE_X + forkOffset, SLING_TOP_Y);
  ctx.lineTo(stonePos.x, stonePos.y);
  ctx.stroke();
}

function drawTrajectory(ctx: CanvasRenderingContext2D) {
  if (!isDragging.value || trajectoryPoints.value.length === 0) return;

  ctx.strokeStyle = "rgba(255, 0, 0, 0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();

  trajectoryPoints.value.forEach((point, i) => {
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });

  ctx.stroke();
  ctx.setLineDash([]);

  // 繪製軌跡點
  trajectoryPoints.value.forEach((point, i) => {
    if (i % 3 === 0) {
      const alpha = 1 - (i / trajectoryPoints.value.length) * 0.7;
      ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

function calculateTrajectory() {
  if (!isDragging.value) {
    trajectoryPoints.value = [];
    return;
  }

  const vx = (SLING_ORIGIN.x - pullPosition.value.x) / LAUNCH_FORCE_MULTIPLIER;
  const vy = (SLING_ORIGIN.y - pullPosition.value.y) / LAUNCH_FORCE_MULTIPLIER;

  const points: Point[] = [];
  let px = SLING_ORIGIN.x;
  let py = SLING_ORIGIN.y;
  let pvx = vx;
  let pvy = vy;

  const ground = GROUND_Y - PROJECTILE_RADIUS;

  for (let i = 0; i < TRAJECTORY_POINTS; i++) {
    px += pvx;
    py += pvy;
    pvy += GRAVITY;

    if (py >= ground || px < 0 || px > CANVAS_WIDTH) break;
    if (py <= PROJECTILE_RADIUS) break;

    points.push({ x: px, y: py });
  }

  trajectoryPoints.value = points;
}

function drawProjectile(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(projectilePosition.value.x, projectilePosition.value.y, PROJECTILE_RADIUS, 0, 2 * Math.PI);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawMeteor(ctx: CanvasRenderingContext2D, meteorState: any) {
  if (!meteorState.active) return;

  // 隕石本體
  ctx.save();
  ctx.shadowColor = "rgba(255, 100, 0, 0.8)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#8B4513";
  ctx.beginPath();
  ctx.arc(meteorState.x, meteorState.y, METEOR_RADIUS, 0, 2 * Math.PI);
  ctx.fill();

  // 隕石細節
  ctx.fillStyle = "#654321";
  ctx.beginPath();
  ctx.arc(meteorState.x - 5, meteorState.y - 5, 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(meteorState.x + 4, meteorState.y + 3, 4, 0, 2 * Math.PI);
  ctx.fill();

  // 火焰尾巴
  const flameLength = meteorState.vy * 3;
  const gradient = ctx.createLinearGradient(
    meteorState.x,
    meteorState.y - METEOR_RADIUS,
    meteorState.x,
    meteorState.y - METEOR_RADIUS - flameLength,
  );
  gradient.addColorStop(0, "rgba(255, 150, 0, 0.8)");
  gradient.addColorStop(0.5, "rgba(255, 100, 0, 0.4)");
  gradient.addColorStop(1, "rgba(255, 50, 0, 0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(meteorState.x, meteorState.y - METEOR_RADIUS);
  ctx.lineTo(meteorState.x - 15, meteorState.y - METEOR_RADIUS - flameLength);
  ctx.lineTo(meteorState.x + 15, meteorState.y - METEOR_RADIUS - flameLength);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, meteorState?: any) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawGround(ctx);
  drawSlingFrame(ctx);
  drawTrajectory(ctx);
  drawElastic(ctx);
  if (meteorState) {
    drawMeteor(ctx, meteorState);
  }
  drawProjectile(ctx);
}

// ===== Helpers =====
function getCanvasPoint(e: MouseEvent): Point {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function constrainPullDistance(point: Point): Point {
  const dx = point.x - SLING_ORIGIN.x;
  const dy = point.y - SLING_ORIGIN.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= MAX_PULL_DISTANCE) return point;
  const s = MAX_PULL_DISTANCE / dist;
  return { x: SLING_ORIGIN.x + dx * s, y: SLING_ORIGIN.y + dy * s };
}
function isPointNearProjectile(p: Point): boolean {
  const d = Math.hypot(p.x - projectilePosition.value.x, p.y - projectilePosition.value.y);
  return d < 20;
}
function calculateTokenValue(x: number) {
  const ratio = Math.max(0, Math.min(1, x / CANVAS_WIDTH));
  return Math.floor(ratio * MAX_TOKEN);
}

// ===== Mouse / Touch Handlers =====
function handlePointerDown(e: MouseEvent) {
  if (isFlying.value) return;
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  if (isPointNearProjectile(p)) {
    isDragging.value = true;
  }
}

function handlePointerMove(e: MouseEvent) {
  if (!isDragging.value || !canvas.value) return;
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const dx = (p.x - SLING_ORIGIN.x) * DRAG_SENSITIVITY;
  const dy = (p.y - SLING_ORIGIN.y) * DRAG_SENSITIVITY;
  const adj = constrainPullDistance({ x: SLING_ORIGIN.x + dx, y: SLING_ORIGIN.y + dy });
  pullPosition.value = adj;
  projectilePosition.value = adj;
  calculateTrajectory();
  const ctx = canvas.value.getContext("2d")!;
  ctx && render(ctx);
}

function handlePointerUp() {
  if (!isDragging.value) return;
  isDragging.value = false;

  velocity.value = {
    x: (SLING_ORIGIN.x - pullPosition.value.x) / LAUNCH_FORCE_MULTIPLIER,
    y: (SLING_ORIGIN.y - pullPosition.value.y) / LAUNCH_FORCE_MULTIPLIER,
  };
  projectilePosition.value = { ...SLING_ORIGIN };
  trajectoryPoints.value = [];
  startFlightAnimation();
}

// ===== Flight Animation =====
function startFlightAnimation() {
  if (!canvas.value) return;
  const ctx = canvas.value!.getContext("2d")!;
  if (!ctx) return;
  isFlying.value = true;
  cancelAnimationFrame(animationFrameId);

  const ground = GROUND_Y - PROJECTILE_RADIUS;
  const top = PROJECTILE_RADIUS;

  const shockwaves: { r: number; active: boolean; alpha: number }[] = [];
  const particles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];
  const cracks: { x: number; y: number; angle: number; length: number; alpha: number }[] = [];
  const meteorState = { active: false, x: 0, y: 0, vy: 0 };
  let shake = 0;
  let flash = 0;

  function drawImpact() {
    // 閃光效果
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flash})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      flash -= 0.1;
    }

    // 地面裂痕
    cracks.forEach((crack) => {
      ctx.strokeStyle = `rgba(0, 0, 0, ${crack.alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(crack.x, crack.y);
      ctx.lineTo(
        crack.x + Math.cos(crack.angle) * crack.length,
        crack.y + Math.sin(crack.angle) * crack.length,
      );
      ctx.stroke();
      crack.alpha -= 0.01;
    });

    // 震波
    shockwaves.forEach((s) => {
      if (!s.active) return;
      ctx.strokeStyle = `rgba(0, 0, 0, ${s.alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(projectilePosition.value.x, ground, s.r, 0, 2 * Math.PI);
      ctx.stroke();
      s.r += 5;
      s.alpha -= 0.02;
      if (s.alpha <= 0) s.active = false;
    });

    // 粒子效果
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.vx *= 0.98;
      p.life -= 0.015;

      const alpha = Math.max(0, p.life);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
      ctx.fill();
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
  }

  function animate() {
    projectilePosition.value.x += velocity.value.x;
    projectilePosition.value.y += velocity.value.y;
    velocity.value.y += GRAVITY;

    if (projectilePosition.value.y <= top) {
      projectilePosition.value.y = top;
      velocity.value.y = Math.abs(velocity.value.y) * 0.5;
    }

    if (
      projectilePosition.value.y >= ground ||
      projectilePosition.value.x < 0 ||
      projectilePosition.value.x > CANVAS_WIDTH
    ) {
      projectilePosition.value.y = ground;
      projectilePosition.value.x = Math.max(0, Math.min(CANVAS_WIDTH, projectilePosition.value.x));
      velocity.value = { x: 0, y: 0 };
      isFlying.value = false;

      // 記錄落地、啟動5秒計時
      landTime = Date.now();
      if (autoReturnTimer) clearTimeout(autoReturnTimer);
      autoReturnTimer = window.setTimeout(() => {
        resetToInitialState();
        if (canvas.value) {
          const ctx2 = canvas.value.getContext("2d");
          ctx2 && render(ctx2);
        }
      }, 5000);

      // 震撼特效加強
      flash = 0.5;
      shake = 10;

      // 更多粒子
      for (let i = 0; i < 80; i++) {
        const a = Math.random() * Math.PI;
        const s = 2 + Math.random() * 6;
        particles.push({
          x: projectilePosition.value.x,
          y: ground - 4,
          vx: Math.cos(a) * s,
          vy: -Math.sin(a) * s - 2,
          life: 0.9 + Math.random() * 0.5,
          size: 2 + Math.random() * 3,
        });
      }

      // 多個震波
      shockwaves.push({ r: 5, active: true, alpha: 0.8 });
      setTimeout(() => shockwaves.push({ r: 5, active: true, alpha: 0.6 }), 50);
      setTimeout(() => shockwaves.push({ r: 5, active: true, alpha: 0.4 }), 100);

      // 地面裂痕
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 8) * i + Math.random() * 0.3;
        cracks.push({
          x: projectilePosition.value.x,
          y: ground,
          angle: angle,
          length: 20 + Math.random() * 25,
          alpha: 0.6,
        });
      }

      const token = calculateTokenValue(projectilePosition.value.x);
      emits("update:maxToken", token);

      const impactAnimate = () => {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (shake > 0) {
          const ox = (Math.random() - 0.5) * shake;
          const oy = (Math.random() - 0.5) * shake;
          ctx.save();
          ctx.translate(ox, oy);
          shake *= 0.85;
        }
        drawGround(ctx);
        drawSlingFrame(ctx);
        drawElastic(ctx);
        drawProjectile(ctx);
        drawImpact();
        if (shake > 0.1 || shockwaves.some((s) => s.active) || particles.length > 0 || flash > 0) {
          requestAnimationFrame(impactAnimate);
        } else {
          ctx.restore?.();
          setTimeout(() => {
            // 若過5秒定時器已觸發，不重置
            if (Date.now() - landTime < 4800) {
              resetToInitialState();
              render(ctx);
            }
          }, 400);
        }
        ctx.restore?.();
      };
      impactAnimate();
      return;
    }

    render(ctx);
    animationFrameId = requestAnimationFrame(animate);
  }
  animate();
}

function resetToInitialState() {
  pullPosition.value = { ...SLING_ORIGIN };
  projectilePosition.value = { ...SLING_ORIGIN };
  velocity.value = { x: 0, y: 0 };
  trajectoryPoints.value = [];
  if (autoReturnTimer) {
    clearTimeout(autoReturnTimer);
    autoReturnTimer = null;
  }
}

// ===== Hooks =====
onMounted(() => {
  if (!canvas.value) return;
  const ctx = canvas.value!.getContext("2d")!;
  ctx && render(ctx);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId);
  if (autoReturnTimer) clearTimeout(autoReturnTimer);
});
</script>

<template>
  <canvas
    ref="canvas"
    :width="CANVAS_WIDTH"
    :height="CANVAS_HEIGHT"
    class="cursor-crosshair select-none"
    style="
      display: block;
      background: transparent;
      touch-action: none;
      user-select: none;
      width: 300px;
      height: 250px;
      position: relative;
      z-index: 10;
    "
    @mousedown.stop.prevent="handlePointerDown"
    @mousemove.stop.prevent="handlePointerMove"
    @mouseup.stop.prevent="handlePointerUp"
    @mouseleave="handlePointerUp"
  />
</template>
