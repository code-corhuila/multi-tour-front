#!/usr/bin/env bash
# Runs the production image and checks what the browser relies on: security headers, a manifest that is never
# cached, a portal path that does not fall back to the shell, and a non-root user. Usage: scripts/check-image.sh <image>
set -euo pipefail

image="$1"
name="front-image-check"
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -p 8080:8080 "$image" >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  curl -sf -o /dev/null http://localhost:8080/ && break
  sleep 1
done

fail() { echo "FAIL: $1"; exit 1; }
headers() { curl -sI "http://localhost:8080$1"; }

for path in / /t/acme /federation.manifest.json; do
  out="$(headers "$path")"
  for h in content-security-policy x-content-type-options x-frame-options referrer-policy; do
    echo "$out" | grep -qi "^$h:" || fail "$h missing on $path"
  done
done

# Captured first: a pipe into grep -q can end curl early and fail under pipefail.
manifest="$(headers /federation.manifest.json)"
tenant="$(headers /t/acme)"
missing="$(headers /portals/missing.js)"
grep -qi '^cache-control:.*no-store' <<<"$manifest" || fail "manifest may be cached"
grep -q ' 200' <<<"$tenant" || fail "tenant link does not fall back to the shell"
grep -q ' 404' <<<"$missing" || fail "a missing portal must be 404, not the shell"
[ "$(docker exec "$name" id -u)" != "0" ] || fail "container runs as root"
echo "OK: image checks passed"
