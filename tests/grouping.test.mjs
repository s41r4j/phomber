import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, readdir, readFile, utimes } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workspace, atomicJSON } from "../dist/workspace/index.js";
import { Catalog } from "../dist/catalog/index.js";
import { investigate } from "../dist/core/engine.js";
import { writeReport } from "../dist/reports/html.js";
import { startServer } from "../dist/server/index.js";
import { groupArticles } from "../dist/catalog/grouping.js";
import { contentHash } from "../dist/core/trust.js";
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), "phomber-grouping-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = new Workspace(root); await workspace.init();
  await atomicJSON(join(root, "library.json"), { schema_version: "1.0", articles: [] });
  return workspace;
}
async function report(workspace, subject, day = 1, status = "partial") {
  const inv = await investigate({ schema_version: "1.0", subject, research: { offline: true } }, workspace);
  inv.created_at = inv.updated_at = `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`;
  inv.research_timing = { started_at: inv.created_at, finished_at: inv.updated_at };
  inv.status = status; await writeReport(inv, workspace); return inv;
}
const subject = (handle = "example_artist") => ({ name: "Example Researcher", socials: [{ platform: "instagram", username: handle }], education: [{ institution: "Example Arts College" }] });

test("catalog waits for a live writer and recovers its lock after the process dies", { timeout: 15000 }, async t => {
  const w = await setup(t);
  const saved = await report(w, subject());
  const catalogModule = new URL("../dist/catalog/index.js", import.meta.url).href;
  const child = spawn(process.execPath, ["--input-type=module", "-e", `
    import { Catalog } from ${JSON.stringify(catalogModule)};
    import { Workspace } from ${JSON.stringify(new URL("../dist/workspace/index.js", import.meta.url).href)};
    const catalog = new Catalog(new Workspace(process.argv[1]));
    catalog.build = async () => {
      process.stdout.write("locked");
      await new Promise(resolve => setTimeout(resolve, 60000));
    };
    await catalog.read();
  `, w.root], { stdio: ["ignore", "pipe", "inherit"] });
  const exited = once(child, "exit");
  try {
    await Promise.race([
      once(child.stdout, "data"),
      exited.then(() => { throw new Error("Lock holder exited before acquiring the lock."); }),
    ]);
    const waiting = new Catalog(w).read();
    assert.equal(await Promise.race([waiting, sleep(150, "waiting")]), "waiting");
    child.kill("SIGKILL");
    await exited;
    const profiles = await waiting;
    assert.deepEqual(profiles[0].articles.map(article => article.id), [saved.id]);
    assert.ok(!(await readdir(w.root)).some(name => name.startsWith("profiles.lock")));
  } finally {
    child.kill("SIGKILL");
    await exited;
  }
});

test("catalog removes an old empty lock directory from the previous format", async t => {
  const w = await setup(t);
  const lock = join(w.root, "profiles.lock");
  await mkdir(lock);
  const stale = new Date(Date.now() - 120000);
  await utimes(lock, stale, stale);
  assert.deepEqual(await new Catalog(w).read(), []);
  assert.ok(!(await readdir(w.root)).includes("profiles.lock"));
});

