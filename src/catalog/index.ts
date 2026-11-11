import {articleText} from "../core/article.js";
import { readFile } from "node:fs/promises";
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
}
export interface Profile {
  id: string;
  title: string;
  keys: string[];
  first_seen_at: string;
  articles: CatalogArticle[];
}
interface Registry {
  version: 1;
  assignments: Record<string, string>;
  profiles: Record<
    string,
    { title: string; keys: string[]; first_seen_at: string }
  >;
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
    inv.input.subject.name ||
    inv.findings
      .filter(
        (f) =>
          /^(full name|name)$/i.test(f.field) &&
          f.category === "identity" &&
          f.value.length < 100,
      )
      .sort((a, b) => b.value.length - a.value.length)[0]?.value ||
    inv.input.subject.usernames?.[0] ||
    inv.input.subject.socials?.[0]?.username ||
    "Unnamed subject"
  );
}
const dateValue = (a: CatalogArticle) => a.date || "";
export class Catalog {
  private registry?: Registry;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly workspace: Workspace) {}
  private async locked<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(fn, fn);
    this.queue = task.catch(() => {});
    return task;
  }
  async read(): Promise<Profile[]> {
    return this.locked(() => this.build());
  }
  private async build(): Promise<Profile[]> {
    await this.workspace.init();
    if (!this.registry) {
      try {
        const raw = JSON.parse(
          await readFile(join(this.workspace.root, "profiles.json"), "utf8"),
        ) as Registry;
        if (raw.version !== 1 || !raw.assignments || !raw.profiles)
          throw new Error("Unsupported profile catalog.");
        for (const [key, p] of Object.entries(raw.profiles))
          if (
            !/^profile-[a-f0-9-]{36}$/.test(key) ||
            typeof p.title !== "string" ||
            !Array.isArray(p.keys)
          )
            throw new Error("Invalid profile catalog.");
        this.registry = raw;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        this.registry = { version: 1, assignments: {}, profiles: {} };
      }
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
          ...inv.findings.map((f) => f.field + " " + f.value),
          articleText(inv.ai?.sections || []),
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
    for (const a of articles) {
      let id = registry.assignments[a.key];
      if (!id || !registry.profiles[id]) {
        const matches = Object.entries(registry.profiles).filter(([, p]) =>
          a.keys.some((k) => p.keys.includes(k)),
        );
        id = matches.length === 1 ? matches[0]![0] : "profile-" + randomUUID();
        registry.assignments[a.key] = id;
        registry.profiles[id] ??= {
          title: a.title,
          keys: [],
          first_seen_at: new Date().toISOString(),
        };
      }
      const profile = registry.profiles[id]!;
      profile.keys = [...new Set([...profile.keys, ...a.keys])];
      a.profile_id = id;
    }
    const profiles = Object.entries(registry.profiles)
      .map(([id, p]) => ({
        ...p,
        id,
        articles: articles.filter((a) => a.profile_id === id),
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
    if (before !== JSON.stringify(registry))
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
      r.assignments[articleKey] = id;
      await atomicJSON(join(this.workspace.root, "profiles.json"), r);
      return id;
    });
  }
}
