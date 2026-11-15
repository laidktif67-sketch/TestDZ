#!/usr/bin/env bash
# Termux-friendly static preflight for TestDZ.
# This does NOT start Docker, connect to Supabase, or execute SQL.
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: run this script from inside a cloned TestDZ Git repository." >&2
  exit 2
}
cd "$ROOT"

errors=0
warnings=0

ok()   { printf 'PASS  %s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*" >&2; errors=$((errors + 1)); }
warn() { printf 'WARN  %s\n' "$*"; warnings=$((warnings + 1)); }

echo "TestDZ local preflight (static checks only)"
echo "Repository: $ROOT"
echo

for cmd in git bash python3; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "required command available: $cmd"
  else
    fail "required command missing: $cmd"
  fi
done

if git diff --check; then
  ok "git diff --check"
else
  fail "git diff --check"
fi

if [ -d supabase/tests ]; then
  shell_count=0
  while IFS= read -r -d '' file; do
    shell_count=$((shell_count + 1))
    if bash -n "$file"; then
      ok "shell syntax: $file"
    else
      fail "shell syntax: $file"
    fi
  done < <(find supabase/tests -type f -name '*.sh' -print0 | sort -z)
  if [ "$shell_count" -eq 0 ]; then
    warn "no shell test scripts found under supabase/tests"
  fi
else
  fail "supabase/tests directory missing"
fi

python3 - <<'PY'
from pathlib import Path
import re
import sys

root = Path.cwd()
errors = 0
migrations = sorted((root / "supabase" / "migrations").glob("*.sql"))
tests = sorted((root / "supabase" / "tests").glob("*.test.sql"))

if not migrations:
    print("FAIL  no migration SQL files found")
    errors += 1
else:
    seen = {}
    for path in migrations:
        match = re.match(r"^(\d{14})_.+\.sql$", path.name)
        if not match:
            print(f"FAIL  migration filename does not match YYYYMMDDHHMMSS_name.sql: {path.relative_to(root)}")
            errors += 1
            continue
        stamp = match.group(1)
        if stamp in seen:
            print(f"FAIL  duplicate migration timestamp {stamp}: {seen[stamp]} and {path.name}")
            errors += 1
        seen[stamp] = path.name
    if errors == 0:
        print(f"PASS  migration filenames/timestamps: {len(migrations)} files")

if not tests:
    print("WARN  no pgTAP *.test.sql files found")
else:
    for path in tests:
        text = path.read_text(encoding="utf-8")
        # Remove comments so commented examples do not satisfy the harness check.
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        text = re.sub(r"--[^\n]*", "", text)
        plans = re.findall(r"\bselect\s+plan\s*\(\s*\d+\s*\)\s*;", text, flags=re.I)
        finishes = re.findall(r"\bselect\s+\*\s+from\s+finish\s*\(\s*\)\s*;", text, flags=re.I)
        if len(plans) != 1:
            print(f"FAIL  {path.relative_to(root)} must contain exactly one SELECT plan(N); (found {len(plans)})")
            errors += 1
        elif len(finishes) != 1:
            print(f"FAIL  {path.relative_to(root)} must contain exactly one SELECT * FROM finish(); (found {len(finishes)})")
            errors += 1
        else:
            print(f"PASS  pgTAP harness markers: {path.relative_to(root)}")

sys.exit(1 if errors else 0)
PY
py_status=$?
if [ "$py_status" -ne 0 ]; then
  fail "migration/pgTAP static checks"
else
  ok "migration/pgTAP static checks"
fi

echo
echo "IMPORTANT: these checks do not parse or execute SQL and do not prove database behavior."
echo "Database integration tests still require a running local Supabase/Postgres test environment."
echo "This script does not run GitHub Actions, Docker, Supabase CLI, or contact any remote database."
echo
printf 'Summary: %s error(s), %s warning(s)\n' "$errors" "$warnings"
[ "$errors" -eq 0 ]
