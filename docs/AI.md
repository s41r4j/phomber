# DeepSeek AI research

[Documentation index](README.md) · [Project guide](../README.md)

`phomber find` now uses the official DeepSeek APIs for AI research by default. `--no-ai` runs only public-source adapters; `--offline` disables all AI calls. No keys are embedded in the package.

Use `phomber find "SUBJECT" --ai-only --no-serve` for DeepSeek-only research. This enables online AI explicitly and skips source adapters and separate portrait downloads; all external research calls go through DeepSeek Search/Fetch. The preference is saved for resume. `--no-ai` returns to adapter collection; `--ai-only` cannot be combined with `--offline` or `--no-ai`. Supplied/imported context remains investigator-provided evidence, not independent verification.

Supplied handles and name/institution combinations receive priority within the search budget. Known contact-broker and people-search hosts are excluded before page retrieval and do not consume the page budget. This exclusion list is bounded; source contents and identity matches still require analyst review.

```sh
npx phomber find "SUBJECT" --company "KNOWN CONTEXT" --depth deep
phomber find "SUBJECT" --depth deep
phomber auth deepseek
phomber auth logout
```

Key input is hidden (no echo). Installed, NPX/npm exec and checkout commands read and save the same `credentials.json` in the shared home workspace, using POSIX mode 0600; Windows relies on the user's ACLs. It is a local plaintext credential, not encrypted storage. Set `PHOMBER_EPHEMERAL_KEY=1` to use a session key without reading or saving the credential file; `--save-key` explicitly saves a newly entered key in that mode. `DEEPSEEK_API_KEY` supplies an environment key without writing it to disk. Keys are never CLI arguments, report fields, exported artifacts or model prompts. The server cannot serve the credential file. Never paste a key into chat.

Default model: `deepseek-flash`, the current rolling model alias documented by DeepSeek (V4.1-Flash-1017 at implementation time). The CLI checks `/models` for availability, and `--model` selects another returned model. It does not guess a model if discovery fails.

By default, the workflow combines public-source adapters with DeepSeek research. Planning receives the current investigation's supplied context, API findings, source availability, topic coverage and retained evidence. It reads supplied profile/home pages directly, then uses DeepSeek Search and Fetch for public pages. Every fetched page receives a bounded extraction pass; early pages are not dropped when a round retrieves more than ten documents. Quotes are checked literally against the retrieved content, and extracted values must occur in their quotes. Distinct excerpts for the same fact on one resource are retained without treating them as independent corroboration. Public certifications and qualifications may be extracted; login credentials remain excluded.

Quick allows up to 3 queries, 5 pages and 1 round; standard allows 8 queries, 15 pages and 2 rounds; deep allows 16 queries, 30 pages and 3 rounds. Direct reads and followed web links count toward the same page budget. Search-result selection spreads reads across query perspectives. Between standard/deep rounds, a structured gap review examines identity uncertainty, contradictions, projects, publications, clubs, arts, events and dates already suggested by evidence. It proposes targeted checks rather than assuming a missing topic does not exist. This is an explicit evidence review, not a guarantee of exhaustive coverage.

Supported account URLs found in retained evidence or selected from actual source-page links can also activate local GitHub, GitLab, DEV and Hugging Face adapters. These follow-up API tasks have separate quick/standard/deep caps of 2/6/12 tasks plus up to 2/3/3 discovered-name discovery tasks within the same 4/12/24 HTTP `get` operation limits; each operation can retry transient failures at most twice. They preserve snapshots, task states and source attribution. Repository pagination is limited to one page for quick/standard and two for deep. Duplicate source tasks and unsupported hosts are skipped. `--ai-only` disables this local enrichment; `--synthesize-only` performs neither web collection nor enrichment. Proposed follow-up URLs must occur in source text or retained evidence. Fabricated model URLs are rejected before retrieval.

The wiki displays automatic resource-match explanations:

