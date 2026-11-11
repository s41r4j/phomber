import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workspace, atomicJSON } from "../dist/workspace/index.js";
import { Catalog } from "../dist/catalog/index.js";
import { investigate } from "../dist/core/engine.js";
import { writeReport } from "../dist/reports/html.js";
import { renderBiography, renderReportInfo } from "../dist/reports/article.js";
import { startServer } from "../dist/server/index.js";
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), "phomber-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const w = new Workspace(root);
  await w.init();
  await atomicJSON(join(root, "library.json"), {
    schema_version: "1.0",
    articles: [],
  });
  return w;
}
async function report(w, name, finished) {
  const v = await investigate(
    { schema_version: "1.0", subject: { name }, research: { offline: true } },
    w,
  );
  v.research_timing = {
    started_at: "2026-01-01T00:00:00Z",
    finished_at: finished,
  };
  v.updated_at = finished;
  await writeReport(v, w);
  return v;
}
test("related versions group provisionally, sort by recency and persist explicit splits/moves", async (t) => {
  const w = await setup(t),
    old = await report(w, "Same Person", "2026-01-02T00:00:00Z"),
    newer = await report(w, "Same Person", "2026-02-02T00:00:00Z"),
    other = await report(w, "Another Person", "2026-03-02T00:00:00Z"),
    catalog = new Catalog(w);
  let profiles = await catalog.read();
  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].articles[0].id, other.id);
  const group = profiles.find((p) => p.title === "Same Person");
  assert.equal(group.articles.length, 2);
  assert.equal(group.articles[0].id, newer.id);
  assert.equal(group.articles[0].version, 2);
  const original = await readFile(
    join(w.reportPath(newer.id), "investigation.json"),
    "utf8",
  );
  const split = await catalog.move("report:" + newer.id);
  profiles = await new Catalog(w).read();
  assert.equal(profiles.length, 3);
  assert.equal(profiles.find((p) => p.id === split).articles.length, 1);
  assert.equal(
    await readFile(join(w.reportPath(newer.id), "investigation.json"), "utf8"),
    original,
  );
  await catalog.rename(split, "Same name — another person");
  assert.equal(
    (await new Catalog(w).read()).find((p) => p.id === split).title,
    "Same name — another person",
  );
  const merged = await catalog.move("report:" + newer.id, group.id);
  assert.equal(merged, group.id);
  assert.equal(
    (await catalog.read()).find((p) => p.id === group.id).articles.length,
    2,
  );
  await assert.rejects(() => catalog.move("report:../bad"));
  await assert.rejects(() =>
    catalog.move("report:" + old.id, "profile-nonexistent"),
  );
});
test("biography is prose-first with numbered references, dynamic infobox, dates and external links", async (t) => {
  const w = await setup(t),
    v = await report(w, "Example Person", "2026-02-02T00:00:00Z");
  v.sources = [
    {
      id: "s1",
      adapter: "public-profile",
      url: "https://example.org/person",
      retrieved_at: "2026-02-01T12:00:00Z",
      status: "ok",
    },
  ];
  v.findings.push({
    id: "f1",
    category: "career",
    field: "professional_title",
    value: "Software researcher",
    status: "lead",
    source_ids: ["s1"],
    identity: "candidate",
    confidence: { score: null, explanation: "Candidate" },
  });
  v.findings.push({
    id: "f2",
    category: "online",
    field: "website",
    value: "https://example.org/person",
    status: "lead",
    source_ids: ["s1"],
    identity: "candidate",
    confidence: { score: null, explanation: "Candidate" },
  });
  v.evidence = [
    {
      id: "e1",
      finding_id: "f1",
      source_id: "s1",
      excerpt: "Profile says software researcher.",
      retrieved_at: "2026-02-01T12:00:00Z",
    },
  ];
  v.ai = {
    model: "fixture",
    status: "complete",
    limitations: [],
    sections: [
      {
        title: "Overview",
        paragraphs: [
          {
            text: "This candidate profile describes a software researcher.",
            evidence_ids: ["e1"],
          },
        ],
      },
      {
        title: "Career",
        paragraphs: [
          {
            text: "The professional profile reports research work.",
            evidence_ids: ["e1"],
          },
        ],
      },
    ],
  };
  const html = renderBiography(v);
  assert.ok(html.includes("Profile information"));
  assert.ok(html.includes("Software researcher"));
  assert.ok(html.includes("profile-reported"));
  assert.ok(
    html.indexOf("The professional profile reports") <
      html.indexOf("<h2>References</h2>"),
  );
  assert.ok(
    html.indexOf("<h2>References</h2>") <
      html.indexOf("<h2>External links</h2>"),
  );
  assert.match(html, /href="#source-s1">\[1\]/);
  assert.ok(!html.includes("API usage and cost"));
  assert.match(html, /Research completed/);
  assert.match(html, /Last source retrieved/);
  assert.ok(renderReportInfo(v).includes("Research session"));
});
test("real pages and CSRF-protected profile controls work without changing evidence", async (t) => {
  const w = await setup(t),
    a = await report(w, "Grouped Person", "2026-01-02T00:00:00Z"),
    b = await report(w, "Grouped Person", "2026-02-02T00:00:00Z");
  const { server, url } = await startServer(w, 0);
  t.after(() => new Promise((r) => server.close(r)));
  for (const path of [
    "/",
    "/articles/",
    "/about/",
    "/collections/",
    "/activity/",
    `/reports/${a.id}/`,
    `/reports/${a.id}/info/`,
    `/reports/${a.id}/evidence/`,
  ])
    assert.equal((await fetch(url + path)).status, 200, path);
  const home = await (await fetch(url + "/articles/")).text();
  assert.match(home, /2 versions/);
  assert.match(home, /Most recently researched/);
  assert.ok(!home.includes("Most recent profile"));
  const profilePath = home.match(
      /href="(\/profiles\/profile-[a-f0-9-]+\/)"/,
    )[1],
    profile = await (await fetch(url + profilePath)).text(),
    csrf = profile.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  assert.ok(profile.includes('action="/manage/profiles"'));
  const post = (token, origin = url) =>
    fetch(url + "/manage/profiles", {
      method: "POST",
      redirect: "manual",
      headers: {
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        csrf: token,
        action: "split",
        article: "report:" + b.id,
      }).toString(),
    });
  assert.equal((await post("wrong")).status, 403);
  assert.equal((await post(csrf, "https://evil.example")).status, 403);
  const moved = await post(csrf);
  assert.equal(moved.status, 303);
  assert.ok(moved.headers.get("location").startsWith("/profiles/"));
  assert.equal((await new Catalog(w).read()).length, 2);
  assert.equal((await w.load(a.id)).id, a.id);
  const history = await fetch(url + `/reports/${a.id}/history/`, {
    redirect: "manual",
  });
  assert.equal(history.status, 303);
});
