export const MORANDI_PALETTE = [
  "#B07D7D", // Muted Red
  "#C79E7E", // Muted Orange
  "#D9CD90", // Muted Yellow
  "#95A595", // Sage Green
  "#7D9494", // Muted Teal
  "#899AB0", // Dusty Blue
  "#787D96", // Muted Indigo
  "#9B8EA6", // Muted Purple
  "#BF9CA9", // Dusty Pink
  "#A6968B", // Warm Brown
  "#8F9983", // Olive Green
  "#9E9E9E", // Neutral Grey
];

export const RAINBOW_PALETTE = [
  "#E53E3E", // Red
  "#DD6B20", // Orange
  "#D69E2E", // Yellow
  "#38A169", // Green
  "#3182CE", // Blue
  "#805AD5", // Purple
  "#D53F8C", // Pink
  "#718096", // Gray
  "#2D3748", // Dark Gray
  "#000000", // Black
];

export const COURSE_EMOJIS = [
  "💻", "📚", "🔢", "🧪", "🧬", "⚡", "🎨", "🎵", 
  "📝", "📊", "📉", "📁", "🏫", "🎓", "📐", "🔬",
  "🧠", "🤖", "🌍", "🏛️", "⚖️", "💼", "💹", "🗣️"
];

// Deterministic Visual Generation
function getCourseHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Helper to get course color (backend > hash)
export function getCourseColor(courseName: string, backendColor?: string): string {
  if (backendColor) return backendColor;
  const hash = getCourseHash(courseName);
  return MORANDI_PALETTE[hash % MORANDI_PALETTE.length];
}

// Helper to get course emoji (backend > hash)
export function getCourseEmoji(courseName: string, backendEmoji?: string): string {
  if (backendEmoji) return backendEmoji;
  const hash = getCourseHash(courseName);
  return COURSE_EMOJIS[hash % COURSE_EMOJIS.length];
}
