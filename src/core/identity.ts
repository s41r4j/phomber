import type { Investigation } from "./types.js";
import { assessFinding } from "./trust.js";

const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function seedIsHandle(inv: Investigation): boolean {
  const name = inv.input.subject.name?.replace(/^@/, "").trim() || "";
  return !!name && !/\s/.test(name) && (/[\d_@]/.test(inv.input.subject.name || "") ||
    [...(inv.input.subject.usernames || []), ...(inv.input.subject.socials || []).map(s => s.username || "")].some(h => h.replace(/^@/, "").toLowerCase() === name.toLowerCase()));
}
export function compatibleName(value: string, name: string): boolean {
  const a = normalize(value).split(" "), b = normalize(name).split(" ");
  return a.length === b.length && a.every((part, i) => part === b[i] || part.length === 1 && b[i]!.startsWith(part));
}
export function seedHostedDocument(value: string, roots: string[]): boolean {
  try {
    const url = new URL(value);
    if (url.hostname !== "github.com" || !url.pathname.endsWith(".pdf")) return false;
    return roots.some(root=>{
      try { const u = new URL(root), parts = u.pathname.replace(/^\/users\//,"/").split("/").filter(Boolean);
        return ["github.com","api.github.com"].includes(u.hostname) && parts.length === 1 &&
          url.pathname.startsWith(`/${parts[0]}/${parts[0]}/releases/download/`);
      } catch {return false;}
    });
  } catch {return false;}
}
/** Resource associations identify research leads, not legal identity or independent verification. */
export function discoveredIdentity(inv: Investigation): { name?: string; source_ids: string[]; evidence_ids: string[]; basis: string } {
  const suppliedName = inv.input.subject.name;
  if (suppliedName && !seedIsHandle(inv)) return {name:suppliedName,source_ids:[],evidence_ids:[],basis:"Investigator-supplied name; not independently verified."};
  const canonical = (value: string) => {
    try { const u = new URL(value); u.hash = ""; u.hostname = u.hostname.replace(/^www\./, "");
      if (u.hostname === "api.github.com") {u.hostname = "github.com";u.pathname = u.pathname.replace(/^\/users\//,"/");}
      if (u.hostname === "gitlab.com" && u.pathname === "/api/v4/users" && u.searchParams.get("username")) {u.pathname = "/"+u.searchParams.get("username");u.search="";}
      if (u.hostname === "dev.to" && u.pathname === "/api/users/by_username" && u.searchParams.get("url")) {u.pathname = "/"+u.searchParams.get("url");u.search="";}
      if (u.hostname === "huggingface.co") u.pathname = u.pathname.replace(/^\/api\/users\/([^/]+)\/overview$/,"/$1");
      return u.href.replace(/\/$/, ""); } catch {return "";}
  };
  const subject = inv.input.subject;
  const hosts: Record<string,string> = {github:"github.com",gitlab:"gitlab.com",dev:"dev.to",huggingface:"huggingface.co"};
  const supplied = new Set([...(subject.websites || []), ...(subject.socials || []).map(s => s.url || (hosts[s.platform] && s.username ? `https://${hosts[s.platform]}/${s.username}` : ""))].filter(Boolean).map(canonical));
  const handles = new Set([...(subject.usernames || []), ...(subject.socials || []).map(s=>s.username || ""), ...(seedIsHandle(inv) ? [suppliedName!] : [])].map(h=>h.replace(/^@/, "").toLowerCase()));
  const candidates = inv.findings.filter(f => f.category === "identity" && /^(full name|name)$/i.test(f.field) &&
    f.status !== "conflicting" && normalize(f.value).split(" ").length >= 2 && f.value.length <= 100 &&
    assessFinding(inv,f).claim !== "rejected" && assessFinding(inv,f).identity !== "different");
  const roots = inv.sources.filter(s => s.status === "ok" && !["imported-evidence","github-search","wikidata-search","crossref"].includes(s.adapter) &&
    (supplied.has(canonical(s.url)) || candidates.some(f => f.source_ids.includes(s.id) && (f.identity === "anchored" || assessFinding(inv,f).identity === "matched")) ||
      ["github","gitlab","dev","huggingface"].includes(s.adapter) && inv.findings.some(f => f.source_ids.includes(s.id) && /username/i.test(f.field) &&
        handles.has(f.value.toLowerCase()) && assessFinding(inv,f).identity !== "different" && assessFinding(inv,f).claim !== "rejected" &&
        canonical(s.url).split(/[/?]/).some(part=>part.toLowerCase() === f.value.toLowerCase()))));
  const names = candidates.filter(f => roots.some(s=>f.source_ids.includes(s.id)));
  const distinct = new Map(names.map(f=>[normalize(f.value),f.value]));
  if (distinct.size !== 1) return {source_ids:[],evidence_ids:[],basis:distinct.size ? "Conflicting full names on seed-linked resources; resolve before name expansion." : "No full name retained on a seed-linked resource yet."};
  return {name:[...distinct.values()][0],source_ids:[...new Set(names.flatMap(f=>f.source_ids))],evidence_ids:inv.evidence.filter(e=>names.some(f=>f.id===e.finding_id)).map(e=>e.id),basis:"A seed-linked public resource reports this full name. Use it for cross-checking; individual claims still need attribution."};
}
