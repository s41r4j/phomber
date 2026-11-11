import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  mkdir,
  writeFile,
  rename,
  readFile,
  readdir,
  lstat,
  realpath,
  rm,
  cp,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { validateInvestigation } from "../core/schema.js";
import type { Investigation, IndexEntry } from "../core/types.js";
export const validId = (id: string) => /^[a-z0-9][a-z0-9-]{5,100}$/.test(id);
export async function atomicJSON(path: string, value: unknown): Promise<void> {
  await atomicFile(path, JSON.stringify(value, null, 2) + "\n");
}
export async function atomicFile(path: string, value: string): Promise<void> {
  const tmp = path + "." + randomUUID() + ".tmp";
  try {
    await writeFile(tmp, value, { mode: 0o600, flag: "wx" });
    await rename(tmp, path);
  } finally {
    await rm(tmp, { force: true });
  }
}
export class Workspace {
  readonly root: string;
  constructor(root = process.env.PHOMBER_HOME || join(homedir(), ".phomber")) {
    this.root = resolve(root);
  }
  async init(): Promise<void> {
    for (const p of [
      this.root,
      ...["reports", "cache", "logs", "exports"].map((x) => join(this.root, x)),
    ]) {
      await mkdir(p, { recursive: true, mode: 0o700 });
      if ((await lstat(p)).isSymbolicLink())
        throw new Error("Workspace directories must not be symbolic links.");
    }
    try {
      await writeFile(
        join(this.root, "config.json"),
        JSON.stringify(
          {
            schema_version: "1.0",
            port: 4317,
            ai: { provider: "deepseek", model: "deepseek-flash" },
          },
          null,
          2,
        ),
        { flag: "wx", mode: 0o600 },
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  reportPath(id: string): string {
    if (!validId(id)) throw new Error("Invalid report ID.");
    return join(this.root, "reports", id);
  }
  async safeReport(id: string): Promise<string> {
    const p = this.reportPath(id);
    const actual = await realpath(p);
    if (
      (await lstat(p)).isSymbolicLink() ||
      actual !== join(await realpath(this.root), "reports", id)
    )
      throw new Error("Report links are not allowed.");
    return actual;
  }
  async load(id: string): Promise<Investigation> {
    const p = await this.safeReport(id);
    const file = join(p, "investigation.json");
    if (!(await lstat(file)).isFile())
      throw new Error("Invalid investigation file.");
    const value = validateInvestigation(
      JSON.parse(await readFile(file, "utf8")),
    );
    if (
      value.id !== id ||
      value.schema_version !== "1.0" ||
      !Array.isArray(value.findings)
    )
      throw new Error("Unsupported or corrupt investigation.");
    return value;
  }
  async save(inv: Investigation): Promise<string> {
    validateInvestigation(inv);
    const p = this.reportPath(inv.id);
    await mkdir(p, { recursive: true, mode: 0o700 });
    await this.safeReport(inv.id);
    await atomicJSON(join(p, "investigation.json"), inv);
    return p;
  }
  async list(includeSearch = false): Promise<IndexEntry[]> {
    const out: IndexEntry[] = [];
    for (const id of await readdir(join(this.root, "reports"))) {
      if (!validId(id)) continue;
      try {
        const v = await this.load(id);
        out.push({
          ...(includeSearch
            ? {
                search_text: v.findings
                  .map((f) => f.field + " " + f.value)
                  .join(" "),
              }
            : {}),
          id,
          name:
            v.input.subject.name ||
            v.input.subject.usernames?.[0] ||
            v.input.subject.socials?.[0]?.username ||
            v.input.subject.professional?.company ||
            v.input.subject.domains?.[0] ||
            "Unnamed subject",
          type: v.input.subject.type || "person",
          research_started_at: v.research_timing?.started_at,
          research_finished_at: v.research_timing?.finished_at,
          duration_ms: v.research_timing?.duration_ms,
          created_at: v.created_at,
          updated_at: v.updated_at,
          status: v.status,
          source_count: v.sources.filter((x) => x.status === "ok").length,
          verified_count: v.findings.filter(
            (x) => x.status === "verified" || x.status === "corroborated",
          ).length,
          depth: v.depth,
          formats: ["html", "json"],
        });
      } catch {
        /* A damaged report cannot hide other investigations. */
      }
    }
    return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  async updateIndex(): Promise<void> {
    await atomicJSON(join(this.root, "index.json"), await this.list());
  }
  async export(id: string, output?: string): Promise<string> {
    const from = await this.safeReport(id);
    const to = resolve(
      output || join(this.root, "exports", id + "-" + Date.now()),
    );
    if (to === from || to.startsWith(from + "/") || to.startsWith(from + "\\"))
      throw new Error("Export destination must be outside the report.");
    await mkdir(to, { recursive: false, mode: 0o700 });
    for (const file of await readdir(from)) {
      if (!/^[a-z]+\.(json|html)$/.test(file)) continue;
      const p = join(from, file);
      if ((await lstat(p)).isFile())
        await cp(p, join(to, file), { errorOnExist: true, force: false });
    }
    return to;
  }
}