test("supplied account URLs and handles group repeat runs as ordered versions without changing evidence", async t => {
  const w = await setup(t);
  const first = await report(w, subject(), 1, "interrupted");
  const newer = await report(w, { name: "Corrected Researcher", socials: [{ platform: "instagram", url: "https://www.instagram.com/EXAMPLE_ARTIST/?utm_source=example" }] }, 3);
  const original = await readFile(join(w.reportPath(first.id), "investigation.json"), "utf8");
  const profiles = await new Catalog(w).read();
  assert.equal(profiles.length, 1); assert.equal(profiles[0].title, "Corrected Researcher");
  assert.deepEqual(profiles[0].articles.map(a => [a.id, a.version]), [[newer.id, 2], [first.id, 1]]);
  assert.equal(profiles[0].articles[0].grouping.method, "automatic");
  assert.match(profiles[0].articles[0].grouping.reason, /instagram:example_artist/);
  assert.equal(await readFile(join(w.reportPath(first.id), "investigation.json"), "utf8"), original);
  assert.equal((await new Catalog(w).read())[0].id, profiles[0].id);
});
test("matching supplied names and college context group interrupted repeats without any AI calls", async t => {
  const w = await setup(t);
  const details = { name: "Same Researcher", education: [{ institution: "Example College" }] };
  for (let day = 1; day <= 3; day++) await report(w, details, day, day === 2 ? "interrupted" : "partial");
  const profiles = await new Catalog(w).read();
  assert.equal(profiles.length, 1); assert.equal(profiles[0].articles.length, 3);
  assert.ok(profiles[0].articles.every(a => /name and context/.test(a.grouping.reason)));
});
test("conflicting accounts and ambiguous context cannot bridge distinct identities", async t => {
  const w = await setup(t);
  const first = await report(w, subject("first_artist"), 4);
  const repeated = await report(w, subject("first_artist"), 3);
  await report(w, subject("second_artist"), 2);
  await report(w, { name: "Example Researcher", education: [{ institution: "Example Arts College" }] }, 1);
  const profiles = await new Catalog(w).read();
  assert.equal(profiles.length, 3);
  const exact = profiles.find(p => p.articles.some(a => a.id === first.id));
  assert.deepEqual(new Set(exact.articles.map(a => a.id)), new Set([first.id, repeated.id]));
  assert.ok(profiles.filter(p => p.id !== exact.id).every(p => p.articles.length === 1));
});
test("platform-scoped identifiers, names alone and unreviewed candidate URLs stay separate", async t => {
  const w = await setup(t);
  for (const platform of ["github", "instagram"]) await report(w, { name: "Same Name", socials: [{ platform, username: "same_handle" }] });
  await report(w, { name: "Same Name" });
  await report(w, { name: "Same Name" });
  assert.equal((await new Catalog(w).read()).length, 4);
});
test("accepted identity evidence can link reports; unreviewed AI candidates cannot", async t => {
  const w = await setup(t), reports = [];
  for (const name of ["Initial search subject", "Later search subject"]) {
    const inv = await report(w, { name });
    inv.sources.push({ id: "review-source", adapter: "fixture", status: "ok", url: "https://instagram.com/reviewed_artist", retrieved_at: inv.updated_at });
    inv.findings.push({ id: "review-profile", category: "online", field: "instagram profile", value: "https://instagram.com/reviewed_artist", status: "lead", identity: "candidate", source_ids: ["review-source"], confidence: { score: null, explanation: "Unreviewed candidate" } });
    await w.save(inv); reports.push(inv);
  }
  assert.equal((await new Catalog(w).read()).length, 2);
  for (const inv of reports) await w.review(inv.id, "review-profile", contentHash(inv), { decision: "accepted", identity: "matched", analyst: "Fixture analyst", reason: "Reviewed an explicit public identity cross-link." });
  assert.equal((await new Catalog(w).read()).length, 1);
});
test("manual split decisions survive reloads and later matching runs; an explicit move rejoins them", async t => {
  const w = await setup(t), first = await report(w, subject(), 1), second = await report(w, subject(), 2);
  const catalog = new Catalog(w), original = (await catalog.read())[0];
  assert.equal(original.articles.length, 2);
  const split = await catalog.move("report:" + second.id);
  assert.notEqual(split, original.id);
  assert.equal((await new Catalog(w).read()).length, 2);
  const third = await report(w, subject(), 3);
  assert.equal((await new Catalog(w).read()).length, 3);
  await catalog.move("report:" + second.id, original.id);
  const combined = await new Catalog(w).read();
  assert.equal(combined.length, 1);
  assert.deepEqual(new Set(combined[0].articles.map(a => a.id)), new Set([first.id, second.id, third.id]));
});
test("v1 migration backs up exact metadata, groups duplicates, redirects old links and preserves collections", async t => {
  const w = await setup(t), first = await report(w, subject(), 1), second = await report(w, subject(), 2);
  const ids = ["profile-" + randomUUID(), "profile-" + randomUUID()];
  const registry = { version: 1, assignments: { ["report:" + first.id]: ids[0], ["report:" + second.id]: ids[1] }, profiles: Object.fromEntries(ids.map((id, i) => [id, { title: "Example Researcher", keys: [], first_seen_at: `2026-01-0${i + 1}T00:00:00Z` }])) };
  await atomicJSON(join(w.root, "profiles.json"), registry);
  const before = await readFile(join(w.root, "profiles.json"), "utf8");
  const collection = { id: "collection-" + randomUUID(), name: "Preserved collection", description: "", profile_ids: [ids[1]], created_at: first.created_at, updated_at: first.updated_at, archived: false };
  await atomicJSON(join(w.root, "collections.json"), [collection]);
  const profiles = await new Catalog(w).read();
  assert.equal(profiles.length, 1); assert.equal(profiles[0].id, ids[0]);
  assert.ok(profiles[0].aliases.includes(ids[1]));
  const backups = (await readdir(w.root)).filter(file => file.startsWith("profiles-v1-"));
  assert.equal(backups.length, 1); assert.equal(await readFile(join(w.root, backups[0]), "utf8"), before);
  const saved = JSON.parse(await readFile(join(w.root, "profiles.json"), "utf8"));
  assert.equal(saved.version, 1); // Older installed versions can still read the catalog.
  assert.equal(saved.grouping_version, 2);
  const { server, url } = await startServer(w, 0);
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const alias = await fetch(`${url}/profiles/${ids[1]}/`, { redirect: "manual" });
  assert.equal(alias.status, 303); assert.equal(alias.headers.get("location"), `/profiles/${ids[0]}/`);
  const html = await (await fetch(`${url}/collections/${collection.id}/`)).text();
  assert.match(html, /Example Researcher/); assert.match(html, /2 versions/);
  assert.match(await (await fetch(`${url}/profiles/${ids[0]}/`)).text(), /Automatic grouping/);
});
test("archive collaborators and profile content URLs do not become identity anchors", () => {
  const base = { kind: "archive", keys: [], text: "", status: "Archived", source_count: 0 };
  const articles = [
    { ...base, key: "archive:first", id: "first", title: "First Person", url: "/wiki/first/", archive: { nodes: [{ tag: "a", href: "https://github.com/shared_handle", children: [] }] } },
    { ...base, key: "archive:second", id: "second", title: "Second Person", url: "/wiki/second/", archive: { nodes: [{ tag: "div", class: "infobox", children: [{ tag: "a", href: "https://github.com/shared_handle", children: [] }] }] } },
  ];
  assert.equal(groupArticles(articles, { assignments: {}, manual: {}, separations: [] }).groups.length, 2);
});
