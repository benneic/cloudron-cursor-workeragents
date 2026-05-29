#!/usr/bin/env bash
# Quick structural check for CloudronVersions.json (run before publishing).
set -euo pipefail
FILE="${1:-CloudronVersions.json}"
python3 - "$FILE" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
assert isinstance(data, dict), "root must be an object, not an array"
assert "versions" in data and isinstance(data["versions"], dict), "missing versions object"
assert len(data["versions"]) > 0, "versions must not be empty"
for ver, entry in data["versions"].items():
    m = entry.get("manifest") or {}
    assert m.get("dockerImage"), f"{ver}: manifest.dockerImage required"
    links = m.get("mediaLinks") or []
    assert len(links) > 0, f"{ver}: mediaLinks must not be empty"
    cl = m.get("changelog") or ""
    assert len(cl) >= 5, f"{ver}: changelog must be at least 5 characters"
print(f"OK: {path} ({len(data['versions'])} version(s))")
PY
