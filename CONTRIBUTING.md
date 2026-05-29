# Contributing

Issues and pull requests are welcome at [github.com/benneic/cloudron-cursor-workeragents](https://github.com/benneic/cloudron-cursor-workeragents).

## Development

1. Clone the repository.
2. Test packaging with `cloudron install` on a Cloudron server (builds from source) or pull the GHCR image.
3. Docker build locally: `docker build -f Dockerfile.cloudron -t cloudron-cursor-workeragents .`

Pushes to `main` do **not** build or publish Docker images. Images are produced only when a version tag is pushed (see Releases).

## Releases

Follow [.cursor/skills/release/SKILL.md](.cursor/skills/release/SKILL.md) when cutting a release. Summary:

1. Bump `version` in `CloudronManifest.json` and `CHANGELOG`.
2. Add a new semver entry to `CloudronVersions.json` (copy prior version; update `dockerImage`, inline `changelog`, dates).
3. Run `./scripts/validate-versions-json.sh`.
4. Commit and push to `main`.
5. Tag and push: `git tag v1.0.1 && git push origin v1.0.1` — this triggers GHCR build.

`CloudronVersions.json` must be an object `{ "stable": true, "versions": { "1.0.0": { ... } } }`, not a JSON array. Put `dockerImage` inside each version’s `manifest`, include at least one `mediaLinks` URL, and use addon key **`proxyAuth`** (camelCase — `proxyauth` fails Cloudron validation).
