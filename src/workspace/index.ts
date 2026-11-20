import {publicationAttribution} from "../core/publications.js";
import { articleText, safeArticleSections } from "../core/article.js";
import { subjectSearchText } from "../core/search.js";
import { canonicalJSON, contentHash, makeReview, type ReviewDecision } from "../core/trust.js";
import { setTimeout as sleep } from "node:timers/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  mkdir,
  writeFile,
  rename,
  link,
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
const writes = new Map<string, Promise<unknown>>();
export class Workspace {
  readonly root: string;
  constructor(root = process.env.PHOMBER_HOME || join(homedir(), ".phomber")) {
    this.root = resolve(root);
  }
  async init(): Promise<void> {
    for (const p of [
      this.root,
      ...["reports", "cache", "logs", "exports", "deleted"].map((x) => join(this.root, x)),
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
  private locked<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const path = this.reportPath(id);
    const guarded = async () => {
      await this.assertNotDeleted(id);
      await mkdir(path, { recursive: true, mode: 0o700 });
      await this.safeReport(id);
      const lock = join(path, ".write-lock");
      const deadline = Date.now() + 10000;
      for (;;) {
        try { await mkdir(lock, { mode: 0o700 }); break; }
        catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
          if (!(await lstat(lock)).isDirectory()) throw new Error("Invalid report write lock.");
          if (Date.now() >= deadline) throw new Error("Report is locked by another writer. Retry after it finishes; an interrupted writer may require lock recovery.");
          await sleep(25);
        }
      }
      try {
        await this.assertNotDeleted(id);
        return await operation();
      } finally { await rm(lock, { recursive: true, force: true }); }
    };
    const task = (writes.get(path) || Promise.resolve()).then(guarded, guarded);
    const pending = task.catch(() => {});
    writes.set(path, pending);
    void pending.then(() => { if (writes.get(path) === pending) writes.delete(path); });
    return task;
  }
  private async objectDirectory(id: string, kind: "revisions" | "snapshots"): Promise<string> {
    await mkdir(this.reportPath(id), { recursive: true, mode: 0o700 });
    const report = await this.safeReport(id);
    const dir = join(report, kind);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    if (!(await lstat(dir)).isDirectory() || await realpath(dir) !== dir)
      throw new Error("Evidence directories must not be symbolic links.");
    return dir;
  }
  private async preserve(id: string, kind: "revisions" | "snapshots", data: unknown): Promise<string> {
    const hash = contentHash(data), path = join(await this.objectDirectory(id, kind), hash + ".json");
    const temporary = path + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, canonicalJSON(data) + "\n", { mode: 0o600, flag: "wx" });
      try { await link(temporary, path); }
      catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        await this.readObject(id, kind, hash);
      }
    } finally { await rm(temporary, { force: true }); }
    return hash;
  }
  async readObject(id: string, kind: "revisions" | "snapshots", hash: string): Promise<unknown> {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid content hash.");
    const report = await this.safeReport(id), dir = join(report, kind), file = join(dir, hash + ".json");
    if (!(await lstat(dir)).isDirectory() || await realpath(dir) !== dir || !(await lstat(file)).isFile())
      throw new Error("Evidence objects must be regular files.");
    const value: unknown = JSON.parse(await readFile(file, "utf8"));
    if (contentHash(value) !== hash) throw new Error("Evidence integrity check failed.");
    return value;
  }
  async preserveSource(id: string, data: unknown): Promise<string> {
    return this.locked(id, () => this.preserve(id, "snapshots", data));
  }
  private async assertNotDeleted(id: string): Promise<void> {
    this.reportPath(id);
    try { await lstat(join(this.root, "deleted", id + ".json")); }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
    throw new Error("Report was deleted. Start a new investigation instead of resuming this ID.");
  }
  async deleteReport(id: string, expectedHash?: string): Promise<void> {
    await this.safeReport(id);
    await this.locked(id, async () => {
      if (expectedHash !== undefined && contentHash(await this.load(id)) !== expectedHash)
        throw new Error("Report changed. Refresh before deleting the current version.");
      const path = await this.safeReport(id);
      const marker = join(this.root, "deleted", id + ".json");
      await atomicJSON(marker, { id, deleted_at: new Date().toISOString() });
      try { await rm(path, { recursive: true }); }
      catch (e) { await rm(marker, { force: true }); throw e; }
    });
    await this.updateIndex();
  }
  async history(id: string): Promise<{ hash: string; updated_at: string; status: string; findings: number }[]> {
    const dir = join(await this.safeReport(id), "revisions");
    let files: string[];
    try { files = await readdir(dir); } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    const out = [];
    for (const file of files.filter(f => /^[a-f0-9]{64}\.json$/.test(f))) {
      const hash = file.slice(0, -5), inv = validateInvestigation(await this.readObject(id, "revisions", hash));
      if (inv.id !== id) throw new Error("Revision belongs to another investigation.");
      out.push({ hash, updated_at: inv.updated_at, status: inv.status, findings: inv.findings.length });
    }
    return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.hash.localeCompare(b.hash));
  }
  private async saveUnlocked(inv: Investigation): Promise<string> {
    validateInvestigation(inv);
    await mkdir(this.reportPath(inv.id), { recursive: true, mode: 0o700 });
    const p = await this.safeReport(inv.id);
    try {
      const previous = await this.load(inv.id);
      await this.preserve(inv.id, "revisions", previous);
      // Analyst decisions survive collector checkpoints; changed evidence makes them stale.
      const reviews = new Map((previous.reviews || []).map(r => [r.id, r]));
      for (const review of inv.reviews || []) {
        if (reviews.has(review.id) && contentHash(reviews.get(review.id)) !== contentHash(review))
          throw new Error("Existing review decisions cannot be rewritten.");
        reviews.set(review.id, review);
      }
      if (reviews.size) inv.reviews = [...reviews.values()];
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    validateInvestigation(inv);
    await this.preserve(inv.id, "revisions", inv);
    await atomicJSON(join(p, "investigation.json"), inv);
    return p;
  }
  async save(inv: Investigation): Promise<string> {
    return this.locked(inv.id, () => this.saveUnlocked(inv));
  }
  async review(id: string, finding: string, expectedHash: string, value: {
    decision: string; identity: string; reason: string; analyst: string;
  }): Promise<ReviewDecision> {
    return this.locked(id, async () => {
      const inv = await this.load(id);
      if (contentHash(inv) !== expectedHash) throw new Error("Report changed. Refresh and review the current evidence.");
      const review = makeReview(inv, finding, value);
      (inv.reviews ??= []).push(review);
      inv.updated_at = new Date().toISOString();
      if (inv.ai) {
        inv.ai.sections = []; inv.ai.status = "partial"; inv.status = "partial";
        inv.ai.limitations = [...new Set([...inv.ai.limitations, "Analyst assessment changed. Regenerate the narrative from current evidence before using it."])];
      }
      await this.saveUnlocked(inv);
      return review;
    });
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
                search_text: id + " " + subjectSearchText(v.input.subject) + " " + v.findings
                  .filter(f=>publicationAttribution(v,f).research)
                  .map((f) => f.field + " " + f.value)
                  .join(" ") + " " + articleText(safeArticleSections(v)),
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
    try {
    for (const file of await readdir(from)) {
      if (!/^[a-z]+\.(json|html)$/.test(file)) continue;
      const p = join(from, file);
      if ((await lstat(p)).isFile())
        await cp(p, join(to, file), { errorOnExist: true, force: false });
    }
    for (const kind of ["revisions", "snapshots"] as const) {
      const dir = join(from, kind);
      let files: string[];
      try { files = await readdir(dir); } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw e;
      }
      await mkdir(join(to, kind), { mode: 0o700 });
      for (const file of files.filter(f => /^[a-f0-9]{64}\.json$/.test(f)))
        await writeFile(join(to, kind, file), canonicalJSON(await this.readObject(id, kind, file.slice(0, -5))) + "\n", { mode: 0o600, flag: "wx" });
    }
    return to;
    } catch (e) {
      await rm(to, { recursive: true, force: true });
      throw e;
    }
  }
}
