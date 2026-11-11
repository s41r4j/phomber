# Publishing PH0MBER

The current release is the `4.0.0-gen2.0` beta. `package.json` sets the public npm registry, public access and the `beta` dist-tag, so the maintainer can publish with `npm publish`.

## Before publishing

1. Commit the intended source, lockfile, tests and workflow. Keep local reports, credentials and personal `references/` out of Git.
2. Push the release commit to GitHub and wait for **Gen2 checks** to pass on Node 22 and 24 on Linux, macOS and Windows.
3. Run `npm ci`, then `npm run release:check`. The check typechecks, builds, tests, packs, installs into a temporary consumer project, and exercises the installed CLI, offline reports and localhost dashboard. It needs npm registry access to install dependencies and permission to bind a loopback port. It does not use AI, private profiles or API keys.
4. Run `npm audit --omit=dev`. This sends production dependency metadata to npm for advisory checking.
5. Run `npm whoami` to verify the publishing account. If necessary, run `npm login`. Verify that this account is permitted to publish `phomber`; E404 from `npm view phomber` is not proof of name availability or ownership.
6. Run `npm publish --dry-run` to inspect the final package. This also runs the release checks. Review the output before the real publication.

## Publish manually

```sh
npm publish
```

The `prepublishOnly` hook runs `release:check` before publication. Do not use `--ignore-scripts` to bypass it. npm may require the maintainer's interactive authentication or two-factor approval. This repository has no automatic publishing workflow and does not store npm credentials.

The beta becomes available through:

```sh
npx phomber@beta help
npm install -g phomber@beta
```

Publishing to `beta` does not set the `latest` dist-tag. Use the explicit beta installation commands until a stable release is published. A published name/version cannot be reused; bump the version for subsequent releases and update the lockfile with `npm install --package-lock-only`.

## Package contents

The tarball includes compiled code, its TypeScript source, build/check scripts, schemas, examples, public documentation and the license. Builds remove `dist/` first so deleted source files cannot survive as stale packaged JavaScript. Runtime installation does not run a build or require development dependencies.

Personal wiki archives, local reports, credentials, tests and internal implementation notes are excluded. The original Python ZIP and its checksum remain in the Git repository; npm includes only the legacy download guide. The optional local collection checksum test is skipped in clean clones without that private collection; portable archive parsing, validation, rendering and import tests always run.

## Stable release

When a stable release is intended, select a stable version and explicitly change `publishConfig.tag` to `latest`, update the lockfile and documentation, and rerun the release checks. The beta tag is intentional for the current Gen2 prerelease.
