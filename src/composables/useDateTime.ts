/**
 * 日期時間格式化工具
 */

/**
 * 將 ISO 時間字串轉換為本地時間格式
 * @param isoString ISO 8601 格式的時間字串
 * @param format 格式選項：'full' | 'date' | 'time' | 'relative'
 * @returns 格式化後的時間字串
 */
export function formatDateTime(
  isoString: string,
  format: "full" | "date" | "time" | "relative" = "full",
): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);

    // 檢查是否為有效日期
    if (isNaN(date.getTime())) {
      return isoString;
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    // 相對時間格式
    if (format === "relative") {
      if (diffSeconds < 60) return "剛剛";
      if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;
      if (diffHours < 24) return `${diffHours} 小時前`;
      if (diffDays < 7) return `${diffDays} 天前`;
      // 超過一週顯示完整日期
      format = "full";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    if (format === "date") {
      return `${year}-${month}-${day}`;
    } else if (format === "time") {
      return `${hours}:${minutes}:${seconds}`;
    } else {
      // 'full' or default
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  } catch (error) {
    console.error("Error formatting date:", error);
    return isoString;
  }
}

/**
 * 將 ISO 時間字串轉換為相對時間描述
 * @param isoString ISO 8601 格式的時間字串
 * @returns 相對時間描述（如「5 分鐘前」）
 */
export function formatRelativeTime(isoString: string): string {
  return formatDateTime(isoString, "relative");
}

/**
 * 將 ISO 時間字串轉換為友好的顯示格式
 * @param isoString ISO 8601 格式的時間字串
 * @returns 友好的時間格式（當天顯示時間，非當天顯示日期+時間）
 */
export function formatFriendlyTime(isoString: string): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      // 今天只顯示時間
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `今天 ${hours}:${minutes}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `昨天 ${hours}:${minutes}`;
    }

    // 其他日期顯示完整格式
    return formatDateTime(isoString, "full");
  } catch (error) {
    console.error("Error formatting friendly time:", error);
    return isoString;
  }
}