- `supported-link`: a supplied resource reports the exact supplied name, or retained named evidence explicitly links to a supplied resource. A supported single-account API can retain the name and link in separate fields of the same response.
- `probable-match`: several distinct clues meet the weighted threshold across independently grouped sources, allowing bounded follow-up as a working hypothesis.
- `context-consistent`: the exact supplied name and supplied institution/employer occur together in an excerpt, while an explicit account link is still missing.
- `unresolved`: no sufficient resource association was retained. A matching name or handle alone is insufficient.
- `conflicting`: contradictory findings or an analyst's different-identity decision override the automatic association.

The matcher applies to all retained professional evidence, not just CVs. Signals are capped once per family: exact research name 20 marks, explicit supplied resource/cross-link 45, education 20, employer 20, project 25, publication 25, qualification 15, explicit supplied handle 8 and an agreeing labeled timeline fact 8. Name text alone does not count as a handle match. Generic skills and generic field labels are not project identifiers. Scores cap at 100 and are **heuristic marks, not a percentage probability**.

A `probable-match` requires at least 70 marks, a name association, two distinct strong clue families and at least two source groups. Pages from the same registrable publisher domain form one group; identical normalized retained excerpts also join mirrors. This grouping detects some duplication, not every copied or syndicated claim, and cannot prove that publishers are independent. Contradictory names, explicit conflicting findings, analyst identity exclusions, multi-person ambiguity and imported-only evidence block automatic expansion. A negative identity finding subtracts 80 marks and vetoes expansion regardless of total. Matching facts and their source/evidence IDs appear in the wiki and `graph.json`. Strongly associated resources can guide project/employer/publication follow-ups as a working same-subject hypothesis; individual claims retain their original evidence/review status. Evidence association does not automatically merge saved reports or convert a CV qualification into an independently verified fact.

### Public PDF documents

