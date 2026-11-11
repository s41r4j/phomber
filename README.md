# PH0MBER Gen2

A local, CLI-first public-source research framework. Give it known identifiers, collect genuine public API evidence, and produce a portable wiki report alongside structured JSON. The Node.js/TypeScript runtime needs no Python, Docker, or database. Wiki research uses DeepSeek AI with live Search/Fetch; source-only mode remains available with --no-ai.

Original project by **s41r4j** · GPLv3 · Gen2 prerelease `4.0.0-gen2.0` · Node.js **22+**.

The original Python implementations remain untouched in the repository and are preserved in [the legacy archive](legacy/README.md). The npm package includes the download guide; the Python ZIP stays in GitHub. Gen2 never executes it.

## Local testing without publication

```sh
npm ci
npm run setup:local
npm run dev
```

Open the URL printed by the server, normally **http://127.0.0.1:4317/**. Keep that terminal open; Ctrl+C stops the server. `setup:local` creates an ignored `.phomber/` test workspace inside this checkout, imports the archived wiki collection if available, and does not seed demonstration investigations. Existing local library and investigation data are preserved on repeated setup. No global installation or publication is needed. AI wiki research requires a DeepSeek key; --no-ai runs source adapters only.

In a second terminal:

```sh
npm run local -- wiki
npm run local -- wiki --name "YOUR SUBJECT NAME" --no-serve
npm run local -- reports
npm run local -- serve --port 4320
```

`npm run local -- …` uses the checkout's isolated `.phomber/` workspace (or your explicit `PHOMBER_HOME`). `npm run dev` rebuilds and serves the same workspace. Refresh the browser after code changes and restart the server; this is not a hot-reload server.

NPX also resolves this checkout directly, without a registry release:

```sh
npx --no-install phomber help
npx --no-install phomber wiki --name "YOUR SUBJECT NAME" --no-serve
```

Run those NPX commands **from the repository directory**. Direct NPX commands use the normal home workspace (`~/.phomber`) unless `PHOMBER_HOME` is set. Outside the checkout, use the local tarball instructions below until the package is published.

## Start from this checkout

```sh
npm ci
npm run build
node dist/cli/index.js help
node dist/cli/index.js wiki --name "YOUR SUBJECT NAME" --no-serve
node dist/cli/index.js serve
```

This implementation has **not been published**. The registry returned E404 for `phomber` during the implementation check; availability and publisher identity must be rechecked before release. Once the maintainer publishes the package, the intended commands are:

```sh
npx phomber@beta
npx phomber@beta help
npx phomber@beta wiki
npm install -g phomber@beta
phomber wiki
```

The current prerelease uses the `beta` npm tag. Maintainers: see [the release checklist](docs/RELEASING.md). `npm publish` defaults to that tag and runs the release checks first.

You can verify the distributable locally now:

```sh
npm pack
npm install -g ./phomber-4.0.0-gen2.0.tgz
phomber help
# Or execute the packed package without a global install:
npm exec --package ./phomber-4.0.0-gen2.0.tgz -- phomber help
```

With no command, an interactive terminal opens the legacy-style shell with tab completion. In scripts, no arguments prints help. Use `help`, `wiki`, `reports`, or the original scanners from the shell. `exit` and `quit` end it.

## Build a wiki

```sh
phomber wiki
```

The progressive questionnaire groups identity, online profiles, education/work, projects/connections and research options. Skip optional fields, revisit categories, review input, save a JSON draft, and start when ready. Supply at least one name, username, company, public website/domain or profile. Return to a category to edit; repeated-entry prompts accept `!clear` to replace the list. Name-only investigations are explicitly ambiguous.

Direct input supports repeated flags rather than comma-separated lists:

```sh
phomber wiki --name "John Doe" \
  --company "Example Inc" --education "Example University" \
  --social github:johndoe --social instagram:@johndoe \
  --connection "Jane Smith" --location "Pune, India" \
  --depth deep --no-serve

phomber wiki --social github:KNOWN_HANDLE --depth standard
phomber wiki --input examples/subject.json --no-serve
phomber wiki --input subject.json --social gitlab:known-handle --format json --no-serve
```

