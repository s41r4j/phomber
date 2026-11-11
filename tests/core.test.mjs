import { renderEvidence } from "../dist/reports/article.js";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Workspace } from "../dist/workspace/index.js";
import {
  validateInput,
  validateInvestigation,
  publicURL,
} from "../dist/core/schema.js";
import { investigate, addFinding, correlate } from "../dist/core/engine.js";
import {
  buildPlan,
  accountTasks,
  normalizeSocial,
} from "../dist/adapters/index.js";
import {
  sanitize,
  publicIPv4,
  HttpClient,
  pinnedLookup,
} from "../dist/adapters/http.js";
import {
  renderReport,
  writeReport,
  script,
  csp,
} from "../dist/reports/html.js";
import { inputFromArgs, parse, tokenize } from "../dist/cli/input.js";
import { assist } from "../dist/ai/index.js";
const fixture = {
  login: "octocat",
  name: "The Octocat",
  company: "GitHub",
  bio: "Official test mascot",
  html_url: "https://github.com/octocat",
  created_at: "2011-01-25T18:44:36Z",
};
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), "phomber-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const w = new Workspace(root);
  await w.init();
  return w;
}
async function seed(w, url, data) {
  const hash = createHash("sha256").update(url).digest("hex");
  await writeFile(
    join(w.root, "cache", hash + ".json"),
    JSON.stringify({
      data,
      retrieved_at: new Date().toISOString(),
      cached: false,
    }),
  );
}
const input = () => ({
  schema_version: "1.0",
  subject: { socials: [{ platform: "github", username: "octocat" }] },
  research: { depth: "quick", offline: true },
});

