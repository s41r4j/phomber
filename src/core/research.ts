import { getDomain } from "tldts";
import { assessFinding, contentHash } from "./trust.js";
import { publicURL } from "./schema.js";
import type { Investigation, Subject } from "./types.js";
import { compatibleName, discoveredIdentity, seedIsHandle, seedHostedDocument } from "./identity.js";
import { publicationAttribution } from "./publications.js";

const normalized = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const contains = (text: string, value: string) => !!value.trim() && (` ${normalized(text)} `).includes(` ${normalized(value)} `);
export function resourceURL(value: string): string | undefined {
  try {
    const url = publicURL(value);
    url.hash = "";
    if (url.hostname === "api.github.com" && /^\/users\/[^/]+$/.test(url.pathname)) {
      url.hostname = "github.com"; url.pathname = url.pathname.replace(/^\/users/, "");
    }
    if (url.hostname === "dev.to" && url.pathname === "/api/users/by_username" && url.searchParams.get("url")) {
      url.pathname = "/" + encodeURIComponent(url.searchParams.get("url")!); url.search = "";
    }
    if (url.hostname === "gitlab.com" && url.pathname === "/api/v4/users" && url.searchParams.get("username")) {
      url.pathname = "/" + encodeURIComponent(url.searchParams.get("username")!); url.search = "";
    }
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.origin.replace("://www.", "://") + url.pathname.replace(/\/+$/, "") + url.search;
  } catch { return undefined; }
}
export function suppliedResources(subject: Subject): string[] {
  const hosts: Record<string, string> = { github: "github.com", gitlab: "gitlab.com", instagram: "www.instagram.com", linkedin: "www.linkedin.com/in", dev: "dev.to", huggingface: "huggingface.co", x: "x.com" };
  return [...new Set([...(subject.websites || []), ...(subject.socials || []).flatMap(s => s.url ? [s.url] : hosts[s.platform.toLowerCase()] && s.username ? [`https://${hosts[s.platform.toLowerCase()]}/${encodeURIComponent(s.username.replace(/^@/, ""))}`] : [])])];
}
export function evidenceLinks(text: string): string[] {
  return [...new Set((text.match(/https:\/\/[^\s<>"\[\]{}]+/g) || []).map(v => v.replace(/[),.;]+$/, "")).filter(v => !!resourceURL(v)))];
}
export interface IdentitySupport {
  source_id: string;
  state: "supported-link" | "probable-match" | "context-consistent" | "unresolved" | "conflicting" | "discovery-only";
  score: number;
  score_kind: "heuristic-marks-not-probability";
  signals: { kind: string; value: string; marks: number; evidence_ids: string[]; source_ids: string[] }[];
  independent_sources: number;
  matched_source_ids: string[];
  expand: boolean;
  reasons: string[];
  evidence_ids: string[];
}
export function researchName(inv: Investigation): string | undefined {
  return discoveredIdentity(inv).name;
}

const weights: Record<string, number> = { name: 20, resource: 45, crosslink: 45, education: 20, employer: 20, project: 25, publication: 25, qualification: 15, handle: 8, timeline: 8 };
export const MATCHING_POLICY = { version: "1.1", probable_match_min_marks: 70, min_independent_groups: 2,
  min_strong_families: 2, conflict_penalty: 80, score_kind: "heuristic-marks-not-probability", weights } as const;
const generic = /^(project(?:s| ?title| ?name)?|publication(?:s| ?title)?|repository(?: ?name)?|repo|name|title|portfolio|website|python|javascript|software|student|engineer|developer|university|college|company|certificate(?: title)?|qualification)$/i;
function factValue(field: string, value: string, kind: string): string | undefined {
  let text = value.trim();
  const canonicalField = normalized(field);
  if (kind === "project") {
    const repo = value.match(/https:\/\/(?:www\.)?(?:github\.com|gitlab\.com)\/([^\s/#?]+\/[^\s/#?]+)/i)?.[1];
    text = !generic.test(canonicalField) && field.length < 100 ? field : repo || text;
  }
  if (kind === "publication") text = value.match(/10\.\d{4,9}\/[^\s]+/i)?.[0] || (!generic.test(canonicalField) ? field : value);
  text = normalized(text);
  return text.length >= 6 && text.length <= 180 && !generic.test(text) ? text : undefined;
}
/** Weighted evidence associations are working research hypotheses, never calibrated identity probabilities. */
export function identitySupport(inv: Investigation): IdentitySupport[] {
  const findingMap = new Map(inv.findings.map(f => [f.id, f]));
  const assessments = new Map(inv.findings.map(f => [f.id, assessFinding(inv, f)]));
  const supplied = new Set(suppliedResources(inv.input.subject).map(resourceURL).filter(Boolean));
  const discovered = discoveredIdentity(inv);
  const linkedResources = new Set(supplied);
  for (const id of discovered.source_ids) { const source = inv.sources.find(s=>s.id===id); if (source) linkedResources.add(resourceURL(source.url)); }
  // Follow explicit links, including equivalent API/HTML representations of the seed account.
  for (let pass=0;pass<3;pass++) for (const source of inv.sources) {
    if (source.status !== "ok" || !linkedResources.has(resourceURL(source.url)) || ["imported-evidence","crossref","github-search","wikidata-search"].includes(source.adapter)) continue;
    const fields = inv.findings.filter(f=>f.source_ids.includes(source.id));
    if (fields.some(f=>f.status === "conflicting" || assessments.get(f.id)?.identity === "different" ||
      f.category === "identity" && /^(full name|name)$/.test(f.field) && discovered.name && !compatibleName(f.value,discovered.name))) continue;
    for (const e of inv.evidence.filter(e=>e.source_id===source.id)) {
      const f = findingMap.get(e.finding_id);
      if (f && assessments.get(f.id)?.claim !== "rejected" && assessments.get(f.id)?.identity !== "different")
        for (const url of evidenceLinks(e.excerpt + " " + f.value)) linkedResources.add(resourceURL(url));
    }
  }
  const rootURLs = inv.sources.filter(s=>discovered.source_ids.includes(s.id)).map(s=>s.url).concat(suppliedResources(inv.input.subject));
  const name = researchName(inv) || "";
  const aliases = [name, ...(inv.input.subject.aliases || [])].filter(Boolean);
  const institutions = (inv.input.subject.education || []).map(e => String(e.institution || e.name || "")).filter(Boolean);
  const employers = [inv.input.subject.professional?.company || "", ...(inv.input.subject.professional?.companies || [])].filter(Boolean);
  const handles = [...(inv.input.subject.usernames || []), ...(inv.input.subject.socials || []).map(s => s.username || "")].map(h => h.replace(/^@/, "")).filter(Boolean);
  const profiles = inv.sources.filter(s => s.status === "ok").map(source => {
    const all = inv.evidence.filter(e => e.source_id === source.id);
    const excerpts = all.filter(e => { const a = assessments.get(e.finding_id), f = findingMap.get(e.finding_id); return a && f && a.claim !== "rejected" && a.identity !== "different" && publicationAttribution(inv,f).research; });
    const named = excerpts.filter(e => aliases.some(n => contains(e.excerpt, n)));
    const fields = inv.findings.filter(f => f.source_ids.includes(source.id));
    const names = fields.filter(f => f.category === "identity" && /^(full name|name)$/i.test(f.field) && assessments.get(f.id)?.claim !== "rejected");
    const otherName = names.some(f => aliases.length > 0 && !aliases.some(n => compatibleName(f.value, n)));
    const ambiguous = otherName && named.length > 0;
    const conflict = fields.some(f => f.status === "conflicting" || assessments.get(f.id)?.identity === "different") || otherName && !named.length;
    const discovery = ["crossref", "github-search", "wikidata-search"].includes(source.adapter);
    const trusted = source.adapter !== "imported-evidence" && !discovery && !conflict && !ambiguous;
    const direct = trusted && !!resourceURL(source.url) && (linkedResources.has(resourceURL(source.url)) || seedHostedDocument(source.url,rootURLs));
    const linked = (text: string) => evidenceLinks(text).some(link => supplied.has(resourceURL(link)));
    const crosslink = trusted && (named.some(e => linked(e.excerpt)) || ["github", "gitlab", "dev", "huggingface"].includes(source.adapter) && named.length > 0 && excerpts.some(e => linked(e.excerpt)));
    const facts = new Map<string, { kind: string; value: string; evidence_ids: string[] }>();
    const add = (kind: string, value: string, ids: string[]) => {
      const key = kind + ":" + normalized(value), old = facts.get(key);
      facts.set(key, { kind, value: normalized(value), evidence_ids: [...new Set([...(old?.evidence_ids || []), ...ids])] });
    };
    if (named.length) {
      for (const [kind, values] of [["education", institutions], ["employer", employers]] as const)
        for (const value of values) { const matched = excerpts.filter(e => contains(e.excerpt, value)); if (matched.length) add(kind, value, matched.map(e => e.id)); }
      for (const e of excerpts) {
        const f = findingMap.get(e.finding_id)!;
        const kind = f.category === "education" && /institution|college|school|university/i.test(f.field) ? "education" :
          /^(?:company|employer|organization|current employer)$/i.test(f.field) && /professional|career|employment/i.test(f.category) ? "employer" :
          /^projects?$/.test(f.category) ? "project" : /^publications?$/.test(f.category) ? "publication" :
          /certification|certificate|credential title|qualification/i.test(f.field) ? "qualification" :
          /timeline|education|professional/.test(f.category) && /date|year|start|graduat|joined|completed|period/i.test(f.field) && /^\d{4}(?:[-/\s\d]*)$/.test(f.value) ? "timeline" : undefined;
        if (kind) { const value = factValue(f.field, kind === "timeline" ? f.field + " " + f.value : f.value, kind); if (value) add(kind, value, [e.id]); }
      }
    }
    const canonical = resourceURL(source.url);
    let domain = source.id;
    try { const host = new URL(canonical || source.url).hostname; domain = getDomain(host, { allowPrivateDomains: false }) || host; } catch { /* invalid older resource */ }
    const fingerprint = contentHash([...new Set(excerpts.map(e => normalized(e.excerpt)))].sort());
    return { source, all, excerpts, named, trusted, direct, crosslink, conflict, ambiguous, discovery, facts, domain, fingerprint };
  });
  // Count one independent source group per publisher; identical retained text also joins mirrors.
  const parent = profiles.map((_, i) => i);
  const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]!));
  for (let i = 0; i < profiles.length; i++) for (let j = 0; j < i; j++)
    if (profiles[i]!.domain === profiles[j]!.domain || profiles[i]!.excerpts.length > 0 && profiles[i]!.fingerprint === profiles[j]!.fingerprint) parent[root(i)] = root(j);
  return profiles.map((profile, index) => {
    const { source, excerpts, named, trusted, direct, crosslink, conflict, ambiguous } = profile;
    if (profile.discovery) return { source_id: source.id, state: "discovery-only", score: 0,
      score_kind: "heuristic-marks-not-probability", signals: [], independent_sources: 0,
      matched_source_ids: [], expand: false,
      reasons: ["This is a multi-record search response, not one person's resource. Each record requires separate author/subject attribution; names from different records or co-authors cannot add identity marks."],
      evidence_ids: profile.all.map(e=>e.id) } satisfies IdentitySupport;
    const signals: IdentitySupport["signals"] = [];
    const add = (kind: string, value: string, evidence_ids: string[], source_ids = [source.id]) => {
      if (!signals.some(s => s.kind === kind)) signals.push({ kind, value, marks: weights[kind] || 0, evidence_ids: [...new Set(evidence_ids)], source_ids: [...new Set(source_ids)] });
    };
    if (named.length) add("name", name, named.map(e => e.id));
    if (direct && named.length) add("resource", "Supplied resource reports the research name", named.map(e => e.id));
    else if (crosslink) add("crosslink", "Named evidence explicitly links a supplied resource", excerpts.filter(e => evidenceLinks(e.excerpt).some(l => supplied.has(resourceURL(l)))).map(e => e.id));
    const matched = new Set([index]);
    for (const fact of profile.facts.values()) {
      const supporting = profiles.map((p, i) => ({p,i})).filter(({p,i}) => i !== index && root(i) !== root(index) && p.trusted && p.named.length && p.facts.has(fact.kind + ":" + fact.value));
      const given = fact.kind === "education" ? institutions : fact.kind === "employer" ? employers : [];
      if (supporting.length || given.some(v => normalized(v) === fact.value)) {
        add(fact.kind, fact.value, [...fact.evidence_ids, ...supporting.flatMap(({p}) => p.facts.get(fact.kind + ":" + fact.value)!.evidence_ids)], [source.id, ...supporting.map(({p}) => p.source.id)]);
        for (const {i} of supporting) matched.add(i);
      }
    }
    const handleEvidence = (excerpt: string, field: string, handle: string) => {
      return /username|handle/i.test(field) && contains(excerpt, handle) ||
        [...excerpt.normalize("NFKC").matchAll(/(?:@|(?:handle|username)[:\s]+@?)([\p{L}\p{N}_.-]+)/giu)].some(match => match[1]!.replace(/\.+$/, "").toLowerCase() === handle.toLowerCase());
    };
    const matchedHandles = handles.filter(h => excerpts.some(e => handleEvidence(e.excerpt, findingMap.get(e.finding_id)!.field, h)));
    if (named.length && matchedHandles.length) add("handle", matchedHandles.join(", "), excerpts.filter(e => matchedHandles.some(h => handleEvidence(e.excerpt, findingMap.get(e.finding_id)!.field, h))).map(e => e.id));
    const independent = new Set([...matched].filter(i => profiles[i]!.trusted && profiles[i]!.named.length).map(root)).size;
    const score = Math.max(0, Math.min(100, signals.reduce((n,s) => n + s.marks, 0) - (conflict ? MATCHING_POLICY.conflict_penalty : 0)));
    const strong = signals.filter(s => !["name", "handle", "timeline"].includes(s.kind)).length;
    const probable = trusted && named.length > 0 && score >= MATCHING_POLICY.probable_match_min_marks && strong >= MATCHING_POLICY.min_strong_families && independent >= MATCHING_POLICY.min_independent_groups;
    const state = conflict ? "conflicting" : (direct && named.length > 0) || crosslink ? "supported-link" : probable ? "probable-match" : trusted && signals.some(s => ["education", "employer"].includes(s.kind)) && named.length ? "context-consistent" : "unresolved";
    const reasons = conflict ? ["A contradictory name/finding or analyst identity exclusion blocks automatic expansion."] :
      ambiguous ? ["Several different names are retained on this resource; automatic expansion is blocked."] :
      state === "supported-link" ? [direct ? "A supplied or explicitly seed-linked resource reports the research name." : "Named evidence explicitly cross-links to a supplied resource.", "The association can guide follow-up research; biographical claims remain source-reported."] :
      probable ? ["Several distinct evidence clues agree across independently grouped sources. Treat this as the same subject for bounded follow-up research while retaining the hypothesis and its evidence."] :
      state === "context-consistent" ? ["Name and supplied institution/employer are consistent; more distinct cross-source evidence is needed."] : ["Matching names or handles alone are insufficient; this resource remains a candidate."];
    if (source.adapter === "imported-evidence") reasons.push("Imported evidence alone cannot authorize automatic expansion.");
    return { source_id: source.id, state, score, score_kind: "heuristic-marks-not-probability" as const, signals, independent_sources: independent,
      matched_source_ids: [...matched].map(i => profiles[i]!.source.id), expand: trusted && ["supported-link", "probable-match"].includes(state), reasons,
      evidence_ids: [...new Set([...profile.all.map(e => e.id), ...signals.flatMap(s => s.evidence_ids)])] } satisfies IdentitySupport;
  });
}
export function researchLeads(inv: Investigation) {
  const support = new Map(identitySupport(inv).map(s => [s.source_id,s]));
  const leads = new Map<string, { url: string; source_id: string; action: "expand" | "verify"; marks: number }>();
  for (const e of inv.evidence) {
    const f = inv.findings.find(f => f.id === e.finding_id), match = support.get(e.source_id);
    if (!f || !match || match.state === "conflicting") continue;
    const review = assessFinding(inv,f);
    if (review.claim === "rejected" || review.identity === "different" || !publicationAttribution(inv,f).research) continue;
    for (const url of evidenceLinks(f.value + " " + e.excerpt)) {
      const item = { url, source_id:e.source_id, action:match.expand ? "expand" as const : "verify" as const, marks:match.score };
      const old = leads.get(url); if (!old || item.action === "expand" && old.action !== "expand" || item.marks > old.marks) leads.set(url,item);
    }
  }
  return [...leads.values()].sort((a,b) => Number(b.action === "expand") - Number(a.action === "expand") || b.marks - a.marks);
}
export function matchingQueries(inv: Investigation): string[] {
  const name = researchName(inv); if (!name) return [];
  const support = identitySupport(inv), expandable = new Set(support.filter(s=>s.expand).map(s=>s.source_id));
  const label = inv.input.subject.name;
  const queries = label && seedIsHandle(inv) && normalized(label) !== normalized(name) ? [`${JSON.stringify(name)} ${JSON.stringify(label)}`] : [];
  const kinds = ["education", "professional", "projects", "achievements", "publications"];
  for (const kind of kinds) for (const f of inv.findings) {
    if (f.category !== kind || !f.source_ids.some(id=>expandable.has(id)) || !publicationAttribution(inv,f).research ||
      assessFinding(inv,f).claim === "rejected" || assessFinding(inv,f).identity === "different") continue;
    const topic = kind === "education" ? /institution|college|school|university/i.test(f.field) : kind === "professional" ? /^(?:company|employer|organization|current employer)$/i.test(f.field) : true;
    const value = kind === "projects" && !generic.test(normalized(f.field)) ? f.field : f.value;
    if (topic && value.length >= 4 && value.length <= 100 && !/^https?:/.test(value) && !generic.test(value)) queries.push(`${JSON.stringify(name)} ${JSON.stringify(value)}`);
  }
  queries.push(...support.filter(s=>s.expand).flatMap(s=>s.signals.filter(signal=>["project","publication","qualification","employer"].includes(signal.kind)).map(signal=>`${JSON.stringify(name)} ${JSON.stringify(signal.value)}`)));
  return [...new Set(queries)].slice(0,8);
}
export function researchRelevance(inv: Investigation, url: string, text = "") {
  let score = 0; const reasons: string[] = [];
  const add = (marks: number, reason: string) => {score += marks;reasons.push(reason);};
  const name = researchName(inv), supplied = suppliedResources(inv.input.subject).map(resourceURL);
  const match = identitySupport(inv).find(s=>resourceURL(inv.sources.find(source=>source.id===s.source_id)!.url) === resourceURL(url));
  if (supplied.includes(resourceURL(url))) add(100,"Supplied resource");
  if (match?.expand) add(80,"Evidence-linked subject resource");
  if (match?.state === "conflicting") add(-200,"Conflicting identity");
  const expanded = new Set(identitySupport(inv).filter(s=>s.expand).map(s=>s.source_id));
  const evidence = inv.findings.filter(f=>f.source_ids.some(id=>expanded.has(id)));
  const content = text + " " + url;
  if (name && contains(content,name)) add(25,"Research name occurs");
  const handles = [...(inv.input.subject.usernames || []),...(inv.input.subject.socials || []).map(s=>s.username || ""),...(seedIsHandle(inv) ? [inv.input.subject.name!] : [])];
  if (handles.some(handle=>contains(content,handle))) add(20,"Exact supplied handle occurs");
  if (evidence.some(f=>["education","professional","projects"].includes(f.category) && f.value.length>=6 && f.value.length<=100 && contains(content,f.value))) add(30,"Retained institution, employer or project context");
  if (/\.pdf(?:$|[?#])|\b(?:resume|curriculum vitae|biography|profile)\b/i.test(content)) add(10,"Identity-rich resource");
  if (/\/(?:topics|explore|search)(?:[/?]|$)/i.test(url)) add(-20,"Broad discovery listing");
  return {score,reasons};
}
export function researchEvidence(inv: Investigation, max = 120) {
  const support = new Map(identitySupport(inv).map(s => [s.source_id, s]));
  const groups = new Map<string, typeof inv.evidence>();
  for (const e of inv.evidence) {
    const f = inv.findings.find(f => f.id === e.finding_id);
    const source = inv.sources.find(s => s.id === e.source_id);
    if (!f || source?.status !== "ok") continue;
    const assessment = assessFinding(inv, f);
    if (assessment.claim === "rejected" || assessment.identity === "different" || !publicationAttribution(inv,f).research) continue;
    groups.set(e.source_id, [...(groups.get(e.source_id) || []), e]);
  }
  for (const group of groups.values()) group.sort((a,b) => {
    const priority = (e: typeof a) => { const f = inv.findings.find(f=>f.id===e.finding_id)!;
      return (f.category === "identity" && /^(full name|name)$/.test(f.field) ? 50 : ["education","professional"].includes(f.category) ? 30 : 0); };
    return priority(b)-priority(a);
  });
  const rankedGroups = [...groups.entries()].sort(([a],[b])=> {
    const rank = (id:string) => support.get(id)?.expand ? 2 : support.get(id)?.state === "conflicting" ? -1 : 0;
    return rank(b)-rank(a);
  }).map(([,group])=>group);
  // Round-robin keeps a prolific repository list from hiding smaller institutional sources.
  const selected: typeof inv.evidence = [];
  for (let row = 0; selected.length < max; row++) {
    const next = rankedGroups.flatMap(group => group[row] ? [group[row]!] : []);
    if (!next.length) break;
    selected.push(...next.slice(0, max - selected.length));
  }
  return selected.map(e => {
    const f = inv.findings.find(f => f.id === e.finding_id)!;
    const match = support.get(e.source_id);
    return { id: e.id, category: f.category, field: f.field, value: f.value.slice(0, 1000), excerpt: e.excerpt, identity: f.identity, status: f.status, assessment: assessFinding(inv, f), publication_attribution: publicationAttribution(inv,f), identity_support: match ? { state: match.state, score: match.score, score_kind: match.score_kind, independent_sources: match.independent_sources, expand: match.expand, reasons: match.reasons } : undefined, source_url: inv.sources.find(s => s.id === e.source_id)!.url };
  });
}
export function researchCoverage(inv: Investigation) {
  const evidence = researchEvidence(inv);
  return ["identity", "education", "professional", "projects", "publications", "achievements", "community", "timeline", "online"].map(topic => ({ topic, excerpts: evidence.filter(e => e.category === topic).length }));
}