These examples express supplied context, not verified identities. Instagram and other unimplemented sources are listed as unsupported; available sources still run.

`--name`, `--type`, `--location` and `--depth` override JSON scalar values. Repeated `--alias`, `--username`, `--company`, `--education`, `--social`, `--connection`, `--website`, `--domain`, `--project` append to imported arrays. Use `--omit FIELD` to remove a top-level subject field before collection. `--input` replaces a resumed investigation's input before other flags apply.

All methods use the same validated engine. See [input JSON Schema](schemas/subject.schema.json), [report JSON Schema](schemas/investigation.schema.json), a [runnable public-account example](examples/subject.json), and an [extended input illustration](examples/extended-subject.json).

## What the engine does

The pipeline validates input, plans bounded API queries, collects records, normalizes and deduplicates findings, checks explicit cross-references and contradictory name/company context, and attaches source URLs, retrieval timestamps, excerpts and confidence explanations. Reports distinguish investigator input, source-backed fields, corroboration, unresolved leads and conflicts. A matching username never establishes common ownership. A failed lookup never establishes account absence.

Implemented public-source adapters: **GitHub, GitLab, DEV Community, Hugging Face, Wikidata search, Crossref, DNS, RDAP and Internet Archive CDX**. The MAC scanner also uses MACLookup. External APIs may impose access/rate limits; each failure is retained in the report.

| Depth | Actual coverage |
| --- | --- |
| Quick | Up to 8 endpoints; targeted account/name/entity lookup and domain DNS |
| Standard | Up to 30; additional developer candidates, repositories, author/publication search, domain registration |
| Deep | Up to 70; broader developer coverage, more projects, public organization memberships and annual archive pointers |

Identity, education, employment, projects, achievements, publications, community activity, organizations, digital footprint, general location, timelines, custom entity types and metadata can be stored as structured input. Collection is source-limited, not an exhaustive people-search service. Imported evidence remains unverified unless independently collected. General search queries are retained as manual follow-up plans; unrestricted web crawling is not implemented.

See [sources, supported platforms and verification semantics](docs/SOURCES.md). Most major social platforms have no automated adapter in this release. There is no false claim of universal platform coverage.

## Reports and localhost dashboard

Every investigation saves an offline HTML wiki and all JSON artifacts. Wiki reports include a contents sidebar, evidence status labels, grouped findings, connections, filterable timeline, source excerpts, dark/light mode, report search, copy/JSON export and print support. No CDN, external font or tracking script is required.

After research, interactive terminals automatically start a foreground localhost server unless `--no-serve` is supplied. `--open` launches the report/dashboard in the system browser. Non-interactive and JSON modes never auto-serve. `--port` selects the listening port; the server tries the next 9 ports if occupied, and port `0` requests an ephemeral port.

```sh
phomber serve --port 4317 --open
phomber reports
phomber reports open REPORT_ID
phomber reports export REPORT_ID
phomber reports export REPORT_ID --output ./portable-report
phomber wiki --resume REPORT_ID --depth deep --no-serve
phomber reports delete REPORT_ID --yes
```

The server binds **127.0.0.1 only**, blocks unsafe Host headers, rejects traversal/symlinks, and serves allowlisted files with security headers. It runs until interrupted and never installs a background daemon. The wiki supports full-text search, recency sorting, grouped version history, separate About/activity/evidence/info pages and report downloads. The wiki includes a dynamic article template, numbered citations and bottom metadata for provider/model, research times, API tokens and estimated cost. Profile organization and curated collection management are enabled immediately in every local wiki session; research and report deletion remain CLI operations.

Routes:

```text
/
/reports/REPORT_ID/
/reports/REPORT_ID/profile.json
/reports/REPORT_ID/sources.json
/reports/REPORT_ID/evidence.json
/reports/REPORT_ID/connections.json
/reports/REPORT_ID/timeline.json
/reports/REPORT_ID/export.json
```

