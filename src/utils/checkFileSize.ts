import { MAX_UPLOAD_SIZE_MB, MAX_UPLOAD_SIZE_BYTES } from "@/constants";

/**
 * 驗證單一檔案是否超過限制，超過會 window.alert。
 */
export function assertFileSizeOK(file: File, label = "File"): boolean {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    window.alert(`${label} '${file.name}' exceeds ${MAX_UPLOAD_SIZE_MB} MB (1 GB) limit.`);
    return false;
  }
  return true;
}

/**
 * 驗證 AI VTuber AC 檔案群組：大小與副檔名。
 */
export function validateFilesForAIAC(files: File[], allowedExtensions: string[]): File[] {
  const valid: File[] = [];

  for (const f of files) {
    // 大小檢查
    if (!assertFileSizeOK(f, "AI VTuber AC file")) continue;

    // 副檔名檢查
    const allowed = allowedExtensions.some((ext) => f.name.endsWith(ext));
    if (!allowed) {
      window.alert(`Invalid file type '${f.name}'. Allowed extensions: ${allowedExtensions.join(", ")}`);
      continue;
    }

    valid.push(f);
  }

  if (valid.length === 0 && files.length > 0) {
    window.alert("No valid files uploaded.");
  }

  return valid;
}
