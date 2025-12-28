import { hover_en } from "./hover-en";
import { hover_zh } from "./hover-zh-tw";
import { hover_taiwanese } from "./hover-zh-min-nan";

export { hover_en, hover_zh, hover_taiwanese };

export const getHoverTranslations = (locale: string) => {
  if (locale === "english") return hover_en;
  if (locale === "taiwanese") return hover_taiwanese;
  return hover_zh;
};
