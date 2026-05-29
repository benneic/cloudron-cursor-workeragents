#!/usr/bin/env bash
# Validate CloudronVersions.json using @cloudron/manifest-format (same as Cloudron box).
set -euo pipefail
FILE="${1:-CloudronVersions.json}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$FILE" ]]; then
  echo "Missing $FILE" >&2
  exit 1
fi

if [[ -d node_modules/@cloudron/manifest-format ]]; then
  MF="node_modules/@cloudron/manifest-format"
elif command -v npm >/dev/null 2>&1; then
  npm install --no-save @cloudron/manifest-format@6 >/dev/null 2>&1
  MF="node_modules/@cloudron/manifest-format"
else
  echo "npm required to run full validation" >&2
  exit 1
fi

node --input-type=module -e "
import mf from './${MF}/index.js';
import fs from 'fs';
const v = JSON.parse(fs.readFileSync('${FILE}', 'utf8'));
const err = mf.parseVersions(v);
if (err) {
  console.error('INVALID:', err.message);
  process.exit(1);
}
for (const ver of Object.keys(v.versions)) {
  const m = v.versions[ver].manifest;
  const e2 = mf.checkVersionsRequirements(m);
  if (e2) {
    console.error('INVALID manifest', ver + ':', e2.message);
    process.exit(1);
  }
}
console.log('OK:', '${FILE}', '(' + Object.keys(v.versions).length + ' version(s))');
"
