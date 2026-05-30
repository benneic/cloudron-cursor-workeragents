"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.httpPort || process.env.HTTP_PORT || 8000);
const CONFIG_PATH = process.env.CONFIG_PATH || "/app/data/config.json";
const DATA_DIR = process.env.DATA_DIR || "/app/data";
const SUPERVISOR_SOCK = process.env.SUPERVISOR_SOCK || "unix:///run/supervisor.sock";
const CURSOR_SETTINGS_URL = "https://cursor.com/dashboard?tab=integrations";
const AGENT_BIN = process.env.AGENT_BIN || "/usr/local/bin/agent";

let loginProcess = null;
let loginOutput = "";

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, CONFIG_PATH);
  try {
    execFile("chown", ["cloudron:cloudron", CONFIG_PATH], () => {});
  } catch {
    /* ignore */
  }
}

function defaultConfig() {
  return {
    authMethod: null,
    cursorApiKey: null,
    targetRepository: "",
    targetRef: "main",
    gitToken: "",
    workerName: process.env.CLOUDRON_APP_LOCATION || "cursor-worker",
  };
}

function mergeConfig(partial) {
  const base = readConfig() || defaultConfig();
  return { ...base, ...partial };
}

function redactConfig(config) {
  if (!config) return null;
  return {
    authMethod: config.authMethod,
    hasApiKey: Boolean(config.cursorApiKey),
    targetRepository: config.targetRepository || "",
    targetRef: config.targetRef || "",
    hasGitToken: Boolean(config.gitToken),
    workerName: config.workerName || "",
  };
}

