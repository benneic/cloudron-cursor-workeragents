#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="${CONFIG_PATH:-/app/data/config.json}"
WORKER_DIR="/app/data/workspace"
HEARTBEAT="/app/data/worker-heartbeat.json"
AGENT_BIN="${AGENT_BIN:-/usr/local/bin/agent}"
CLOUDRON_HOME="/app/data"

log() {
  echo "[worker-wrapper] $*" >&2
}

write_heartbeat() {
  local state="$1"
  local detail="${2:-}"
  printf '{"state":"%s","detail":"%s","at":"%s"}\n' \
    "$state" "$detail" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$HEARTBEAT"
  chown cloudron:cloudron "$HEARTBEAT" 2>/dev/null || true
}

if [[ ! -f "$CONFIG_PATH" ]]; then
  log "No config at $CONFIG_PATH — worker idle"
  write_heartbeat "idle" "not_configured"
  sleep 30
  exit 0
fi

eval "$(python3 - "$CONFIG_PATH" <<'PY'
import json, shlex, sys
c = json.load(open(sys.argv[1]))
def emit(k, v):
    print(f"{k}={shlex.quote(str(v or ''))}")
emit("AUTH_METHOD", c.get("authMethod"))
emit("CURSOR_API_KEY", c.get("cursorApiKey"))
emit("TARGET_REPOSITORY", c.get("targetRepository"))
emit("TARGET_REF", c.get("targetRef"))
emit("GIT_TOKEN", c.get("gitToken"))
emit("WORKER_NAME", c.get("workerName"))
PY
)"

if [[ -z "${TARGET_REPOSITORY:-}" ]]; then
  log "targetRepository not set"
  write_heartbeat "idle" "missing_repository"
  sleep 30
  exit 0
fi

if [[ "$AUTH_METHOD" != "oauth" && -z "${CURSOR_API_KEY:-}" ]]; then
  log "Cursor not authenticated (set OAuth or API key)"
  write_heartbeat "idle" "not_authenticated"
  sleep 30
  exit 0
fi

if [[ -z "${WORKER_NAME:-}" ]]; then
  WORKER_NAME="${CLOUDRON_APP_LOCATION:-cursor-worker}"
fi

GIT_USERNAME="${CURSOR_GIT_USERNAME:-x-access-token}"

configure_git_auth() {
  if [[ -z "${GIT_TOKEN:-}" ]]; then
    return
  fi
  if [[ "$TARGET_REPOSITORY" != https://* ]]; then
    log "GIT_TOKEN supports HTTPS repository URLs only"
    write_heartbeat "error" "git_https_required"
    sleep 60
    exit 0
  fi
  local repo_host
  repo_host="$(printf '%s' "$TARGET_REPOSITORY" | sed -E 's#https?://([^/]+)/.*#\1#')"
  gosu cloudron:cloudron env HOME="$CLOUDRON_HOME" git config --global \
    "url.https://${GIT_USERNAME}:${GIT_TOKEN}@${repo_host}/.insteadOf" \
    "https://${repo_host}/"
}

git_fail() {
  local err="$1"
  log "Git error: $err"
  if grep -qiE '403|401|authentication|not granted|permission denied|invalid username|password' <<<"$err"; then
    write_heartbeat "error" "git_auth_failed"
  elif [[ -z "${GIT_TOKEN:-}" ]]; then
    write_heartbeat "error" "git_token_required"
  else
    write_heartbeat "error" "git_clone_failed"
  fi
  sleep 60
  exit 0
}

run_git() {
  local err_file
  err_file="$(mktemp)"
  if ! gosu cloudron:cloudron env HOME="$CLOUDRON_HOME" "$@" 2>"$err_file"; then
    cat "$err_file" >&2
    git_fail "$(cat "$err_file")"
  fi
  rm -f "$err_file"
}

clone_or_update_repo() {
  if [[ ! -d "$WORKER_DIR/.git" ]]; then
    rm -rf "$WORKER_DIR"
    run_git git clone "$TARGET_REPOSITORY" "$WORKER_DIR"
  else
    run_git git -C "$WORKER_DIR" remote set-url origin "$TARGET_REPOSITORY"
    run_git git -C "$WORKER_DIR" fetch origin --tags --prune
  fi
  if [[ -n "${TARGET_REF:-}" ]]; then
    run_git git -C "$WORKER_DIR" fetch origin "$TARGET_REF" --depth 1
    run_git git -C "$WORKER_DIR" checkout --detach FETCH_HEAD
  fi
}

configure_git_auth
log "Syncing repository $TARGET_REPOSITORY"
clone_or_update_repo

write_heartbeat "starting" "agent_worker_start"

declare -a WORKER_ARGS
WORKER_ARGS=(worker start --worker-dir "$WORKER_DIR" --name "$WORKER_NAME" --management-addr "127.0.0.1:8081")

if [[ "$AUTH_METHOD" == "api_key" && -n "${CURSOR_API_KEY:-}" ]]; then
  WORKER_ARGS+=(--api-key "$CURSOR_API_KEY")
fi

log "Starting agent worker as $WORKER_NAME"
write_heartbeat "running" "$WORKER_NAME"

exec gosu cloudron:cloudron env \
  HOME="$CLOUDRON_HOME" \
  PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/app/code/playwright-browsers}" \
  "$AGENT_BIN" "${WORKER_ARGS[@]}"