test("schema validates optional categories, dates and custom metadata", () => {
  assert.equal(
    validateInput({
      ...input(),
      subject: {
        name: "Test",
        education: [
          {
            institution: "University",
            date: { start: "2020", precision: "year" },
          },
        ],
        custom: { key: "value" },
      },
    }).schema_version,
    "1.0",
  );
  for (const value of [
    { subject: { name: "x" } },
    { schema_version: "2.0", subject: { name: "x" } },
    { schema_version: "1.0", subject: {} },
    { ...input(), research: { depth: "ultra" } },
    { ...input(), subject: { name: "x", typo: true } },
  ])
    assert.throws(() => validateInput(value));
});
test("repeatable flags append, scalars override and invalid values fail", async (t) => {
  const w = await setup(t),
    file = join(w.root, "input.json");
  await writeFile(
    file,
    JSON.stringify({
      ...input(),
      subject: {
        name: "Old",
        socials: [{ platform: "gitlab", username: "old" }],
      },
    }),
  );
  const v = await inputFromArgs(
    parse([
      "--input",
      file,
      "--name",
      "New",
      "--social",
      "github:octocat",
      "--education",
      "One",
      "--education",
      "Two",
      "--company",
      "A",
      "--company",
      "B",
    ]),
  );
  assert.equal(v.subject.name, "New");
  assert.equal(v.subject.socials.length, 2);
  assert.equal(v.subject.education.length, 2);
  assert.deepEqual(v.subject.professional.companies, ["A", "B"]);
  await assert.rejects(() =>
    inputFromArgs(parse(["--name", "x", "--format", "xml"])),
  );
  assert.throws(() => parse(["--nmae", "x"]));
  assert.deepEqual(tokenize('wiki --name "John Doe"'), [
    "wiki",
    "--name",
    "John Doe",
  ]);
  assert.throws(() => tokenize('"bad'));
});
test("public URL and IP checks reject unsafe destinations and credentials", () => {
  for (const url of [
    "http://example.com",
    "https://localhost/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://foo.local",
    "https://example.com:4000",
    "https://u:p@example.com",
    "https://example.com/?token=abc",
  ])
    assert.throws(() => publicURL(url));
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.1.1",
    "169.254.1.1",
    "100.64.0.1",
    "224.0.0.1",
  ])
    assert.equal(publicIPv4(ip), false);
  assert.equal(publicIPv4("8.8.8.8"), true);
});
test("cache sanitization omits contact information and secrets recursively", () => {
  assert.deepEqual(
    sanitize({
      email: "private",
      entities: [{ contact: "bad" }],
      nested: { api_key: "secret", name: "Name" },
      bio: "mail foo@example.com",
    }),
    { nested: { name: "Name" }, bio: "mail [email omitted]" },
  );
});
test("depth changes actual endpoint and request coverage", () => {
  const s = { name: "Example", usernames: ["test"], domains: ["example.com"] };
  const plans = ["quick", "standard", "deep"].map((depth) =>
    buildPlan({ schema_version: "1.0", subject: s, research: { depth } }),
  );
  assert.ok(plans[0].tasks.length < plans[1].tasks.length);
  assert.ok(plans[1].tasks.length < plans[2].tasks.length);
  assert.ok(plans[2].tasks.some((t) => t.adapter === "internet-archive"));
  assert.ok(plans[1].tasks.some((t) => t.adapter === "crossref"));
});
test("profile URL parsing and platform limitations are explicit", () => {
  assert.equal(
    normalizeSocial("https://github.com/octocat").username,
    "octocat",
  );
  assert.equal(
    buildPlan({
      schema_version: "1.0",
      subject: { socials: [{ platform: "linkedin", username: "example" }] },
    }).unsupported.length,
    1,
  );
  assert.equal(
    accountTasks(
      { platform: "github", username: "../bad" },
      "quick",
      "candidate",
    ).length,
    0,
  );
});
test("source parsers extract real API shapes without contact fields", () => {
  const task = accountTasks(
    { platform: "github", username: "octocat" },
    "quick",
    "anchored",
  )[0];
  const records = task.parse({ ...fixture, email: "private@example.com" });
  assert.ok(
    records.some((r) => r.field === "name" && r.value === "The Octocat"),
  );
  assert.ok(!records.some((r) => r.field === "email"));
  const pub = buildPlan({
    schema_version: "1.0",
    subject: { name: "Name" },
    research: { depth: "standard" },
  }).tasks.find((t) => t.adapter === "crossref");
  assert.equal(
    pub.parse({
      message: {
        items: [
          {
            title: ["A paper"],
            URL: "https://doi.org/10.example/paper",
            published: { "date-parts": [[2020]] },
          },
        ],
      },
    })[0].date.start,
    "2020",
  );
});
test("engine collects cached evidence, resumes with stable ID and exports all files", async (t) => {
  const w = await setup(t);
  await seed(w, "https://api.github.com/users/octocat", fixture);
  const inv = await investigate(input(), w);
  assert.equal(inv.status, "complete");
  assert.ok(
    inv.findings.some((f) => f.field === "name" && f.status === "verified"),
  );
  assert.ok(inv.evidence.length > 0);
  assert.ok(inv.timeline.length > 0);
  assert.equal(validateInvestigation(inv).id, inv.id);
  const path = await writeReport(inv, w);
  assert.match(await readFile(join(path, "index.html"), "utf8"), /The Octocat/);
  const resumed = await investigate(input(), w, { resume: inv });
  assert.equal(resumed.id, inv.id);
  assert.equal(resumed.findings.length, inv.findings.length);
  assert.equal(resumed.created_at, inv.created_at);
  const exported = await w.export(inv.id);
  assert.equal(
    JSON.parse(await readFile(join(exported, "profile.json"), "utf8")).id,
    inv.id,
  );
  await assert.rejects(() => w.export(inv.id, exported));
  assert.equal((await w.list()).length, 1);
});
test("username-only matches remain leads and source failure is not absence", async (t) => {
  const w = await setup(t);
  await seed(w, "https://api.github.com/users/octocat", fixture);
  const inv = await investigate(
    {
      schema_version: "1.0",
      subject: { usernames: ["octocat"] },
      research: { depth: "quick", offline: true },
    },
    w,
  );
  assert.ok(
    inv.findings
      .filter((f) => f.source_ids.length)
      .every((f) => f.status === "lead" && f.confidence.score === null),
  );
  const failed = await investigate(
    {
      ...input(),
      subject: { socials: [{ platform: "github", username: "missing" }] },
    },
    w,
  );
  assert.equal(failed.status, "partial");
  assert.equal(failed.sources[0].status, "unavailable");
  assert.equal(
    failed.findings.filter((f) => f.status === "verified").length,
    0,
  );
});
test("contradictions are retained and source-backed connections require evidence", async (t) => {
  const w = await setup(t);
  await seed(w, "https://api.github.com/users/octocat", fixture);
  const inv = await investigate(
    {
      ...input(),
      subject: {
        ...input().subject,
        name: "Someone Else",
        connections: [{ name: "A private friend" }],
      },
    },
    w,
  );
  assert.ok(
    inv.findings.some((f) => f.field === "name" && f.status === "conflicting"),
  );
  assert.equal(inv.connections.length, 0);
});
test("omissions apply to resumed data, cancellation persists an interrupted report", async (t) => {
  const w = await setup(t);
  const inv = await investigate(
    { ...input(), subject: { ...input().subject, location: "Omit me" } },
    w,
  );
  const resumed = await investigate(
    { ...inv.input, research: { ...inv.input.research, omit: ["location"] } },
    w,
    { resume: inv },
  );
  assert.ok(!JSON.stringify(resumed).includes("Omit me"));
  const controller = new AbortController();
  controller.abort();
  const stopped = await investigate(input(), w, { signal: controller.signal });
  assert.equal(stopped.status, "interrupted");
  assert.equal((await w.load(stopped.id)).status, "interrupted");
});
test("HTML escapes findings, attributes and evidence, has offline controls and CSP hashes", async (t) => {
  const w = await setup(t),
    inv = await investigate(input(), w);
  inv.input.subject.name = "<img src=x onerror=alert(1)>";
  inv.findings.push({
    id: "unsafe",
    category: "identity",
    field: "Unsafe",
    value: "<script>alert(1)</script>",
    status: "lead",
    source_ids: [],
    identity: "candidate",
    confidence: { score: null, explanation: '" onmouseover="bad' },
  });
  const html = renderReport(inv);
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<script>alert(1)"));
  const evidenceHtml = renderEvidence(inv);
  assert.ok(evidenceHtml.includes("&lt;script&gt;"));
  assert.ok(!evidenceHtml.includes("<script>alert(1)"));
  assert.match(html, /\/evidence\//);
  assert.match(html, /Research completed/);
  assert.ok(!html.includes("cdn."));
  assert.ok(!html.includes("fonts.googleapis"));
  const hash = createHash("sha256").update(script).digest("base64");
  assert.ok(csp.includes(hash));
  assert.ok(html.includes(`<script>${script}</script>`));
});
test("workspace rejects traversal and symbolic report files", async (t) => {
  if (process.platform === "win32") {
    t.skip(
      "Symlink creation requires developer mode or administrator privileges on Windows.",
    );
    return;
  }
  const w = await setup(t);
  assert.throws(() => w.reportPath("../escape"));
  const inv = await investigate(input(), w),
    p = w.reportPath(inv.id);
  await rm(join(p, "investigation.json"));
  await symlink(join(w.root, "config.json"), join(p, "investigation.json"));
  await assert.rejects(() => w.load(inv.id));
});
test("AI requires explicit consent, selected evidence and traceable citations", async () => {
  let calls = 0;
  const provider = {
    name: "test",
    async suggest(e) {
      calls++;
      return [
        {
          text: "Summary",
          kind: "summary",
          evidence_ids: [e[0].id],
          verified: false,
        },
      ];
    },
  };
  const e = [
    {
      id: "e",
      finding_id: "f",
      source_id: "s",
      excerpt: "Public fact",
      retrieved_at: "2020-01-01",
    },
  ];
  await assert.rejects(() =>
    assist(provider, e, { enabled: false, evidence_ids: ["e"] }),
  );
  assert.equal(calls, 0);
  assert.equal(
    (await assist(provider, e, { enabled: true, evidence_ids: ["e"] })).length,
    1,
  );
  await assert.rejects(() =>
    assist(
      {
        name: "bad",
        async suggest() {
          return [
            { text: "Invented", evidence_ids: ["unknown"], verified: false },
          ];
        },
      },
      e,
      { enabled: true, evidence_ids: ["e"] },
    ),
  );
});

test("pinned DNS callbacks support both Node single-address and all-address lookup modes", () => {
  const lookup = pinnedLookup("8.8.8.8");
  lookup("example.com", { all: true }, (error, value) => {
    assert.equal(error, null);
    assert.deepEqual(value, [{ address: "8.8.8.8", family: 4 }]);
  });
  lookup("example.com", { family: 4 }, (error, value, family) => {
    assert.equal(error, null);
    assert.equal(value, "8.8.8.8");
    assert.equal(family, 4);
  });
});

test("a conflicting social URL cannot anchor another platform account", () => {
  assert.throws(
    () =>
      buildPlan({
        schema_version: "1.0",
        subject: {
          socials: [
            {
              platform: "github",
              username: "octocat",
              url: "https://evil.example/octocat",
            },
          ],
        },
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      buildPlan({
        schema_version: "1.0",
        subject: {
          socials: [
            {
              platform: "github",
              username: "another",
              url: "https://github.com/octocat",
            },
          ],
        },
      }),
    /does not match/,
  );
});
