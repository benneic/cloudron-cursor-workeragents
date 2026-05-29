# After install

1. Enable **self-hosted cloud agents** in your [Cursor Cloud Agents dashboard](https://cursor.com/agents).
2. Open **Configure** (`/admin`) on this app and sign in with your Cloudron account.
3. **Connect with Cursor** (browser sign-in) or paste an **API key** under Advanced.
4. Set your **repository URL**, branch/ref, optional **git token**, and **worker name** (defaults to this app’s subdomain).
5. Save settings—the worker restarts and registers with Cursor.
6. At [cursor.com/agents](https://cursor.com/agents), choose this machine from the environment dropdown.

## Multiple workers

Install the app again on another subdomain (e.g. `worker-2.yourdomain.com`). Each install needs its own Cursor auth and repository settings.

## Triggers

Use `worker=<name>` in Slack or GitHub (`@cursoragent worker=my-worker ...`) when the worker name matches. See [My Machines](https://cursor.com/docs/cloud-agent/my-machines).

## Backups

`/app/data` contains your Cursor login state, API keys, git clone, and caches. Treat backups as sensitive.

## Troubleshooting

- **Worker not in Cursor UI:** Check logs (`cloudron logs`), confirm auth and repo URL, ensure outbound HTTPS is allowed.
- **Private git repo:** Add a GitHub/GitLab personal access token in admin.
- **Browser tests fail:** Ensure the app has enough RAM; Chromium runs inside the container.
