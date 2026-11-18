import { lstat, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { contentHash } from "../core/trust.js";
import type { Workspace } from "./index.js";
import type { IndexEntry } from "../core/types.js";

/** JSON reports remain portable; this transactional full-text index is rebuildable. */
export async function searchWorkspace(workspace: Workspace, query: string): Promise<{ engine: string; results: IndexEntry[] }> {
  const terms = query.normalize("NFKC").match(/[\p{L}\p{N}_-]+/gu) || [];
  if (!terms.length || query.length > 4096 || terms.length > 50)
    throw new Error("Search needs 1–50 words and at most 4096 characters.");
  const entries = await workspace.list(true);
  let sqlite: typeof import("node:sqlite");
  try { sqlite = await import("node:sqlite"); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ERR_UNKNOWN_BUILTIN_MODULE") throw e;
    return { engine: "portable-scan", results: entries.filter(e => terms.every(term =>
      (e.name + " " + e.search_text).normalize("NFKC").toLowerCase().includes(term.toLowerCase()))) };
  }
  const file = join(workspace.root, "search.sqlite");
  try { await writeFile(file, "", { flag: "wx", mode: 0o600 }); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
  if (!(await lstat(file)).isFile()) throw new Error("Search index must be a regular file.");
  await chmod(file, 0o600);
  const db = new sqlite.DatabaseSync(file);
  try {
    db.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE");
    try {
      const version = Number(db.prepare("PRAGMA user_version").get()?.user_version);
      if (version > 1) throw new Error("Search index was created by a newer version.");
      db.exec("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, hash TEXT NOT NULL, metadata TEXT NOT NULL); CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(id UNINDEXED, name, content); PRAGMA user_version=1");
      const current = new Map(db.prepare("SELECT id, hash FROM documents").all().map(row => [String(row.id), String(row.hash)]));
      const ids = new Set(entries.map(e => e.id));
      const remove = db.prepare("DELETE FROM documents WHERE id=?"), removeText = db.prepare("DELETE FROM documents_fts WHERE id=?");
      const insert = db.prepare("INSERT OR REPLACE INTO documents VALUES (?, ?, ?)"), insertText = db.prepare("INSERT INTO documents_fts VALUES (?, ?, ?)");
      for (const id of current.keys()) if (!ids.has(id)) { remove.run(id); removeText.run(id); }
      for (const entry of entries) {
        const hash = contentHash(entry);
        if (current.get(entry.id) === hash) continue;
        removeText.run(entry.id);
        insert.run(entry.id, hash, JSON.stringify(entry));
        insertText.run(entry.id, entry.name, entry.search_text || "");
      }
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
    const expression = terms.map(term => '"' + term.replaceAll('"', '""') + '"').join(" AND ");
    const results = db.prepare("SELECT d.metadata FROM documents_fts JOIN documents d ON d.id=documents_fts.id WHERE documents_fts MATCH ? ORDER BY bm25(documents_fts) LIMIT 100").all(expression);
    return { engine: "sqlite-fts5", results: results.map(r => JSON.parse(String(r.metadata)) as IndexEntry) };
  } finally { db.close(); }
}
