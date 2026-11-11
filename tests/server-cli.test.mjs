import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import http from "node:http";
import { Workspace } from "../dist/workspace/index.js";
import { investigate } from "../dist/core/engine.js";
import { writeReport } from "../dist/reports/html.js";
import { startServer } from "../dist/server/index.js";
const exec = promisify(execFile),
  cli = resolve("dist/cli/index.js");
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), "phomber-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function request(url, path, headers = {}, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(url), { path, headers, method }, (res) => {
      const chunks = [];
      res.on("data", (b) => chunks.push(b));
      res.on("end", () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}
test("CLI works in scripts with clean JSON, actionable errors, and saved reports", async (t) => {
  const root = await setup(t),
    env = { ...process.env, PHOMBER_HOME: root };
  const run = (...args) => exec(process.execPath, [cli, ...args], { env });
  assert.match((await run("help")).stdout, /PH0MBER Gen2/);
  assert.match((await run()).stdout, /Usage/);
  const number = JSON.parse(
    (await run("number", "+442079460000", "--format", "json")).stdout,
  );
  assert.equal(number.country, "GB");
  const { stdout, stderr } = await run(
    "wiki",
    "--social",
    "github:octocat",
    "--offline",
    "--no-serve",
    "--format",
    "json",
  );
  const inv = JSON.parse(stdout);
  assert.equal(stderr, "");
  assert.equal(inv.status, "partial");
  assert.equal(JSON.parse((await run("reports")).stdout)[0].id, inv.id);
  await assert.rejects(
    () => run("wiki", "--depth", "invalid"),
    (e) => e.code === 1,
  );
  await assert.rejects(
    () => run("number", "bad"),
    (e) => e.code === 1 && /international/.test(e.stderr),
  );
  await assert.rejects(
    () => run("reports", "delete", inv.id),
    (e) => e.code === 1 && /--yes/.test(e.stderr),
  );
  await run("reports", "delete", inv.id, "--yes");
  assert.equal(JSON.parse((await run("reports")).stdout).length, 0);
});
test("CLI JSON file and repeat flags share the engine", async (t) => {
  const root = await setup(t),
    file = join(root, "subject.json");
  await writeFile(
    file,
    JSON.stringify({ schema_version: "1.0", subject: { name: "Test" } }),
  );
  const r = await exec(
    process.execPath,
    [
      cli,
      "wiki",
      "--input",
      file,
      "--education",
      "One",
      "--education",
      "Two",
      "--offline",
      "--no-serve",
      "--format",
      "json",
    ],
    { env: { ...process.env, PHOMBER_HOME: root } },
  );
  assert.equal(JSON.parse(r.stdout).input.subject.education.length, 2);
});
test("localhost dashboard and JSON routes work; unsafe paths, hosts, methods and symlinks fail", async (t) => {
  const root = await setup(t),
    w = new Workspace(root);
  await w.init();
  const inv = await investigate(
    {
      schema_version: "1.0",
      subject: { name: "Test" },
      research: { offline: true },
    },
    w,
  );
  await writeReport(inv, w);
  const { server, url } = await startServer(w, 0);
  t.after(() => new Promise((r) => server.close(r)));
  assert.equal(server.address().address, "127.0.0.1");
  const home = await request(url, "/");
  assert.equal(home.status, 200);
  assert.match(home.body, /Test/);
  assert.match(home.headers["content-security-policy"], /default-src 'none'/);
  for (const file of [
    "",
    "profile.json",
    "sources.json",
    "evidence.json",
    "connections.json",
    "timeline.json",
    "export.json",
  ]) {
    const r = await request(url, `/reports/${inv.id}/${file}`);
    assert.equal(r.status, 200, file);
    if (file) JSON.parse(r.body);
  }
  for (const path of [
    "/../config.json",
    "/reports/%2e%2e/config.json",
    "/reports/foo/%2fetc",
    "/reports/../../../etc/passwd",
    "/reports/" + inv.id + "/investigation.json",
    "/reports/" + inv.id + "/missing",
  ])
    assert.notEqual((await request(url, path)).status, 200, path);
  assert.equal(
    (await request(url, "/", { host: "evil.example:1234" })).status,
    403,
  );
  assert.equal((await request(url, "/", {}, "POST")).status, 405);
  const second = await startServer(w, server.address().port);
  t.after(() => new Promise((r) => second.server.close(r)));
  assert.notEqual(second.url, url);
  if (process.platform === "win32") return;
  await rm(join(w.reportPath(inv.id), "profile.json"));
  await symlink(
    join(root, "config.json"),
    join(w.reportPath(inv.id), "profile.json"),
  );
  assert.notEqual(
    (await request(url, `/reports/${inv.id}/profile.json`)).status,
    200,
  );
});
