# Project website

The public project page is `website/index.html`, intended for **https://phomber.s41r4j.in/**. All CSS, the logo and the optional copy-button JavaScript are inline. It works without a build, external assets, analytics or a backend. Commands remain selectable when JavaScript or clipboard access is unavailable. The page describes Gen2 **0.0.1** and the active npm runtime; it does not expose investigation data.

Open `website/index.html` directly in a browser to preview it. Run `npm run check:site` to validate the version, domain, internal anchors, copy targets and public file allowlist. Update the visible version and `phomber-version` meta tag with future releases. This check runs in the release checks and the Pages workflow.

The page uses a light-only, encyclopedia-inspired layout: a contents sidebar, serif article headings, a searchable command reference, npm/NPX setup selection and native FAQs. There is no dark theme or color-mode switch. It is a single HTML page with section navigation, not a multi-page site.

The evidence atlas is an inline Canvas illustration of a rotating 3D wireframe globe and source connections. It is conceptual and contains no investigation data. It runs at a bounded drawing rate, caps pixel density, pauses when offscreen or the page is hidden, supports a visible pause/play control and respects reduced-motion preferences by default. A static inline SVG remains available when JavaScript or Canvas is unavailable. Copy buttons have a selection fallback, and the complete command table and npm instructions remain readable without JavaScript.

Earlier designs remain outside the published folder and npm package:

- `backups/website/index-before-details-0.0.1.html`: original light landing page, preserved byte-for-byte.
- `backups/website/index-dark-0.0.1.html`: the later dark design, preserved before the encyclopedia redesign.

Open either backup to compare, or copy it over `website/index.html` to restore that design. Old branding in a backup is intentionally preserved. The public Details page and supplied screenshot informed the earlier design; no private Details library assets or code were used.

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

DNS, GitHub Pages settings and live deployment are external setup steps. Preparing this checkout does not perform them. npm installation examples become available after the maintainer publishes the package; see [RELEASING.md](RELEASING.md).
