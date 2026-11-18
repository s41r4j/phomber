import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const npmCLI = process.env.npm_execpath;
assert.ok(npmCLI, "Run this check with npm run test:package");
const temporary = await mkdtemp(join(tmpdir(), "phomber-package-"));
const consumer = join(temporary, "consumer");
const env = {
  ...process.env,
  PHOMBER_HOME: join(temporary, "workspace"),
  DEEPSEEK_API_KEY: "",
  npm_config_cache: join(temporary, "npm-cache"),
};
async function npm(args, cwd = root) {
  try {
    // A publish dry-run is inherited by lifecycle children. Packing/installing
    // here must still create the temporary files used by the release check.
    const result = await exec(process.execPath, [npmCLI, "--dry-run=false", ...args], {
      cwd, env, maxBuffer: 10_000_000, timeout: 180_000,
    });
    return result.stdout;
  } catch (error) {
    throw new Error(`npm ${args.join(" ")} failed\n${error.stdout || ""}\n${error.stderr || ""}`, { cause: error });
  }
}
try {
  const packed = JSON.parse(await npm(["pack", "--json", "--pack-destination", temporary]));
  // npm versions emit either an array or an object keyed by package name.
  const packages = Array.isArray(packed) ? packed : packed && typeof packed === "object" ? Object.values(packed) : [];
  assert.ok(packages.length === 1 && typeof packages[0]?.filename === "string" && Array.isArray(packages[0]?.files),
    "npm pack did not produce valid package metadata");
  const [pack] = packages;
  const paths = new Set(pack.files.map((file) => file.path));
  for (const required of ["dist/cli/index.js", "dist/core/trust.js", "dist/reports/workbench.js", "dist/workspace/search.js", "docs/ANALYST_WORKFLOW.md", "src/cli/index.ts", "scripts/prepare.mjs", "tsconfig.json", "schemas/subject.schema.json", "schemas/investigation.schema.json", "LICENSE", "README.md"]) {
    assert.ok(paths.has(required), `Missing package file: ${required}`);
  }
  for (const path of paths) {
    assert.ok(!/^(references|\.phomber|\.git|node_modules|tests|website|backups)\//.test(path), `Unexpected private/development content: ${path}`);
    assert.ok(!/(^|\/)(\.env(?:\..*)?|credentials\.json)$/.test(path), `Credential file in package: ${path}`);
    assert.ok(!path.endsWith(".zip") && path !== "docs/IMPLEMENTATION.md", `Unexpected archive/internal notes: ${path}`);
  }
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  assert.equal(pack.version, manifest.version);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[""].version, manifest.version);
  assert.match(await readFile(join(root, ".npmrc"), "utf8"), new RegExp(`^tag=${manifest.publishConfig.tag}$`, "m"));
  assert.equal(manifest.publishConfig.access, "public");
  assert.equal(manifest.publishConfig.registry, "https://registry.npmjs.org/");
  if (manifest.version.includes("-")) {
    assert.ok(manifest.publishConfig.tag && manifest.publishConfig.tag !== "latest", "Prereleases require a non-latest publish tag");
  }
  else assert.equal(manifest.publishConfig.tag, "latest", "Stable versions should use the latest tag");
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), JSON.stringify({ private: true }));
  await npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", join(temporary, pack.filename)], consumer);
  const cli = (...args) => npm(["exec", "--offline", "--", "phomber", ...args], consumer);
  assert.match(await cli("help"), /PH0MBER Gen2/);
  assert.equal((await cli("--version")).trim(), manifest.version);
  assert.equal(JSON.parse(await cli("info")).version, manifest.version);
  assert.equal(JSON.parse(await cli("number", "+442079460000", "--format", "json")).country, "GB");
  assert.deepEqual(JSON.parse(await cli("library")), []);
  const inv = JSON.parse(await cli("wiki", "--name", "Package smoke subject", "--offline", "--no-serve", "--format", "json"));
  assert.equal(inv.status, "partial");
  assert.equal(JSON.parse(await cli("reports"))[0].id, inv.id);
  const queue = JSON.parse(await cli("review", inv.id));
  assert.ok(queue.some(f => f.review === "pending"));
  await cli("review", inv.id, queue[0].id, "--decision", "needs-review", "--identity", "unresolved", "--analyst", "Package smoke", "--reason", "Installation workflow check.");
  assert.ok(JSON.parse(await cli("history", inv.id)).length > 0);
  assert.equal(JSON.parse(await cli("verify", inv.id)).integrity, "passed");
  assert.equal(JSON.parse(await cli("search", "Package smoke")).results[0].id, inv.id);
  assert.match(await readFile(join(env.PHOMBER_HOME, "reports", inv.id, "index.html"), "utf8"), /Package smoke subject/);
  const installed = join(consumer, "node_modules", manifest.name);
  const { Workspace } = await import(pathToFileURL(join(installed, "dist/workspace/index.js")).href);
  const { startServer } = await import(pathToFileURL(join(installed, "dist/server/index.js")).href);
  const { server, url } = await startServer(new Workspace(env.PHOMBER_HOME), 0);
  try {
    const home = await fetch(url);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Package smoke subject/);
    const about = await fetch(`${url}/about/`);
    assert.equal(about.status, 200);
    const aboutHTML = await about.text();
    assert.ok(aboutHTML.includes(`href="${new URL(manifest.homepage).href}"`));
    assert.ok(aboutHTML.includes(manifest.version));
    assert.ok(aboutHTML.includes(`<meta name="phomber-version" content="${manifest.version}">`));
    assert.ok(aboutHTML.includes(`Gen2 · v${manifest.version}`));
    assert.ok(aboutHTML.includes('OSINT Researcher'));
    for (const file of ["", "profile.json", "sources.json", "evidence.json", "export.json", "review/", "revisions/", "graph.json"]) {
      const response = await fetch(`${url}/reports/${inv.id}/${file}`);
      assert.equal(response.status, 200, file);
      if (file && !file.endsWith("/")) await response.json();
      else assert.match(await response.text(), /Package smoke subject/);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`Package check passed: ${pack.filename}, ${pack.entryCount} files, ${pack.size} bytes; installed CLI, offline report and dashboard verified.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
