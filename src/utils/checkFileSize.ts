import { MAX_UPLOAD_SIZE_MB, MAX_UPLOAD_SIZE_BYTES } from "@/constants";

export function assertFileSizeOK(file: File, label = "File"): boolean {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    window.alert(`${label} '${file.name}' exceeds ${MAX_UPLOAD_SIZE_MB} MB (1 GB) limit.`);
    return false;
  }
  return true;
}
