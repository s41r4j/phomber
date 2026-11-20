import {publicationAttribution} from "../core/publications.js";
import {articleText,safeArticleSections} from "../core/article.js";
import { subjectSearchText } from "../core/search.js";
import { readFile, writeFile, mkdir, rm, lstat, readdir, rename, rmdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { hostname } from "node:os";
import { contentHash } from "../core/trust.js";
import { researchName } from "../core/research.js";
import { groupArticles, type GroupingDecision } from "./grouping.js";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Workspace, atomicJSON } from "../workspace/index.js";
import {
  loadLibrary,
  wikiText,
  type WikiArticle,
  type WikiNode,
} from "../reports/library.js";
import type { Investigation } from "../core/types.js";
export interface CatalogArticle {
  key: string;
  id: string;
  title: string;
  kind: "research" | "archive";
  url: string;
  keys: string[];
  text: string;
  date?: string;
  started?: string;
  finished?: string;
  retrieved?: string;
  status: string;
  source_count: number;
  inv?: Investigation;
  archive?: WikiArticle;
  profile_id?: string;
  version?: number;
  grouping?: GroupingDecision;
}
export interface Profile {
  id: string;
  title: string;
  keys: string[];
  first_seen_at: string;
  articles: CatalogArticle[];
  aliases?: string[];
}
interface LegacyRegistry {
  version: 1;
  assignments: Record<string, string>;
  profiles: Record<
    string,
    { title: string; keys: string[]; first_seen_at: string; custom_title?: boolean }
  >;
}
interface Registry extends LegacyRegistry {
  grouping_version: 2;
  manual: Record<string, boolean>;
  separations: [string, string][];
  redirects: Record<string, string>;
}
const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function profileKeys(name: string, handles: string[]): string[] {
  return [
    ...new Set([
      ...(normalize(name) ? ["name:" + normalize(name)] : []),
      ...handles
        .filter(Boolean)
        .map((h) => "handle:" + h.replace(/^@/, "").toLowerCase()),
    ]),
  ];
}
export function archiveHandles(nodes: WikiNode[]): string[] {
  const found: string[] = [];
  function links(list: WikiNode[]) {
    for (const n of list) {
      if (n.tag === "a" && n.href) {
        try {
          const u = new URL(n.href),
            parts = u.pathname.split("/").filter(Boolean);
          if (
            [
              "github.com",
              "gitlab.com",
              "dev.to",
              "huggingface.co",
              "x.com",
              "instagram.com",
            ].includes(u.hostname) &&
            parts.length === 1
          )
            found.push(parts[0]!);
        } catch {}
      }
      if (n.children) links(n.children);
    }
  }
  function visit(list: WikiNode[]) {
    for (const n of list) {
      if ((n.class || "").split(/\s+/).includes("infobox"))
        links(n.children || []);
      else if (n.children) visit(n.children);
    }
  }
  visit(nodes);
  return found;
}
export function reportTitle(inv: Investigation): string {
  return (
    researchName(inv) ||
    inv.input.subject.usernames?.[0] ||
    inv.input.subject.socials?.[0]?.username ||
    inv.input.subject.professional?.company ||
    inv.input.subject.domains?.[0] ||
    inv.input.subject.websites?.[0] ||
    inv.input.subject.socials?.[0]?.url ||
    "Unnamed subject"
  );
}
const dateValue = (a: CatalogArticle) => a.date || "";
const catalogWrites = new Map<string, Promise<unknown>>();
const lockHost = contentHash(hostname()).slice(0, 16);
const lockOwnerPattern = /^([0-9a-f]{16})-([1-9]\d{0,9})-[0-9a-f-]{36}$/;

async function removeEmptyLock(path: string): Promise<void> {
  try { await rmdir(path); }
  catch (error) {
    if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes((error as NodeJS.ErrnoException).code || "")) throw error;
  }
}

