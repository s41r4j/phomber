import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readLibrary,
  validateLibrary,
  renderWikiNodes,
  wikiText,
} from "../dist/reports/library.js";
import { renderDashboard, renderArchive } from "../dist/reports/html.js";
import { Workspace } from "../dist/workspace/index.js";
import { startServer } from "../dist/server/index.js";
const fixture = () => ({
  schema_version: "1.0",
  articles: [
    {
      id: "sample-wiki",
      title: "Sample Person",
      filename: "sample-wiki.html",
      sha256: "a".repeat(64),
      nodes: [
        { tag: "h2", id: "education", children: [{ text: "Education" }] },
        {
          tag: "p",
          children: [
            { text: "Studied at Example University. Project: FreelancerKit." },
          ],
        },
      ],
    },
  ],
});
const exec = promisify(execFile);
test("optional local collection matches its original checksums", {
  skip: !existsSync("references/library.json") && "Local personal collection is not part of the repository",
}, async () => {
  const library = await readLibrary("references/library.json");
  assert.equal(library.articles.length, 12);
  for (const a of library.articles) {
    const bytes = await readFile(join("references/people-wikis", a.filename));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), a.sha256);
  }
  assert.ok(library.articles.some((a) => a.id === "sairaj-wikipedia-wiki-v3"));
});
test("library JSON loads from a portable file and rejects corrupt metadata", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "phomber-library-file-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "library.json"), library = fixture();
  await writeFile(file, JSON.stringify(library));
  assert.deepEqual(await readLibrary(file), library);
  library.articles[0].sha256 = "invalid";
  await writeFile(file, JSON.stringify(library));
  await assert.rejects(() => readLibrary(file), /Invalid wiki article metadata/);
});
test("archived rendering permits readable wiki markup and rejects active content", () => {
  const nodes = [
    { tag: "script", children: [{ text: "alert(1)" }] },
    { tag: "iframe", src: "https://evil.example" },
    { tag: "p", children: [{ text: "<img src=x onerror=alert(1)>" }] },
    { tag: "a", href: "javascript:alert(2)", children: [{ text: "bad link" }] },
    { tag: "a", href: "https://example.com", children: [{ text: "source" }] },
    { tag: "img", src: "https://remote.example/tracker", alt: "Portrait" },
    { tag: "img", src: "data:image/svg+xml;base64,AAAA" },
    { tag: "h2", id: "safe", children: [{ text: "Education" }] },
    { tag: "img", src: "data:image/png;base64,AAAA", alt: "Local image" },
  ];
  const html = renderWikiNodes(nodes);
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<iframe"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes('src="https://'));
  assert.ok(!html.includes("image/svg"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes('href="https://example.com/"'));
  assert.ok(html.includes("data:image/png"));
  assert.ok(html.includes('id="safe"'));
  assert.ok(!wikiText(nodes).includes("alert(1)alert"));
});
test("library validation rejects unsafe IDs, duplicate articles and excessive depth", () => {
  const f = fixture();
  validateLibrary(f);
  assert.throws(() =>
    validateLibrary({
      ...f,
      articles: [{ ...f.articles[0], id: "../escape" }],
    }),
  );
  assert.throws(() =>
    validateLibrary({ ...f, articles: [f.articles[0], f.articles[0]] }),
  );
  let node = { text: "leaf" };
  for (let i = 0; i < 100; i++) node = { tag: "div", children: [node] };
  assert.throws(() =>
    validateLibrary({ ...f, articles: [{ ...f.articles[0], nodes: [node] }] }),
  );
});
test("Wikipedia home indexes full article text and distinguishes archived evidence", () => {
  const lib = fixture(),
    html = renderDashboard([], lib);
  assert.match(html, /Welcome to/);
  assert.match(html, /PH0MBER Wiki/);
  assert.match(html, /data-search-text="Sample Person.*FreelancerKit/);
  assert.match(html, /action="\/"/);
  assert.match(html, /Archived wiki/);
  assert.match(html, /id="no-results"/);
  assert.match(html, /name="text-size"/);
  const archive = renderArchive(lib.articles[0], lib);
  assert.match(archive, /not been independently reverified/);
  assert.match(archive, /Example University/);
  assert.match(archive, /Archive information/);
});
test("library imports persist independently of project references and archived routes work", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "phomber-wiki-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "import.json");
  await writeFile(file, JSON.stringify(fixture()));
  const result = await exec(
    process.execPath,
    [resolve("dist/cli/index.js"), "library", "import", file],
    { env: { ...process.env, PHOMBER_HOME: root } },
  );
  assert.match(result.stdout, /Imported 1/);
  const listed = await exec(
    process.execPath,
    [resolve("dist/cli/index.js"), "library"],
    { env: { ...process.env, PHOMBER_HOME: root } },
  );
  assert.equal(JSON.parse(listed.stdout).length, 1);
  const w = new Workspace(root),
    { server, url } = await startServer(w, 0);
  t.after(() => new Promise((r) => server.close(r)));
  const home = await fetch(url);
  assert.match(await home.text(), /Sample Person/);
  const page = await fetch(url + "/wiki/sample-wiki/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Example University/);
  assert.equal((await fetch(url + "/wiki/missing/")).status, 404);
});
