import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readdir, rm, writeFile, symlink } from "node:fs/promises";
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
  assert.equal(JSON.parse((await run("reports", "--format", "json")).stdout)[0].id, inv.id);
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
  assert.equal(JSON.parse((await run("reports", "--format", "json")).stdout).length, 0);
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
test("installed, NPX and checkout entry points share reports regardless of working directory", async (t) => {
  const home = await setup(t), expected = join(home, ".phomber");
  const first = join(home, "first"), second = join(home, "second");
  await Promise.all([mkdir(first), mkdir(second)]);
  const env = { ...process.env, HOME: home, USERPROFILE: home, PHOMBER_HOME: "", DEEPSEEK_API_KEY: "", npm_command: "" };
  const run = async (entry, cwd, npmCommand, ...args) => {
    const result = await exec(process.execPath, [entry, ...args, ...(args.includes("--format") ? [] : ["--format", "json"])], { cwd, env: { ...env, npm_command: npmCommand } });
    return JSON.parse(result.stdout);
  };
  const local = resolve("scripts/local.mjs");
  const report = await run(cli, first, "", "wiki", "--name", "Shared workspace fixture", "--offline", "--no-serve", "--format", "json");
  for (const [entry, cwd, command] of [[cli, first, ""], [cli, second, "exec"], [local, second, "run-script"]]) {
    assert.equal((await run(entry, cwd, command, "config")).workspace, expected);
    assert.equal((await run(entry, cwd, command, "reports"))[0].id, report.id);
  }
  const fromCheckout = await run(local, second, "run-script", "wiki", "--name", "Checkout workspace fixture", "--offline", "--no-serve", "--format", "json");
  assert.deepEqual(new Set((await run(cli, first, "exec", "reports")).map(r => r.id)), new Set([report.id, fromCheckout.id]));
  const isolated = join(home, "isolated");
  const override = await exec(process.execPath, [local, "reports", "--format", "json"], { cwd: second, env: { ...env, PHOMBER_HOME: isolated } });
  assert.deepEqual(JSON.parse(override.stdout), []);
  assert.equal((await run(cli, first, "", "reports")).length, 2);
  assert.ok(!(await readdir(first)).includes(".phomber"));
  assert.ok(!(await readdir(second)).includes(".phomber"));
});
test("CLI rejects conflicting DeepSeek-only flags before accessing credentials",async t=>{
  const root=await setup(t);
  const run=(...args)=>exec(process.execPath,[cli,'wiki','--name','Example','--ai-only',...args],{env:{...process.env,PHOMBER_HOME:root,DEEPSEEK_API_KEY:''}});
  for(const flag of ['--offline','--no-ai'])
    await assert.rejects(()=>run(flag),e=>e.code===1 && /requires online AI/.test(e.stderr) && !/key required/.test(e.stderr));
});
test("find is the primary command, accepts a short name, and keeps wiki as a hidden alias", async t => {
  const root = await setup(t);
  const run = (...args) => exec(process.execPath, [cli, ...args], { env: { ...process.env, PHOMBER_HOME: root, DEEPSEEK_API_KEY: "" } });
  const overview = (await run("help")).stdout;
  assert.match(overview, /^\s+find \["FULL NAME"\]/m);
  assert.ok(!/^\s+wiki\b/m.test(overview));
  assert.ok(!/phomber wiki\b/.test(overview));
  const detailed = (await run("help", "find")).stdout;
  assert.match(detailed, /Usage: phomber find/);
  assert.equal((await run("help", "wiki")).stdout, detailed);
  assert.equal((await run("wiki", "--help")).stdout, detailed);
  assert.equal((await run("find", "--help")).stdout, detailed);
  const { interactiveCommands } = await import("../dist/cli/help.js");
  assert.ok(interactiveCommands.includes("find"));
  assert.ok(!interactiveCommands.includes("wiki"));
  await assert.rejects(() => run("find", "First", "--name", "Second"), e => /positional name or --name/.test(e.stderr));
  await assert.rejects(() => run("find", ""), e => /nonempty subject name/.test(e.stderr));
  assert.deepEqual(await readdir(root), []);
  const research = async (...args) => JSON.parse((await run(...args, "--offline", "--no-serve", "--format", "json")).stdout);
  const primary = await research("find", "Example Researcher");
  const legacy = await research("wiki", "--name", "Example Researcher");
  assert.deepEqual(primary.input, legacy.input);
  assert.equal(primary.input.subject.name, "Example Researcher");
  assert.equal((await research("find", "Example", "Researcher")).input.subject.name, "Example Researcher");
  assert.equal((await research("find", "--resume", primary.id)).id, primary.id);
  const html = (await run("find", "HTML Fixture", "--offline", "--no-serve", "--format", "html")).stdout.trim();
  assert.match(html, /index\.html$/);
  assert.ok((await readdir(join(root, "reports"))).length >= 4);
});
test("command help is specific and has no collection, shell or workspace side effects", async (t) => {
  const root = await setup(t);
  const run = (...args) => exec(process.execPath, [cli, ...args], {
    env: { ...process.env, PHOMBER_HOME: root }, timeout: 5000,
  });
  const overview = (await run("help")).stdout;
  assert.match(overview, /Start here[\s\S]*Saved investigations[\s\S]*Source checks[\s\S]*Utilities[\s\S]*Examples/);
  const { scanners } = await import("../dist/legacy-commands/index.js");
  for (const name of scanners) {
    const detailed = (await run("help", name)).stdout;
    assert.match(detailed, new RegExp(`Usage: phomber ${name}\\b`));
    assert.equal((await run(name, "--help")).stdout, detailed);
    assert.match(overview, new RegExp(`\\b${name}\\b`));
  }
  assert.match((await run("help", "scanners")).stdout, /Number format|phone-number format/);
  assert.match((await run("wiki", "-h")).stdout, /--synthesize-only/);
  assert.match((await run("serve", "--open", "--help")).stdout, /same PHOMBER_HOME/);
  assert.match((await run("auth", "--help")).stdout, /DEEPSEEK_API_KEY/);
  assert.match((await run("shell", "--help")).stdout, /native operating-system shell/);
  assert.match((await run("help", "interactive")).stdout, /save \[PATH\]/);
  await assert.rejects(() => run("help", "unknown"), e => e.code === 1 && /Unknown help topic/.test(e.stderr));
  assert.deepEqual(await readdir(root), []);
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

test("synthesis-only refuses disabled AI or changed input before accessing a key", async (t) => {
  const root=await setup(t),w=new Workspace(root);
  const inv=await investigate({schema_version:'1.0',subject:{name:'Original'},research:{offline:true}},w);
  inv.input.research.offline=false;
  await w.save(inv);
  const run=(...args)=>exec(process.execPath,[cli,'wiki','--resume',inv.id,'--synthesize-only','--no-serve',...args],{env:{...process.env,PHOMBER_HOME:root,DEEPSEEK_API_KEY:''}});
  await assert.rejects(()=>run('--no-ai'),e=>e.code===1 && /requires AI and online mode/.test(e.stderr));
  await assert.rejects(()=>run('--name','Different'),e=>e.code===1 && /cannot change investigation input/.test(e.stderr));
  assert.equal((await w.load(inv.id)).input.subject.name,'Original');
});
