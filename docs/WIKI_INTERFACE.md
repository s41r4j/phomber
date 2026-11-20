# PH0MBER Wiki interface

[Documentation index](README.md) · [Project guide](../README.md)

The generated biography now follows the structure of the archived Wikipedia-style articles: a serif title, contents rail, right-floating infobox with a locally embedded source portrait when available, attributed overview, ordered education/career/certifications/projects/writing/profile sections, identity notes, timeline, references, then external links. Unavailable biographical fields are omitted rather than invented. Profile-reported fields retain source citations and uncertainty. Raw evidence, source failures, JSON and detailed API usage have separate views, with a compact research metadata footer on the article.

## Pages

- `/`: wiki main page and recency-sorted profile index; no pinned-person card.
- `/articles/`: all profiles, with every report/archive available in version history.
- `/collections/`: curated collections and built-in library views.
- `/activity/`: research start, results completion and latest successful retrieval dates.
- `/about/`: a standalone explanation of the wiki and evidence policy.
- `/profiles/:id/`: profile umbrella, article versions and local organization controls.
- `/reports/:id/`: generated biography, freshly rendered from saved JSON.
- `/reports/:id/evidence/`: complete finding/evidence/source ledger.
- `/reports/:id/info/`: research timestamps, duration, cost and downloads.
- `/reports/:id/history/`: redirects to that report's profile umbrella.
- `/reports/:id/review/`: analyst decisions and task coverage.
- `/reports/:id/revisions/`: preserved report states and comparisons.
- `/reports/:id/graph.json`: source/finding provenance graph.
- `/reports/:id/delete/`: review and confirm deletion of one investigation.
- `/admin/reports/`: saved investigations with management links.
- `/admin/collections/`: create, edit and archive local collections.
- `/wiki/:id/info/` and `/wiki/:id/history/`: archive metadata and grouped history.

The previous report URLs continue working. Live biographies render from their saved JSON, so an old index.html cannot leave the web view on a stale template. `writeReport` also refreshes the standalone offline HTML. Portrait raster data is embedded, not loaded from third-party tracking URLs in the browser. The portrait fetch is restricted to the image returned by an already-cited GitHub profile API; unsupported/failed images leave the infobox text intact.

## Dates and recency

The index defaults to latest known research completion, not alphabetic order. Article headers and index rows distinguish research completion from last successful source retrieval. All display times are IST; JSON timestamps remain UTC. Archive research dates are not guessed from file modification times or today's import date. Their original source retrieval dates remain in their reference sections.

## Profiles and versions

`profiles.json` in the workspace stores stable profile IDs, version assignments, manual overrides and separation decisions. Gen2 0.0.2 automatically groups repeated research subjects using matching platform-specific supplied or reviewed account profiles, or matching supplied names plus college, work, username or website context. Names alone, handles on different platforms, unreviewed AI candidates and conflicting identifiers do not establish a group. Archive account links are read only from infoboxes, not collaborator references. Grouping decisions and reasons appear in version history; evidence records and confidence levels remain separate.

Each report/archive keeps its own source file, ID, dates, citations and status. Automatically or manually grouped investigations appear as versions under one profile; grouping is organizational and does not approve identity. Undated archive ordering uses file names; version numbers are catalog sequence, not invented research dates.

“Different person - separate version” creates a new profile for a mistaken match. “Move version” merges a selected version into another existing profile. A local label can distinguish different people with the same name. These controls are reversible through moving versions and do not delete or rewrite research evidence. Explicit assignments persist after restarting. A later article matching multiple separated profiles is kept separate instead of silently choosing one.

Profile metadata changes use `/manage/profiles`; collection metadata changes use `/manage/collections`. Both are available by default in the local wiki. Forms require a random per-server token, exact loopback Origin/Host, bounded URL-encoded bodies, and known article/profile IDs. Report deletion uses a separate confirmation page and `/manage/reports`, with the same CSRF/origin protections plus a current-revision hash and explicit confirmation. Other report endpoints remain read-only; the browser cannot invoke research, execute shell commands or expose credentials.

## Dynamic article template

The provider-neutral contract lives in `src/core/article.ts` and `schemas/article.schema.json`. DeepSeek uses its shared instructions. Generated sections support ordered paragraph, table, list, subheading and exact quotation blocks, each with evidence IDs on factual content. Section titles and lengths follow the available evidence. Required title, infobox, References, external links and article metadata are rendered centrally. The older paragraph-only format remains supported.

