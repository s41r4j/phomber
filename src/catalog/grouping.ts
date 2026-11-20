import { assessFinding } from "../core/trust.js";
import type { CatalogArticle } from "./index.js";
import type { Social } from "../core/types.js";

export interface GroupingDecision {
  method: "automatic" | "manual" | "separate";
  reason: string;
}
export interface GroupingRules {
  assignments: Record<string, string>;
  manual: Record<string, boolean>;
  separations: [string, string][];
}
const normalized = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const alias: Record<string, string> = { twitter: "x", "twitter.com": "x", "x.com": "x", "github.com": "github", "gitlab.com": "gitlab", "instagram.com": "instagram", "linkedin.com": "linkedin", "dev.to": "dev", "huggingface.co": "huggingface", "bsky.app": "bluesky", "youtube.com": "youtube", "orcid.org": "orcid" };
const reserved = new Set(["p", "reel", "reels", "stories", "explore", "search", "login", "signup", "settings", "share", "watch", "shorts", "posts", "status", "about", "orgs", "topics"]);
function account(social: Social): { key: string; platform: string; handle: string } | undefined {
  let platform = alias[normalized(social.platform).replace(/^www\./, "")] || normalized(social.platform);
  let handle = social.username?.trim().replace(/^@/, "").toLowerCase();
  if (social.url) {
    try {
      const url = new URL(social.url);
      if (url.protocol !== "https:" || url.username || url.password || url.port) return;
      const host = url.hostname.replace(/^www\./, "");
      const actual = alias[host];
      if (!actual || (platform && platform !== actual && platform !== host)) return;
      platform = actual;
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const name = platform === "linkedin" && parts.length === 2 && parts[0] === "in" ? parts[1]
        : platform === "bluesky" && parts.length === 2 && parts[0] === "profile" ? parts[1]
        : parts.length === 1 ? parts[0] : undefined;
      if (!name || reserved.has(name.toLowerCase()) || (handle && handle !== name.replace(/^@/, "").toLowerCase())) return;
      handle = name.replace(/^@/, "").toLowerCase();
    } catch { return; }
  }
  if (!platform || !/^[a-z0-9.-]{1,60}$/.test(platform) || !handle || !/^[\p{L}\p{N}_.-]{1,150}$/u.test(handle) || reserved.has(handle)) return;
  return { key: `account:${platform}:${handle}`, platform, handle };
}
interface Signals { type: string; strong: Set<string>; weak: Set<string>; accounts: Map<string, Set<string>> }
function signals(article: CatalogArticle): Signals {
  const strong = new Set<string>(), accounts = new Map<string, Set<string>>(), context = new Set<string>();
  const add = (social: Social) => {
    const parsed = account(social); if (!parsed) return;
    strong.add(parsed.key);
    const values = accounts.get(parsed.platform) || new Set<string>(); values.add(parsed.handle); accounts.set(parsed.platform, values);
  };
  const fromURL = (url: string) => {
    try { const host = new URL(url).hostname.replace(/^www\./, ""); add({ platform: alias[host] || host, url }); } catch { /* Not an account URL. */ }
  };
  let name = "", type = "person";
  if (article.inv) {
    const inv = article.inv, subject = inv.input.subject;
    name = subject.name ? normalized(subject.name) : "";
    type = normalized(subject.type || "person");
    (subject.socials || []).forEach(add);
    for (const url of subject.websites || []) {
      fromURL(url);
      try { const parsed = new URL(url); if (parsed.protocol === "https:" && !parsed.username && !parsed.password) context.add("website:" + parsed.hostname.toLowerCase() + parsed.pathname.replace(/\/$/, "")); } catch {}
    }
    for (const value of subject.usernames || []) if (value.trim()) context.add("username:" + normalized(value.replace(/^@/, "")));
    for (const entry of subject.education || []) {
      const value = entry.institution || entry.school || entry.name;
      if (typeof value === "string" && value.trim()) context.add("education:" + normalized(value));
    }
    for (const company of [subject.professional?.company, ...(subject.professional?.companies || [])])
      if (company?.trim()) context.add("company:" + normalized(company));
    // A reviewed identity link may connect reports; unreviewed AI candidates cannot.
    for (const finding of inv.findings) {
      const assessment = assessFinding(inv, finding);
      if (assessment.identity === "matched" && assessment.review === "accepted") fromURL(finding.value);
    }
  } else if (article.archive) {
    name = normalized(article.title);
    const visit = (nodes: typeof article.archive.nodes, inBox = false) => {
      for (const node of nodes) {
        const inside = inBox || (node.class || "").split(/\s+/).includes("infobox");
        if (inside && node.tag === "a" && node.href) fromURL(node.href);
        if (node.children) visit(node.children, inside);
      }
    };
    visit(article.archive.nodes);
  }
  const weak = new Set(name ? [...context].filter(value => !/:(unknown|none|n\/a|not known)$/.test(value)).map(value => `${type}|name:${name}|${value}`) : []);
  return { type, strong, weak, accounts };
}
class Groups {
  parent: number[];
  constructor(size: number) { this.parent = Array.from({ length: size }, (_, i) => i); }
  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) root = this.parent[root]!;
    while (this.parent[i] !== i) { const next = this.parent[i]!; this.parent[i] = root; i = next; }
    return root;
  }
  join(a: number, b: number): void { const x = this.find(a), y = this.find(b); if (x !== y) this.parent[y] = x; }
  components(): number[][] {
    const result = new Map<number, number[]>();
    this.parent.forEach((_, i) => { const key = this.find(i); const list = result.get(key) || []; list.push(i); result.set(key, list); });
    return [...result.values()];
  }
}
export function groupArticles(articles: CatalogArticle[], rules: GroupingRules): { groups: CatalogArticle[][]; decisions: Record<string, GroupingDecision> } {
  const data = articles.map(signals), groups = new Groups(articles.length), ambiguous = new Set<number>();
  const blocked = new Set(rules.separations.map(pair => JSON.stringify([...pair].sort())));
  const manual = (i: number) => rules.manual[articles[i]!.key] ? rules.assignments[articles[i]!.key] : undefined;
  const compatible = (a: number, b: number) => {
    if (data[a]!.type !== data[b]!.type || blocked.has(JSON.stringify([articles[a]!.key, articles[b]!.key].sort()))) return false;
    const first = data[a]!, second = data[b]!;
    for (const [platform, values] of first.accounts) {
      const other = second.accounts.get(platform);
      if (other?.size && ![...values].some(value => other.has(value))) return false;
    }
    return true;
  };
  const pinned = new Map<string, number>();
  articles.forEach((_, i) => { const id = manual(i); if (id) { if (pinned.has(id)) groups.join(i, pinned.get(id)!); else pinned.set(id, i); } });
  const phase = (field: "strong" | "weak") => {
    const proposal = new Groups(articles.length);
    for (const component of groups.components()) for (const i of component) proposal.join(component[0]!, i);
    const buckets = new Map<string, number[]>();
    data.forEach((entry, i) => { for (const key of entry[field]) { const list = buckets.get(key) || []; list.push(i); buckets.set(key, list); } });
    for (const indexes of buckets.values()) {
      // Connect proposals first, then reject ambiguous bridges as a whole.
      for (const i of indexes) proposal.join(indexes[0]!, i);
    }
    for (const component of proposal.components()) {
      if (component.every(i => groups.find(i) === groups.find(component[0]!))) continue;
      const pinnedIDs = new Set(component.map(manual).filter(Boolean));
      let valid = pinnedIDs.size <= 1;
      for (let a = 0; valid && a < component.length; a++) for (let b = a + 1; b < component.length; b++) {
        if (groups.find(component[a]!) !== groups.find(component[b]!) && !compatible(component[a]!, component[b]!)) { valid = false; break; }
      }
      if (valid) for (const i of component) groups.join(component[0]!, i);
      else component.forEach(i => ambiguous.add(i));
    }
  };
  phase("strong"); phase("weak");
  const decisions: Record<string, GroupingDecision> = {};
  const result = groups.components().map(component => {
    for (const i of component) {
      const article = articles[i]!;
      const shared = (field: "strong" | "weak") => [...data[i]![field]].filter(key => component.some(j => j !== i && data[j]![field].has(key))).sort();
      const strong = shared("strong"), weak = shared("weak");
      decisions[article.key] = manual(i) ? { method: "manual", reason: "Manually organized; this assignment is preserved." }
        : component.length > 1 && strong.length ? { method: "automatic", reason: "Matching supplied or reviewed profile: " + strong[0]!.replace(/^account:/, "") }
        : component.length > 1 && weak.length ? { method: "automatic", reason: "Matching supplied name and context: " + weak[0]!.split("|").at(-1) }
        : { method: "separate", reason: ambiguous.has(i) ? "Conflicting identifiers, a manual separation or multiple possible identities; kept separate." : "No sufficiently specific matching identifier or context." };
    }
    return component.map(i => articles[i]!);
  });
  return { groups: result, decisions };
}
