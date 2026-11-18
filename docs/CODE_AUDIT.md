# Gen2 code audit — 14 November 2026

This audit covers the active TypeScript runtime, source adapters, HTTP transport, evidence pipeline, AI orchestration, CLI, local server, report storage/rendering, and npm distribution. It is a point-in-time verification, not a guarantee of exhaustive research or future third-party availability.

The sections below record the original 14 November audit. The 18 November follow-up supersedes its collection/retry limitations and records validation of the analyst-workflow upgrade.

## Follow-up implementation — 18 November 2026

- Added separate extraction, identity, claim and analyst-review assessments; equal names and candidate values no longer automatically merge identities or imply corroboration.
- Added evidence-bound review decisions, stale-review detection, review forms, task coverage, report comparisons and provenance JSON.
- Added hash-verified source snapshots and report revisions, serialized writers, recovery of interrupted tasks, and integrity-checked exports.
- Added bounded safe pagination, request budgets, typed provider failures, per-origin redirect throttling and `Retry-After` handling. Long provider waits stop for a later run.
- Added persistent AI preferences and request/output limits, unknown-billing handling after network failures, and exclusion of rejected/different-identity evidence from synthesis and citation validation.
- Added a rebuildable SQLite full-text index with a portable fallback and installed-package checks for review, history, integrity, search and workbench routes. Package checks use an isolated temporary npm cache and accept both observed npm metadata formats.
- Validation: TypeScript build and type check passed; **69 tests passed, 0 failed, 0 skipped** on the current macOS/Node runtime. The packed application installed into a fresh temporary consumer; its CLI, offline report, review/history/search/integrity commands and dashboard routes passed. Workbench layout was also checked in a browser. Changed active files passed the whitespace check.
- Current behavior and remaining roadmap are documented in [ANALYST_WORKFLOW.md](ANALYST_WORKFLOW.md). These tests use fixtures for paid AI; the follow-up did not make billed live calls or revalidate every public provider.

### Gen2 0.0.1 release preparation

- Set the package and lockfile version to `0.0.1`, with the `latest` npm tag. Runtime version output, scanner information, the HTTP user agent and the wiki's About page now share package metadata.
- Set the project homepage and About-page link to `https://phomber.s41r4j.in`. Added a self-contained responsive public page, domain file, a Pages-only deployment workflow and setup instructions. Only the three allowlisted files in `website/` are eligible for website upload.
- Added command-specific help and full interactive command completion. All six implemented legacy scanners and their utility commands have usage/examples and explicit limitations.
- Validated site consistency and inline JavaScript syntax, the TypeScript build/type check, **70 tests with no failures or skips**, and a fresh package installation including runtime version output, the About link and CLI/dashboard workflows. Desktop and 390px mobile layouts were inspected; the mobile page had no horizontal overflow.
- The initial package assertion was corrected to account for normalized URL trailing slashes. A later isolated dependency installation timed out; its retry passed. The final npm publication metadata dry run passed using `--ignore-scripts` and the already validated build; the release-hook checks were run separately. `phomber-0.0.1.tgz` was generated locally.
- Production dependency audit: **0 known vulnerabilities** at this check. The registry returned E404 for `phomber`; this does not establish ownership or permission to publish. The account check returned E401, so the maintainer must refresh npm authentication before real publication. No package was published, and no DNS/Pages settings or remote deployment were changed.

### Website and branding refinement

- Preserved the original public page at `backups/website/index-before-details-0.0.1.html`; its SHA-1 remains `231c86d29d473d2214a45176b7420fd7086e73c1`. Backups stay outside the Pages upload and npm tarball.
- Rebuilt the single-file landing page using the supplied Details screenshot/public page as the design reference: dark styling, serif headings, numbered setup, npm/NPX switching, workflow previews, a filterable command table, copy/selection fallback and native FAQs. No private Details library code or assets were used.
- Details OAuth authentication and its MCP tool catalog were verified through Codex. Direct reference-search tools remained unavailable in this running chat; a separate client could not resume the active chat writer, and its proxy attempt timed out. Authentication should not be confused with successful reference retrieval.
- Standardized the product tagline as **OSINT Researcher**. The local wiki header, footer and About page now read the shared project metadata; the About version explicitly displays **Gen2 · v0.0.1**. Schema and adapter versions retain their independent meanings.
- `npm run release:check` passed in full: site validation and inline JavaScript parsing, type check, build, **70 tests with no failures/skips**, and fresh-install CLI/server package checks. Rebuilt the local `phomber-0.0.1.tgz` after those checks.
- Browser checks verified workflow selection, npm/NPX command updates, all six scanner rows under filtering, FAQ expansion and successful command copying. Desktop and 390px mobile layouts had no horizontal overflow. The existing local wiki was restarted on port 4317, and its About page visibly showed the updated version, tagline and subdomain link.

### Final publication and light-site review

