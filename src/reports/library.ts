import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Workspace } from "../workspace/index.js";
export interface WikiNode {
  tag?: string;
  text?: string;
  children?: WikiNode[];
  id?: string;
  class?: string;
  href?: string;
  src?: string;
  alt?: string;
  colspan?: string;
  rowspan?: string;
}
export interface WikiArticle {
  id: string;
  title: string;
  filename: string;
  sha256: string;
  nodes: WikiNode[];
}
export interface WikiLibrary {
  schema_version: "1.0";
  articles: WikiArticle[];
}
export const emptyLibrary = (): WikiLibrary => ({
  schema_version: "1.0",
  articles: [],
});
export function validateLibrary(value: unknown): WikiLibrary {
  const v = value as Partial<WikiLibrary>;
  if (
    !v ||
    v.schema_version !== "1.0" ||
    !Array.isArray(v.articles) ||
    v.articles.length > 500
  )
    throw new Error("Invalid wiki library.");
  let count = 0;
  function node(n: WikiNode, depth: number): void {
    if (!n || typeof n !== "object" || depth > 80 || ++count > 150000)
      throw new Error("Wiki library exceeds node limits.");
    for (const key of [
      "tag",
      "text",
      "id",
      "class",
      "href",
      "src",
      "alt",
      "colspan",
      "rowspan",
    ] as const)
      if (
        n[key] !== undefined &&
        (typeof n[key] !== "string" || n[key]!.length > 1_000_000)
      )
        throw new Error("Invalid wiki node.");
    if (n.children !== undefined) {
      if (!Array.isArray(n.children)) throw new Error("Invalid wiki children.");
      n.children.forEach((c) => node(c, depth + 1));
    }
  }
  const seen = new Set<string>();
  for (const article of v.articles) {
    if (
      !article ||
      !/^[-a-z0-9]{1,100}$/.test(article.id) ||
      seen.has(article.id) ||
      typeof article.title !== "string" ||
      article.title.length > 300 ||
      !Array.isArray(article.nodes) ||
      !/^[a-f0-9]{64}$/.test(article.sha256) ||
      typeof article.filename !== "string" ||
      !/^[-a-z0-9]+\.html$/.test(article.filename)
    )
      throw new Error("Invalid wiki article metadata.");
    seen.add(article.id);
    article.nodes.forEach((n) => node(n, 0));
  }
  return v as WikiLibrary;
}
export async function readLibrary(file: string): Promise<WikiLibrary> {
  if ((await stat(file)).size > 10_000_000)
    throw new Error("Wiki library exceeds 10 MB.");
  return validateLibrary(JSON.parse(await readFile(file, "utf8")));
}
export async function loadLibrary(workspace: Workspace): Promise<WikiLibrary> {
  for (const file of [
    join(workspace.root, "library.json"),
    new URL("../../references/library.json", import.meta.url),
  ]) {
    try {
      return await readLibrary(
        file instanceof URL ? fileURLToPath(file) : file,
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return emptyLibrary();
}
export function wikiText(nodes: WikiNode[]): string {
  const blocked = new Set([
    "script",
    "style",
    "noscript",
    "iframe",
    "object",
    "embed",
    "svg",
    "form",
  ]);
  return nodes
    .map((n) =>
      (n.tag && blocked.has(n.tag.toLowerCase())) ||
      n.id === "about-this-page" ||
      (n.class || "")
        .split(/\s+/)
        .some((c) =>
          [
            "article-tools",
            "tabs",
            "title-row",
            "article-header",
            "page-meta",
          ].includes(c),
        )
        ? ""
        : (n.text ?? wikiText(n.children || [])),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const tags = new Set([
  "p",
  "div",
  "section",
  "article",
  "aside",
  "h2",
  "h3",
  "h4",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "small",
  "span",
  "a",
  "sup",
  "sub",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "figure",
  "figcaption",
  "blockquote",
  "code",
  "pre",
  "dl",
  "dt",
  "dd",
  "br",
  "hr",
  "img",
  "details",
  "summary",
]);
const blocked = new Set([
  "script",
  "style",
  "noscript",
  "iframe",
  "object",
  "embed",
  "svg",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "h1",
]);
const classes = new Set([
  "infobox",
  "infobox-title",
  "infobox-subtitle",
  "infobox-image",
  "image-caption",
  "name-cell",
  "portrait-wrap",
  "portrait",
  "section-head",
  "wikitable",
  "reference",
  "references",
  "external-links",
  "columns",
  "hatnote",
  "lead",
  "project-grid",
  "project-card",
  "project-meta",
  "timeline",
  "timeline-item",
  "timeline-year",
  "source-note",
  "compact-list",
  "status-former",
  "nowrap",
  "categories",
  "page-meta",
]);
export function renderWikiNodes(nodes: WikiNode[]): string {
  return nodes
    .map((n) => {
      if (n.text !== undefined) return esc(n.text);
      const tag = (n.tag || "").toLowerCase();
      if (
        blocked.has(tag) ||
        n.id === "about-this-page" ||
        (n.class || "")
          .split(/\s+/)
          .some((c) =>
            [
              "article-tools",
              "tabs",
              "title-row",
              "article-header",
              "page-meta",
            ].includes(c),
          )
      )
        return "";
      const children = () => renderWikiNodes(n.children || []);
      if (!tags.has(tag)) return children();
      let attrs = "";
      if (n.id && /^[a-zA-Z][\w:.-]{0,100}$/.test(n.id))
        attrs += ` id="${esc(n.id)}"`;
      const klass = (n.class || "").split(/\s+/).filter((c) => classes.has(c));
      if (klass.length) attrs += ` class="${klass.join(" ")}"`;
      if (tag === "a" && n.href) {
        try {
          const u = new URL(n.href, "https://local.invalid");
          if (n.href.startsWith("#") && /^#[\w:.-]+$/.test(n.href))
            attrs += ` href="${esc(n.href)}"`;
          else if (
            ["https:", "http:"].includes(u.protocol) &&
            !u.username &&
            !u.password &&
            u.hostname !== "local.invalid"
          )
            attrs += ` href="${esc(u.href)}" target="_blank" rel="noopener noreferrer"`;
        } catch {}
      }
      if (tag === "img") {
        if (
          !n.src ||
          n.src.length > 1_000_000 ||
          !/^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(n.src)
        )
          return n.alt
            ? `<span class="image-omitted">${esc(n.alt)} — external image omitted</span>`
            : "";
        return `<img${attrs} src="${esc(n.src)}" alt="${esc(n.alt || "Archived profile image")}" loading="lazy">`;
      }
      for (const key of ["colspan", "rowspan"] as const)
        if (
          (tag === "td" || tag === "th") &&
          n[key] &&
          /^\d{1,2}$/.test(n[key]!)
        )
          attrs += ` ${key}="${n[key]}"`;
      return `<${tag}${attrs}>${tag === "br" || tag === "hr" ? "" : children() + `</${tag}>`}`;
    })
    .join("");
}
export function wikiHeadings(
  nodes: WikiNode[],
): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  function visit(list: WikiNode[]) {
    for (const n of list) {
      if (n.tag === "h2" && n.id && /^[a-zA-Z][\w:.-]{0,100}$/.test(n.id))
        out.push({ id: n.id, title: wikiText(n.children || []) });
      if (n.children) visit(n.children);
    }
  }
  visit(nodes);
  return out;
}

export function wikiSummary(nodes: WikiNode[]): string {
  const candidates: WikiNode[] = [];
  function visit(list: WikiNode[]) {
    for (const n of list) {
      if (
        (n.class || "")
          .split(/\s+/)
          .some((c) =>
            ["infobox", "notice", "hatnote", "article-tools", "tabs"].includes(
              c,
            ),
          ) ||
        n.id === "about-this-page"
      )
        continue;
      if (n.tag === "p" && wikiText(n.children || []).length > 140)
        candidates.push(n);
      else if (n.children) visit(n.children);
    }
  }
  visit(nodes);
  return wikiText(candidates[0]?.children || nodes);
}
