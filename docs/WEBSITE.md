# Project website

[Documentation index](README.md) · [Project guide](../README.md)

The public project page is `website/index.html`, intended for **https://phomber.s41r4j.in/**. CSS, the logo and the page scripts are inline. It works without a build, external assets, analytics or a backend. Commands remain selectable when JavaScript or clipboard access is unavailable. The page describes Gen2 **0.0.2** and the active npm runtime; it does not expose investigation data.

Open `website/index.html` directly in a browser to preview it. Run `npm run check:site` to validate the version, domain, internal anchors, copy targets and public file allowlist. Update the visible version and `phomber-version` meta tag with future releases. This check runs in the release checks and the Pages workflow.

The page uses a light-only, encyclopedia-inspired layout: a contents sidebar, serif article headings, a searchable command reference, npm/NPX setup selection and native FAQs. There is no dark theme or color-mode switch. It is one deployable HTML file with separate client-side views: Overview, Getting started, Command reference, Evidence and identity, Common questions, Planned work, About/release and Search. The interface switches views instead of showing the full guide as one long page. Search and an unknown-page view are also handled inside that same file. Hash URLs such as `#/guide`, `#/commands` and `#/search?q=delete%20report` work on static GitHub Pages without server rewrites. Old `#start`, `#commands` and other section bookmarks still work. Browser Back/Forward restores views and searches; query links open the exact topic or FAQ answer.

The header includes a GitHub star badge between the repository link and version badge. On each page load it requests the public repository star count from GitHub, without credentials or a referrer, with a six-second timeout. If JavaScript is disabled, GitHub is unavailable or the API rate limit is reached, the badge remains a working Stars link instead of displaying an invented count.

The evidence atlas is an inline Canvas illustration of a rotating 3D wireframe globe and source connections. It is conceptual and contains no investigation data. It runs at a bounded drawing rate, caps pixel density, pauses when offscreen or the page is hidden, supports a visible pause/play control and respects reduced-motion preferences by default. A static inline SVG remains available when JavaScript or Canvas is unavailable. Copy buttons have a selection fallback. Without JavaScript, all guide views remain readable in one document, plain section links still work and browser Find is the search fallback. The live routing/search interface requires JavaScript.

Earlier designs remain outside the published folder and npm package:

- `backups/website/index-before-site-navigation-0.0.2.html`: the light single-page guide preserved before the multi-view/search update.
- `backups/website/index-before-details-0.0.1.html`: earlier light landing-page layout.
- `backups/website/index-dark-0.0.1.html`: the later dark design, preserved before the encyclopedia redesign.

Open either backup to compare, or copy it over `website/index.html` to restore that design. Backups preserve earlier layouts and historical version labels; punctuation and license labels have received project-wide corrections. They are design references, not byte-for-byte snapshots of the original files. The public Details page and supplied screenshot informed the earlier design; no private Details library assets or code were used.

## GitHub Pages setup

The `Project website` workflow validates and uploads only `website/`, then deploys with the official Pages actions. It runs on relevant pushes to `main` or manual dispatch. It does not upload the repository root, `.phomber/`, reports, references or credentials. It does not publish npm packages.

One-time configuration by the repository/domain owner:

1. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. Set the custom domain to **phomber.s41r4j.in** in Pages settings.
3. After claiming the custom domain in GitHub, configure DNS for `s41r4j.in`: **CNAME**, name **phomber**, target **s41r4j.github.io**. Do not include `/phomber` in the target.
4. Push the intended website/workflow changes or manually run **Project website**. Once DNS validation and certificate issuance complete, enable **Enforce HTTPS** in Pages settings.

`website/CNAME` records the intended domain and supports branch-based hosting if used later. For an Actions deployment, GitHub's custom-domain setting is authoritative; the file alone does not configure the domain. See [GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) and [Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Separate local wiki

`phomber serve` serves the investigator's workspace on localhost. Its About page points to the public project website and reads the version from `package.json`. Hosting the project guide on Pages does not publish the investigator's wiki or run a public investigation service.

GitHub Pages deploys the project guide separately from the npm package. Registry install commands resolve the version published on npm. See [the release checklist](RELEASING.md).

## Current command guide

Public examples use `phomber find` for guided research and `phomber find "Full Name"` for positional input. `phomber reports` prints a readable list; `phomber serve` prints the local wiki URL and accepts optional `--open`. The older research verb is documented only in the migration guide. The header searches site content rather than filtering only command rows. A separate input filters the command table. Both use the same inline engine for ranked exact matches, prefixes, word forms, curated related terms and bounded typo correction. Examples: `servr` finds `serve`, `remove report` finds confirmed deletion, and `comapny` finds the company roadmap. Short two-character tokens such as `ip` are not fuzzy matched. All meaningful query words must match; suggestions and a clear empty state help when nothing fits.

The local index includes the setup guide, command examples, FAQ questions/answers, evidence/matching explanations, PDF notes, roadmap and About text. Results show their page/type and identify planned work explicitly. A matching query does not turn a roadmap item into an available feature. Query text is rendered using text nodes; no query text is inserted as HTML. Queries stay in the browser hash and are not sent to a research API or used to query private workspace reports. The optional GitHub star request is independent of search.

## Local verification

```sh
npm run check:site
node --test tests/website.test.mjs
python3 -m http.server 54809 --bind 127.0.0.1 --directory website
```

Open `http://127.0.0.1:54809/` for the preview. The regression tests execute the actual inline search engine against page content and check ranking, typo/related-word matching, planned-feature discovery, bounded inputs and route parsing. Browser checks cover exact result links, expanded FAQ answers, navigation/history, command filtering and responsive overflow. The source change stays local until an explicit GitHub push/deployment.
