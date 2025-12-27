export const INVISIBLE_RE = new RegExp("\\p{C}|\\u00A0|\\u200B|\\u200C|\\u200D|\\u2060|\\uFEFF", "u");

export function containsInvisible(value: unknown): boolean {
  return typeof value === "string" && INVISIBLE_RE.test(value);
}
