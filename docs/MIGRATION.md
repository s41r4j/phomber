# Audit and migration notes

The pre-migration active release was Python 3.1.1: 1,524 lines in one `phomber.py`, global output and prompt state, six scanner commands, terminal history, output saving and native shell execution. No active tests or CI test workflows were present. `.archive` contains v1, v2 and an unreleased modular v3. The existing GPLv3 license and attribution are retained. A pre-existing edit to `.archive/v2.0/README.md` is preserved.

Packaging issues found: README installs TOML as a requirements file; Dockerfile copies a missing root requirements.txt; Python entry points refer to a package layout different from the active root script. Several requests have no timeout, broad exceptions hide errors, and username lookup scrapes brittle IDCrawl markup. No source code has been removed or rewritten; all new runtime code is TypeScript and normal execution does not use Python.

Before Gen2 changes, tracked Python source, docs, scripts, images, configurations and license were placed byte-for-byte in `legacy/phomber-python-legacy.zip`. Every included member was compared with its original working-tree bytes. The credential-bearing old config and generated egg-info were excluded as documented in `legacy/README.md`. The original historical files remain in Git and on disk. Maintainers should rotate any historical exposed credentials separately; this migration does not modify Git history.

## Compatibility

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

No-argument behavior preserves a command shell. `wiki` starts the new questionnaire. Direct commands support automation and clean JSON. `save`, `change`, `clear`, `flush` are shell-only. Silent Python flags `-s` and verbose `-e` are replaced by explicit direct commands, `--format json`, actionable errors and exit codes.

Gen2 requires Node >=22. Python's broad claims of subscriber lookup and Windows compatibility are not assumed to be proven. CI defines Linux/macOS/Windows coverage; a local macOS run does not establish all-platform execution.

## Release status

The npm registry returned E404 for `phomber` during implementation (11 November 2026 IST). This is not a reservation or guarantee of publish permission. Recheck `npm view phomber name version maintainers --json` before publication and verify maintainer identity; do not publish under a different name silently. No package was published by this migration. Until publication, use the checkout or locally packed tarball.
