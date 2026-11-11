# PH0MBER Python legacy

This archive preserves the pre-Gen2 working tree, including the active v3.1.1 script, dependency metadata, original README, Dockerfile, license, images, and older archived implementations. Files included are byte-for-byte originals, including the pre-existing local README edit. Git history is unchanged.

The npm package contains this guide only. Download [the legacy ZIP](https://github.com/s41r4j/phomber/blob/main/legacy/phomber-python-legacy.zip) and [SHA256SUMS](https://github.com/s41r4j/phomber/blob/main/legacy/SHA256SUMS) from the repository into the same directory before following these steps. The Node.js CLI does not need the Python archive.

Verify with `shasum -a 256 -c SHA256SUMS` (Linux: `sha256sum -c SHA256SUMS`). Extract the ZIP, enter `phomber-python`, create a Python virtual environment, and install dependencies:

```sh
python3 -m venv .venv
# POSIX: source .venv/bin/activate
# Windows: .venv\Scripts\activate
python -m pip install requests prompt_toolkit psutil beautifulsoup4 phonenumbers mac-vendor-lookup python-whois dnspython
python phomber.py
```

Historical commands: help, exit/quit, dork, exp, check, clear, flush, save, shell, info, change, number, ip, mac, whois, dns, username. The original README's `pip install -r pyproject.toml` and Dockerfile's missing requirements file were already broken; the explicit dependency command above avoids both. External legacy sources may no longer work. Gen2 does not execute Python.

Preservation exceptions: `.archive/unreleasedv3/phomber/modules/config.ini` contained hardcoded API credentials and is intentionally omitted; recreate it locally using the configuration sections referenced by historical adapters if needed. Generated `.egg-info` metadata is omitted. No credentials were copied from that configuration. Source, notices, license and other files were not rewritten. The historical Git files remain in place.
