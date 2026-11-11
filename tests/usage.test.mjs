import test from "node:test";
import assert from "node:assert/strict";
import { summarizeUsage, balanceChange } from "../dist/ai/usage.js";
import { renderDashboard } from "../dist/reports/html.js";
test("usage uses provider token counts and only bills successful nonempty tools", () => {
  const base = {
    started_at: "2026-11-11T10:00:00Z",
    finished_at: "2026-11-11T10:00:01Z",
    status: 200,
    prompt_tokens: 0,
    completion_tokens: 0,
    cache_hit_tokens: 0,
    cache_miss_tokens: 0,
    billable_tool: false,
  };
  const usage = summarizeUsage([
    {
      ...base,
      endpoint: "/chat/completions",
      model: "deepseek-flash",
      prompt_tokens: 1000,
      cache_miss_tokens: 1000,
      completion_tokens: 100,
    },
    { ...base, endpoint: "/v1/tools/search", billable_tool: true },
    { ...base, endpoint: "/v1/tools/fetch", billable_tool: false },
  ]);
  assert.equal(usage.totals.prompt_tokens, 1000);
  assert.equal(usage.totals.search_calls, 1);
  assert.equal(usage.totals.fetch_calls, 0);
  assert.equal(usage.estimated_usd_max, 0.00117);
  assert.equal(usage.estimated_usd_min, 0.00096);
  assert.equal(
    summarizeUsage([
      { ...base, endpoint: "/chat/completions", model: "unpriced" },
    ]).estimated_usd_min,
    null,
  );
});
test("account balance difference is recorded without persisting full balances", () => {
  assert.deepEqual(
    balanceChange(
      { balance_infos: [{ currency: "USD", total_balance: "10" }] },
      { balance_infos: [{ currency: "USD", total_balance: "9.97" }] },
    ),
    [{ currency: "USD", amount: 0.03 }],
  );
});
test("homepage shows research start and finish time with local timezone", () => {
  const html = renderDashboard([
    {
      id: "test-person",
      name: "Fresh Subject",
      type: "person",
      created_at: "2026-11-11T10:00:00Z",
      updated_at: "2026-11-11T10:01:00Z",
      research_started_at: "2026-11-11T10:00:00Z",
      research_finished_at: "2026-11-11T10:01:00Z",
      status: "complete",
      source_count: 0,
      verified_count: 0,
      depth: "deep",
      formats: ["html", "json"],
    },
  ]);
  assert.match(html, /Started /);
  assert.match(html, /11 Nov 2026/);
  assert.match(html, /IST|GMT\+5:30/);
});

import { publicURL } from "../dist/core/schema.js";
test("Crossref author parameters are public queries, not credentials", () => {
  assert.equal(
    publicURL("https://api.crossref.org/works?query.author=Name").hostname,
    "api.crossref.org",
  );
  assert.throws(() => publicURL("https://example.com?api_key=secret"));
});
