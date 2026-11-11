# Sources and evidence rules

Collection is deliberately bounded. There is no scraping of login pages, CAPTCHAs or private profiles. The source-adapter-only mode needs no key. AI wiki mode uses a DeepSeek key for live web Search/Fetch and synthesis (see AI.md). Every adapter can fail independently without fabricating a finding. HTTP 404, empty results, blocked access and timeouts are never translated into “account does not exist.”

| Integration | Collected data | Constraints / documentation |
| --- | --- | --- |
| GitHub REST | Public account, non-fork repositories, public organization memberships; name search candidates | Unauthenticated rate limits; repositories limited to 10 standard / 30 deep, no pagination. [API](https://docs.github.com/en/rest/users/users) |
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

Quick: at most 8 requests; GitHub username candidates, name/entity discovery and DNS. Standard: at most 30; adds GitLab, repositories, author publication search and RDAP. Deep: at most 70; adds DEV/Hugging Face candidates, more repositories, public organization memberships and annual archive pointers. Limits apply after deduplication; the input determines which endpoints are relevant. No recursively expanding crawl is performed.

HTTP: one request per origin per 1.1 seconds during an investigation, 12-second request timeout plus bounded DNS resolution, max 2 MB per response, max 3 redirects. 429/5xx/reset/timeout errors retry up to twice with exponential backoff. Independent CLI processes do not share a rate limiter. `Retry-After` scheduling is not currently implemented. IPv4 transport is pinned to a resolved public address to prevent DNS rebinding; IPv6-only sources are unsupported. API error text is shown without copying credentials. Responses are cached for one hour; stale cache entries are not used offline. Cache sanitization excludes contacts, RDAP entities, email fields, credentials and email strings before persistence.

## Verification vocabulary

- **User-provided:** investigator input, not independently checked.
- **Verified:** an exact field retrieved from an explicitly supplied account/domain. Does not prove person ownership or the truth of an account biography.
- **Corroborated:** identical anchored fields found in multiple adapter source families. Does not assert that self-reports are independently true.
- **Lead:** name search, username matches and investigator-imported evidence. No identity probability is assigned.
- **Conflicting:** an anchored account's name/company differs from supplied context. Both values remain visible; this may be an alias or changed employment.
- **Unavailable/unsupported:** retrieval could not occur. Not proof of absence.

Confidence is deterministic and explained: 1 only measures exact extraction from a supplied resource; unresolved identity probabilities are null. No probabilistic confidence numbers are invented. Only an explicit source-backed public organization membership enters the generated connections list. Investigator-supplied connections remain unverified input. Timeline entries retain provenance, partial date precision and uncertainty.

Resume reuses the ID and creation date, recalculates the current findings from current input and fresh/cache-backed source responses, and deduplicates evidence. It is not a historical revision ledger. This avoids retaining fields requested for omission or silently treating stale findings as current.

## Extending adapters

Add a Task producer in `src/adapters/index.ts` with an adapter ID, permitted public API URL, identity policy and a pure JSON-to-Candidate parser. Parsers must select necessary fields, avoid contacts and private data, and never manufacture URLs or relationship assertions. `HttpClient` supplies cache, timeout, cancellation, bounded transport and retries. Add fixtures and failure tests. Keep pure matching logic in `src/core`, not UI templates. The CLI, questionnaire and JSON import all call `investigate`.