Every factual table row and list item is citation-checked before a report can be saved. Tables must have consistent row widths; quotations must match cited evidence. Provider text is escaped, and generated raw HTML cannot introduce scripts. Tables scroll on narrow screens. The renderer removes em dashes from displayed output while leaving historical JSON and original evidence intact. The shared P/W globe SVG is also the offline-compatible favicon.

The article footer now includes provider, model, start/completion times, duration, input/output tokens, API call totals and estimated USD cost with pricing context. Unknown historical fields say “Not recorded”. Full API usage remains available on the information page and in JSON.

## Default admin mode and curated collections

The whole local wiki is in admin mode automatically. The same server is used by `phomber serve`, the NPX serve entry point, and reports opened after research. Profile editing and collection management require no login, owner link, cookie or unlock command. Local Origin, Host, CSRF and form-size checks still apply.

- `/admin/`: immediately available library management links.
- `/admin/collections/`: create or edit collection names, descriptions and profile membership, or archive/unarchive collections.
- `/collections/:id/`: open a curated collection, including archived collections. Archived collections are omitted from the active collection list.
- `/profiles/:id/`: edit a label, split a mistaken identity match or move a version immediately.

`phomber admin --port 4317` prints the management URL for an already-running server; it does not grant access or create credentials. In this checkout use `npm run local -- admin --port 4317` if you want this optional shortcut. Use the actual running port.

Collection settings persist in restricted-permission `collections.json`. Profile labels and version assignments remain in `profiles.json`. The catalog waits for active writers and automatically recovers a lock when it can confirm the owning process on this computer has exited. Empty locks from older versions become eligible for cleanup after one minute. There is no stored admin credential or browser session. AI API credentials remain separate. The UI cannot run shell commands, initiate paid research or retrieve credentials. It can delete a selected investigation and its preserved evidence after an explicit confirmation.

## Analyst workbench

`/reports/:id/review/` provides evidence-bound analyst decisions and collection coverage. `/reports/:id/revisions/` lists integrity-checked preserved states and comparisons; `/reports/:id/graph.json` exports source-to-finding provenance. Snapshot/revision JSON is served only through validated hash routes. Review submissions use Origin/CSRF checks and reject changed report versions with HTTP 409. See [the analyst workflow](ANALYST_WORKFLOW.md).

## Investigation deletion and search

Open **Delete report** from an investigation, its profile version history or **Admin → Manage investigations**. The confirmation identifies the exact report and explains which files are removed. A changed report rejects stale confirmation forms. Deleting one version preserves other investigations and imported archived articles. Separate exports and shared response cache are retained. Deletion markers prevent stale collectors from restoring the same report ID.

Global search matches words in any order across profile labels, known identifiers, supplied context, findings and article prose. The server renders submitted query results and keeps the query visible; JavaScript adds immediate filtering. Search from a report or admin page navigates to the main catalog.

Browser management forms use a same-origin referrer policy so native form submissions retain the Origin required by the loopback checks. External navigations do not receive a referrer. Article search highlights matching text blocks, including infobox entries, and offers Next match or Enter to navigate; Escape clears it.

## Automatic version grouping in 0.0.2

The catalog applies matching locally; it does not send other reports to an AI service or incur new research charges. Shared account identifiers include the platform, so equal handles on different sites cannot match by themselves. A matching full supplied name plus shared college/work or other supplied context can group repeated research. Conflicting accounts, incompatible entity types, ambiguous bridges and explicit separations remain separate. A model assertion without accepted identity evidence cannot merge profiles.

The first read of an older v1 catalog preserves its exact bytes in `profiles-v1-<hash>.backup.json` before adding automatic-grouping metadata (`grouping_version: 2`). The base catalog format remains `version: 1` so older installed versions can still read the shared workspace. Recognizable existing manual groups and renamed profiles are retained. Old v1 singleton rows did not record whether they were automatically created or manually split: unrenamed singletons are eligible for automatic grouping. The backup preserves the original organization. New split/move decisions are explicit and persist across restarts and later matching runs.

Old profile URLs redirect to the surviving profile after grouping, and collection membership follows those aliases. No investigation, evidence, snapshot or revision file is rewritten by catalog grouping.
