---
name: release
description: >-
  Release a new version of this Cloudron community app. Use when the user asks to
  "release a new version", "bump version", "tag release", "publish to Cloudron",
  "update CloudronVersions.json", or ship a semver update to GHCR and the
  community catalog.
---

# Release a new Cloudron package version

This repo publishes a **Cloudron community app**. Docker images are built **only when a version tag is pushed** (`v1.0.1`), not on every commit to `main`. Cloudron discovers updates from **`CloudronVersions.json`**, not from GHCR alone.

## When to release

- User-facing packaging or app changes that Cloudron users should install or update to.
- Do **not** bump version for docs-only or CI-only commits unless the user asks.

## Version format

- **Package version:** semver in `CloudronManifest.json` (`1.0.1`).
- **Git tag:** `v` + same semver (`v1.0.1`). Tag must match manifest or CI fails.
- **Docker image:** `ghcr.io/benneic/cloudron-cursor-workeragents:<semver>` (no `v` prefix).

## Release checklist (execute in order)

### 1. Bump manifest and changelog

- Set `version` in [CloudronManifest.json](../../CloudronManifest.json) to the new semver.
- Add a dated section in [CHANGELOG](../../CHANGELOG) describing the release.

### 2. Add catalog entry in CloudronVersions.json

Copy the previous entry under `versions` and update:

| Field | Action |
|-------|--------|
| Key under `versions` | New semver (e.g. `"1.0.1"`) |
| `manifest.version` | Same semver |
| `manifest.dockerImage` | `ghcr.io/benneic/cloudron-cursor-workeragents:<semver>` |
| `manifest.changelog` | Inline bullet list for this release (min 5 chars) |
| `creationDate` / `ts` | Current GMT, e.g. `Thu, 29 May 2026 12:00:00 GMT` |
| `publishState` | `"published"` |

**Do not** edit an existing published version entry in place. Add a new key; [revoke](https://docs.cloudron.io/packaging/publishing/) only if a bad release must be pulled.

**Critical:** addon key is **`proxyAuth`** (camelCase), not `proxyauth`.

### 3. Validate

```bash
./scripts/validate-versions-json.sh
```

Fix any `@cloudron/manifest-format` errors before committing.

### 4. Commit and push to main

Single commit on `main` with manifest, CHANGELOG, and CloudronVersions.json updates.

### 5. Tag and push (triggers GHCR build)

```bash
VERSION=$(node -p "require('./CloudronManifest.json').version")
git tag "v${VERSION}"
git push origin "v${VERSION}"
```

Or: `git push origin v1.0.1`

Watch [Actions](https://github.com/benneic/cloudron-cursor-workeragents/actions/workflows/docker.yml) until the build succeeds and GHCR has `:<semver>`.

### 6. Verify for Cloudron users

- Community URL (unchanged):  
  `https://raw.githubusercontent.com/benneic/cloudron-cursor-workeragents/main/CloudronVersions.json`
- GHCR package must be **public** (or users need registry credentials).
- Existing installs see the update when their Cloudron refreshes the catalog.

## Optional: Cloudron CLI

If `cloudron` CLI is available and logged in after the image exists:

```bash
cloudron versions add
```

Still commit the resulting `CloudronVersions.json`. Prefer the manual catalog edit in step 2 when CI builds the image from tags.

## Manual / emergency build

[workflow_dispatch](https://github.com/benneic/cloudron-cursor-workeragents/actions/workflows/docker.yml) builds from current `main` without a tag. Use only for debugging; normal releases always use tags.

## Do not

- Bump `CloudronVersions.json` without bumping `CloudronManifest.json` version.
- Push a tag whose `vX.Y.Z` does not match `CloudronManifest.json`.
- Rely on `:latest` alone for Cloudron updates — the catalog semver key is what triggers updates.
- Change `dockerImage` on an already-published version entry users may have installed.
