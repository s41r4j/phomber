# DeepSeek AI research

`phomber wiki` now uses the official DeepSeek APIs for AI research by default. `--no-ai` runs only public-source adapters; `--offline` disables all AI calls. No keys are embedded in the package.

Use `phomber wiki --name "SUBJECT" --ai-only --no-serve` for DeepSeek-only research. This enables online AI explicitly and skips source adapters and separate portrait downloads; all external research calls go through DeepSeek Search/Fetch. The preference is saved for resume. `--no-ai` returns to adapter collection; `--ai-only` cannot be combined with `--offline` or `--no-ai`. Supplied/imported context remains investigator-provided evidence, not independent verification.

Supplied handles and name/institution combinations receive priority within the search budget. Known contact-broker and people-search hosts are excluded before page retrieval and do not consume the page budget. This exclusion list is bounded; source contents and identity matches still require analyst review.

```sh
npx --no-install phomber wiki --name "SUBJECT" --company "KNOWN CONTEXT" --depth deep
phomber wiki --name "SUBJECT" --depth deep
phomber auth deepseek
phomber auth logout
```

Key input is hidden (no echo). Under NPX/npm exec the key stays in memory for that wiki invocation. A normally installed executable saves it to `credentials.json` in its local workspace, using POSIX mode 0600; Windows relies on the user's ACLs. It is a local plaintext credential, not encrypted storage. `--save-key` explicitly persists an NPX key. `DEEPSEEK_API_KEY` supplies an environment key without writing it to disk. Keys are never CLI arguments, report fields, exported artifacts or model prompts. The server cannot serve the credential file. Never paste a key into chat.

Default model: `deepseek-flash`, the current rolling model alias documented by DeepSeek (V4.1-Flash-1017 at implementation time). The CLI checks `/models` for availability, and `--model` selects another returned model. It does not guess a model if discovery fails.

The workflow runs the existing OSINT adapters, then asks the AI to plan searches, calls DeepSeek's Search API and Fetch API to retrieve real public source pages, extracts evidence with literal quotes checked against retrieved content, follows bounded research leads, and writes cited biography sections. Quick: up to 3 queries/5 pages/1 round; standard: 8 queries/15 pages/2 rounds; deep: 16 queries/30 pages/3 rounds. Each model prompt is scoped to this investigation. No other saved investigations or credential files are sent. Source text is treated as untrusted data.

Each synthesis excerpt includes its finding identity and verification/conflict status so unresolved matches remain visible to the model. AI-produced paragraphs must cite existing evidence IDs. Unsupported citation IDs reject the narrative. Extracted web matches remain leads; a quote matching a page does not establish that a page describes the right person or that its claim is independently true. AI synthesis is labeled separately from source-backed resource data. Citations and local evidence remain accessible in HTML and JSON. Authentication/balance errors and blocked sources are shown as limitations; partial evidence is saved if later AI steps fail.

DeepSeek model, Search and Fetch calls are billed to the supplied key. Calls use bounded responses and timeouts; transient rate/server failures retry twice. There is no claim of free AI research or exhaustive search-engine coverage. A live authenticated blind-operator test was completed with a user-provided temporary key; its private report and cost audit are stored in the local workspace, and the temporary key file was deleted. Automated tests use fixture transports to check planning, actual search/fetch orchestration, quote validation and citation rejection.

Official documentation: [model alias](https://api-docs.deepseek.com/en/), [Search/Fetch](https://api-docs.deepseek.com/guides/search/), [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/).

## Session timing and cost

Every CLI investigation records `research_timing.started_at`, `finished_at` and `duration_ms`. The wiki and homepage show research start/results times in IST (Asia/Kolkata), while JSON retains UTC ISO timestamps. In-progress AI collection checkpoints the report so refreshes can show its starting time before completion.

DeepSeek responses contribute provider-reported input, output and cache-token counts to `usage`. Each API attempt records endpoint, time and HTTP status, never Authorization headers or the key. Search/Fetch fees count only nonempty successful results. USD estimates use the documented off-peak/peak interval, with the pricing URL stored for audit; they are not invented by the language model. If available, a before/after account-balance difference is recorded separately and can include concurrent account activity or billing delay. `usage.json` accompanies the report JSON. Unknown model pricing produces an unavailable estimate rather than a guessed amount.

Malformed model JSON is retried at most twice; quotes and evidence references are still validated after retry. Failed and corrected investigations retain separate IDs, timestamps and usage records.

If a run has collected useful evidence but narrative validation failed, `phomber wiki --resume REPORT_ID --synthesize-only --no-serve` rewrites from that same evidence without repeating searches. This option requires online AI mode and unchanged subject context, imported evidence and omissions. Execution budgets and explicit AI/online preferences may change. To change identifiers or apply omissions, resume without `--synthesize-only` so evidence is recollected. API usage is cumulative for that investigation; the observed account balance change covers the latest invocation only. A separate audit should include discarded/wrong-identifier attempts when reporting total test spend. The report keeps its original start time and updates completion time. A complete AI narrative can coexist with top-level `partial` when sources are blocked or unavailable; this does not mean the narrative is missing.

## Review and execution limits

`--no-ai` persists as an investigation preference; `--ai` explicitly enables sharing again. `--max-ai-calls` caps all provider HTTP attempts, including retries and metadata calls; `--max-output-tokens` caps each model response. Unknown completion/usage makes billing estimates unavailable. Analyst decisions invalidate earlier prose, and rejected/different-identity evidence cannot be cited in regeneration. See [the analyst workflow](ANALYST_WORKFLOW.md) for defaults and limitations.
