import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Workspace, atomicJSON } from "../dist/workspace/index.js";
import { investigate } from "../dist/core/engine.js";
import { contentHash } from "../dist/core/trust.js";
import { searchWorkspace } from "../dist/workspace/search.js";
import { writeReport } from "../dist/reports/html.js";
import { startServer } from "../dist/server/index.js";
import { script } from "../dist/reports/shell.js";
import { runInNewContext } from "node:vm";
const exec = promisify(execFile), cli = resolve("dist/cli/index.js");
test("the actual inline article search script finds infobox text and navigates matches", () => {
  const classes = new Set(), events = {}, nextEvents = {};
  let scrolled = 0;
  const row = { textContent: "EducationNorth Arts College", querySelector: () => null, closest: () => null,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c) }, scrollIntoView: () => scrolled++ };
  const input = { value: "north", addEventListener: (name, fn) => { events[name] = fn; } };
  const next = { hidden: true, addEventListener: (name, fn) => { nextEvents[name] = fn; } };
  const status = { textContent: "" };
  const nodes = { "#report-search": input, "#report-search-next": next, "#report-search-status": status, "#content": { querySelectorAll: () => [row] } };
  const document = { querySelector: selector => nodes[selector] || null, querySelectorAll: selector => selector === ".search-hit" && classes.has("search-hit") ? [row] : [] };
  runInNewContext(script, { document });
  events.input(); assert.equal(status.textContent, "1 matching text blocks");
  assert.equal(next.hidden, false); assert.ok(classes.has("search-hit"));
  nextEvents.click(); assert.equal(scrolled, 1); assert.equal(status.textContent, "Match 1 of 1");
  input.value = "unfindable"; events.input(); assert.equal(status.textContent, "No matches in this article.");
  assert.equal(next.hidden, true); assert.ok(!classes.has("search-hit"));
  input.value = "ｎｏｒｔｈ"; events.input(); assert.equal(next.hidden, false);
  events.keydown({ key: "Escape" }); assert.equal(input.value, ""); assert.equal(next.hidden, true);
});
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "phomber-usability-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = new Workspace(root); await workspace.init();
  await atomicJSON(join(root, "library.json"), { schema_version: "1.0", articles: [] });
  const inv = await investigate({ schema_version: "1.0", subject: { name: "Readable Researcher", education: [{ institution: "Example Arts College" }] }, research: { offline: true } }, workspace);
  await writeReport(inv, workspace);
  const run = async (...args) => (await exec(process.execPath, [cli, ...args], { env: { ...process.env, PHOMBER_HOME: root, DEEPSEEK_API_KEY: "" } })).stdout;
  return { workspace, inv, run };
}
test("CLI defaults to readable reports and scanner details; JSON remains explicit", async t => {
  const { run, inv } = await fixture(t);
  const reports = await run("reports");
  assert.match(reports, /Saved investigations \(1\)/);
  assert.match(reports, /Readable Researcher \[partial\]/);
  assert.ok(reports.includes(inv.id)); assert.ok(!reports.trimStart().startsWith("["));
  assert.equal(JSON.parse(await run("reports", "--format", "json"))[0].id, inv.id);
  const phone = await run("number", "+442079460000");
  assert.match(phone, /Country: GB/); assert.match(phone, /Valid: Yes/);
  assert.equal(JSON.parse(await run("number", "+442079460000", "--format", "json")).country, "GB");
  for (const args of [["config"], ["info"], ["library"], ["review", inv.id], ["history", inv.id], ["verify", inv.id]]) {
    assert.match(await run(...args), /PH0MBER \/ /);
    const json = await run(...args, "--format", "json");
    assert.doesNotThrow(() => JSON.parse(json));
  }
});
test("CLI search finds partial names, context words in any order, and report IDs", async t => {
  const { run, inv } = await fixture(t);
  for (const query of ["read college", "ARTS readable", inv.id]) {
    assert.equal(JSON.parse(await run("search", query, "--format", "json")).results[0].id, inv.id);
    assert.match(await run("search", query), /Search results \(1\)/);
  }
  assert.match(await run("search", "no-such-fixture"), /No matching reports/);
});
test("report deletion requires confirmation and prevents stale tasks from restoring evidence", async t => {
  const { workspace, inv, run } = await fixture(t);
  await assert.rejects(() => run("reports", "delete", inv.id), e => /--yes/.test(e.stderr));
  await assert.rejects(() => workspace.deleteReport(inv.id, "0".repeat(64)), /Report changed/);
  assert.equal((await workspace.list()).length, 1);
  await searchWorkspace(workspace, "Readable");
  const result = JSON.parse(await run("reports", "delete", inv.id, "--yes", "--format", "json"));
  assert.equal(result.status, "deleted");
  await assert.rejects(() => access(workspace.reportPath(inv.id)));
  assert.equal((await searchWorkspace(workspace, "Readable")).results.length, 0);
  await assert.rejects(() => workspace.save(inv), /Report was deleted/);
  await assert.rejects(() => workspace.preserveSource(inv.id, { stale: true }), /Report was deleted/);
  await assert.rejects(() => access(workspace.reportPath(inv.id)));
});
test("wiki search is rendered server-side and UI deletion enforces origin, token and revision", async t => {
  const { workspace, inv } = await fixture(t);
  const other = await investigate({ schema_version: "1.0", subject: { name: "Other fixture" }, research: { offline: true } }, workspace);
  await writeReport(other, workspace);
  const { server, url } = await startServer(workspace, 0);
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const search = await (await fetch(url + "/?search=college%20read")).text();
  assert.match(search, /value="college read"/);
  assert.match(search, /1 profile matching/);
  assert.equal((search.match(/<tr hidden class="library-entry"/g) || []).length, 1);
  assert.match(await (await fetch(url + "/?search=unfindable")).text(), /0 profiles matching/);
  assert.match(await (await fetch(url + `/reports/${inv.id}/`)).text(), /Delete report/);
  const confirmation = await fetch(url + `/reports/${inv.id}/delete/`);
  assert.equal(confirmation.headers.get("referrer-policy"), "same-origin");
  const page = await confirmation.text();
  const csrf = page.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  assert.equal((await workspace.list()).length, 2);
  const post = (extra = {}, origin = url) => fetch(url + "/manage/reports", { method: "POST", redirect: "manual", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf, report: inv.id, revision: contentHash(inv), action: "delete", confirm: "yes", ...extra }) });
  for (const extra of [{ csrf: "bad" }, { confirm: "" }, { report: "../../config.json" }])
    assert.equal((await post(extra)).status, 403);
  assert.equal((await post({}, "https://evil.example")).status, 403);
  assert.equal((await post({ revision: "0".repeat(64) })).status, 409);
  assert.equal((await workspace.list()).length, 2);
  const deleted = await post(); assert.equal(deleted.status, 303);
  assert.equal(deleted.headers.get("location"), "/admin/reports/");
  assert.equal((await fetch(url + `/reports/${inv.id}/`)).status, 404);
  assert.equal((await fetch(url + `/reports/${other.id}/`)).status, 200);
  assert.match(await (await fetch(url + "/admin/reports/")).text(), /Other fixture/);
});