async function runAsCloudron(subcommand, args, options = {}) {
  const fullArgs = ["cloudron:cloudron", AGENT_BIN, subcommand, ...args];
  return execFileAsync("gosu", fullArgs, {
    env: {
      ...process.env,
      HOME: DATA_DIR,
      NO_OPEN_BROWSER: "1",
      PLAYWRIGHT_BROWSERS_PATH:
        process.env.PLAYWRIGHT_BROWSERS_PATH || "/app/code/playwright-browsers",
      ...options.env,
    },
    timeout: options.timeout || 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

async function agentStatus() {
  const config = readConfig();
  if (config?.authMethod === "api_key" && config?.cursorApiKey) {
    return { ok: true, stdout: "Authenticated via API key (config.json)." };
  }
  try {
    const { stdout } = await runAsCloudron("status", [], { timeout: 15000 });
    return { ok: true, stdout: stdout.trim() };
  } catch (err) {
    return { ok: false, stderr: (err.stderr || err.message || "").toString().trim() };
  }
}

function parseLoginOutput(text) {
  const linkLine =
    text.match(/navigate to this link:\s*(https:\/\/\S+)/i) ||
    text.match(/open[^\n]*?(https:\/\/\S+)/i);
  const urlMatch =
    linkLine ||
    text.match(/https:\/\/cursor\.com\/\S+/i) ||
    text.match(/https:\/\/[^\s\]"')]+/i);
  const codeMatch =
    text.match(/code[:\s]+([A-Z0-9-]{4,})/i) ||
    text.match(/device[^\n]*?([A-Z0-9]{4}-[A-Z0-9]{4})/i);
  const url = urlMatch
    ? (urlMatch[1] || urlMatch[0]).replace(/[)\],.'"']+$/, "")
    : null;
  return {
    url,
    code: codeMatch ? codeMatch[1] : null,
    raw: text.slice(-8000),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLoginUrl(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = parseLoginOutput(loginOutput);
    if (info.url) return info;
    if (!loginProcess && loginOutput.length > 0) break;
    await sleep(300);
  }
  return parseLoginOutput(loginOutput);
}

function restartWorker() {
  return execFileAsync("supervisorctl", ["-s", SUPERVISOR_SOCK, "restart", "worker"], {
    timeout: 30000,
  });
}

function readHeartbeat() {
  const p = path.join(DATA_DIR, "worker-heartbeat.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

async function checkWorkerManagement() {
  try {
    const res = await fetch("http://127.0.0.1:8081/healthz", { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a; }
    body { max-width: 42rem; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.35rem; }
    label { display: block; margin-top: 1rem; font-weight: 600; }
    input[type=text], input[type=password], input[type=url] { width: 100%; padding: 0.5rem; box-sizing: border-box; }
    button, .btn { margin-top: 0.75rem; margin-right: 0.5rem; padding: 0.5rem 1rem; cursor: pointer; }
    .muted { color: #555; font-size: 0.9rem; }
    .ok { color: #0a6; }
    .warn { color: #a60; }
    .err { color: #c33; }
    pre { background: #f4f4f4; padding: 0.75rem; overflow: auto; font-size: 0.8rem; }
    details { margin-top: 1rem; }
    .card { border: 1px solid #ddd; border-radius: 6px; padding: 1rem; margin: 1rem 0; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

async function renderStatusPage() {
  const config = readConfig();
  const redacted = redactConfig(config);
  const heartbeat = readHeartbeat();
  const auth = await agentStatus();
  const mgmt = await checkWorkerManagement();
  const configured =
    config &&
    config.targetRepository &&
    (config.authMethod === "oauth" || config.cursorApiKey);

  const authLine = config?.authMethod === "oauth"
    ? '<span class="ok">Cursor: signed in (browser)</span>'
    : config?.authMethod === "api_key"
      ? '<span class="ok">Cursor: API key configured</span>'
      : '<span class="warn">Cursor: not authenticated</span>';

  return htmlPage(
    "Cursor Worker",
    `<h1>Cursor Cloud Agent Worker</h1>
<p class="muted">Self-hosted worker for Cursor Pro/Personal (My Machines).</p>
<ul>
  <li>${authLine}</li>
  <li>Repository: ${redacted?.targetRepository ? escapeHtml(redacted.targetRepository) : "<em>not set</em>"}</li>
  <li>Worker name: ${escapeHtml(redacted?.workerName || "—")}</li>
  <li>Worker process: ${heartbeat ? escapeHtml(heartbeat.state) : "unknown"}${mgmt ? ' <span class="ok">(management OK)</span>' : ""}</li>
</ul>
<p><a class="btn" href="/admin">Configure</a></p>
<p class="muted">Admin settings are protected by Cloudron login at <code>/admin</code>.</p>`
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderAdminPage(message = "", messageClass = "") {
  const config = readConfig() || defaultConfig();
  const auth = await agentStatus();
  const loginInfo = parseLoginOutput(loginOutput);

  const msg = message
    ? `<p class="${messageClass}">${escapeHtml(message)}</p>`
    : "";

  const oauthSection =
    config.authMethod === "oauth"
      ? `<p class="ok">Connected via browser sign-in.</p>
         <form method="post" action="/admin/disconnect"><button type="submit">Disconnect Cursor</button></form>`
      : `<form method="post" action="/admin/connect">
           <button type="submit">Connect with Cursor</button>
         </form>
         <p class="muted">Opens Cursor sign-in in your browser (device flow). Complete login there, then return here.</p>
         <div id="login-link-area">
         ${loginProcess ? `<p class="warn">Login in progress…</p>` : ""}
         ${loginInfo.url ? `<p><a class="btn" href="${escapeHtml(loginInfo.url)}" target="_blank" rel="noopener">Open Cursor sign-in</a></p>` : ""}
         ${loginInfo.code ? `<p>Device code: <strong>${escapeHtml(loginInfo.code)}</strong></p>` : ""}
         ${!loginInfo.url && (loginProcess || loginInfo.raw) ? `<p class="muted" id="login-wait-msg">Waiting for sign-in link from Cursor CLI…</p>` : ""}
         </div>
         <script>
         (function () {
           const area = document.getElementById("login-link-area");
           if (!area || area.querySelector("a.btn")) return;
           const poll = async () => {
             try {
               const r = await fetch("/admin/connect/status");
               const j = await r.json();
               if (j.login && j.login.url) {
                 const p = document.createElement("p");
                 const a = document.createElement("a");
                 a.className = "btn";
                 a.href = j.login.url;
                 a.target = "_blank";
                 a.rel = "noopener";
                 a.textContent = "Open Cursor sign-in";
                 p.appendChild(a);
                 area.replaceChildren(p);
                 if (j.login.code) {
                   const cp = document.createElement("p");
                   cp.innerHTML = "Device code: <strong></strong>";
                   cp.querySelector("strong").textContent = j.login.code;
                   area.appendChild(cp);
                 }
                 const done = document.createElement("p");
                 done.className = "muted";
                 done.textContent = "Complete login in that tab, then refresh this page.";
                 area.appendChild(done);
                 return;
               }
               if (!j.loginInProgress && j.login && j.login.raw) {
                 const wait = document.getElementById("login-wait-msg");
                 if (wait) wait.textContent = "No link yet. Refresh or use API key below.";
               }
             } catch (e) { /* ignore */ }
             setTimeout(poll, 800);
           };
           poll();
         })();
         </script>`;

  return htmlPage(
    "Admin — Cursor Worker",
    `<h1>Configuration</h1>
${msg}
<div class="card">
  <h2>Cursor account</h2>
  ${oauthSection}
  <details>
    <summary>Advanced: API key</summary>
    <form method="post" action="/admin/api-key">
      <label>API key
        <input type="password" name="cursorApiKey" autocomplete="off" placeholder="${config.cursorApiKey ? "••••••••" : "crsr_…"}" />
      </label>
      <p class="muted"><a href="${CURSOR_SETTINGS_URL}" target="_blank" rel="noopener">Create API key in Cursor dashboard</a></p>
      <button type="submit">Save API key</button>
    </form>
    ${config.authMethod === "api_key" ? `<form method="post" action="/admin/clear-api-key"><button type="submit">Clear API key</button></form>` : ""}
  </details>
  ${auth.ok ? `<pre>${escapeHtml(auth.stdout)}</pre>` : ""}
</div>
<div class="card">
  <h2>Repository</h2>
  <form method="post" action="/admin/save">
    <label>Repository URL (HTTPS)
      <input type="url" name="targetRepository" required value="${escapeHtml(config.targetRepository || "")}" placeholder="https://github.com/org/repo" />
    </label>
    <label>Branch / ref
      <input type="text" name="targetRef" value="${escapeHtml(config.targetRef || "main")}" />
    </label>
    <label>Git token (private repos)
      <input type="password" name="gitToken" autocomplete="off" placeholder="${config.gitToken ? "••••••••" : "optional"}" />
    </label>
    <label>Worker name (for worker= triggers)
      <input type="text" name="workerName" value="${escapeHtml(config.workerName || process.env.CLOUDRON_APP_LOCATION || "cursor-worker")}" />
    </label>
    <button type="submit">Save &amp; restart worker</button>
  </form>
</div>
<p class="muted"><a href="/">← Status</a></p>`
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseForm(body) {
  const params = new URLSearchParams(body);
  const out = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

async function startLogin() {
  if (loginProcess) return;
  loginOutput = "";
  loginProcess = spawn(
    "gosu",
    ["cloudron:cloudron", AGENT_BIN, "login"],
    {
      env: {
        ...process.env,
        HOME: DATA_DIR,
        NO_OPEN_BROWSER: "1",
      },
    }
  );
  loginProcess.stdout.on("data", (d) => {
    loginOutput += d.toString();
  });
  loginProcess.stderr.on("data", (d) => {
    loginOutput += d.toString();
  });
  loginProcess.on("close", () => {
    loginProcess = null;
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (req.method === "GET" && pathname === "/") {
      const html = await renderStatusPage();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && (pathname === "/admin" || pathname === "/admin/connect")) {
      const html = await renderAdminPage();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && pathname === "/admin/connect/status") {
      const auth = await agentStatus();
      const loginInfo = parseLoginOutput(loginOutput);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          authenticated:
            auth.ok &&
            !/not authenticated|login required/i.test(
              (auth.stdout || "") + (auth.stderr || "")
            ),
          loginInProgress: Boolean(loginProcess),
          login: loginInfo,
          agent: auth,
        })
      );
      return;
    }

    if (req.method === "POST" && pathname === "/admin/connect") {
      await startLogin();
      const auth = await agentStatus();
      if (auth.ok) {
        const cfg = mergeConfig({ authMethod: "oauth", cursorApiKey: null });
        writeConfig(cfg);
        await restartWorker().catch(() => {});
        const html = await renderAdminPage("Signed in with Cursor.", "ok");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      await waitForLoginUrl();
      const loginInfo = parseLoginOutput(loginOutput);
      const hint = loginInfo.url
        ? "Open the link below, complete login in your browser, then refresh this page."
        : "Sign-in started. Wait for the link below (or refresh in a few seconds), then complete login.";
      const html = await renderAdminPage(hint, loginInfo.url ? "ok" : "warn");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && pathname === "/admin/disconnect") {
      try {
        await runAsCloudron("logout", [], { timeout: 30000 });
      } catch {
        /* ignore */
      }
      const cfg = mergeConfig({ authMethod: null, cursorApiKey: null });
      writeConfig(cfg);
      await restartWorker().catch(() => {});
      const html = await renderAdminPage("Disconnected from Cursor.", "ok");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && pathname === "/admin/api-key") {
      const body = await readBody(req);
      const form = parseForm(body);
      if (!form.cursorApiKey) {
        const html = await renderAdminPage("API key is required.", "err");
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      const cfg = mergeConfig({
        authMethod: "api_key",
        cursorApiKey: form.cursorApiKey,
      });
      writeConfig(cfg);
      await restartWorker().catch(() => {});
      const html = await renderAdminPage("API key saved.", "ok");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && pathname === "/admin/clear-api-key") {
      const cfg = mergeConfig({ authMethod: null, cursorApiKey: null });
      writeConfig(cfg);
      await restartWorker().catch(() => {});
      const html = await renderAdminPage("API key cleared.", "ok");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && pathname === "/admin/save") {
      const body = await readBody(req);
      const form = parseForm(body);
      if (!form.targetRepository || !form.targetRepository.startsWith("https://")) {
        const html = await renderAdminPage("Repository URL must be HTTPS.", "err");
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      const existing = readConfig() || defaultConfig();
      const cfg = mergeConfig({
        targetRepository: form.targetRepository,
        targetRef: form.targetRef || "main",
        workerName: form.workerName || existing.workerName,
        gitToken: form.gitToken || existing.gitToken,
      });
      writeConfig(cfg);
      await restartWorker().catch(() => {});
      const html = await renderAdminPage("Settings saved. Worker restarted.", "ok");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  } catch (err) {
    console.error("[web]", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[web] listening on :${PORT}`);
});
