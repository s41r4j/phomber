import type { Json } from "../adapters/http.js";
import { arr, obj, str } from "../adapters/http.js";
export interface APICall {
  endpoint: string;
  started_at: string;
  finished_at: string;
  status: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  billable_tool: boolean;
  model?: string;
}
export interface ResearchUsage {
  calls: APICall[];
  totals: {
    model_calls: number;
    search_calls: number;
    fetch_calls: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
  estimated_usd_min: number | null;
  estimated_usd_max: number | null;
  pricing_source: string;
  pricing_note: string;
  balance_change?: { currency: string; amount: number }[];
}
export function summarizeUsage(calls: APICall[]): ResearchUsage {
  let min = 0,
    max = 0,
    known = true;
  for (const c of calls) {
    if (c.billable_tool) {
      min += 0.00075;
      max += 0.00075;
    }
    if (c.endpoint === "/chat/completions" && c.status === 200) {
      const rates =
        c.model === "deepseek-flash"
          ? [0.006, 0.3, 1.2]
          : c.model === "deepseek-v4-pro"
            ? [0.044, 1.32, 3.96]
            : undefined;
      if (!rates) {
        known = false;
        continue;
      }
      const cost =
        (c.cache_hit_tokens * rates[0]! +
          c.cache_miss_tokens * rates[1]! +
          c.completion_tokens * rates[2]!) /
        1e6;
      min += cost / 2;
      max += cost;
    }
  }
  return {
    calls,
    totals: {
      model_calls: calls.filter(
        (c) => c.endpoint === "/chat/completions" && c.status === 200,
      ).length,
      search_calls: calls.filter(
        (c) => c.endpoint === "/v1/tools/search" && c.billable_tool,
      ).length,
      fetch_calls: calls.filter(
        (c) => c.endpoint === "/v1/tools/fetch" && c.billable_tool,
      ).length,
      prompt_tokens: calls.reduce((s, c) => s + c.prompt_tokens, 0),
      completion_tokens: calls.reduce((s, c) => s + c.completion_tokens, 0),
    },
    estimated_usd_min: known ? Number(min.toFixed(8)) : null,
    estimated_usd_max: known ? Number(max.toFixed(8)) : null,
    pricing_source: "https://api-docs.deepseek.com/quick_start/pricing/",
    pricing_note:
      "Token usage is provider-reported. USD interval uses documented off-peak/peak rates checked 2026-11-11, and $0.00075 per nonempty successful Search/Fetch. Estimates are not an invoice; retries with unknown server completion may incur unobserved charges.",
  };
}
export function balanceChange(
  before: Json,
  after: Json,
): { currency: string; amount: number }[] {
  return arr(obj(after).balance_infos).flatMap((raw) => {
    const row = obj(raw),
      previous = arr(obj(before).balance_infos)
        .map(obj)
        .find((b) => b.currency === row.currency),
      a = Number(previous?.total_balance),
      b = Number(row.total_balance);
    return previous && Number.isFinite(a) && Number.isFinite(b)
      ? [{ currency: str(row.currency), amount: Number((a - b).toFixed(8)) }]
      : [];
  });
}