- The current public site uses a **light-only encyclopedia layout**, a contents sidebar, article sections, local command search and a rotating 3D evidence-atlas illustration. It remains one self-contained HTML file; there is no dark-mode switch. The dark design is preserved separately at `backups/website/index-dark-0.0.1.html` (SHA-1 `11129ab6d15375b1494ffd0356d2396001ea66ed`).
- `npm publish --dry-run` passed with its full release hook: website validation, type check/build, **70 passing tests**, and a fresh installed-package CLI/server check. The distribution contains **151 files**. An archive inspection verified file paths, excluded workspace/reference/backup/site directories, the CLI shebang and executable mode, and found no matches for the checked private-key, GitHub/npm token, AWS access-key or developer-absolute-path patterns. Pattern scanning is not proof that every possible secret is absent.
- The production audit returned **0 known vulnerabilities** at this review. `npm whoami` returned E401; real publication still requires valid npm authentication and package ownership permission. Registry lookup returned E404 for `phomber@0.0.1`; no publication was performed.
- Browser verification covered the light color scheme, desktop/mobile overflow, globe rotation, pause/play, search results including the empty state, six-scanner filtering, npm/NPX command updates and copying. A separate isolated execution of the actual atlas script verified reduced-motion default behavior, explicit playback overrides, offscreen/hidden suspension and the Canvas-unavailable fallback.
- Later changes after the full release dry run were limited to site-only copy/CSS adjustments; site validation and atlas behavior checks passed again. Runtime code was unchanged. `website/` retains exactly `index.html`, `CNAME` and `.nojekyll`; the existing Pages workflow uploads only that directory.

## Corrections

- Request caps now retain skipped endpoints as explicit unsupported sources and warnings. Inputs with no available source requests remain partial instead of claiming successful collection.
- API profile URL parsing rejects content/repository paths and GitHub navigation routes. Direct JSON social handles normalize leading `@` consistently with CLI handles.
- DNS-over-HTTPS errors are rejected at the protocol level even when HTTP returns 200; NXDOMAIN remains an empty result without an identity or account-absence claim.
- Cached JSON is checked for data and a fresh, non-future timestamp and sanitized again on read. An unwritable cache no longer converts a successful network retrieval into a failed source.
- Same-origin concurrent requests reserve separate rate-limit slots. HTTP and AI backoff delays honor already-fired cancellation and clean up listeners. Cancelled investigations skip portrait retrieval; pre-cancelled scanner requests stop immediately.
- AI synthesis receives identity and finding status with each evidence excerpt, including unresolved matches and contradictions. Failed page fetches are attempted only once per research run, avoiding duplicate source IDs and repeated spending on the same failed page. Search/fetch cancellation propagates instead of becoming an ordinary source limitation.
- Narrative validation rejects a missing/non-array sections field. Synthesis-only CLI runs reject disabled AI or changed input before credentials or paid calls, so omissions and changed identifiers cannot silently reuse old evidence.
- Report validation rejects duplicate record IDs, evidence pointing to a source absent from its finding, and broken timeline, connection, or portrait source references.

Eleven regression tests were added for these behaviors, including HTTP private-address/redirect blocking, body-size limits, invalid JSON, retries, cancellation, and cache failures. Source/AI documentation describes the revised behavior.

## Verification

- TypeScript build and `npm run check`: passed.
- Full Node test suite with localhost access: **51 passed, 0 failed, 0 skipped**. The default sandbox cannot bind localhost; the four server tests pass with the required access.
- `npm run test:package`: passed. Packs and installs into a temporary consumer, then verifies the installed CLI, offline investigation, exports, and dashboard.
- `npm audit --omit=dev --audit-level=low`: **0 known production dependency vulnerabilities** at audit time.
- Diff whitespace check on changed active code, tests, and docs: passed. The user's pre-existing archive README edit was preserved.
- Live public endpoint smoke test: all 12 endpoint variants returned usable JSON and parsed successfully: GitHub profile/repositories/organizations/name search, GitLab, DEV, Hugging Face, Wikidata, Crossref, RDAP (including redirects), Google DNS, and Internet Archive CDX. Organization/name searches can validly return zero records. The smoke check used public example identifiers, temporary storage, and no API credentials; its temporary cache was removed.
- The DeepSeek [Search contract](https://api-docs.deepseek.com/api/search/) and [pricing documentation](https://api-docs.deepseek.com/quick_start/pricing/) were checked against the integration. Paid authenticated AI behavior was verified through fixture transports and mocked HTTP responses during this audit; no live billed AI calls were made.

## Original audit boundaries — 14 November

- Third-party failures yield unavailable sources and partial reports. Retries and cache are the shipped fallbacks; most individual sources have no interchangeable provider. Unsupported platforms still require manual review or AI web research.
- Collection is bounded and IPv4-only, does not paginate beyond documented per-endpoint limits, and does not schedule retries using `Retry-After`. HTTP retry/backoff is bounded. Model availability is discovered rather than guessed.
- Evidence references and literal extraction can be validated automatically; factual truth, identity ownership, and the semantic accuracy of AI paraphrases still need review.
- Local execution verified this checkout's current macOS/Node runtime. The existing CI matrix defines Linux/macOS/Windows and Node 22/24 coverage; those other environments were not executed locally.
- Historical Python sources, Python packaging metadata, and the historical Dockerfile remain preserved legacy artifacts. As already documented in `docs/MIGRATION.md` and `legacy/README.md`, the Dockerfile references a missing root requirements file, Python entry points do not match the root-script layout, some legacy requests lack timeouts, and legacy scrapers depend on brittle external markup. They are not validated working Gen2 installation paths. The active npm runtime does not execute them.
