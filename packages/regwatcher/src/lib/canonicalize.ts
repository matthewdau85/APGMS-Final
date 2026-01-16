import * as cheerio from "cheerio";

/**
 * Convert HTML to a stable, low-noise text form:
 * - drop script/style/noscript
 * - drop nav/footer/aside where obvious
 * - collapse whitespace
 * - keep headings and main text content order
 */
export function htmlToCanonicalText(html: string): string {
  const $ = cheerio.load(html, { decodeEntities: true });

  // Remove noise
  $("script, style, noscript, template, iframe, object, embed").remove();
  $("nav, footer, aside, [aria-hidden='true']").remove();

  // Remove comments
  $("*")
    .contents()
    .each(function () {
      if (this.type === "comment") this.data = "";
    });

  // Extract visible text with simple separators for block elements
  const blockTags = new Set([
    "p",
    "div",
    "section",
    "article",
    "header",
    "main",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "ul",
    "ol",
    "table",
    "tr",
    "td",
    "th",
    "dl",
    "dt",
    "dd"
  ]);

  function walk(el: cheerio.Element, out: string[]) {
    if (el.type === "text" && el.data) {
      out.push(el.data);
      return;
    }
    if (!("name" in el) || !el.name) {
      if ("children" in el && el.children) el.children.forEach((c) => walk(c as any, out));
      return;
    }
    if (blockTags.has(el.name)) out.push("\n");
    if ("children" in el && el.children) el.children.forEach((c) => walk(c as any, out));
    if (blockTags.has(el.name)) out.push("\n");
  }

  const out: string[] = [];
  walk($("body")[0] || $.root()[0], out);

  // Collapse whitespace and join
  const text = out.join(" ");
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
