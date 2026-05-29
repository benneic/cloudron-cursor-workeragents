# Cursor Cloud Agent Worker for Cloudron

Run a [Cursor Cloud Agent](https://cursor.com/docs/cloud-agent/my-machines) worker on your Cloudron server so agents execute in your environment—your repos, tools, and network—while Cursor handles orchestration.

## Who this is for

- **Cursor Pro or Personal** with self-hosted cloud agents enabled
- **My Machines** workers (not Enterprise worker pools)
- One app install = one named worker (install multiple apps for `worker-1`, `worker-2`, etc.)

## What you get

- Pre-built image with Cursor CLI, Node.js, git, build tools, and Playwright/Chromium for browser automation
- Web UI at `/admin` (protected by Cloudron login) to connect Cursor via browser sign-in or API key
- Persistent workspace and credentials under `/app/data` (backed up with the app)

## Requirements

- Outbound HTTPS to `api2.cursor.sh`, `api2direct.cursor.sh`, and artifact upload hosts (see Cursor docs)
- At least **4 GB RAM** allocated to the app (8 GB for large monorepos)
- A git repository URL (HTTPS) the worker should clone

## Not included

- Enterprise `--pool` workers or service-account pools
- Slack/Linear/GitHub trigger APIs (use Cursor’s built-in integrations with `worker=<name>`)
