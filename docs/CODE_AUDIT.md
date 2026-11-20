# Gen2 code audit - 14 November 2026

## Handle-led identity, relevance and concurrency, 19 November 2026

Separated a handle search label from a seed-linked full name, preserving original investigator input. Added evidence-bound name discovery, literal first-party links, same-account self-profile CV attribution, deterministic name/context follow-up queries and reserved name-adapter task allowances. Different names on seed-linked roots block discovery; genuine supplied full names retain surname-conflict protection. Relevance prioritizes research actions without altering claim assessments. Bounded search/page concurrency and independent model/profile overlap retain cancellation, budgets and serialized checkpoints.

Public professional email/phone and general location can now be retained on subject-linked first-party resources and rendered in a deterministic cited table. Private identifiers and residential details remain excluded. Explicit contact/location omissions take precedence. Previously redacted snapshots are preserved; missing values are not reconstructed by inference.

Validation: 146 full-suite fixture/offline tests passed, including 12 new discovery/relevance/concurrency/contact regressions. Fresh-package install, NPX/shared-home storage and dashboard checks passed. The cited user-owned report was corrected locally, and its already-linked public CV was refreshed through PH0MBER's PDF reader to restore previously redacted published contact text. Original evidence and the previous revision were verified intact. No new paid model/search calls or public release were made. These tests do not measure population-wide identity accuracy, provider latency under load or real-world relevance quality.


## Publication attribution correction, 19 November 2026

Traced an incorrect surname-association statement to an unfiltered multi-author Crossref return. Fixed per-author matching without cross-co-author name assembly, malformed/incomplete author handling, subject-specific ORCID/DOI linkage, discovery-response score isolation, model-selected citation limits and safe legacy article/timeline rendering. Numeric matching displays now say evidence marks rather than implying a probability.

Validation: 134 full-suite tests passed, including nine new author-attribution regressions. A targeted local report was corrected from existing evidence; its prior revision and original source/evidence values were retained. No new billed model/search calls or public release were performed. This prevents the tested structured-author failure mode; it does not establish general AI claim-entailment accuracy.


## Cross-source marks, public PDFs and email checks, 19 November 2026

Added weighted professional-evidence associations across source types, with distinct clue families, publisher/retained-text grouping, explicit negative-identity vetoes and inspectable source/evidence IDs. Probable matches are working hypotheses that guide bounded follow-ups. Matching marks do not populate a calibrated probability or automatically accept claims or merge saved reports. Generic project-field labels and names accidentally matching handle text are covered by regressions.

Public text-based PDFs have bounded local download/extraction in an isolated worker; later text chunks are processed, common contact labels/emails are sanitized and raw PDF binaries are not retained. A worker-scoped Promise.try compatibility shim was required for Node.js 22. The standalone email command validates common syntax and public DNS with masked output and an own/authorized-details notice, without mailbox probes or breach lookup. Company-specific research, privacy cleanup/address auditing and verified-owner breach services are tracked in Product TODO.

Validation: 119 full-suite tests on the current Node runtime, plus 14 targeted PDF/email/matching tests on Node.js 22.23.5. The npm production dependency audit reported zero known advisories at check time. Fresh-package/shared-workspace checks and website validation passed. No new billed DeepSeek accuracy benchmark, public release or cross-platform CI run was performed.


## Evidence-driven research update, 19 November 2026

Compared the structure and source diversity of 12 imported AI-written articles locally, without treating their claims as verified ground truth or uploading the library. Updated planning to combine current API/web evidence; supplied resource reads; bounded local profile follow-ups; all-page extraction; structured gap/disconfirmation reviews; source-balanced context; deterministic matching explanations; and safer discovered-name/infobox handling. Public qualifications are distinct from login credentials. Distinct quotes are preserved without inflating corroboration.

Research regression fixtures cover supported versus contextual links, unrelated names/handles, imported evidence, reviewed exclusions, 30-page deep rounds, fabricated follow-up URLs, provider failures, collection cancellation, API task budgets, conflicting display names, supplied-profile name disagreements, qualifications and quote preservation. No new live-person accuracy benchmark or billed DeepSeek comparison was performed for this update.


This audit covers the active TypeScript runtime, source adapters, HTTP transport, evidence pipeline, AI orchestration, CLI, local server, report storage/rendering, and npm distribution. It is a point-in-time verification, not a guarantee of exhaustive research or future third-party availability.

The sections below record the original 14 November audit. The 18 November follow-up supersedes its collection/retry limitations and records validation of the analyst-workflow upgrade.

## Current local release - Gen2 0.0.2, 19 November 2026

The older dated sections below are historical audit records. Current source behavior supersedes earlier descriptions of separate profiles, JSON-only CLI output, checkout-specific storage and CLI-only report deletion.

- `phomber find` is the primary command, with positional name input and a hidden compatibility alias.
- Installed, NPX and checkout commands share per-user storage and saved keys; output defaults to readable text with explicit JSON for scripts.
- Matching research runs group into versions with reasons, manual overrides, migration backups and preserved profile-link aliases. Grouping does not approve identity or rewrite evidence.
- Search covers supplied context and partial terms; wiki search also works through server-rendered results. Article search includes infobox text.
- Confirmed deletion works in the CLI, interactive terminal and wiki, with CSRF/origin/revision checks and stale-collector protection.
- Gen2 uses MIT; historical Python license terms and the original ZIP remain preserved.
- Verification at this implementation point: 89 tests passed, along with type/site checks and a fresh 0.0.2 package installation. Browser and terminal flows used fictional offline fixtures. This records local verification, not a new cross-platform CI run or a public 0.0.2 release.

## Follow-up implementation - 18 November 2026

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

## Original audit boundaries - 14 November

- Third-party failures yield unavailable sources and partial reports. Retries and cache are the shipped fallbacks; most individual sources have no interchangeable provider. Unsupported platforms still require manual review or AI web research.
- Collection is bounded and IPv4-only, does not paginate beyond documented per-endpoint limits, and does not schedule retries using `Retry-After`. HTTP retry/backoff is bounded. Model availability is discovered rather than guessed.
- Evidence references and literal extraction can be validated automatically; factual truth, identity ownership, and the semantic accuracy of AI paraphrases still need review.
- Local execution verified this checkout's current macOS/Node runtime. The existing CI matrix defines Linux/macOS/Windows and Node 22/24 coverage; those other environments were not executed locally.
- Historical Python sources, Python packaging metadata, and the historical Dockerfile remain preserved legacy artifacts. As already documented in `docs/MIGRATION.md` and `legacy/README.md`, the Dockerfile references a missing root requirements file, Python entry points do not match the root-script layout, some legacy requests lack timeouts, and legacy scrapers depend on brittle external markup. They are not validated working Gen2 installation paths. The active npm runtime does not execute them.
