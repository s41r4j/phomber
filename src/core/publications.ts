import { discoveredIdentity } from "./identity.js";
import { assessFinding } from "./trust.js";
import type { Finding, Investigation, Subject } from "./types.js";

const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === "string" ? value : "";
export interface PublicationAuthor { given?: string; family?: string; name?: string; ORCID?: string }
export function matchAuthorName(subject: Subject, author: PublicationAuthor): "exact" | "middle-variant" | "different" | "insufficient" {
  const given = string(author.given).trim(), family = string(author.family).trim();
  const full = given && family ? given + " " + family : string(author.name).trim();
  // A malformed combined author field cannot stand in for one individual author.
  if (!full || /[,;&|/]/.test(full)) return "insufficient";
  const names = [subject.name || "", ...(subject.aliases || [])].filter(Boolean);
  if (!names.length) return "insufficient";
  if (names.some(name => normalize(name) === normalize(full))) return "exact";
  if (names.every(name => normalize(name).split(" ").length < 2)) return "insufficient";
  if (given && family) {
    const g = normalize(given).split(" "), f = normalize(family).split(" ");
    for (const name of names) {
      const n = normalize(name).split(" ");
      if (n.length < f.length + 1 || n.slice(-f.length).join(" ") !== f.join(" ")) continue;
      if (g[0]!.length === 1 && n[0]!.startsWith(g[0]!) || n[0]!.length === 1 && g[0]!.startsWith(n[0]!)) return "insufficient";
      if (n[0] !== g[0]) continue;
      const middle = n.slice(1, -f.length), other = g.slice(1);
      if (!middle.length || !other.length || middle.length === other.length && middle.every((part, i) => part === other[i] || part.length === 1 && other[i]!.startsWith(part) || other[i]!.length === 1 && part.startsWith(other[i]!))) return "middle-variant";
    }
  }
  return "different";
}
export function matchingAuthors(subject: Subject, authors: unknown): PublicationAuthor[] {
  return Array.isArray(authors) ? authors.map(object).filter(author => ["exact", "middle-variant"].includes(matchAuthorName(subject, author))) : [];
}
export const publicationDOI = (value: string): string | undefined => {
  try { value = decodeURIComponent(value); } catch { /* literal DOI */ }
  return value.match(/10\.\d{4,9}\/[^\s"<>]+/i)?.[0].toLowerCase();
};
const orcid = (value: string) => value.match(/(?:^|\/)(\d{4}-\d{4}-\d{4}-[\dX]{4})(?:$|[/?#])/i)?.[1]?.toUpperCase();
export interface PublicationAttribution {
  state: "not-applicable" | "author-name-only" | "linked-publication" | "different-authors" | "unresolved" | "excluded";
  reason: string;
  research: boolean;
  article: boolean;
  matched_authors: string[];
}
/** Assess one work's author list. Never combine name parts across co-authors or other works. */
export function publicationAttribution(inv: Investigation, finding: Finding): PublicationAttribution {
  const result = (state: PublicationAttribution["state"], reason: string, research: boolean, article: boolean, authors: string[] = []): PublicationAttribution => ({state, reason, research, article, matched_authors: authors});
  const sources = inv.sources.filter(source => finding.source_ids.includes(source.id));
  if (!sources.some(source => source.adapter === "crossref") || finding.category !== "publications")
    return result("not-applicable", "Not a Crossref author-search record.", true, true);
  const assessment = assessFinding(inv, finding);
  if (assessment.claim === "rejected" || assessment.identity === "different") return result("excluded", "Excluded by the current evidence-bound review.", false, false);
  const records = inv.evidence.filter(e => e.finding_id === finding.id && sources.some(s => s.id === e.source_id && s.adapter === "crossref")).flatMap(e => {
    try { const record = object(JSON.parse(e.excerpt)); return Array.isArray(record.authors) ? [record] : []; }
    catch { return []; }
  });
  if (!records.length) return result("unresolved", "No intact per-work author metadata was retained; this record cannot support the subject's biography.", false, false);
  const expected = publicationDOI(finding.value);
  if (records.some(record => expected && publicationDOI(string(record.DOI)) !== expected))
    return result("unresolved", "The cited work and retained author metadata have different or missing DOIs.", false, false);
  const subject = {...inv.input.subject,name:discoveredIdentity(inv).name || inv.input.subject.name};
  const matches = records.map(record => matchingAuthors(subject, record.authors));
  if (matches.some(authors => !authors.length)) {
    const ambiguous = records.some(record => !(record.authors as unknown[]).length || (record.authors as unknown[]).some(author => matchAuthorName(subject, object(author)) === "insufficient"));
    return ambiguous ? result("unresolved", "Incomplete or malformed author fields cannot establish an individual full-name match. This record stays outside the biography.", false, false) :
      result("different-authors", "No individual author in this work matches the supplied full name or an explicit alias. Name parts from different co-authors must never be combined.", false, false);
  }
  const authors = matches.flat(), names = [...new Set(authors.map(a => [a.given,a.family].filter(Boolean).join(" ") || a.name || ""))];
  if (assessment.identity === "matched" && assessment.review === "accepted") return result("linked-publication", "An accepted evidence-bound analyst decision explicitly links this work to the subject.", true, true, names);
  const suppliedOrcids = new Set((inv.input.subject.socials || []).filter(s => s.platform.toLowerCase() === "orcid").map(s => orcid(s.url || s.username || "")).filter(Boolean));
  if (authors.some(author => suppliedOrcids.has(orcid(author.ORCID || ""))))
    return result("linked-publication", "The matching author's ORCID equals the investigator-supplied ORCID; this links the record without verifying every claim.", true, true, names);
  if (expected && inv.findings.some(other => other.id !== finding.id && other.category === "publications" && publicationDOI(other.value) === expected &&
    !other.source_ids.some(id => inv.sources.some(s => s.id === id && s.adapter === "crossref")) &&
    (other.identity === "anchored" || assessFinding(inv, other).identity === "matched") &&
    assessFinding(inv, other).claim !== "rejected" && assessFinding(inv, other).identity !== "different" &&
    inv.evidence.some(e => e.finding_id === other.id && publicationDOI(e.excerpt) === expected)))
    return result("linked-publication", "A subject-linked supplied/reviewed resource explicitly lists this exact DOI; the author-name match is additional evidence.", true, true, names);
  return result("author-name-only", "An individual author name matches, but no subject-specific ORCID, exact DOI link from a supplied/reviewed resource or accepted identity decision connects this work to the target. Keep it in the evidence ledger, not the biography.", true, false, names);
}
export function articleTimeline(inv: Investigation) {
  return inv.timeline.filter(entry => {
    const works = inv.findings.filter(f => f.category === "publications" && f.field === entry.title && f.source_ids.some(id => entry.source_ids.includes(id)));
    return !works.length || works.some(f => publicationAttribution(inv,f).article);
  });
}
