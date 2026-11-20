# PH0MBER usage guide

Research public sources from a terminal, keep inspectable evidence and read your investigations in a local wiki.

**Gen2 0.0.2 · Node.js 22+ · MIT · by s41r4j**

[Project website](https://phomber.s41r4j.in) · [Documentation](README.md) · [Changes](../CHANGELOG.md)

This guide covers version **0.0.2**. Run `phomber --version` to check your installation. Use the checkout instructions below to run directly from source.

## Start here

Install the published package:

```sh
npm install -g phomber
phomber find
```

Or run it without a global installation:

```sh
npx phomber find
```

`find` opens the guided investigation builder. AI research uses billed DeepSeek APIs by default and prompts privately for a key when needed. Use `phomber find --no-ai` for source adapters only, or `--offline` for cached evidence with AI disabled.

| Everyday command | Purpose |
| --- | --- |
| `phomber` | Open the interactive command prompt |
| `phomber find` | Start guided research |
| `phomber reports` | Read the saved investigation list and report IDs |
| `phomber serve` | Start the wiki and print its local URL |

`serve` works on its own. Open the printed address, normally **http://127.0.0.1:4317/**; optional `--open` launches the browser. Keep that terminal open, and press Ctrl+C to stop the server. After updating the code, stop the old server and start it again.

## Use this checkout

```sh
npm ci --ignore-scripts
npm run setup:local
npm run local -- find
```

In another terminal, browse existing investigations:

```sh
npm run local -- reports
npm run local -- serve
```

`setup:local` builds the CLI, prepares the shared workspace and imports `references/library.json` if available and no library has already been saved. It preserves existing reports and library data. `npm run dev` rebuilds and serves the same workspace; it is not a hot-reload server.

Other ways to run the built checkout:

```sh
node dist/cli/index.js find
node dist/cli/index.js help find
```

To inspect or install a local package without publishing:

```sh
npm pack
npm install -g ./phomber-0.0.2.tgz
# Alternative without a global install:
npm exec --package ./phomber-0.0.2.tgz -- phomber help find
```

## Research a subject

Use the guided builder, or supply a name directly:

```sh
phomber find
phomber find "Full Name"
phomber find "Full Name" --education "Known College" --social instagram:known_handle --no-serve
```

A positional name is the short form of `--name`; choose one form per command. Name-only research is ambiguous. Supplied names, handles, institutions and relationships are clues, not verified facts.

Useful research options:

| Option | Behavior |
| --- | --- |
| `--no-ai` | Run public-source adapters without DeepSeek |
| `--ai-only` | Use DeepSeek Search/Fetch without adapters or portrait downloads |
| `--offline` | Use fresh local cache only; disable AI |
| `--omit FIELD` | Omit a subject field or a published contact field. Repeat for multiple fields. |
| `--depth quick\|standard\|deep` | Select bounded collection coverage |
| `--no-serve` | Finish research without starting the wiki server |
| `--resume REPORT_ID` | Continue an existing investigation using its saved preferences |
| `--format json` | Print structured output for scripts |

Full options and examples: `phomber help find`. The questionnaire supports revisiting categories, reviewing input and saving an input JSON draft. In repeated-entry questions, `!clear` replaces the existing list.

From the repository root, test the input illustration offline; for your own JSON file, supply its path:

```sh
phomber find --input examples/subject.json --offline --no-serve
phomber find --resume REPORT_ID --no-ai --no-serve
```

The files in [examples/](../examples/) illustrate the input format. Replace their placeholders before live research. Scalar flags override JSON values and repeated flags append to arrays. Use `--omit email` to redact recognizable email addresses from new web and PDF snapshots and DeepSeek chat prompts. See the [input schema](../schemas/subject.schema.json), [report schema](../schemas/investigation.schema.json), [AI guide](AI.md) and [source coverage](SOURCES.md).

## Read, search and manage reports

```sh
phomber reports
phomber search "name college"
phomber reports open REPORT_ID
phomber reports export REPORT_ID
phomber reports delete REPORT_ID
```

The default CLI output is readable text, including inside the interactive prompt. Add `--format json` for automation. `find --format html` prints the saved HTML path. HTML and JSON report artifacts are saved regardless of the stdout format.

In the interactive prompt, omit the `phomber` prefix. Tab completes commands; `exit` or `quit` closes the prompt. This is a command prompt, not a selectable report menu. Reports remain accessible through their IDs or the wiki.

The wiki provides:

- Full-text catalog search across names, supplied context, findings and article prose.
- Article search with highlighted text blocks, infobox matches and Next match navigation.
- Version history with an explanation of automatic grouping and manual split/move controls.
- Review findings, preserved revisions, integrity information and report downloads.
- **Delete report**, or **Admin → Manage investigations**, with explicit deletion confirmation.

CLI deletion prompts in a terminal. Scripts and JSON mode require `phomber reports delete REPORT_ID --yes`. Deletion removes the report directory, including snapshots and revisions. Other investigations, imported archives, separate exports and shared response cache remain. A deletion marker prevents a stale collector from restoring the same report ID. Catalog backups and derived storage are described in the [retention notes](ANALYST_WORKFLOW.md#search-exports-and-retention).

The server binds to loopback only, serves allowlisted files and checks Host, Origin and CSRF tokens for management requests. Administration is enabled locally without a login. `phomber admin` prints a management URL for an already running server; it does not start one.

## Automatic profile versions

Matching research subjects are grouped as versions using matching platform-specific supplied/reviewed account identifiers, or a supplied name plus shared college, work or other identifying context. Names alone and ambiguous or conflicting matches stay separate. Grouping does not merge evidence or approve factual claims.

Use **Different person - separate version** or **Move to another profile** to override grouping. These decisions persist. Older catalogs are backed up before automatic-grouping metadata is added; old profile URLs and collection memberships follow aliases. See [profile organization](WIKI_INTERFACE.md#automatic-version-grouping-in-002).

## One workspace on each device

Installed, NPX, direct Node and checkout commands share the same per-user storage:

| OS | Default directory |
| --- | --- |
| macOS / Linux | `~/.phomber` |
| Windows | `%USERPROFILE%\.phomber` |

Run `phomber config` to see the resolved path. Set `PHOMBER_HOME` to the same absolute path in every terminal to choose a different workspace. Data is shared between entry points on that device/account; it is not synced across computers. Older checkout `.phomber/` directories remain separate until copied into the shared workspace or selected explicitly.

```text
.phomber/
  config.json, credentials.json
  profiles.json, collections.json, history.json
  profiles-v1-HASH.backup.json    # catalog migration backup, when needed
  index.json, search.sqlite      # derived listing/search data
  reports/REPORT_ID/
    investigation.json, index.html, profile.json, ...
    revisions/SHA256.json
    snapshots/SHA256.json
  cache/, exports/, logs/
  deleted/REPORT_ID.json         # deleted-ID marker
```

Installed and NPX runs reuse the same saved API key. Keys use hidden terminal entry and restricted local permissions. `DEEPSEEK_API_KEY` supplies an environment key without saving it; `PHOMBER_EPHEMERAL_KEY=1` opts into session-only key entry. `phomber auth logout` removes the saved key. Workspace data and credentials are not encrypted. See [AI setup and costs](AI.md).

## Advanced tools and limits

| Scanner | Purpose |
| --- | --- |
| `email ADDRESS` | Masked syntax and mail-domain DNS check for your own/authorized address |
| `number +PHONE` | Offline numbering-plan metadata |
| `ip PUBLIC_IPV4` | IP registration through RDAP |
| `mac MAC_ADDRESS` | MAC vendor-prefix lookup |
| `whois DOMAIN` | Domain registration through RDAP |
| `dns DOMAIN_OR_IP` | DNS records or reverse DNS |
| `username HANDLE` | Candidate accounts on four supported platforms |

Prefix these with `phomber`, or enter them directly inside the prompt. Use `phomber help scanners` for examples and limitations. Other focused help: `phomber help interactive`, `phomber help reports`, `phomber help review` and `phomber help serve`.

Source adapters cover GitHub, GitLab, DEV, Hugging Face, Wikidata, Crossref, DNS, RDAP and archive pointers. A recognized platform name does not mean its API is implemented. Phone metadata does not identify subscribers; matching handles do not establish common ownership; failed requests do not prove absence. DeepSeek can search/fetch additional public pages, with billed calls and bounded queries. Review claims and identity decisions before using or sharing results.

[Responsible use](RESPONSIBLE_USE.md) · [Source support](SOURCES.md) · [Analyst workflow](ANALYST_WORKFLOW.md)

For broader evidence-led research, use `phomber find "Full Name" --education "Known College" --depth deep --no-serve`. API and web evidence guide targeted follow-ups and identity checks together. A handle-led search can discover a seed-linked full name, prioritize name-plus-institution/project checks, and overlap bounded independent searches. Cited public professional contacts and general location can be retained from linked first-party sources; the report explains resource associations and unresolved matches. See [AI research and limits](AI.md).

## Development and verification

```sh
npm run release:check
```

This checks the site, typechecks, builds, runs tests, packs and installs into a temporary consumer, then verifies the installed CLI and localhost dashboard. It uses offline/fixture research; it does not require a DeepSeek key or make paid AI calls. The package check needs npm registry access for dependencies and loopback-server access.

Individual checks: `npm run check:site`, `npm run check`, `npm test`, and `npm run test:package`. CI defines Node 22/24 coverage on Linux, macOS and Windows; local success alone does not establish a completed CI run. Source adapters, PDF parsing and dependency requirements are documented in [Sources](SOURCES.md). SQLite search uses Node's built-in module when available and a portable fallback otherwise.

Publishing is a separate maintainer action. See [RELEASING.md](RELEASING.md); ordinary tests and local installation do not publish the package.

## Troubleshooting

- **Old commands or version:** compare `phomber --version` with `npm run local -- --version`. Registry installations do not include unpublished changes. Rebuild and restart a running wiki after source updates.
- **npm notice run messages:** npm prints these before PH0MBER starts. Use `npx --loglevel=warn phomber reports`, or set `npm config set loglevel warn --location=user` once. Warnings/errors remain visible; PH0MBER does not change npm settings during installation.
- **No terminal:** supply a name, `--social` or `--input`; use `--format json` for scripts. With no command in a pipe, PH0MBER prints help.
- **API errors or no offline results:** inspect the evidence/source views. Offline mode only uses fresh cached responses; an unavailable source is not proof of absence.
- **Busy port:** use the URL actually printed by `serve`, or choose another port. Ctrl+C stops the foreground server.
- **Different reports between terminals:** check `phomber config`, OS user accounts and `PHOMBER_HOME` in both terminals.

## Website, legacy code and license

The public single-file guide is in `website/index.html`; GitHub Pages deploys only `website/`. Your investigation wiki stays local. See [website setup](WEBSITE.md) and [the source HTML](https://github.com/s41r4j/phomber/blob/main/website/index.html).

Historical Python code is preserved in the [legacy ZIP](https://github.com/s41r4j/phomber/blob/main/legacy/phomber-python-legacy.zip), with a [checksum](https://github.com/s41r4j/phomber/blob/main/legacy/SHA256SUMS) and [legacy guide](../legacy/README.md). Gen2 does not run Python, Docker or historical installation scripts. Archived article collections can be imported with `phomber library import /absolute/path/library.json`; they remain local and retain their original claims.

Gen2 code, documentation and the website use the [MIT License](../LICENSE). Historical Python files retain their original terms, including [GPLv3](https://github.com/s41r4j/phomber/blob/main/legacy/LICENSE). Dependencies retain their own licenses. Historical ZIP contents and previously published releases are unchanged.

## Email checks and planned work

```sh
phomber email me@example.com
phomber email me@example.com --format json
```

Use only your own details or an address whose owner has authorized the check. This checks common email syntax and public mail-domain DNS, masks the address in output, and makes no mailbox-existence, ownership or breach claim. Company-specific research, privacy cleanup, address auditing and authorized breach checks are tracked in [Product TODO](TODO.md). Public availability does not grant permission to contact or republish personal information.
