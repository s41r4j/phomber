import { createHash, randomUUID } from "node:crypto";
import type { Finding, Investigation } from "./types.js";

/** Stable hashes describe retained content, not the truth of a source. */
export function canonicalJSON(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v !== null && typeof v === "object")
      return Object.fromEntries(Object.entries(v).filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k, item]) => [k, normalize(item)]));
    return v;
  };
  return JSON.stringify(normalize(value));
}
export const contentHash = (value: unknown): string =>
  createHash("sha256").update(canonicalJSON(value)).digest("hex");

export interface ReviewDecision {
  id: string;
  finding_id: string;
  evidence_hash: string;
  decision: "accepted" | "rejected" | "needs-review";
  identity: "unresolved" | "matched" | "different";
  reason: string;
  analyst: string;
  created_at: string;
}
export interface TrustAssessment {
  extraction: "source-backed" | "supplied";
  identity: "unresolved" | "supplied-resource" | "matched" | "different";
  claim: "unassessed" | "conflicting" | "accepted" | "rejected";
  review: "pending" | "accepted" | "rejected" | "needs-review";
  stale_reviews: number;
}
export function findingFingerprint(inv: Investigation, finding: Finding): string {
  return contentHash({
    subject: inv.input.subject,
    finding: { id: finding.id, category: finding.category, field: finding.field,
      value: finding.value, identity: finding.identity, status: finding.status },
    evidence: inv.evidence.filter(e => e.finding_id === finding.id),
    sources: inv.sources.filter(s => finding.source_ids.includes(s.id)),
  });
}
export function assessFinding(inv: Investigation, finding: Finding): TrustAssessment {
  const hash = findingFingerprint(inv, finding);
  const reviews = (inv.reviews || []).filter(r => r.finding_id === finding.id);
  const current = reviews.filter(r => r.evidence_hash === hash).at(-1);
  return {
    extraction: finding.source_ids.length ? "source-backed" : "supplied",
    identity: current?.identity === "matched" || current?.identity === "different"
      ? current.identity : finding.identity === "anchored" ? "supplied-resource" : "unresolved",
    claim: current?.decision === "accepted" ? "accepted" : current?.decision === "rejected"
      ? "rejected" : finding.status === "conflicting" ? "conflicting" : "unassessed",
    review: current?.decision || "pending",
    stale_reviews: reviews.filter(r => r.evidence_hash !== hash).length,
  };
}
export function makeReview(inv: Investigation, findingId: string, value: {
  decision: string; identity: string; reason: string; analyst: string;
}): ReviewDecision {
  const finding = inv.findings.find(f => f.id === findingId);
  if (!finding || !["accepted", "rejected", "needs-review"].includes(value.decision) ||
    !["unresolved", "matched", "different"].includes(value.identity) ||
    !value.reason.trim() || value.reason.trim().length > 2000 ||
    !value.analyst.trim() || value.analyst.trim().length > 120)
    throw new Error("A valid finding, decision, identity assessment, analyst and reason are required.");
  if (value.decision === "accepted" && value.identity === "different")
    throw new Error("A finding about a different identity cannot be accepted for this subject.");
  return { id: randomUUID(), finding_id: findingId, evidence_hash: findingFingerprint(inv, finding),
    decision: value.decision as ReviewDecision["decision"], identity: value.identity as ReviewDecision["identity"],
    reason: value.reason.trim(), analyst: value.analyst.trim(), created_at: new Date().toISOString() };
}
export function compareReports(before: Investigation, after: Investigation) {
  const old = new Map(before.findings.map(f => [f.id, f]));
  const next = new Map(after.findings.map(f => [f.id, f]));
  return {
    added: after.findings.filter(f => !old.has(f.id)),
    removed: before.findings.filter(f => !next.has(f.id)),
    changed: after.findings.filter(f => old.has(f.id) &&
      findingFingerprint(before, old.get(f.id)!) !== findingFingerprint(after, f)),
  };
}
