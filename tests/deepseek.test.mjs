import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Workspace } from "../dist/workspace/index.js";
import { investigate } from "../dist/core/engine.js";
import { researchWithAI, validateSections } from "../dist/ai/deepseek.js";
import {
  saveCredential,
  readCredential,
  forgetCredential,
  isNpx,
} from "../dist/ai/credentials.js";
import { validateInvestigation } from "../dist/core/schema.js";
import { renderReport, renderDashboard } from "../dist/reports/html.js";
async function base(t) {
  const root = await mkdtemp(join(tmpdir(), "phomber-ai-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const w = new Workspace(root);
  await w.init();
  return {
    w,
    inv: await investigate(
      {
        schema_version: "1.0",
        subject: { name: "Example Researcher" },
        research: { depth: "quick", offline: true },
      },
      w,
    ),
  };
}
test("AI runs search/fetch, follows evidence and writes source-cited sections", async (t) => {
  const { inv } = await base(t);
  const calls = [];
  const transport = async (path, body) => {
    calls.push(path);
    if (path === "/models") return { data: [{ id: "deepseek-flash" }] };
    if (path === "/v1/tools/search")
      return { results: [{ url: "https://example.org/researcher" }] };
    if (path === "/v1/tools/fetch")
      return {
        content:
          "Example Researcher created the public Example Project in 2020.",
      };
    const prompt = body.messages[1].content;
    if (prompt.startsWith("Plan"))
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                queries: ['"Example Researcher" project'],
              }),
            },
          },
        ],
      };
    if (prompt.startsWith("Extract"))
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                claims: [
                  {
                    url: "https://example.org/researcher",
                    category: "projects",
                    field: "Project",
                    value: "Example Project",
                    quote: "created the public Example Project in 2020.",
                  },
                  {
                    url: "https://example.org/researcher",
                    category: "identity",
                    field: "Bad",
                    value: "Invented",
                    quote: "Not actually on page",
                  },
                ],
                queries: [],
              }),
            },
          },
        ],
      };
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              sections: [
                {
                  title: "Projects",
                  blocks: [
                    {type:'paragraph',text:'The collected page credits Example Project to this candidate.',evidence_ids:['E1']},
                    {type:'table',caption:'Public project evidence',columns:['Project'],rows:[{cells:['Example Project'],evidence_ids:['E1']}]}
                  ],
                },
              ],
            }),
          },
        },
      ],
    };
  };
  await researchWithAI(inv, transport);
  assert.ok(calls.includes("/v1/tools/search"));
  assert.ok(calls.includes("/v1/tools/fetch"));
  assert.ok(!inv.findings.some((f) => f.value === "Invented"));
  assert.equal(inv.ai.sections.length, 1);
  assert.equal(
    inv.findings.find((f) => f.value === "Example Project").status,
    "lead",
  );
  validateInvestigation(inv);
  assert.equal(inv.ai.sections[0].blocks[1].rows[0].evidence_ids[0],inv.evidence[0].id);
  assert.match(renderReport(inv), /Public project evidence/);
});
test("unsupported evidence citations fail; unknown models fail before paid searches", async (t) => {
  const { inv } = await base(t);
  assert.throws(() =>
    validateSections(
      {
        sections: [
          {
            title: "x",
            paragraphs: [{ text: "invented", evidence_ids: ["unknown"] }],
          },
        ],
      },
      inv,
    ),
  );
  await assert.rejects(
    () =>
      researchWithAI(inv, async () => ({ data: [{ id: "available" }] }), {
        model: "missing",
      }),
    /model unavailable/,
  );
});
test("credentials remain separate from reports, restricted, removable and NPX detected", async (t) => {
  const { w, inv } = await base(t);
  await saveCredential(w, "fixture-not-a-real-key");
  assert.equal(await readCredential(w), "fixture-not-a-real-key");
  if (process.platform !== "win32")
    assert.equal(
      (await stat(join(w.root, "credentials.json"))).mode & 0o777,
      0o600,
    );
  assert.ok(!JSON.stringify(inv).includes("fixture-not-a-real-key"));
  await forgetCredential(w);
  assert.equal(await readCredential(w), undefined);
  const old = process.env.npm_command;
  process.env.npm_command = "exec";
  assert.equal(isNpx(), true);
  if (old === undefined) delete process.env.npm_command;
  else process.env.npm_command = old;
});
test("home features newest person, without a fixed archived individual, and logo includes W", () => {
  const v = {
    id: "test-profile",
    name: "Most Recent Person",
    type: "person",
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
    status: "complete",
    source_count: 0,
    verified_count: 0,
    depth: "quick",
    formats: ["html", "json"],
  };
  const html = renderDashboard([v]);
  assert.ok(!html.includes("Most recent profile"));
  assert.match(html, />Most Recent Person<\/a>/);
  assert.match(html, /Most recently researched/);
  assert.match(html, />W<\/text>/);
});

test("DeepSeek records provider usage without recording the API key", async () => {
  const { DeepSeek } = await import("../dist/ai/deepseek.js");
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        model: "deepseek-flash",
        usage: {
          prompt_tokens: 100,
          prompt_cache_hit_tokens: 10,
          prompt_cache_miss_tokens: 90,
          completion_tokens: 20,
        },
        choices: [],
      }),
      { status: 200 },
    );
  try {
    const client = new DeepSeek("fixture-private-key");
    await client.request("/chat/completions", { model: "deepseek-flash" });
    const usage = client.usage();
    assert.equal(usage.totals.prompt_tokens, 100);
    assert.equal(usage.totals.completion_tokens, 20);
    assert.ok(!JSON.stringify(usage).includes("fixture-private-key"));
  } finally {
    globalThis.fetch = previous;
  }
});

test("evidence-only synthesis repairs citation identifiers without repeating searches", async (t) => {
  const { inv } = await base(t);
  inv.sources.push({
    id: "source-fixture",
    adapter: "fixture",
    url: "https://example.org",
    retrieved_at: "2026-11-11T00:00:00Z",
    status: "ok",
  });
  inv.findings.push({
    id: "finding-fixture",
    category: "projects",
    field: "Project",
    value: "Example Project",
    status: "lead",
    source_ids: ["source-fixture"],
    identity: "candidate",
    confidence: { score: null, explanation: "Candidate" },
  });
  inv.evidence.push({
    id: "evidence-fixture",
    finding_id: "finding-fixture",
    source_id: "source-fixture",
    excerpt: "The candidate maintains Example Project.",
    retrieved_at: "2026-11-11T00:00:00Z",
  });
  let attempts = 0;
  const paths = [];
  await researchWithAI(
    inv,
    async (path) => {
      paths.push(path);
      if (path === "/models") return { data: [{ id: "deepseek-flash" }] };
      attempts++;
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                sections: [
                  {
                    title: "Projects",
                    paragraphs: [
                      {
                        text: "The collected page mentions Example Project.",
                        evidence_ids: [attempts === 1 ? "E999" : "E1"],
                      },
                    ],
                  },
                ],
              }),
            },
          },
        ],
      };
    },
    { synthesisOnly: true },
  );
  assert.equal(attempts, 2);
  assert.ok(!paths.includes("/v1/tools/search"));
  assert.equal(
    inv.ai.sections[0].paragraphs[0].evidence_ids[0],
    "evidence-fixture",
  );
});
