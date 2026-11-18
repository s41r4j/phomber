import { contentHash } from "./trust.js";
import type { Json } from "../adapters/http.js";
import { randomUUID, createHash } from "node:crypto";
import { join } from "node:path";
import { buildPlan, collect } from "../adapters/index.js";
import { HttpClient, SourceError } from "../adapters/http.js";
import { validateInput, publicURL, validPartialDate } from "./schema.js";
import { Workspace } from "../workspace/index.js";
import type {
  Input,
  Investigation,
  Finding,
  Source,
  Candidate,
} from "./types.js";
const key = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);
export function addFinding(
  inv: Investigation,
  record: Candidate,
  source?: Source,
): void {
  const id = key(
    [
      record.category,
      record.field,
      record.value,
      record.identity || "provided",
      record.identity === "candidate" ? source?.id || "" : "",
    ].join("|"),
  );
  let finding = inv.findings.find((x) => x.id === id);
  if (!finding) {
    const anchored = record.identity === "anchored";
    finding = {
      id,
      category: record.category,
      field: record.field,
      value: record.value,
      status: source ? (anchored ? "verified" : "lead") : "user-provided",
      source_ids: [],
      identity: record.identity || "provided",
      confidence: {
        score: null,
        explanation:
          source && anchored
            ? "Exact field retrieved from the supplied resource. Identity ownership and claim credibility are unassessed; no probability is assigned."
            : source
              ? "Candidate match only; no identity probability assigned."
              : "Provided by the investigator; not independently checked.",
      },
    };
    inv.findings.push(finding);
  }
  if (source && !finding.source_ids.includes(source.id)) {
    finding.source_ids.push(source.id);
    inv.evidence.push({
      id: key(id + source.id),
      finding_id: id,
      source_id: source.id,
      excerpt: (record.excerpt || `${record.field}: ${record.value}`).slice(
        0,
        2000,
      ),
      retrieved_at: source.retrieved_at,
    });
    // Repeated reporting is retained as evidence, never automatic independent corroboration.

  }
  if (
    record.date?.start &&
    validPartialDate(record.date.start) &&
    !inv.timeline.some(
      (t) => t.title === record.field && t.date.start === record.date?.start,
    )
  )
    inv.timeline.push({
      title: record.field,
      date: record.date,
      source_ids: source ? [source.id] : [],
      status: finding.status,
    });
  if (
    record.category === "timeline" &&
    !record.date &&
    /^\d{4}-\d{2}-\d{2}/.test(record.value) && validPartialDate(record.value.slice(0, 10))
  ) {
    const date = {
      start: record.value.slice(0, 10),
      precision: "day" as const,
    };
    if (
      !inv.timeline.some(
        (t) => t.title === record.field && t.date.start === date.start,
      )
    )
      inv.timeline.push({
        title: record.field,
        date,
        source_ids: source ? [source.id] : [],
        status: finding.status,
      });
  }
  if (
    record.category === "connections" &&
    source &&
    record.identity === "anchored" &&
    !inv.connections.some((c) => c.name === record.field)
  )
    inv.connections.push({
      name: record.field,
      relationship: record.relationship || record.value,
      source_ids: [source.id],
      status: "verified",
    });
}
function userFindings(inv: Investigation): void {
  const s = inv.input.subject;
  for (const [field, value] of Object.entries(s)) {
    if (["metadata", "custom"].includes(field)) continue;
    if (typeof value === "string")
      addFinding(inv, { category: "identity", field, value });
    else if (Array.isArray(value))
      for (const entry of value)
        addFinding(inv, {
          category: field,
          field:
            typeof entry === "string"
              ? field
              : String(
                  entry.title ||
                    entry.name ||
                    entry.institution ||
                    entry.platform ||
                    field,
                ),
          value: typeof entry === "string" ? entry : JSON.stringify(entry),
          date: typeof entry === "object" ? entry.date : undefined,
        });
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value))
        addFinding(inv, {
          category: field,
          field: k,
          value: typeof v === "string" ? v : JSON.stringify(v),
        });
  }
}
export function correlate(inv: Investigation): void {
  // Report disagreements; never silently merge accounts or erase contradictory evidence.
  for (const provided of inv.findings.filter(
    (f) =>
      f.status === "user-provided" && ["name", "company"].includes(f.field),
  )) {
    const candidates = inv.findings.filter(
      (f) => f.identity === "anchored" && f.field === provided.field,
    );
    for (const f of candidates)
      if (
        f.value.toLowerCase().trim() !== provided.value.toLowerCase().trim()
      ) {
        f.status = "conflicting";
        f.confidence = {
          score: null,
          explanation:
            "This supplied account reports a different " +
            f.field +
            ". It may be an alias, outdated value, or another identity. Review the evidence.",
        };
      }
  }
  // Cross-links establish links between resources, not a legal or personal identity.
  const supplied = (inv.input.subject.socials || []).flatMap((s) =>
    s.url
      ? [s.url.replace(/\/$/, "").toLowerCase()]
      : s.platform === "github" && s.username
        ? ["https://github.com/" + s.username.toLowerCase()]
        : [],
  );
  for (const f of inv.findings.filter(
    (f) => f.identity === "anchored" && f.field === "website",
  ))
    if (supplied.includes(f.value.replace(/\/$/, "").toLowerCase()))
      f.confidence.explanation +=
        " The account explicitly links to another investigator-supplied profile.";
}
export async function investigate(
  input: Input,
  workspace: Workspace,
  options: {
    resume?: Investigation;
    signal?: AbortSignal;
    progress?: (s: string) => void;
  } = {},
): Promise<Investigation> {
  input = structuredClone(validateInput(input));
  for (const field of input.research?.omit || []) {
    if (field in input.subject)
      delete (input.subject as unknown as Record<string, unknown>)[field];
  }
  validateInput(input);
  for (const u of [
    ...(input.subject.websites || []),
    ...(input.subject.socials || []).flatMap((x) => (x.url ? [x.url] : [])),
  ])
    publicURL(u);
  await workspace.init();
  const now = new Date().toISOString();
  const inv: Investigation = {
    schema_version: "1.0",
    research_timing: { started_at: now },
    id:
      options.resume?.id ||
      ((
        input.subject.name ||
        input.subject.usernames?.[0] ||
        input.subject.socials?.[0]?.username ||
        input.subject.domains?.[0] ||
        input.subject.professional?.company ||
        "subject"
      )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)
        .replace(/^-|-$/g, "") || "subject") +
        "-" +
        randomUUID(),
    created_at: options.resume?.created_at || now,
    updated_at: now,
    status: "running",
    input,
    findings: [],
    sources: [],
    evidence: [],
    connections: [],
    timeline: [],
    plan: [],
    warnings: [],
    summary: "",
    depth: input.research?.depth || "standard",
  };
  userFindings(inv);
  if (
    input.subject.name &&
    !(
      input.subject.socials?.length ||
      input.subject.websites?.length ||
      input.subject.usernames?.length
    )
  )
    inv.warnings.push(
      "Name-only research is ambiguous. Search results are leads, never automatically merged into the subject.",
    );
  inv.warnings.push(
    "Verification describes evidence retrieved from a resource; it does not prove account ownership or the truth of self-reported claims. Precise locations and contact details are not collected.",
  );
  const plan: ReturnType<typeof buildPlan> = input.research?.ai_only
    ? { tasks: [], skipped: [], unsupported: [], queries: ["Research through DeepSeek Search/Fetch only; source adapters are disabled."] }
    : buildPlan(input);
  if (input.research?.ai_only)
    inv.warnings.push("DeepSeek-only mode: source adapters and separate portrait downloads are disabled.");
  inv.plan = plan.queries;
  inv.tasks = [...plan.tasks, ...plan.skipped].map(task => ({ id: key(task.url), adapter: task.adapter,
    url: task.url, status: plan.skipped.includes(task) ? "skipped" : "queued" }));
  for (const task of plan.skipped)
    inv.sources.push({
      id: key(task.url), adapter: task.adapter, url: task.url,
      retrieved_at: now, status: "unsupported",
      detail: "Not collected: investigation request limit reached. Increase depth or narrow the supplied identifiers.",
    });
  if (plan.skipped.length)
    inv.warnings.push(`${plan.skipped.length} source requests skipped because the ${inv.depth} request limit was reached.`);
  if (!plan.tasks.length && !input.research?.ai_only)
    inv.warnings.push("No automated source requests are available for the supplied identifiers. Add a supported profile, name, username or domain, or use AI web research.");
  for (const p of plan.unsupported) {
    const url = p.url || "";
    const id = key("unsupported" + p.platform + (p.username || url));
    if (!inv.sources.some((s) => s.id === id))
      inv.sources.push({
        id,
        adapter: p.platform,
        url,
        retrieved_at: now,
        status: "unsupported",
        detail:
          "Automated collection is unavailable. Review this supplied profile manually; no account existence or identity claim is made.",
      });
  }
  for (const imported of input.evidence || []) {
    const url = publicURL(imported.url).href,
      id = key("imported" + url),
      source: Source = {
        id,
        adapter: "imported-evidence",
        url,
        retrieved_at: imported.retrieved_at,
        status: "ok",
        detail: "Imported by investigator; not independently retrieved.",
      };
    if (!inv.sources.some((s) => s.id === id)) inv.sources.push(source);
    addFinding(inv, { ...imported, identity: "candidate" }, source);
  }
  const http = new HttpClient(
    join(workspace.root, "cache"),
    options.signal,
    input.research?.offline,
    3600000,
    { maxRequests: inv.depth === "quick" ? 8 : inv.depth === "standard" ? 30 : 70 },
  );
  await workspace.save(inv);
  for (const task of plan.tasks) {
    if (options.signal?.aborted) {
      inv.status = "interrupted";
      break;
    }
    options.progress?.("Collecting " + task.adapter);
    const id = key(task.url);
    const checkpoint = inv.tasks!.find(t => t.id === id)!;
    checkpoint.status = "running"; checkpoint.started_at = new Date().toISOString();
    await workspace.save(inv);
    try {
      const previous = options.resume;
      const saved = previous?.sources.find(s => s.id === id && s.status === "ok" && s.snapshot_hash);
      const age = saved ? Date.now() - Date.parse(saved.retrieved_at) : Infinity;
      const recover = saved && age >= 0 && age < 3600000 &&
        ["interrupted", "running"].includes(previous!.status) &&
        contentHash(previous!.input) === contentHash(input) &&
        previous!.tasks?.some(t => t.id === id && t.status === "succeeded");
      const result = recover ? await (async () => {
        const payload = await workspace.readObject(inv.id, "snapshots", saved.snapshot_hash!) as Json;
        const pages = saved.pages && saved.pages > 1 && payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as { pages: Json[] }).pages : [payload];
        if (!Array.isArray(pages)) throw new Error("Invalid checkpoint snapshot.");
        checkpoint.detail = "Recovered from an intact, fresh collection checkpoint.";
        return { payload, records: pages.flatMap(data => task.parse(data)).filter(r => r.value.trim()).map(r => ({ ...r, identity: task.identity })),
          retrieved_at: saved.retrieved_at, cached: !!saved.cached, final_url: saved.final_url,
          pages: saved.pages || 1, limitation: undefined };
      })() : await collect(task, http, inv.depth === "quick" ? 1 : inv.depth === "standard" ? 3 : 5);
      const source: Source = {
          id,
          adapter: task.adapter,
          url: task.url,
          retrieved_at: result.retrieved_at,
          status: "ok",
          cached: result.cached,
          snapshot_hash: await workspace.preserveSource(inv.id, result.payload),
          adapter_version: "gen2-json-v1",
          final_url: result.final_url,
          pages: result.pages,
          detail: result.limitation || (result.records.length
            ? undefined
            : "No usable records returned; this is not evidence of absence."),
        };
      inv.sources = inv.sources.filter((s) => s.id !== id);
      inv.sources.push(source);
      for (const record of result.records) addFinding(inv, record, source);
      checkpoint.status = result.limitation ? "partial" : "succeeded";
      checkpoint.detail = result.limitation || checkpoint.detail;
    } catch (e) {
      checkpoint.status = options.signal?.aborted ? "cancelled" : "failed";
      checkpoint.detail = (e as Error).message;
      inv.sources = inv.sources.filter((s) => s.id !== id);
      inv.sources.push({
        id,
        adapter: task.adapter,
        url: task.url,
        retrieved_at: new Date().toISOString(),
        status: "unavailable",
        error_code: e instanceof SourceError ? e.code : options.signal?.aborted ? "cancelled" : "collection_failed",
        detail: options.signal?.aborted
          ? "Cancelled"
          : (e as Error).message.replace(
              /(?:key|token|password)=[^\s&]+/gi,
              "credential=[redacted]",
            ),
      });
    }
    checkpoint.finished_at = new Date().toISOString();
    inv.updated_at = new Date().toISOString();
    await workspace.save(inv);
  }
  if (options.signal?.aborted) {
    inv.status = "interrupted";
    for (const task of inv.tasks || []) if (task.status === "queued") task.status = "cancelled";
  }
  correlate(inv);
  inv.timeline.sort((a, b) =>
    (a.date.start || "").localeCompare(b.date.start || ""),
  );
  inv.warnings = [...new Set(inv.warnings)];
  if (inv.status === "running")
    inv.status = !inv.sources.length || inv.sources.some((s) => s.status !== "ok") || inv.tasks?.some(t => t.status !== "succeeded")
      ? "partial"
      : "complete";
  const verified = inv.findings.filter(
    (f) => f.status === "verified" || f.status === "corroborated",
  ).length;
  inv.summary = `${inv.sources.filter((s) => s.status === "ok").length} sources retrieved; ${verified} source-backed fields on supplied resources; ${inv.findings.filter((f) => f.status === "lead").length} unverified leads. ${inv.sources.filter((s) => s.status !== "ok").length} sources unavailable or unsupported.`;
  inv.updated_at = new Date().toISOString();
  await workspace.save(inv);
  await workspace.updateIndex();
  return inv;
}