The generated report folder works without the server. Open `index.html` directly or share an exported folder after reviewing its contents. `--format json` writes only structured investigation JSON to stdout; `--format html` prints the HTML path; default text prints a summary. Both HTML and JSON artifacts are always saved, including when an input's `output` list expresses a preferred format. Exit codes: 0 on completed/partial research, 1 for invalid input or fatal operation errors, 130 for interrupted research. Source failures yield partial reports with explicit reasons.

## Wiki administration and templates

The local wiki is always in admin mode. Starting `phomber serve` (including the local NPX entry point) or opening the wiki after research immediately provides profile and collection management. There is no admin login, unlock link, cookie or session expiry. Open **Admin** in the wiki to manage collections; open a profile’s version history to edit its label or split/move versions.

`phomber admin --port 4317` simply prints the management URL for a running server. In this checkout use `npm run local -- admin --port 4317`. This optional shortcut does not enable permissions or start another server. Management forms retain local Origin and CSRF checks.

The base template always supplies an infobox, References and research metadata. AI providers supply cited paragraphs, tables, lists, subheadings and quotations in dynamically titled sections. See [the article contract](docs/ARTICLE_TEMPLATE.md) and [wiki interface details](docs/WIKI_INTERFACE.md). DeepSeek is currently implemented; the shared contract supports future providers without changing the reading layout.

## Local workspace

Home resolution uses Node's cross-platform home-directory API:

```text
~/.phomber/                 # %USERPROFILE%\.phomber on Windows
  config.json
  index.json
  profiles.json             # profile grouping and version assignments
  collections.json          # admin-curated collection settings
  history.json              # shell command names only; no arguments
  cache/                    # redacted public API responses, 1-hour TTL
  logs/                     # reserved; no activity logs by default
  reports/SUBJECT-UUID/
    index.html
    profile.json
    sources.json
    evidence.json
    connections.json
    timeline.json
    investigation.json
  exports/
```

Use `PHOMBER_HOME` to select an isolated workspace. Every new investigation gets a random UUID. Resume keeps its ID and creation timestamp and recalculates the current evidence view with cached responses where fresh; historical revisions are not retained. Checkpoints survive cancellation, and atomic file replacement protects individual JSON writes. The dashboard derives its index from report files so an interrupted index update does not hide valid records. Concurrent updates of the **same** investigation are not supported; use separate IDs.

```sh
phomber config
phomber cache clear --yes
```

## Original commands

```sh
phomber number +442079460000
phomber ip 8.8.8.8
phomber mac 00:1A:2B:00:00:00
phomber whois example.com
phomber dns example.com
phomber username KNOWN_HANDLE --format json
phomber info
phomber check
phomber dork
phomber exp
phomber shell "echo hello"
```

Inside the interactive shell: `save [PATH]` saves the previous result, `flush` clears persisted command history, `clear` clears the terminal, `change 0-7` changes prompt color, and `exit`/`quit` leave. `shell` deliberately invokes the native shell only when explicitly requested; the server cannot invoke commands. See [migration and compatibility details](docs/MIGRATION.md) for replacements and limitations.

Phone lookup provides offline numbering-plan metadata, not subscriber identity, real-time location or current carrier tracking. IP/WHOIS return registration information through RDAP with contact data omitted. MAC vendor results cannot establish device identity. Username results are leads.

## Privacy and optional AI

No telemetry, hidden uploads, private databases, access-control bypass, credentials collection or speculative private relationship mapping. Saved reports stay local. AI wiki mode explicitly sends the current subject context and public evidence to DeepSeek; --no-ai disables this. Reports use restrictive POSIX permissions; Windows inherits the user's ACLs. Public APIs receive the identifier required for each lookup. Cache storage omits common contact/credential fields; arbitrary public prose still requires human review. Reports are not encrypted.

DeepSeek research is enabled for wiki unless --no-ai or --offline is used. See docs/AI.md for credential handling and billed API use.

Read the [responsible-use policy](docs/RESPONSIBLE_USE.md) before investigating people or sharing reports.

