import assert from "node:assert/strict";
import { readFile, readdir, lstat } from "node:fs/promises";
import { Script } from "node:vm";

const root = new URL("../", import.meta.url);
const site = new URL("website/", root);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const html = await readFile(new URL("index.html", site), "utf8");
// Only the public landing page is uploaded; workspace reports must never enter it.
const files = await readdir(site);
assert.deepEqual(files.sort(), [".nojekyll", "CNAME", "index.html"]);
for (const file of files) assert.ok((await lstat(new URL(file, site))).isFile(), `Unexpected site object: ${file}`);
const domain = (await readFile(new URL("CNAME", site), "utf8")).trim();
assert.equal(new URL(pkg.homepage).hostname, domain);
assert.ok(html.includes(`<meta name="phomber-version" content="${pkg.version}">`), "Website version differs from package.json");
for (const version of html.match(/\bv\d+\.\d+\.\d+(?:-[\w.]+)?/g) || [])
  assert.equal(version, `v${pkg.version}`, "Visible website version is stale");
assert.ok(html.includes(`<link rel="canonical" href="https://${domain}/">`));
assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'));
assert.ok(!/<(?:script|img|iframe|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(
  html.replace(/<link\b[^>]*rel="canonical"[^>]*>/gi, "")), "The single-file site must not depend on remote assets");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "Duplicate page IDs");
for (const [, id] of html.matchAll(/href="#([^"]+)"/g))
  assert.ok(ids.includes(id), `Broken page anchor: ${id}`);
for (const [, id] of html.matchAll(/data-copy="([^"]+)"/g))
  assert.ok(ids.includes(id), `Copy button target missing: ${id}`);
for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(script);
assert.ok(html.includes('OSINT RESEARCHER'), "Project tagline is missing");
assert.ok(html.includes('color-scheme:light'), "The project site must use its light encyclopedia theme");
assert.ok(!/color-scheme\s*:\s*dark|prefers-color-scheme\s*:\s*dark/.test(html), "Unexpected dark theme");
assert.ok(html.includes('prefers-reduced-motion: reduce'), "The moving atlas must respect reduced motion");
assert.ok(html.includes('id="motion-toggle"'), "The moving atlas must offer a pause control");
console.log(`Website check passed: single HTML, ${domain}, Gen2 ${pkg.version}; no external assets.`);
