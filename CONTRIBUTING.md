# Contributing

Issues and pull requests are welcome at [github.com/benneic/cloudron-cursor-workeragents](https://github.com/benneic/cloudron-cursor-workeragents).

## Development

1. Clone the repository.
2. Test packaging with `cloudron install` on a Cloudron server (builds from source) or pull the GHCR image.
3. Docker build locally: `docker build -f Dockerfile.cloudron -t cloudron-cursor-workeragents .`

## Releases

1. Bump `version` in `CloudronManifest.json` and `CHANGELOG`.
2. Merge to `main` — GitHub Actions publishes `ghcr.io/benneic/cloudron-cursor-workeragents:latest`.
3. Update `CloudronVersions.json` with the new version entry (prefer `cloudron versions add` after build, or run `./scripts/validate-versions-json.sh`).

`CloudronVersions.json` must be an object `{ "stable": true, "versions": { "1.0.0": { ... } } }`, not a JSON array. Put `dockerImage` inside each version’s `manifest`, and include at least one `mediaLinks` URL.
