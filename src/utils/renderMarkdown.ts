import DOMPurify from "dompurify";
import tm from "markdown-it-texmath";
import markdownIt from "markdown-it";
import type MarkdownIt from "markdown-it";
import katex from "katex";
import hljs from "highlight.js";
import slugify from "./slugify";

// Lightweight anchor plugin to avoid external dependency issues.
const addHeadingAnchors = (md: MarkdownIt) => {
  md.core.ruler.push("heading_anchor", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "heading_open") continue;
      const titleToken = tokens[i + 1];
      if (!titleToken || titleToken.type !== "inline") continue;
      const title = titleToken.content || "";
      const id = slugify(title);
      if (!id) continue;
      tokens[i].attrSet("id", id);
    }
    return false;
  });
};

const md = markdownIt({
  html: false,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, { language: lang }).value;
    }
    return str;
  },
})
  .use(tm, {
    engine: katex,
    delimiters: "dollars",
    katexOptions: { macros: { "\\RR": "\\mathbb{R}" } },
  })
  .use(addHeadingAnchors);

export default function renderMarkdown(markdown: string): string {
  return DOMPurify.sanitize(md.render(markdown));
}
