import type { IndexEntry } from "../core/types.js";

// Public source values must not inject terminal controls into readable output.
const clean = (value: unknown): string => String(value ?? "Not recorded")
  .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
  .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "")
  .replaceAll("\u2014", "-");
const label = (key: string) => clean(key).replaceAll("_", " ")
  .replace(/\b\w/g, c => c.toUpperCase()).replace(/\bId\b/g, "ID").replace(/\bUrl\b/g, "URL");
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function date(value?: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function details(value: unknown, indent = ""): string {
  if (Array.isArray(value)) {
    if (!value.length) return indent + "None";
    return value.map((item, i) => object(item) || Array.isArray(item)
      ? `${indent}${i + 1}.\n${details(item, indent + "   ")}`
      : indent + "- " + clean(item)).join("\n");
  }
  if (object(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (!entries.length) return indent + "No details available.";
    return entries.map(([key, v]) => {
      if (Array.isArray(v) && v.every(x => !object(x) && !Array.isArray(x)))
        return `${indent}${label(key)}: ${v.length ? v.map(clean).join(", ") : "None"}`;
      return object(v) || Array.isArray(v)
        ? `${indent}${label(key)}\n${details(v, indent + "  ")}`
        : `${indent}${label(key)}: ${typeof v === "boolean" ? v ? "Yes" : "No" : clean(v)}`;
    }).join("\n");
  }
  return indent + clean(value);
}
function reports(entries: IndexEntry[], title: string): string {
  const heading = `${title} (${entries.length})`;
  if (!entries.length) return `${heading}\n\n${title === "Saved investigations" ? "No saved investigations yet. Run phomber find to create one." : "No matching reports. Try a different name, handle or context word."}`;
  return heading + "\n\n" + entries.map((entry, i) => [
    `${i + 1}. ${clean(entry.name)} [${clean(entry.status)}]`,
    `   ID: ${clean(entry.id)}`,
    `   Sources retrieved: ${entry.source_count} | Verified findings: ${entry.verified_count}`,
    `   Updated: ${date(entry.updated_at)} | Depth: ${clean(entry.depth)}`,
  ].join("\n")).join("\n\n") + "\n\nBrowse: phomber serve\nOpen:   phomber reports open REPORT_ID\nDelete: phomber reports delete REPORT_ID";
}
export function formatOutput(value: unknown, command = ""): string {
  if (typeof value === "string") return clean(value);
  if (command === "reports" && Array.isArray(value)) return reports(value, "Saved investigations");
  if (command === "search" && object(value) && Array.isArray(value.results))
    return reports(value.results as IndexEntry[], "Search results");
  const title = command ? "PH0MBER / " + label(command) : "PH0MBER";
  return title + "\n" + "=".repeat(title.length) + "\n\n" + details(value);
}
