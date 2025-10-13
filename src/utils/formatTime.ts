import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/zh-tw";

export const formatTime = (time: number | string | null | undefined) => {
  if (!time) {
    return "N/A";
  }

  if (typeof time === "number") {
    if (time === 0) return "N/A";
    return dayjs(time * 1000).format("YYYY-MM-DD HH:mm");
  }

  const date = dayjs(time);
  if (!date.isValid()) {
    return "N/A";
  }

  return date.format("YYYY-MM-DD HH:mm");
};