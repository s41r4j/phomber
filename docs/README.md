# PH0MBER documentation

**Gen2 0.0.2 · MIT · Node.js 22+**

Start with the [project guide](../README.md). The main research command is `phomber find`: run it alone for the questionnaire, or use `phomber find "Full Name"` with known context.

| Guide | Contents |
| --- | --- |
| [Command guide](USAGE.md) | Installation, research options, reports, scanners, storage and troubleshooting |
| [Product TODO](TODO.md) | Company research, authorized privacy cleanup, breach-provider work and document coverage |
| [AI research](AI.md) | DeepSeek setup, saved keys, research modes, budgets and recorded costs |
| [Wiki interface](WIKI_INTERFACE.md) | Local pages, search, automatic versions, manual organization and deletion |
| [Analyst workflow](ANALYST_WORKFLOW.md) | Evidence review, snapshots, revisions, integrity, recovery and retention |
| [Sources](SOURCES.md) | Supported adapters, source limitations, status vocabulary and extension points |
| [Article template](ARTICLE_TEMPLATE.md) | Provider-neutral prose, tables, lists, quotes and citation contract |
| [Responsible use](RESPONSIBLE_USE.md) | Public-source boundaries, privacy, storage and sharing |
| [Migration and compatibility](MIGRATION.md) | Historical Python tools, command compatibility and release history |
| [Website setup](WEBSITE.md) | Single-file public guide, GitHub Pages and the local/public distinction |
| [Release checklist](RELEASING.md) | Package validation and separate, explicit publication steps |

## Everyday commands

```sh
phomber find
phomber find "Full Name"
phomber reports
phomber serve
```

Research uses billed AI by default. `--no-ai` runs source adapters only; `--offline` disables AI and uses fresh local cache. `serve` prints a URL; optional `--open` launches the browser. Reports print readable text by default; add `--format json` for scripts.

All entry points use the same per-user workspace unless `PHOMBER_HOME` is set. To run from a Git checkout, use `npm run local -- find` and `npm run local -- serve` after `npm run setup:local`.

## Input reference

- [Basic input illustration](../examples/subject.json)
- [Extended input illustration](../examples/extended-subject.json)
- [Input JSON Schema](../schemas/subject.schema.json)
- [Investigation JSON Schema](../schemas/investigation.schema.json)
- [Changelog](../CHANGELOG.md)

Replace example placeholders before live research. `phomber find --input examples/subject.json --offline --no-serve` exercises the input format without making network or AI requests when run from the repository root.

## Email checks

`phomber email me@example.com` checks a supplied address's common syntax and public mail-domain DNS. Use your own details or an authorized subject. Output is masked; mailbox existence, ownership and breach exposure stay unknown. See [TODO](TODO.md) for privacy cleanup and verified breach-provider plans.
