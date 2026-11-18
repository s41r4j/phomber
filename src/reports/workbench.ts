import { assessFinding, compareReports, contentHash } from "../core/trust.js";
import type { Investigation } from "../core/types.js";
import { escape, page, appearance, link } from "./shell.js";
import { articleTabs, dateTime } from "./article.js";
import { reportTitle } from "../catalog/index.js";

function shell(inv: Investigation, title: string, body: string): string {
  return page(title + " — " + reportTitle(inv), `<div class="page-grid"><nav class="contents"><div class="side-title">Research tools</div><a href="/reports/${inv.id}/">Article</a><a href="/reports/${inv.id}/review/">Analyst workbench</a><a href="/reports/${inv.id}/revisions/">Preserved revisions</a><a href="/reports/${inv.id}/evidence/">Evidence ledger</a></nav><main class="article" id="content"><h1>${escape(reportTitle(inv))}: ${escape(title)}</h1>${articleTabs(inv.id, title)}${body}</main>${appearance()}</div>`);
}
export function renderWorkbench(inv: Investigation, csrf: string): string {
  const version = contentHash(inv);
  const queue = inv.findings.filter(f => assessFinding(inv, f).review !== "accepted" && assessFinding(inv, f).review !== "rejected");
  const options = (values: string[], selected: string) => values.map(v => `<option value="${v}"${v === selected ? " selected" : ""}>${v}</option>`).join("");
  const body = `<p>Review retrieval, identity and claim credibility separately. Acceptance records your assessment; it is not automatic factual verification. Decisions remain in the audit trail and expire when the subject or supporting evidence changes.</p><p><strong>${queue.length} findings await review.</strong> ${inv.reviews?.length || 0} decisions recorded. <a href="/reports/${inv.id}/graph.json">Download provenance graph</a></p>
  <h2>Collection coverage</h2><p>Completion means the configured tasks ran, not that all public information was found.</p><table class="wikitable"><thead><tr><th>Source</th><th>Task state</th><th>Details</th></tr></thead><tbody>${(inv.tasks || []).map(t => `<tr><td>${escape(t.adapter)}</td><td>${escape(t.status)}</td><td>${escape(t.detail || "")}</td></tr>`).join("") || '<tr><td colspan="3">Task history was not recorded for this older report.</td></tr>'}</tbody></table>
  <h2>Candidate resources</h2><p>These resources stay separate. Matching names and handles do not merge identities.</p><ul>${inv.sources.map(s => `<li>${link(s.url, s.adapter)} · ${escape(s.status)} ${s.snapshot_hash ? `· <a href="/reports/${inv.id}/snapshots/${s.snapshot_hash}.json">Preserved source</a>` : '· No preserved snapshot'} ${s.error_code ? `· ${escape(s.error_code)}` : ''}</li>`).join("")}</ul>
  <h2>Finding review</h2>${inv.findings.map(f => {
    const assessment = assessFinding(inv, f);
    const reviews = (inv.reviews || []).filter(r => r.finding_id === f.id);
    return `<section id="finding-${escape(f.id)}"><h3>${escape(f.field)}</h3><p>${escape(f.value)}</p><p>Extraction: <strong>${assessment.extraction}</strong> · Identity: <strong>${assessment.identity}</strong> · Claim: <strong>${assessment.claim}</strong> · Review: <strong>${assessment.review}</strong>${assessment.stale_reviews ? ` · ${assessment.stale_reviews} earlier decisions require reassessment` : ''}</p>${inv.evidence.filter(e => e.finding_id === f.id).map(e => `<blockquote>${escape(e.excerpt)}<br><small>${escape(dateTime(e.retrieved_at))}</small></blockquote>`).join("")}
    <details><summary>Record analyst decision</summary><form class="analyst-form" action="/manage/reviews" method="post">
    <input type="hidden" name="csrf" value="${escape(csrf)}"><input type="hidden" name="report" value="${inv.id}"><input type="hidden" name="finding" value="${escape(f.id)}"><input type="hidden" name="revision" value="${version}">
    <p><label>Decision <select name="decision">${options(['needs-review','accepted','rejected'], assessment.review)}</select></label> <label>Identity <select name="identity">${options(['unresolved','matched','different'], assessment.identity)}</select></label></p>
    <p><label>Analyst <input name="analyst" required maxlength="120" autocomplete="name"></label></p><p><label>Reason <textarea name="reason" required maxlength="2000" rows="3"></textarea></label></p><button type="submit">Save decision</button></form></details>
    ${reviews.length ? `<details><summary>Decision history</summary><ul>${reviews.map(r => `<li>${escape(r.analyst)} · ${escape(r.decision)} · identity ${escape(r.identity)} · ${escape(dateTime(r.created_at))}<p>${escape(r.reason)}</p></li>`).join("")}</ul></details>` : ''}</section>`;
  }).join("")}`;
  return shell(inv, "Analyst workbench", body);
}
export function renderRevisions(inv: Investigation, revisions: {hash: string; updated_at: string; status: string; findings: number}[], previous?: Investigation): string {
  const diff = previous ? compareReports(previous, inv) : undefined;
  return shell(inv, "Preserved revisions", `<p>Revisions preserve collected data and analyst decisions. Hashes detect altered retained content; they do not certify the source or an analyst's conclusion.</p>${diff ? `<h2>Changes from selected revision to current report</h2><p>${diff.added.length} added · ${diff.removed.length} removed · ${diff.changed.length} changed evidence or assessments</p>${(['added','removed','changed'] as const).map(k => `<h3>${k}</h3><ul>${diff[k].map(f => `<li>${escape(f.field)}: ${escape(f.value)}</li>`).join('') || '<li>None</li>'}</ul>`).join('')}` : ''}<table class="wikitable"><thead><tr><th>Saved</th><th>State</th><th>Findings</th><th>Revision</th></tr></thead><tbody>${revisions.map(r => `<tr><td>${escape(dateTime(r.updated_at))}</td><td>${escape(r.status)}</td><td>${r.findings}</td><td><a href="?compare=${r.hash}">Compare with current</a> · <a href="/reports/${inv.id}/revisions/${r.hash}.json"><code>${r.hash.slice(0, 12)}</code> JSON</a></td></tr>`).join('')}</tbody></table>`);
}
export function provenanceGraph(inv: Investigation) {
  return {
    schema_version: "1.0", investigation: inv.id,
    nodes: [...inv.sources.map(s => ({id: 'source:'+s.id, type: 'source', url: s.url, snapshot_hash: s.snapshot_hash})),
      ...inv.findings.map(f => ({id:'finding:'+f.id, type:'finding', field:f.field, value:f.value, assessment:assessFinding(inv,f)}))],
    edges: inv.evidence.map(e => ({from:'source:'+e.source_id,to:'finding:'+e.finding_id,relationship:'reports',evidence_id:e.id,retrieved_at:e.retrieved_at})),
  };
}
