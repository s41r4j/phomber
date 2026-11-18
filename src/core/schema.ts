import {validateArticleSections} from "./article.js";
import AjvModule from "ajv";
import { readFileSync } from "node:fs";
import type { Input, Investigation } from "./types.js";
const Ajv = AjvModule.default;
const schema = JSON.parse(
  readFileSync(
    new URL("../../schemas/subject.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv({ allErrors: true, strict: false });
export function validPartialDate(value: string): boolean {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (!match[2]) return true;
  if (month < 1 || month > 12) return false;
  if (!match[3]) return true;
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1]!;
}
ajv.addFormat("partial-date", validPartialDate);
const validate = ajv.compile<Input>(schema);
export function validateInput(value: unknown): Input {
  if (!validate(value))
    throw new Error(
      "Invalid investigation input: " +
        validate.errors
          ?.map((e) => `${e.instancePath || "/"} ${e.message}`)
          .join("; "),
    );
  const s = value.subject;
  if (value.research?.ai_only && (value.research.offline || value.research.ai === false))
    throw new Error("DeepSeek-only collection requires online AI. Use --ai-only to enable it, or --no-ai to return to source adapters.");
  for (const e of value.evidence || [])
    if (!Number.isFinite(Date.parse(e.retrieved_at)))
      throw new Error("Evidence retrieved_at must be a valid timestamp.");
  if (
    ![
      s.name,
      ...(s.usernames ?? []),
      ...(s.socials ?? []).map((x) => x.username || x.url),
      ...(s.websites ?? []),
      ...(s.domains ?? []),
      s.professional?.company,
      ...(s.professional?.companies ?? []),
    ].some((x) => typeof x === "string" && x.trim())
  )
    throw new Error(
      "Provide at least one name, username, social profile, website, domain, or company.",
    );
  return value;
}
export function publicURL(value: string): URL {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443")
  )
    throw new Error(
      "Use a public HTTPS URL without credentials or custom ports.",
    );
  if (
    /^(localhost|.*\.localhost|.*\.local)$/i.test(u.hostname) ||
    /^[\d.]+$/.test(u.hostname) ||
    u.hostname.includes(":") ||
    !u.hostname.includes(".")
  )
    throw new Error("Private or literal network addresses are not allowed.");
  if (
    [...u.searchParams.keys()].some((k) =>
      /^(api[-_]?key|access[-_]?token|token|secret|password|authorization|auth|key)$/i.test(
        k,
      ),
    )
  )
    throw new Error("URLs containing credential parameters are not allowed.");
  return u;
}

const outputSchema = JSON.parse(
  readFileSync(
    new URL("../../schemas/investigation.schema.json", import.meta.url),
    "utf8",
  ),
);
const outputValidator = ajv.compile<Investigation>(outputSchema);
export function validateInvestigation(value: unknown): Investigation {
  if (!outputValidator(value))
    throw new Error(
      "Invalid report format: " + ajv.errorsText(outputValidator.errors),
    );
  validateInput(value.input);
  for (const records of [value.sources, value.findings, value.evidence])
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error("Report contains duplicate record IDs.");
  const sources = new Set(value.sources.map((s) => s.id)),
    findings = new Set(value.findings.map((f) => f.id));
  if (
    value.findings.some((f) => f.source_ids.some((id) => !sources.has(id))) ||
    value.evidence.some(
      (e) => !sources.has(e.source_id) || !findings.has(e.finding_id) ||
        !value.findings.find((f) => f.id === e.finding_id)?.source_ids.includes(e.source_id),
    )
  )
    throw new Error("Report contains broken evidence references.");
  if ([...value.timeline, ...value.connections].some((r) => r.source_ids.some((id) => !sources.has(id))) ||
      (value.portrait && !sources.has(value.portrait.source_id)))
    throw new Error("Report contains broken source references.");
  if (value.timeline.some(t => (t.date.start && !validPartialDate(t.date.start)) || (t.date.end && !validPartialDate(t.date.end))))
    throw new Error("Report contains invalid timeline dates.");
  for (const records of [value.reviews || [], value.tasks || []])
    if (new Set(records.map(r => r.id)).size !== records.length)
      throw new Error("Report contains duplicate audit records.");
  if (value.reviews?.some(r => !r.reason.trim() || !r.analyst.trim() || !Number.isFinite(Date.parse(r.created_at)) ||
    (r.decision === "accepted" && r.identity === "different")))
    throw new Error("Invalid analyst review.");
  if(value.ai) validateArticleSections({sections:value.ai.sections},value);
  return value;
}
