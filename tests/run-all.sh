#!/bin/bash
# Runs every tests/**/*.test.js one file at a time (fake Supabase only) and prints pass / fail per file and a total.
# Usage: tests/run-all.sh [folder-or-file ...]   (default: all).  Output of each file: /tmp/wpf-tests/<name>.log
cd "$(dirname "$0")/.." || exit 1
OUT=${WPF_TEST_OUT:-/tmp/wpf-tests}; mkdir -p "$OUT"
FILES=$( (if [ $# -gt 0 ]; then for a in "$@"; do if [ -d "$a" ]; then find "$a" -name '*.test.js'; else echo "$a"; fi; done; else find tests -name '*.test.js'; fi) | sort)
TP=0; TF=0
for f in $FILES; do
  log="$OUT/$(echo "$f" | tr '/' '_').log"
  timeout ${WPF_TEST_TIMEOUT:-600} node "$f" > "$log" 2>&1; rc=$?
  p=$(grep -c -E '^\s*(PASS|ok|✓|✔)\b' "$log"); x=$(grep -c -E '^\s*(FAIL|not ok|✗|✘|❌)\b' "$log")
  TP=$((TP+p)); TF=$((TF+x))
  echo "$f  pass=$p fail=$x rc=$rc"
done
echo "TOTAL pass=$TP fail=$TF"
