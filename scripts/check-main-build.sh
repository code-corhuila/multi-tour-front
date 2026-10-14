#!/usr/bin/env bash
# V·main_build_has_no_dev_sign_in (norm 5.5.2): the production bundle carries no development sign-in
# and no stub remote. Usage: scripts/check-main-build.sh [build-dir]
# Keep it POSIX: the Dockerfile runs it with sh (busybox).
set -euo pipefail

dir="${1:-dist/shell/browser}"
[ -f "$dir/index.html" ] || { echo "FAIL: no build in $dir"; exit 1; }

if grep -rIlE 'dev-sign-in|DevSignIn|Stub sign-in' "$dir"; then
  echo "FAIL: the development sign-in is in the bundle"
  exit 1
fi
if [ -d "$dir/stubs" ]; then
  echo "FAIL: stub remotes are in the build"
  exit 1
fi
echo "OK: no development sign-in and no stubs in $dir"
