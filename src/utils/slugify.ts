export default function slugify(s: string): string {
  // Use raw string for UTF-8 support (Chinese headers).
  // Browsers support UTF-8 formatting in IDs.
  // We just trim and replace spaces.
  return String(s).trim().toLowerCase().replace(/\s+/g, "-");
}
