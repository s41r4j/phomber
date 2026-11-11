import { renderCatalog } from "./catalog-pages.js";
import type { Profile, CatalogArticle } from "../catalog/index.js";
import { renderBiography } from "./article.js";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { atomicFile, atomicJSON, Workspace } from "../workspace/index.js";
import type { Investigation, IndexEntry } from "../core/types.js";
import {
  renderWikiNodes,
  wikiText,
  wikiSummary,
  wikiHeadings,
  emptyLibrary,
  type WikiLibrary,
  type WikiArticle,
} from "./library.js";
import {
  escape,
  link,
  page,
  appearance,
  titleRow,
  researchMeta,
  style,
  script,
  csp,
} from "./shell.js";
export {
  escape,
  link,
  page,
  appearance,
  titleRow,
  researchMeta,
  style,
  script,
  csp,
} from "./shell.js";
export function renderReport(inv: Investigation): string {
  return renderBiography(inv);
}
export function renderArchive(
  article: WikiArticle,
  library: WikiLibrary,
  historyURL?: string,
): string {
  const headings = wikiHeadings(article.nodes);
  const versions = library.articles.filter(
    (a) =>
      a.id.startsWith(article.id.split("-wikipedia")[0]!) &&
      a.id !== article.id,
  );
  return page(
    article.title,
    `<div class="page-grid"><nav class="contents" aria-label="Contents"><div class="side-title">Contents</div><a href="#content">(Top)</a>${headings.map((h) => `<a href="#${escape(h.id)}">${escape(h.title)}</a>`).join("")}<a href="#archive-information">Archive information</a><p class="muted">Navigation</p><a href="/">Main page</a><a href="/articles/">All articles</a></nav><main class="article" id="content">${titleRow(article.title, "Archived article", undefined, "/wiki/" + article.id + "/info/")}<p class="subtitle">From PH0MBER Wiki, the local research encyclopedia</p>${historyURL ? `<p class="hatnote"><a href="${escape(historyURL)}">View all versions and organize this profile →</a></p>` : ""}<div class="notice">This is a previously authored wiki from your People Wiki Collection. Its claims and references are preserved as historical material and have not been independently reverified by Gen2.</div>${versions.length ? `<p class="hatnote">Other versions: ${versions.map((a) => `<a href="/wiki/${a.id}/">${escape(a.id.includes("v3") ? "Version 3" : a.id.includes("v2") ? "Version 2" : a.id.includes("whoami") ? "Whoami design" : "Original")}</a>`).join(" · ")}</p>` : ""}<div class="archive-content">${renderWikiNodes(article.nodes)}</div><section id="archive-information"><h2>Archive information and metadata</h2><table class="wikitable"><tbody><tr><th>Research provider / model</th><td>Not recorded in the imported archive</td></tr><tr><th>Research start / completion / duration</th><td>Not recorded. Original source retrieval dates remain in the references.</td></tr><tr><th>API tokens / cost</th><td>Not recorded. This does not imply zero cost.</td></tr><tr><th>Original file</th><td>${escape(article.filename)}</td></tr><tr><th>Collection</th><td>PHOMBER People Wikis Collection</td></tr><tr><th>SHA-256</th><td><code>${escape(article.sha256)}</code></td></tr><tr><th>Verification</th><td>Original file checksum matched the collection manifest. This verifies file integrity, not biographical claims.</td></tr></tbody></table></section><div class="categories">Categories: Archived people profiles · User-provided research · Historical wiki collection</div><footer class="page-meta" id="page-information">Local archive page. Original external scripts, forms and remote images are not executed or loaded. Inline raster portraits are retained when present.<br>Original HTML remains in the project's references folder.</footer></main>${appearance()}</div>`,
  );
}
export function renderDashboard(
  entries: IndexEntry[],
  library: WikiLibrary = emptyLibrary(),
): string {
  const articles: CatalogArticle[] = [
    ...entries.map((e) => ({
      key: "report:" + e.id,
      id: e.id,
      title: e.name,
      kind: "research" as const,
      url: "/reports/" + e.id + "/",
      keys: [],
      text: e.search_text || e.name,
      date: e.updated_at,
      started: e.research_started_at,
      finished: e.research_finished_at,
      status: e.status,
      source_count: e.source_count,
    })),
    ...library.articles.map((a) => ({
      key: "archive:" + a.id,
      id: a.id,
      title: a.title,
      kind: "archive" as const,
      url: "/wiki/" + a.id + "/",
      keys: [],
      text: wikiText(a.nodes),
      status: "Archived wiki",
      source_count: 0,
      archive: a,
    })),
  ];
  const profiles: Profile[] = articles
    .map((a, i) => {
      const digest = createHash("sha256")
          .update(a.key)
          .digest("hex")
          .slice(0, 32),
        id =
          "profile-" +
          [
            digest.slice(0, 8),
            digest.slice(8, 12),
            digest.slice(12, 16),
            digest.slice(16, 20),
            digest.slice(20),
          ].join("-");
      a.profile_id = id;
      a.version = 1;
      return { id, title: a.title, keys: [], first_seen_at: "", articles: [a] };
    })
    .sort((a, b) =>
      (b.articles[0]?.date || "").localeCompare(a.articles[0]?.date || ""),
    );
  return renderCatalog(profiles, true);
}
export async function writeReport(
  inv: Investigation,
  workspace: Workspace,
): Promise<string> {
  if (inv.ai?.status === "complete")
    inv.warnings = inv.warnings.map((w) =>
      w.startsWith("AI research incomplete:")
        ? "Earlier AI output failed validation; narrative was subsequently regenerated from the same evidence."
        : w,
    );
  const path = await workspace.save(inv);
  for (const [name, data] of Object.entries({
    profile: inv,
    sources: inv.sources,
    evidence: inv.evidence,
    connections: inv.connections,
    timeline: inv.timeline,
    usage: inv.usage || {},
  }))
    await atomicJSON(join(path, name + ".json"), data);
  await atomicFile(join(path, "index.html"), renderReport(inv));
  await workspace.updateIndex();
  return path;
}
