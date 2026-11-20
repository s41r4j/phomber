# Audit and migration notes

[Documentation index](README.md) · [Project guide](../README.md)

The pre-migration active release was Python 3.1.1: 1,524 lines in one `phomber.py`, global output and prompt state, six scanner commands, terminal history, output saving and native shell execution. No active tests or CI test workflows were present. `.archive` contains v1, v2 and an unreleased modular v3. Gen2 source, documentation and the website now use MIT. Historical Python files retain their original license terms and attribution, including the GPLv3 text preserved in `legacy/LICENSE`; the original ZIP is unchanged. A pre-existing edit to `.archive/v2.0/README.md` is preserved.

Packaging issues found: README installs TOML as a requirements file; Dockerfile copies a missing root requirements.txt; Python entry points refer to a package layout different from the active root script. Several requests have no timeout, broad exceptions hide errors, and username lookup scrapes brittle IDCrawl markup. The Gen2 runtime is implemented in TypeScript and normal execution does not use Python. Original Python files are preserved in the legacy ZIP; checked-out legacy text has also received punctuation corrections.

Before Gen2 changes, tracked Python source, docs, scripts, images, configurations and license were placed byte-for-byte in `legacy/phomber-python-legacy.zip`. Every included member was compared with its original working-tree bytes. The credential-bearing old config and generated egg-info were excluded as documented in `legacy/README.md`. The original historical files remain in Git and on disk. Maintainers should rotate any historical exposed credentials separately; this migration does not modify Git history.

## Compatibility

The Gen2 research command is now `phomber find`. Earlier `wiki` invocations remain accepted as a hidden compatibility alias, including `help wiki`; both route to the same research implementation and workspace. Current help, autocomplete and examples use `find`.

| Python command | Gen2 behavior |
| --- | --- |
| help, exit/quit | CLI help / exit the interactive shell |
| number | Offline international number validation, country/calling code/type from libphonenumber metadata; no subscriber data or live carrier tracking |
| ip | Public IPv4 registration data through RDAP; no exact geolocation |
| mac | MAC vendor lookup through MACLookup public API; detects randomized/local MACs |
| whois | RDAP replaces WHOIS; contacts and precise addresses excluded |
| dns | A, AAAA, MX, NS, TXT, SOA or reverse PTR |
| username | GitHub, GitLab, DEV and Hugging Face API candidates; replaces IDCrawl HTML scraping |
| dork | Public-source search templates; replaces random exploit-db scraping |
| check | Public endpoint reachability; a failed source is not a universal internet diagnosis |
| info, exp | Runtime/platform metadata and legacy expression legend |
| save | Interactive shell: save previous output to a local text file |
| shell | Explicit native shell invocation, never available from the web server |
| change, clear, flush | Interactive prompt color, screen clearing, persisted history clearing |

No-argument behavior preserves a command shell. `find` starts the questionnaire; `find "Full Name"` supplies a name directly. Direct commands print readable text by default; add `--format json` for automation. `save`, `change`, `clear`, `flush` are shell-only. Silent Python flags `-s` and verbose `-e` are replaced by explicit direct commands, `--format json`, actionable errors and exit codes.

Gen2 requires Node >=22. Python's broad claims of subscriber lookup and Windows compatibility are not assumed to be proven. CI defines Linux/macOS/Windows coverage; a local macOS run does not establish all-platform execution.

## Release history and current checkout

The npm registry returned E404 for `phomber` during implementation (11 November 2026 IST). This is not a reservation or guarantee of publish permission. Recheck `npm view phomber name version maintainers --json` before publication and verify maintainer identity; do not publish under a different name silently. That statement records the original migration, not current registry availability. The first Gen2 release was 0.0.1. This guide covers Gen2 0.0.2. Use the checkout or a local tarball to test source changes, and follow [the release checklist](RELEASING.md) for publication.
