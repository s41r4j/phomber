# Sources and evidence rules

[Documentation index](README.md) · [Project guide](../README.md)

Collection is deliberately bounded. There is no scraping of login pages, CAPTCHAs or private profiles. The source-adapter-only mode needs no key. AI wiki mode uses a DeepSeek key for live web Search/Fetch and synthesis (see AI.md). Every adapter can fail independently without fabricating a finding. HTTP 404, empty results, blocked access and timeouts are never translated into “account does not exist.”

| Integration | Collected data | Constraints / documentation |
| --- | --- | --- |
| GitHub REST | Public account, non-fork repositories, public organization memberships; name search candidates | Unauthenticated rate limits; repository pages contain 10 standard / 30 deep records, bounded to 3 standard / 5 deep pages within the investigation lookup budget. [API](https://docs.github.com/en/rest/users/users) |
| GitLab REST | Public user search by exact username | Anonymous access may be restricted. [API](https://docs.gitlab.com/api/users/) |
| DEV Community | Public account by username | [API](https://developers.forem.com/api/v1#tag/users) |
| Hugging Face | Public user overview | Availability and API shape may change. [Hub API](https://huggingface.co/docs/hub/api) |
| Wikidata | Name search candidates | Name match does not resolve identity. [Data access](https://www.wikidata.org/wiki/Wikidata:Data_access) |
| Crossref | Author-name publication search, titles, DOI URLs, publication year | Author names may be shared; publications remain leads. [API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) |
| Google Public DNS | A records for wiki domain research | [JSON API](https://developers.google.com/speed/public-dns/docs/doh/json); direct scanner uses system DNS for richer records |
| RDAP.org bootstrap | Domain registration dates/nameservers; IP registration scanner | Registry redirects checked for public destinations; no contact entities retained. [Service](https://about.rdap.org/) |
| Internet Archive CDX | Up to 10 annual capture pointers in deep domain research | May return 403 or rate-limit; does not download historical page content. [CDX API](https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server) |
| MACLookup | Vendor company for a globally administered MAC | No inference for randomized MACs. [API](https://maclookup.app/api-v2) |
| libphonenumber | Offline number validation and numbering-plan metadata | Not an ownership or current carrier lookup |

LinkedIn, Bitbucket, X, Instagram, Facebook, Threads, Bluesky, Mastodon, Reddit, YouTube, Twitch, Medium, Hashnode, Stack Overflow/Exchange, Quora, Behance, Dribbble, Kaggle, ResearchGate, Google Scholar, ORCID, Product Hunt, Indie Hackers, npm, PyPI and Docker Hub may be supplied as public source context, but automated profile adapters for them are not shipped. They appear as **unsupported**, without invented URLs or findings. All named platforms are recognized input context; recognition is not a claim of automated support.

Education, professional history, awards, community activity and other extensible categories accept structured input and imported evidence. Developer bios and public entity/publication search may reveal relevant leads. The engine does not promise exhaustive institution, employer, or general web crawling. Generated search queries are retained for manual follow-up; there is no unrestricted search-engine scrape. The AI workflow additionally searches the web through the official DeepSeek Search API and retrieves public pages through its Fetch API. Website arguments generate domain research, not arbitrary page crawls.

## Pipeline and limits

Input validation → query/endpoint planning → bounded API collection → field normalization → duplicate removal → resource cross-reference and contradiction review → provenance-linked report.

Quick: at most 8 requests; GitHub username candidates, name/entity discovery and DNS. Standard: at most 30; adds GitLab, repositories, author publication search and RDAP. Deep: at most 70; adds DEV/Hugging Face candidates, more repositories, public organization memberships and annual archive pointers. Limits apply after deduplication; requests beyond the limit appear as unsupported sources with an explicit limit warning, so bounded collection cannot silently claim full coverage. Reports with no automated requests remain partial. The input determines which endpoints are relevant. No recursively expanding crawl is performed.

HTTP: one request per origin per 1.1 seconds during an investigation, 12-second request timeout plus bounded DNS resolution, max 2 MB per response, max 3 redirects. 429/5xx/reset/timeout errors retry up to twice with exponential backoff. Independent CLI processes do not share a rate limiter. Valid `Retry-After` and GitHub quota reset headers are honored for bounded waits up to 30 seconds; longer waits stop for a later retry. IPv4 transport is pinned to a resolved public address to prevent DNS rebinding; IPv6-only sources are unsupported. API error text is shown without copying credentials. Responses are cached for one hour; stale cache entries are not used offline. Cache sanitization excludes contacts, RDAP entities, email fields, credentials and email strings before persistence and again on cache reads. Malformed, stale and future-dated cache entries are rejected. Cache write failures do not discard successfully retrieved evidence.

## Verification vocabulary

- **User-provided:** investigator input, not independently checked.
- **Verified:** an exact field retrieved from an explicitly supplied account/domain. Does not prove person ownership or the truth of an account biography.
- **Corroborated:** a legacy collection label. New collection never infers independent corroboration from matching values on different websites.
- **Lead:** name search, username matches and investigator-imported evidence. No identity probability is assigned.
- **Conflicting:** an anchored account's name/company differs from supplied context. Both values remain visible; this may be an alias or changed employment.
- **Unavailable/unsupported:** retrieval could not occur. Not proof of absence.

New findings leave numeric confidence null and expose separate extraction, identity, credibility and analyst-review assessments. Old reports may retain score 1 as an extraction-only legacy value. No probabilistic confidence numbers are invented. Only an explicit source-backed public organization membership enters the generated connections list. Investigator-supplied connections remain unverified input. Timeline entries retain provenance, partial date precision and uncertainty.

Resume reuses the ID and creation date. Every save preserves revisions; interrupted runs may restore completed tasks from intact, fresh snapshots with unchanged input. Other resumes recalculate the current findings from source responses. Omissions affect current data; preserved history remains until the full report is deleted. See [the analyst workflow](ANALYST_WORKFLOW.md).

## Extending adapters

Add a Task producer in `src/adapters/index.ts` with an adapter ID, permitted public API URL, identity policy and a pure JSON-to-Candidate parser. Parsers must select necessary fields, avoid RDAP registrant contacts and private data, and never manufacture URLs or relationship assertions. `HttpClient` supplies cache, timeout, cancellation, bounded transport and retries. Add fixtures and failure tests. Keep pure matching logic in `src/core`, not UI templates. The CLI, questionnaire and JSON import all call `investigate`.

## Evidence-driven profile follow-up

Online AI-assisted research can follow supported public profile URLs already found in this investigation through local API adapters. Follow-up requests retain candidate identity status, task history and source snapshots, with separate depth-based budgets. DeepSeek-only and synthesis-only modes disable these API follow-ups. See [research orchestration and matching](AI.md) for budgets, automatic match states and evidence limits.

## Public PDF text and email checks

Online mixed AI research can locally extract text and public link annotations from a bounded number of public HTTPS PDFs. The source adapter is `local-pdf`; snapshots contain sanitized parsed text, not raw PDF binaries. Scanned PDFs need OCR, which is not included. Source text is chunked so later professional details can be considered. See [PDF limits](AI.md#public-pdf-documents).

`phomber email ADDRESS` is a standalone syntax/mail-domain DNS check. It accepts a user-supplied address, masks output, sends only domain queries to DNS and does not search for personal emails, probe mailboxes or query breaches. Use it only for your own details or authorized subjects. See [planned privacy/company work](TODO.md).

## Author identity boundaries

A full author-name match must occur inside one work's individual author record. Cross-author name assembly is rejected. Same-name results remain in the evidence ledger until subject-specific ORCID/DOI linkage or a valid analyst identity decision supports attribution. Missing or malformed author fields are unresolved, not silently repaired into a name. Mixed search-response metadata receives no identity marks. See [publication attribution](AI.md#per-work-publication-attribution) and [Crossref metadata documentation](https://www.crossref.org/documentation/retrieve-metadata/rest-api/).


## Discovered-name and contact provenance

A seed handle and a discovered full name are separate values. The original input is retained, while exact API account identifiers or explicit first-party links establish bounded resource associations for further checks. Broad directory/search responses cannot supply the subject's name or identity marks. Same-account self-profile release PDFs can be associated when their individual name agrees; they remain self-reported sources. Name-based follow-up adapters retain task history and do not certify author/profile identity. See [research prioritization and concurrency](AI.md#discovered-names-relevance-and-concurrent-research).

Public professional contacts and general city/region/country are extracted only from supported subject-linked resources and rendered with source citations. HTTP API caches still sanitize RDAP contacts and credentials. The mixed public document reader can retain professional contact text for attribution, while residential/private identifiers remain excluded. Previously redacted source snapshots are preserved, not rewritten to invent missing values.