Public PDF CVs/resumes and other readable PDF documents can use local text extraction in mixed research mode. Downloads allow public HTTPS only, pin a checked public IPv4 destination, validate redirects and stop at 8 MB. Parsing runs in a terminable worker with a 15-second timeout, a 256 MB old-generation heap limit, a 25-page limit and a 120,000-character text cap (plus at most 16,000 characters of public link annotations). PDF parsing uses the bundled JavaScript parser through [unpdf](https://github.com/unjs/unpdf); no Python or system PDF utility is required. PDF script evaluation and parsing-time fetches are disabled. These bounds reduce resource risks; they do not promise support for every PDF.

Quick/standard/deep mixed runs permit up to 1/2/4 local PDF attempts, also within the existing fetched-resource budget. If local extraction fails, DeepSeek Fetch is tried and failures stay visible. DeepSeek-only mode uses provider Fetch without local downloads; provider support for a PDF is not guaranteed. Image-only/scanned PDFs report that OCR is required. Parsed professional text and safe public link annotations are retained as source snapshots; raw PDF binaries are not saved in the report. The mixed research reader retains public professional email/phone text for subject-attributed extraction, while common labeled residential and private identifier lines are sanitized. The low-level PDF extraction API keeps contact redaction as its default unless professional-contact retention is explicitly selected. This is not a guarantee that every sensitive datum in an unstructured document can be recognized. Documents are processed in overlapping 24,000-character chunks so later sections are considered rather than silently dropped. Source text over the stated cap is explicitly reported as truncated. Retrieval and extraction do not independently validate CV assertions.

These deterministic checks do not certify legal identity or independently verify self-reported qualifications, education or employment. Imported evidence alone cannot establish an automatic supported link. Analyst decisions remain separate, take priority and expire when their supporting evidence changes. Rejected/different-identity findings cannot be shared for synthesis; conflicting findings remain available as disagreements and stay out of the biography infobox. Unrelated candidate names cannot rename a handle-only report. An unambiguous full name retrieved from a supplied account, an account whose API identifier exactly matches a supplied handle, or an analyst-matched finding can supply its title and guide cross-checks. Conflicting supplied display names keep the identifier-based title rather than selecting the longest name. The evidence ledger preserves excluded material for audit.

Planning and extraction use a source-balanced context of up to 120 excerpts; synthesis uses up to 300 with their original evidence identifiers. The full ledger remains stored even when the model context is capped. Each synthesis excerpt includes its identity, claim/review assessment and automatic resource-match basis. Every factual paragraph, list item and table row must cite retained evidence IDs. Invalid citations reject the narrative; literal quote and ID checks do not establish factual entailment of every generated sentence. Unknowns and contradictory identities must stay visible. Provider planning, extraction or gap-review failures are recorded as limitations and keep collection partial, while usable local evidence can still produce a cited narrative.

Each model prompt is scoped to this investigation. No other saved investigations, imported article collection or credential files are sent. Source text is treated as untrusted data. The imported AI-written article collection was inspected locally as a structural reference for topic breadth and source diversity; its biographical assertions were not imported as verified facts or sent wholesale to DeepSeek.

DeepSeek model, Search and Fetch calls are billed to the supplied key. Calls use bounded responses and timeouts; transient rate/server failures retry twice. There is no claim of free AI research or exhaustive search-engine coverage. A live authenticated blind-operator test was completed with a user-provided temporary key; its private report and cost audit are stored in the local workspace, and the temporary key file was deleted. Automated tests use fixture transports to check planning, actual search/fetch orchestration, quote validation and citation rejection.

Official documentation: [model alias](https://api-docs.deepseek.com/en/), [Search/Fetch](https://api-docs.deepseek.com/guides/search/), [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/).

## Session timing and cost

Every CLI investigation records `research_timing.started_at`, `finished_at` and `duration_ms`. The wiki and homepage show research start/results times in IST (Asia/Kolkata), while JSON retains UTC ISO timestamps. In-progress AI collection checkpoints the report so refreshes can show its starting time before completion.

DeepSeek responses contribute provider-reported input, output and cache-token counts to `usage`. Each API attempt records endpoint, time and HTTP status, never Authorization headers or the key. Search/Fetch fees count only nonempty successful results. USD estimates use the documented off-peak/peak interval, with the pricing URL stored for audit; they are not invented by the language model. If available, a before/after account-balance difference is recorded separately and can include concurrent account activity or billing delay. `usage.json` accompanies the report JSON. Unknown model pricing produces an unavailable estimate rather than a guessed amount.

Malformed model JSON is retried at most twice; quotes and evidence references are still validated after retry. Failed and corrected investigations retain separate IDs, timestamps and usage records.

If a run has collected useful evidence but narrative validation failed, `phomber find --resume REPORT_ID --synthesize-only --no-serve` rewrites from that same evidence without repeating searches. This option requires online AI mode and unchanged subject context, imported evidence and omissions. Execution budgets and explicit AI/online preferences may change. To change identifiers or apply omissions, resume without `--synthesize-only` so evidence is recollected. API usage is cumulative for that investigation; the observed account balance change covers the latest invocation only. A separate audit should include discarded/wrong-identifier attempts when reporting total test spend. The report keeps its original start time and updates completion time. A complete AI narrative can coexist with top-level `partial` when sources are blocked or unavailable; this does not mean the narrative is missing.

## Review and execution limits

`--no-ai` persists as an investigation preference; `--ai` explicitly enables sharing again. `--max-ai-calls` caps all provider HTTP attempts, including retries and metadata calls; `--max-output-tokens` caps each model response. Unknown completion/usage makes billing estimates unavailable. Analyst decisions invalidate earlier prose, and rejected/different-identity evidence cannot be cited in regeneration. See [the analyst workflow](ANALYST_WORKFLOW.md) for defaults and limitations.

## Command and workspace reference

`phomber find` opens the questionnaire. `phomber find "Full Name"` supplies the name directly; do not combine a positional name with `--name`. Repeated context flags append to JSON input. All install methods share the same per-user workspace and saved key unless `PHOMBER_HOME` selects another directory. `--format json` preserves machine-readable stdout; ordinary results use readable text.

Local catalog version grouping does not make AI calls or send other saved reports to DeepSeek. It organizes matching research subjects while leaving evidence assessments separate; see [profile grouping](WIKI_INTERFACE.md#automatic-version-grouping-in-002).

## Per-work publication attribution

Crossref author queries are discovery, not identity proof. The adapter now requires one individual author record to match the supplied full name or an explicit alias; it never combines one co-author's given name with another co-author's family name. Compatible middle-name/initial variants remain candidates. Different surnames, malformed combined author fields and missing/ambiguous author metadata cannot become invented aliases.

Even an exact full author name can belong to another person. Name-only results may inform follow-up research but cannot be cited in the subject's generated biography or publication timeline until a matching-author ORCID equals the supplied ORCID, an exact DOI is listed on a supplied/reviewed subject-linked publication resource, or an accepted evidence-bound identity decision links that work. An analyst decision does not bypass a contradictory author list. The identity must match within the same author record; a co-author's ORCID is insufficient.

Multi-record discovery responses (Crossref, GitHub name search and Wikidata search) have `discovery-only` status, zero identity marks and no automatic expansion. A name or context in one record cannot lend marks to other records. The numeric field on an individual finding remains null unless historical data explicitly records otherwise. Configured matching marks are heuristic evidence counts, not collected probabilities or model confidence. The UI labels them as evidence marks and states that they are not a probability.

New synthesis accepts only evidence identifiers that were actually sent to the model and pass the publication-attribution guard. Older saved articles remain loadable, but display/export filters unsupported publication blocks and timeline entries. Their original data, source snapshots and revisions remain inspectable. This guard addresses structured author attribution; citation checking alone does not prove the meaning of every AI-written sentence.


## Discovered names, relevance and concurrent research

A handle entered as the positional search label (for example `phomber find casey42`) stays in the original input. The researcher separately derives an unambiguous full name from a seed-linked account. It does not compare that handle to a full name as a surname disagreement. Conflicting seed-linked names block automatic name expansion. Names from mixed search responses, unrelated profiles and contact fields cannot establish this identity.

An associated full name generates deterministic name-plus-handle and name-plus-institution/employer/project queries ahead of repetitive discovery queries. Local discovery adapters can re-query GitHub, Wikidata and Crossref for the discovered name within their budgets; those results still require individual attribution. Literal first-party links are retained in the ledger. A matching-name CV published as a release in the exact GitHub account's self-profile repository is a first-party resource association, not independent confirmation of CV claims. Arbitrary repositories, unrelated hosting accounts and copied CVs do not receive this association.

Search results are ranked from their supplied metadata before page reads. Seed resources, supported links, exact names/handles and retained institutions/employers/projects take priority; broad search/topic listings rank lower. The provenance graph exposes name-discovery evidence and source relevance reasons. Relevance ranks the next research action; it does not change identity marks or accept factual claims.

At most three searches or three page reads run concurrently per batch. DeepSeek planning and between-round reviews can overlap independent profile I/O; dependent evidence extraction and final synthesis wait for their inputs. These are asynchronous network operations, not parallel model reasoning threads. Checkpoints are serialized. Cancellation waits for active work to settle, starts no further queued work and retains earlier evidence. Existing query, page, request and AI-call budgets remain in force. Individual provider failures stay visible while other usable results are retained.

## Published professional contact details

Subject-linked first-party profiles, portfolios and CVs may contribute explicitly published professional email, phone and general city/region/country, with literal evidence and source citations. These findings use category `public-contact`; a deterministic table renders accepted fields even if the model leaves them out of prose. Sources cannot bootstrap identity through contact data. Street/residential addresses, coordinates, private identifiers, broker records and leaked credentials remain excluded. Investigator `--omit email`, `--omit phone`, `--omit location` and `--omit contact` take priority for these fields.

`--omit email` and `--omit contact` redact recognizable email addresses from newly collected web and PDF text before PH0MBER saves snapshots or builds DeepSeek chat prompts. DeepSeek Fetch still retrieves the public page itself when used. Earlier snapshots remain part of the report history.

Publicly listed information can be outdated or copied and does not authorize unsolicited contact. This is not the planned privacy-cleanup/verified-owner breach workflow. Old snapshots that already replaced an email with `[email omitted]` cannot recover that value without a new public-source retrieval; source values are never guessed.
