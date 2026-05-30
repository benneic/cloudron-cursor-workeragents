# cloudron-cursor-workeragents

[![Build and push image](https://github.com/benneic/cloudron-cursor-workeragents/actions/workflows/docker.yml/badge.svg)](https://github.com/benneic/cloudron-cursor-workeragents/actions/workflows/docker.yml)

Cloudron **community app** that runs a [Cursor Cloud Agent](https://cursor.com/docs/cloud-agent/my-machines) worker (Pro/Personal, **My Machines**) on your server.

Each install is one worker—use separate subdomains for `cursor-worker-1`, `cursor-worker-2`, etc.

## Install on Cloudron

1. In your Cloudron dashboard, go to **App Store → Add custom app → Community app** and add:

   ```
   https://raw.githubusercontent.com/benneic/cloudron-cursor-workeragents/main/CloudronVersions.json
   ```

2. Install **Cursor Cloud Agent Worker** from the App Store.
3. Open **Configure** (`/admin`), connect Cursor, and set your repository.

Or via CLI:

```bash
cloudron install --versions-url https://raw.githubusercontent.com/benneic/cloudron-cursor-workeragents/main/CloudronVersions.json
```

## Builds and container image

| Resource | Link |
|----------|------|
| **Build workflow** | [actions/workflows/docker.yml](https://github.com/benneic/cloudron-cursor-workeragents/actions/workflows/docker.yml) |
| **All Actions runs** | [actions](https://github.com/benneic/cloudron-cursor-workeragents/actions) |
| **Container package (GHCR)** | [pkgs/container/cloudron-cursor-workeragents](https://github.com/benneic/cloudron-cursor-workeragents/pkgs/container/cloudron-cursor-workeragents) |

Images are built when a **version tag** is pushed (e.g. `v1.0.1`), not on every commit to `main`:

- `ghcr.io/benneic/cloudron-cursor-workeragents:<semver>`
- `ghcr.io/benneic/cloudron-cursor-workeragents:latest` (updated on each release)

To release: see [.cursor/skills/release/SKILL.md](.cursor/skills/release/SKILL.md).

## Features

- **Cursor auth:** browser device flow (`agent login`) or API key via `/admin`
- **Repository:** clone/update HTTPS git repo into persistent `/app/data/workspace`
- **Toolchain:** Cursor CLI, Node 20, git, build-essential, Playwright/Chromium
- **Security:** Cloudron `proxyAuth` on `/admin` only; public `/healthz` and status `/`

## Requirements

- Cursor **Pro+** with self-hosted agents enabled
- Cloudron **9.1.0+**
- **4 GB+** app memory recommended

## Documentation

- [DESCRIPTION.md](DESCRIPTION.md) — app store description
- [POSTINSTALL.md](POSTINSTALL.md) — setup checklist
- [Cursor My Machines](https://cursor.com/docs/cloud-agent/my-machines)

## License

MIT — see [LICENSE](LICENSE).
