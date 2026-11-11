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
  const sources = new Set(value.sources.map((s) => s.id)),
    findings = new Set(value.findings.map((f) => f.id));
  if (
    value.findings.some((f) => f.source_ids.some((id) => !sources.has(id))) ||
    value.evidence.some(
      (e) => !sources.has(e.source_id) || !findings.has(e.finding_id),
    )
  )
    throw new Error("Report contains broken evidence references.");
  if(value.ai) validateArticleSections({sections:value.ai.sections},value);
  return value;
}
