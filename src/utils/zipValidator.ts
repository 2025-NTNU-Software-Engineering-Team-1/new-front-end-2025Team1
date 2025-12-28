import { ZipReader, BlobReader } from "@zip.js/zip.js";

const MAC_SIGNATURES = {
  folders: ["__MACOSX", ".Trashes", ".fseventsd", ".Spotlight-V100", ".TemporaryItems"],
  files: [".DS_Store", ".localized"],
  prefixes: ["._"],
};

export async function isMacOsZip(file: File): Promise<boolean> {
  try {
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    await reader.close();

    for (const entry of entries) {
      const filename = entry.filename;
      const parts = filename.split("/").filter(Boolean);
      const basename = parts[parts.length - 1] || "";

      // 檢查資料夾名稱
      if (parts.some((part) => MAC_SIGNATURES.folders.includes(part))) {
        return true;
      }

      // 檢查檔案名稱
      if (MAC_SIGNATURES.files.includes(basename)) {
        return true;
      }

      // 檢查前綴
      if (MAC_SIGNATURES.prefixes.some((prefix) => basename.startsWith(prefix))) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("[isMacOsZip] Error reading zip file:", error);
    return false;
  }
}
