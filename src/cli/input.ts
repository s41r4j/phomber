import { parseArgs } from "node:util";
import { readFile, stat } from "node:fs/promises";
import { normalizeSocial } from "../adapters/index.js";
import { validateInput } from "../core/schema.js";
import type { Input, Depth } from "../core/types.js";
const repeat = [
  "alias",
  "username",
  "company",
  "education",
  "social",
  "connection",
  "website",
  "domain",
  "project",
  "omit",
];
const strings = [
  "name",
  "location",
  "depth",
  "input",
  "format",
  "port",
  "output",
  "resume",
  "type",
  "model",
];
const booleans = [
  "no-ai",
  "synthesize-only",
  "save-key",
  "help",
  "no-serve",
  "open",
  "offline",
  "yes",
];
export function parse(argv: string[]) {
  const options: Record<
    string,
    { type: "string" | "boolean"; multiple?: boolean; short?: string }
  > = {};
  for (const k of repeat) options[k] = { type: "string", multiple: true };
  for (const k of strings) options[k] = { type: "string" };
  for (const k of booleans)
    options[k] = { type: "boolean", ...(k === "help" ? { short: "h" } : {}) };
  return parseArgs({
    args: argv,
    options,
    allowPositionals: true,
    strict: true,
  });
}
export type Args = ReturnType<typeof parse>;
export async function readInputFile(file: string): Promise<Input> {
  if ((await stat(file)).size > 1_000_000)
    throw new Error("Input exceeds 1 MB.");
  try {
    return validateInput(JSON.parse(await readFile(file, "utf8")));
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}
export async function inputFromArgs(args: Args, base?: Input): Promise<Input> {
  const v = args.values;
  let input: Input = base
    ? structuredClone(base)
    : {
        schema_version: "1.0",
        subject: { type: "person" },
        research: { depth: "standard" },
        output: ["html", "json"],
      };
  if (typeof v.input === "string") input = await readInputFile(v.input);
  const s = input.subject;
  for (const key of ["name", "location", "type"] as const)
    if (typeof v[key] === "string") s[key] = v[key] as string;
  const many = (k: string): string[] =>
    Array.isArray(v[k]) ? (v[k] as string[]) : [];
  const append = <T>(current: T[] | undefined, added: T[]): T[] => [
    ...(current || []),
    ...added,
  ];
  if (v.alias) s.aliases = append(s.aliases, many("alias"));
  if (v.username) s.usernames = append(s.usernames, many("username"));
  if (v.social)
    s.socials = append(s.socials, many("social").map(normalizeSocial));
  if (v.website) s.websites = append(s.websites, many("website"));
  if (v.domain) s.domains = append(s.domains, many("domain"));
  if (v.company) {
    s.professional = {
      ...s.professional,
      company: s.professional?.company || many("company")[0],
      companies: append(s.professional?.companies, many("company")),
    };
  }
  if (v.education)
    s.education = append(
      s.education,
      many("education").map((institution) => ({ institution })),
    );
  if (v.connection)
    s.connections = append(
      s.connections,
      many("connection").map((name) => ({
        name,
        relationship: "investigator supplied; unverified",
      })),
    );
  if (v.project)
    s.projects = append(
      s.projects,
      many("project").map((name) => ({ name })),
    );
  input.research = {
    ...input.research,
    ...(v.depth ? { depth: v.depth as Depth } : {}),
    ...(v.offline ? { offline: true } : {}),
    ...(v.omit ? { omit: append(input.research?.omit, many("omit")) } : {}),
  };
  if (v.format && !["json", "html", "text"].includes(String(v.format)))
    throw new Error("--format must be json, html or text.");
  return validateInput(input);
}
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let token = "",
    quote = "",
    active = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quote) {
      if (c === quote) quote = "";
      else token += c;
      active = true;
    } else if (c === '"' || c === "'") {
      quote = c;
      active = true;
    } else if (/\s/.test(c)) {
      if (active) {
        out.push(token);
        token = "";
        active = false;
      }
    } else {
      token += c;
      active = true;
    }
  }
  if (quote) throw new Error("Unclosed quote.");
  if (active) out.push(token);
  return out;
}
