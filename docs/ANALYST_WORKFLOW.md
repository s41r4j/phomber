# Evidence preservation and analyst workflow

[Documentation index](README.md) · [Project guide](../README.md)

PH0MBER now preserves sanitized source responses and content-addressed investigation revisions, separates trust assessments, and records analyst decisions. Existing v1 reports remain readable. New optional fields (`reviews`, `tasks`, and source snapshot metadata) do not require rewriting existing reports. Old reports acquire revision history when next saved; snapshots cannot be reconstructed retroactively from a URL.

## Start and review an investigation

```sh
phomber find --social github:KNOWN_HANDLE --no-ai --no-serve
phomber review REPORT_ID
phomber review REPORT_ID FINDING_ID --decision accepted --identity matched \
  --analyst "Your name" --reason "Reviewed the explicit primary-source cross-link."
phomber history REPORT_ID
phomber diff REPORT_ID REVISION_SHA256
phomber verify REPORT_ID
phomber search "project name"
phomber serve
```

Open the report and select **Review findings**. The analyst workbench shows task coverage, separate candidate resources, source snapshots, excerpts, review forms, and prior decisions. **Revisions** lists preserved states and supports comparison with the current report. A provenance graph is available as JSON; its edges describe which source reports which finding, not inferred personal relationships.

A review records decision (`accepted`, `rejected`, `needs-review`), identity assessment (`unresolved`, `matched`, `different`), analyst label, reason, timestamp and an evidence fingerprint. An analyst label is attribution in a local application, not an authenticated signature. An accepted finding cannot simultaneously describe a different identity.

The workbench separates:

- **Extraction:** source-backed or investigator-supplied.
- **Identity:** unresolved, supplied-resource, analyst-matched, or different.
- **Claim:** unassessed, conflicting, analyst-accepted, or rejected.
- **Review:** pending or the latest applicable analyst decision.

Successful retrieval never automatically proves identity or claim credibility. New findings have no numeric identity probability. Legacy `verified`/`corroborated` fields remain readable for compatibility, but the workbench and evidence ledger display separate assessments. Multiple websites reporting the same value do not establish independent corroboration. Equal candidate values from different sources stay separate.