## Development

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:package
npm publish --dry-run
```

Runtime dependencies are Ajv and libphonenumber-js; argument parsing, prompts, HTTP, DNS, serving and storage use Node built-ins. TypeScript uses strict checking. Tests cover CLI inputs/JSON, cached API fixtures, source parsers, correlation, provenance, cancellation/resume, HTML escaping/CSP, workspace/export safety, localhost routes and AI consent. Tests do not query live personal profiles. `npm run release:check` runs typechecking, the test suite and a tarball installation check. CI runs it on Node 22/24 on Windows, macOS and Linux; symlink tests are skipped on Windows where creation requires special privileges. The optional personal collection checksum test is skipped when that local collection is absent. Add adapters using the contract in [SOURCES.md](docs/SOURCES.md). A package lock pins checkout builds.

## Python preservation

The [legacy Python ZIP](https://github.com/s41r4j/phomber/blob/main/legacy/phomber-python-legacy.zip) contains the original Python project; [SHA256SUMS](https://github.com/s41r4j/phomber/blob/main/legacy/SHA256SUMS) verifies it. These downloads stay in GitHub to keep the npm package small. [Legacy instructions](legacy/README.md) document extraction, dependencies, historical commands and preservation exclusions. Git history and the source files remain unchanged. Do not use the historical Dockerfile or TOML-as-requirements installation instructions without reading the migration notes.

## Troubleshooting

- **`npx phomber@beta` not found:** inside this checkout, build first and use `npx --no-install phomber help`. Outside the checkout, install the packed tarball until the beta is published.
- **Node errors:** install Node 22 or later and rebuild after changing sources.
- **No interactive terminal:** use explicit arguments or `--input`; questionnaire input is not read from pipes.
- **HTTP 403/429/404 or API errors:** inspect `sources.json`; blocked or missing responses do not prove absence. Respect source restrictions and retry later.
- **No results offline:** only fresh cached source responses are used with `--offline`. Saved reports can always reopen without new research.
- **Port occupied:** choose `--port` or use the reported fallback port. Ctrl+C stops the foreground server.
- **Report location:** inspect `phomber reports` or override `PHOMBER_HOME` for a different writable directory.
- **Browser cannot copy JSON:** offline clipboard permissions vary. Expand Structured data or open `profile.json` directly.
- **Limited identity confidence:** add explicit known profiles and identifying public context, then review every candidate. Do not resolve ambiguity by assuming equal handles belong to one person.

## PH0MBER Wiki and local archive imports

`phomber serve` now opens **PH0MBER Wiki**: a Wikipedia-style main page with full-text search across saved investigations and imported archived articles. It uses a white canvas, serif article headings, blue links, contents navigation, article tabs, infoboxes, references, wiki tables, and appearance controls for text size, width and color. New reports use the same article theme.

Your own archived articles can be imported through a portable library JSON file. Personal collections and reports are excluded from Git and npm. If a local checkout has `references/library.json`, it can load that collection automatically; an installed package starts with an empty library and can import one explicitly:

```sh
phomber library import /path/to/library.json
phomber library
phomber serve --port 4317
```

Search the homepage by a person's name, project, institution, profile, or any keyword in article text. `/wiki/ARTICLE_ID/` opens an archived wiki; `/reports/REPORT_ID/` opens a generated investigation. Archived claims remain explicitly historical and unverified. The original pages stay untouched, while the served versions discard active content and remote tracking assets. Imports stay in the local workspace and are not automatically uploaded.

DeepSeek keys are entered with no terminal echo. NPX uses a session-only key; the installed CLI saves the key in local credentials.json (0600 on POSIX). Use --save-key to explicitly persist an NPX key, DEEPSEEK_API_KEY for automation, --model to override the discovered model, and phomber auth logout to erase the saved key. AI API requests are billed to your DeepSeek account. See [AI research details](docs/AI.md).

See [Wiki pages and profile organization](docs/WIKI_INTERFACE.md) for the redesigned biography layout, dated article index, source portraits, version umbrellas and split/move/label controls.
