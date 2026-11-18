# Publishing PH0MBER

The prepared release is **Gen2 version `0.0.1`**, package name **`phomber`**. Generation is the product label; the npm version is `0.0.1`. `package.json` sets the public npm registry, public access and the `latest` dist-tag. The project `.npmrc` sets `tag=latest` so the command defaults and manifest agree. The project homepage is **https://phomber.s41r4j.in/**. Preparing this checkout does not publish the package.

## Before publishing

1. Commit the intended source, lockfile, tests and workflow. Keep local reports, credentials and personal `references/` out of Git.
2. Push the release commit to GitHub and wait for **Gen2 checks** to pass on Node 22 and 24 on Linux, macOS and Windows.
3. Run `npm ci --ignore-scripts`, then `npm run release:check`. The check validates the standalone site, typechecks, builds, tests, packs, installs into a temporary consumer project, and exercises the installed CLI, offline reports and localhost dashboard. It also verifies matching manifest/lockfile/runtime versions, the npm tag and About-page website link. It needs npm registry access to install dependencies and permission to bind a loopback port. It does not use AI, private profiles or API keys.
4. Run `npm audit --omit=dev`. This sends production dependency metadata to npm for advisory checking.
5. Run `npm whoami` to verify the publishing account. If necessary, run `npm login`. Verify that this account is permitted to publish `phomber`; E404 from `npm view phomber` is not proof of name availability or ownership. Check `npm view phomber@0.0.1 version` to ensure that exact version is not already published.
6. Run `npm publish --dry-run` to inspect the final package. This also runs the release checks. Review the output before the real publication.

## Publish manually

```sh
npm publish
```

The `prepublishOnly` hook runs `release:check` before publication. Do not use `--ignore-scripts` to bypass it. npm may require the maintainer's interactive authentication or two-factor approval. This repository has no automatic publishing workflow and does not store npm credentials.

After successful publication, verify the package and use the simple commands:

```sh
npm view phomber@0.0.1 version dist.tarball
npx phomber@0.0.1 --version
npx phomber help
npm install -g phomber
phomber --version
phomber serve
```

The default `latest` tag makes `npx phomber` and `npm install -g phomber` resolve this release. A published name/version cannot be reused; bump the version for subsequent releases and update the lockfile with `npm install --package-lock-only`. See [npm's publication documentation](https://docs.npmjs.com/cli/v12/commands/npm-publish/).

## Package contents

The tarball includes compiled code, its TypeScript source, build/check scripts, schemas, examples, public documentation and the license. Builds remove `dist/` first so deleted source files cannot survive as stale packaged JavaScript. Runtime installation does not run a build or require development dependencies.

Personal wiki archives, local reports, credentials, tests and internal implementation notes are excluded. The public landing-page files stay in GitHub and are excluded from npm. The original Python ZIP and its checksum remain in the Git repository; npm includes only the legacy download guide. The optional local collection checksum test is skipped in clean clones without that private collection; portable archive parsing, validation, rendering and import tests always run.

## Website and subsequent releases

The single-file project site and GitHub Pages setup are described in [WEBSITE.md](WEBSITE.md). Configure the domain and publish the npm package before announcing the installation commands. DNS and Pages settings require the repository/domain owner's setup.

For the next release, update `package.json`, both root version entries in `package-lock.json`, the website's version meta tag and visible labels, the changelog and relevant documentation. Runtime version output, the HTTP user agent and the wiki About page read package metadata automatically. Rerun the full release checks. Use a prerelease version and a non-`latest` tag only if intentionally creating a separate preview channel.