async function catalogLockAvailable(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (!info.isDirectory()) throw new Error("Invalid profile catalog lock.");
    const owners = await readdir(path);
    if (owners.length === 0) {
      // Legacy writers used an empty directory. Allow them time to finish.
      if (Date.now() - info.mtimeMs >= 60000) await removeEmptyLock(path);
      return false;
    }
    const owner = owners[0]!;
    const match = owners.length === 1 && lockOwnerPattern.exec(owner);
    if (!match) throw new Error("Invalid profile catalog lock owner.");
    if (match[1] !== lockHost) return false;
    try { process.kill(Number(match[2]), 0); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM") return false;
      if (code !== "ESRCH") throw error;
      // Contenders can remove only this dead owner's unique marker. A newly
      // acquired lock is always nonempty, so rmdir cannot remove it.
      await rm(join(path, owner), { force: true });
      await removeEmptyLock(path);
    }
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

export class Catalog {
  private registry?: Registry;
  constructor(readonly workspace: Workspace) {}
  private async locked<T>(fn: () => Promise<T>): Promise<T> {
    const guarded = async () => {
      await this.workspace.init();
      const lock = join(this.workspace.root, "profiles.lock"), deadline = Date.now() + 10000;
      const owner = `${lockHost}-${process.pid}-${randomUUID()}`;
      const staged = lock + "." + owner;
      await mkdir(staged, { mode: 0o700 });
      try {
        await writeFile(join(staged, owner), "", { flag: "wx", mode: 0o600 });
        for (;;) {
          if (await catalogLockAvailable(lock)) {
            try {
              // Publish the directory and owner together so a contender
              // never sees a newly acquired lock without an owner.
              await rename(staged, lock);
              break;
            } catch (error) {
              // Windows may report a permissions error if another writer won the rename.
              if (!["EEXIST", "ENOTEMPTY", "EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code || "")) throw error;
            }
          }
          if (Date.now() >= deadline) throw new Error("Profile catalog is locked by another writer. Retry after it finishes.");
          await sleep(25);
        }
        try { return await fn(); }
        finally {
          await rm(join(lock, owner), { force: true });
          await removeEmptyLock(lock);
        }
      } finally {
        await rm(staged, { recursive: true, force: true });
      }
    };
    const task = (catalogWrites.get(this.workspace.root) || Promise.resolve()).then(guarded, guarded);
    const pending = task.catch(() => {});
    catalogWrites.set(this.workspace.root, pending);
    void pending.then(() => { if (catalogWrites.get(this.workspace.root) === pending) catalogWrites.delete(this.workspace.root); });
    return task;
  }
  async read(): Promise<Profile[]> {
    return this.locked(() => this.build());
  }
  private async build(): Promise<Profile[]> {
    await this.workspace.init();
    let migrated = false;
    try {
        const file = join(this.workspace.root, "profiles.json");
        if (!(await lstat(file)).isFile()) throw new Error("Profile catalog must be a regular file.");
        const original = await readFile(file, "utf8");
        const raw = JSON.parse(original) as Registry | LegacyRegistry;
        if (raw.version !== 1 || !raw.assignments || typeof raw.assignments !== "object" || !raw.profiles || typeof raw.profiles !== "object")
          throw new Error("Unsupported profile catalog.");
        for (const [key, p] of Object.entries(raw.profiles))
          if (
            !/^profile-[a-f0-9-]{36}$/.test(key) ||
            typeof p.title !== "string" ||
            !Array.isArray(p.keys) ||
            typeof p.first_seen_at !== "string"
          )
            throw new Error("Invalid profile catalog.");
        for (const [key, value] of Object.entries(raw.assignments))
          if (!/^(report|archive):[a-z0-9-]+$/.test(key) || typeof value !== "string" || !/^profile-[a-f0-9-]{36}$/.test(value)) throw new Error("Invalid article assignment.");
        if (!("grouping_version" in raw)) {
          const backup = join(this.workspace.root, `profiles-v1-${contentHash(raw).slice(0, 12)}.backup.json`);
          try { await writeFile(backup, original, { flag: "wx", mode: 0o600 }); }
          catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
            if (!(await lstat(backup)).isFile() || await readFile(backup, "utf8") !== original) throw new Error("Profile migration backup conflict.");
          }
          this.registry = { ...raw, grouping_version: 2, manual: {}, separations: [], redirects: {} };
          migrated = true;
        } else {
          if (raw.grouping_version !== 2 || !raw.manual || typeof raw.manual !== "object" || Object.values(raw.manual).some(v => typeof v !== "boolean") || !Array.isArray(raw.separations) || raw.separations.some(pair => !Array.isArray(pair) || pair.length !== 2 || pair.some(key => typeof key !== "string")) || !raw.redirects || typeof raw.redirects !== "object" || Object.values(raw.redirects).some(v => typeof v !== "string"))
            throw new Error("Invalid automatic grouping metadata.");
          this.registry = raw;
        }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        this.registry = { version: 1, grouping_version: 2, assignments: {}, profiles: {}, manual: {}, separations: [], redirects: {} };
      }
    const registry = this.registry;
    const before = JSON.stringify(registry);
    const articles: CatalogArticle[] = [];
    const library = await loadLibrary(this.workspace);
    for (const a of library.articles)
      articles.push({
        key: "archive:" + a.id,
        id: a.id,
        title: a.title,
        kind: "archive",
        url: "/wiki/" + a.id + "/",
        keys: profileKeys(a.title, archiveHandles(a.nodes)),
        text: wikiText(a.nodes),
        status: "Archived · not reverified",
        source_count: 0,
        archive: a,
      });
    for (const entry of await this.workspace.list()) {
      const inv = await this.workspace.load(entry.id),
        title = reportTitle(inv),
        handles = [
          ...(inv.input.subject.usernames || []),
          ...(inv.input.subject.socials || []).flatMap((s) =>
            s.username ? [s.username] : [],
          ),
        ];
      articles.push({
        key: "report:" + inv.id,
        id: inv.id,
        title,
        kind: "research",
        url: "/reports/" + inv.id + "/",
        keys: profileKeys(title, handles),
        text: [
          title,
          inv.id,
          subjectSearchText(inv.input.subject),
          ...inv.findings.filter(f=>publicationAttribution(inv,f).research).map((f) => f.field + " " + f.value),
          articleText(safeArticleSections(inv)),
        ].join(" "),
        date: inv.research_timing?.finished_at || inv.updated_at,
        started: inv.research_timing?.started_at || inv.created_at,
        finished: inv.research_timing?.finished_at,
        retrieved: inv.sources
          .filter((s) => s.status === "ok")
          .map((s) => s.retrieved_at)
          .sort()
          .at(-1),
        status: inv.status,
        source_count: inv.sources.filter((s) => s.status === "ok").length,
        inv,
      });
    }
    if (migrated) {
      for (const [id, saved] of Object.entries(registry.profiles)) {
        const members = articles.filter(article => registry.assignments[article.key] === id);
        const renamed = members.length > 0 && members.every(article => normalize(article.title) !== normalize(saved.title));
        if (renamed) saved.custom_title = true;
        // Older catalogs did not distinguish automatic singleton rows from manual splits.
        // Preserve recognizable manual organization; retain a full v1 backup for recovery.
        if (members.length > 1 || renamed) for (const member of members) registry.manual[member.key] = true;
      }
    }
    const oldAssignments = { ...registry.assignments };
    const grouped = groupArticles(articles, registry);
    const reserved = new Set(Object.keys(registry.manual).filter(key => registry.manual[key]).map(key => registry.assignments[key]));
    const used = new Set<string>();
    for (const members of grouped.groups) {
      const pinned = members.filter(article => registry.manual[article.key]).map(article => registry.assignments[article.key]).find(Boolean);
      const candidates = [...new Set(members.map(article => registry.assignments[article.key]).filter((id): id is string => !!id && !!registry.profiles[id]))]
        .filter(id => !used.has(id) && (!reserved.has(id) || id === pinned))
        .sort((a, b) => Number(!!registry.profiles[b]!.custom_title) - Number(!!registry.profiles[a]!.custom_title) || registry.profiles[a]!.first_seen_at.localeCompare(registry.profiles[b]!.first_seen_at) || a.localeCompare(b));
      const id = pinned || candidates[0] || "profile-" + randomUUID();
      used.add(id);
      const newest = [...members].sort((a, b) => dateValue(b).localeCompare(dateValue(a)) || a.id.localeCompare(b.id))[0]!;
      registry.profiles[id] ??= { title: newest.title, keys: [], first_seen_at: new Date().toISOString() };
      const profile = registry.profiles[id]!;
      if (!profile.custom_title) profile.title = newest.title;
      profile.keys = [...new Set(members.flatMap(article => article.keys))];
      for (const article of members) {
        registry.assignments[article.key] = id;
        article.profile_id = id;
        article.grouping = grouped.decisions[article.key];
      }
    }
    // Preserve old profile links and collection memberships after automatic grouping.
    for (const oldID of new Set(Object.values(oldAssignments))) {
      if (used.has(oldID)) { delete registry.redirects[oldID]; continue; }
      const targets = new Set(articles.filter(article => oldAssignments[article.key] === oldID).map(article => article.profile_id!));
      if (targets.size === 1) registry.redirects[oldID] = [...targets][0]!;
    }
    const destination = (id: string): string | undefined => {
      const visited = new Set<string>();
      while (!used.has(id) && registry.redirects[id] && !visited.has(id)) { visited.add(id); id = registry.redirects[id]!; }
      return used.has(id) ? id : undefined;
    };
    const profiles = Object.entries(registry.profiles)
      .map(([id, p]) => ({
        ...p,
        id,
        articles: articles.filter((a) => a.profile_id === id),
        aliases: Object.keys(registry.redirects).filter(alias => alias !== id && destination(alias) === id),
      }))
      .filter((p) => p.articles.length);
    for (const p of profiles) {
      p.articles.sort(
        (a, b) =>
          dateValue(a).localeCompare(dateValue(b)) || a.id.localeCompare(b.id),
      );
      p.articles.forEach((a, i) => (a.version = i + 1));
      p.articles.reverse();
    }
    profiles.sort(
      (a, b) =>
        (b.articles[0]?.date || "").localeCompare(a.articles[0]?.date || "") ||
        a.title.localeCompare(b.title),
    );
    if (migrated || before !== JSON.stringify(registry))
      await atomicJSON(join(this.workspace.root, "profiles.json"), registry);
    return profiles;
  }
  async rename(id: string, title: string): Promise<void> {
    return this.locked(async () => {
      const profiles = await this.build();
      if (
        !profiles.some((p) => p.id === id) ||
        !title.trim() ||
        title.trim().length > 200
      )
        throw new Error("Invalid profile label.");
      this.registry!.profiles[id]!.title = title.trim();
      this.registry!.profiles[id]!.custom_title = true;
      for (const article of profiles.find(profile => profile.id === id)!.articles) this.registry!.manual[article.key] = true;
      await atomicJSON(
        join(this.workspace.root, "profiles.json"),
        this.registry,
      );
    });
  }
  async move(articleKey: string, target?: string): Promise<string> {
    return this.locked(async () => {
      const profiles = await this.build(),
        article = profiles
          .flatMap((p) => p.articles)
          .find((a) => a.key === articleKey);
      if (!article) throw new Error("Article not found.");
      if (target && !profiles.some((p) => p.id === target))
        throw new Error("Target profile not found.");
      const id = target || "profile-" + randomUUID();
      const r = this.registry!;
      r.profiles[id] ??= {
        title: article.title,
        keys: article.keys,
        first_seen_at: new Date().toISOString(),
      };
      const previous = profiles.find(profile => profile.id === article.profile_id)!;
      const targetMembers = profiles.find(profile => profile.id === id)?.articles || [];
      for (const member of targetMembers) r.manual[member.key] = true;
      const targets = new Set(targetMembers.map(member => member.key));
      r.separations = r.separations.filter(pair => !(pair.includes(articleKey) && pair.some(key => targets.has(key))));
      for (const member of previous.articles) {
        if (member.key !== articleKey && !targets.has(member.key)) {
          if (!r.separations.some(pair => pair.includes(articleKey) && pair.includes(member.key))) r.separations.push([articleKey, member.key]);
          r.manual[member.key] = true;
        }
      }
      r.assignments[articleKey] = id;
      r.manual[articleKey] = true;
      delete r.redirects[id];
      await atomicJSON(join(this.workspace.root, "profiles.json"), r);
      return id;
    });
  }
}