Matching repeated research subjects now share a profile automatically, using platform-specific supplied/reviewed account IDs or matching supplied names and context. Ambiguous matches stay separate. Version history explains each decision, and manual split/move choices persist. Old catalogs are backed up before grouping metadata is added. This organizes reports without merging evidence or approving identity; see [automatic version grouping](WIKI_INTERFACE.md#automatic-version-grouping-in-002).

## Stale reviews and AI

Review forms carry the current report hash. A concurrent update returns HTTP 409 and requires a refreshed review. Decisions are append-only through the application and bind to the subject, finding and supporting evidence. Changed subject context or evidence makes previous decisions stale; the finding returns to the review queue. Collector checkpoints retain prior decision events without silently treating them as current approval.

Recording a review clears existing AI prose and marks it partial. Regenerate it with `find --resume REPORT_ID --synthesize-only` when appropriate. Current rejected evidence and findings assessed as a different identity cannot be cited in regenerated articles. Citation validation and literal quotation checks are deterministic; the semantic truth of paraphrases still requires analyst review.

`--no-ai` is saved in investigation input. Resume respects that preference; `--ai` explicitly enables sharing again. `--offline` always disables external AI; `--online` explicitly leaves saved offline mode. Synthesis-only may change AI preferences and execution budgets, but cannot change the subject, imported evidence or omissions. For example, use `--online --ai --synthesize-only --resume REPORT_ID` to synthesize an existing offline evidence collection with explicit sharing consent.

```sh
phomber find --name "Public example" --max-ai-calls 40 --max-output-tokens 4000 --no-serve
```

Defaults are at most 100 AI HTTP attempts per invocation and 12,000 output tokens per model response; configurable maxima are 1,000 and 32,000 respectively. Model discovery, balance checks and retries consume the call budget. These are request/token caps, not an exact monetary spending guarantee. Network failures are recorded with status 0; unknown completion or missing successful model usage yields an unavailable cost estimate. No paid live AI call is required by the tests.

## Preserved data and recovery

Each report can contain:

```text
investigation.json             current validated report
revisions/SHA256.json           preserved report states
snapshots/SHA256.json           sanitized JSON responses or retained AI page excerpts
```

Source records retain snapshot hash, adapter version, retrieval time, page count and final URL when observed. AI snapshots preserve the retained page excerpt used for extraction, not a full web archive. Imported evidence and historical reports may have no snapshot; the workbench says so.

Hashing uses stable JSON key order and SHA-256. Objects are published without replacing existing objects, and reads verify their hashes. Traversal and symbolic evidence files/directories are rejected. Hashes detect altered retained content; they do not provide external timestamps, authenticity, independent verification, or protection against someone rewriting an entire local workspace.

Every save preserves the previous and new report states before replacing the current report. Per-report write queues and filesystem locks serialize application writers, including separate processes. A lock waits at most ten seconds; a crashed writer can leave `.write-lock`. After confirming no process is writing that report, remove that directory to recover. Storage is local files with atomic current-report replacement, not a multi-user transactional case database.

An interrupted/running investigation with unchanged input can recover completed tasks from intact source snapshots less than one hour old, even when its HTTP cache is missing. Completed reports, stale snapshots, changed input and partial/failed tasks are recollected through normal cache/network rules. Task states distinguish queued, running, succeeded, partial, failed, skipped and cancelled. Checkpoints are preserved during collection.

## Collection bounds

GitHub repository/organization lists follow validated same-endpoint pagination links: up to three pages in standard mode and five in deep mode. Query parameters other than the page may not change. Unsafe/repeated continuations and later-page failures preserve earlier usable evidence and mark the task partial. Quick/standard/deep investigations allow at most 8/30/70 logical HTTP lookups, including cache reads and pagination. Retry attempts and redirects have separate existing bounds. Restored task snapshots do not issue HTTP lookups.

HTTP requests, including redirects, reserve per-origin slots. Transient failures use exponential backoff with jitter. Valid `Retry-After` values and GitHub quota reset headers are respected; waits over 30 seconds stop for a later retry instead of retrying prematurely. Source errors expose categories such as rate-limited, access-denied, provider failure, offline cache miss and budget exhaustion. Most sources still have no interchangeable fallback provider.

## Search, exports and retention

CLI search synchronizes a rebuildable SQLite FTS5 index in a transaction where `node:sqlite` is available. Older Node versions lacking that built-in module use a portable local scan. Reports remain the authoritative portable data. The index has schema-version checks, bounded parameterized queries and restricted file permissions. It indexes names, report IDs, supplied subject context, findings and AI article text. Queries support partial words in any order and return up to 100 reports. The localhost catalog also renders submitted searches on the server, with live browser filtering when JavaScript is available.

Report exports include preserved revisions and source snapshots with integrity checks. The current report's existing HTML/JSON artifacts remain included. Use `phomber reports delete REPORT_ID` for a terminal confirmation, or add `--yes` in scripts/JSON mode. The wiki offers a confirmation page through Delete report and Admin → Manage investigations. Deletion removes the report directory, including snapshots and revisions; the next CLI search removes its entries from the rebuildable search index. A restricted `deleted/REPORT_ID.json` marker retains the ID and deletion time to block stale collectors. Separate exports, shared response cache and catalog migration backups remain.

`--omit` affects the new current investigation, not previously preserved history. Old revisions, snapshots and review reasons can retain earlier supplied information. Removing a report is not a secure-erasure operation: separate exports, response cache, catalog backups and derived-index files may retain metadata or copies. Consider those artifacts separately when erasure is required. Workspace data is not encrypted; OS keychain integration and shared-workspace authentication are not included in this upgrade.

## Further work

This release implements the trust foundation, bounded collection improvements, local full-text indexing and analyst review workflow. It does not implement broad company-registry connectors, OCR or additional office-document ingestion, a visual entity-resolution graph, authenticated team case management, source-independent AI claim entailment, or a population-level accuracy benchmark. The regression suite exercises false identity merges, stale decisions, tampering, pagination, recovery and limits; passing it is not a measured identity-matching accuracy score.

## Automatic research review

Standard and deep AI research review combined API/web evidence between rounds and target remaining identity questions and relevant gaps. Public text-based PDFs now have bounded local extraction. The article and evidence ledger show weighted, source-linked resource-match reasons and heuristic marks; Page information shows retained topic counts. A supported link establishes a resource association, not independent verification of credentials or biographical claims. Conflicting and analyst-excluded findings remain in the ledger but do not populate the biography infobox. Use the workbench for explicit identity/claim decisions. See [AI research](AI.md) for exact limits.

## Publication candidates and older prose

The evidence ledger now exposes per-work publication attribution separately from source retrieval and matching marks. Exact author names are still name-only candidates until a subject-specific link is retained. Unrelated/malformed author returns cannot be used in biography synthesis. Legacy prose and timeline entries based only on unlinked publication candidates are omitted from the readable article while original revisions and evidence remain available. A corrected article does not constitute a new external research run.


## Handle-led investigations

A handle typed into `find` remains the search input. Review the separately discovered name, its exact source/evidence IDs and research priorities in `graph.json`. A seed-linked account's unambiguous name can guide name-plus-handle/institution/project cross-checks; it is not a legal identity certificate. Candidate names on unrelated resources or conflicting primary names must be resolved before expansion. First-party CV facts remain self-reported even when the CV is clearly linked to an account.

A cited published-contact table retains eligible professional email/phone and general location independently of narrative coverage. Use `--omit email`, `--omit phone`, `--omit location` or `--omit contact` before collection when needed. The current feature does not implement ownership-verified privacy cleanup or breach lookup. Never restore redacted historical data by guessing.
