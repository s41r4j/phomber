# PH0MBER Wiki interface

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
- `/wiki/:id/info/` and `/wiki/:id/history/`: archive metadata and grouped history.

The previous report URLs continue working. Live biographies render from their saved JSON, so an old index.html cannot leave the web view on a stale template. `writeReport` also refreshes the standalone offline HTML. Portrait raster data is embedded, not loaded from third-party tracking URLs in the browser. The portrait fetch is restricted to the image returned by an already-cited GitHub profile API; unsupported/failed images leave the infobox text intact.

## Dates and recency

The index defaults to latest known research completion, not alphabetic order. Article headers and index rows distinguish research completion from last successful source retrieval. All display times are IST; JSON timestamps remain UTC. Archive research dates are not guessed from file modification times or today's import date. Their original source retrieval dates remain in their reference sections.

## Profiles and versions

`profiles.json` in the workspace stores stable profile IDs and article-to-profile assignments. Matching normalized display names or profile identifiers initially group related material for browsing. For archives, identifiers are taken from their infobox links rather than every mentioned collaborator. This is a provisional organizational match, not identity verification. No evidence records or confidence levels are merged.

Each report/archive keeps its own source file, ID, dates, citations and status. The generated investigation and the four Sairaj archive designs now appear as five versions under one profile. Other people remain separate. Undated archive ordering uses file names; version numbers are catalog sequence, not invented research dates.

“Different person - separate version” creates a new profile for a mistaken match. “Move version” merges a selected version into another existing profile. A local label can distinguish different people with the same name. These controls are reversible through moving versions and do not delete or rewrite research evidence. Explicit assignments persist after restarting. A later article matching multiple separated profiles is kept separate instead of silently choosing one.

Profile metadata changes use `/manage/profiles`; collection metadata changes use `/manage/collections`. Both are available by default in the local wiki. Forms require a random per-server token, exact loopback Origin/Host, bounded URL-encoded bodies, and known article/profile IDs. Other report endpoints remain read-only; the browser cannot invoke research, execute shell commands, expose credentials or delete reports.

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

Collection settings persist in restricted-permission `collections.json`. Profile labels and version assignments remain in `profiles.json`. There is no stored admin credential or browser session. AI API credentials remain separate. The UI cannot run shell commands, initiate paid research, retrieve credentials or delete evidence.
