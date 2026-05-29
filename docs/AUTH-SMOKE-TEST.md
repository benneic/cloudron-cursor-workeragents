# Cursor CLI auth smoke test

Run inside the built container (or after `cloudron exec`):

```bash
export HOME=/app/data
export NO_OPEN_BROWSER=1
gosu cloudron:cloudron agent login
```

**Expected:** stdout/stderr includes an `https://` authorization URL (and optionally a device code), without `spawn xdg-open ENOENT`.

**Verify auth:**

```bash
gosu cloudron:cloudron env HOME=/app/data agent status
```

If device flow fails in your environment, use the **API key** path in `/admin` (Advanced).

CI does not run interactive login; validate manually on first image deploy.
