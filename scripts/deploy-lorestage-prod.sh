#!/usr/bin/env bash
set -euo pipefail

LUKER_DIR="${LUKER_DIR:-/root/Luker}"
AUTH_DIR="${AUTH_DIR:-/root/lorestage-auth}"
AUTH_BIN="${AUTH_BIN:-/opt/lorestage-auth/lorestage-auth}"
AUTH_SERVICE="${AUTH_SERVICE:-lorestage-auth}"
LUKER_SERVICE="${LUKER_SERVICE:-luker}"
CADDY_CONFIG="${CADDY_CONFIG:-/etc/caddy/Caddyfile.json}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://www.lorestage.com}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root so systemd services and /opt binaries can be updated." >&2
  exit 1
fi

wait_for_url() {
  local url="$1"
  local name="$2"
  for _ in $(seq 1 120); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "${name} did not become healthy: ${url}" >&2
  return 1
}

verify_logout_flow() {
  local headers
  headers="$(mktemp)"

  curl -sS -D "${headers}" -o /dev/null "${PUBLIC_BASE_URL}/login?noauto=true"
  if ! grep -Eiq '^location:[[:space:]]*/auth/logout[[:space:]]*$' "${headers}"; then
    echo "Logout fallback check failed: /login?noauto=true must redirect to /auth/logout." >&2
    rm -f "${headers}"
    return 1
  fi
  curl -sS -D "${headers}" -o /dev/null "${PUBLIC_BASE_URL}/?noauto=true"
  if ! grep -Eiq '^location:[[:space:]]*/auth/logout[[:space:]]*$' "${headers}"; then
    echo "Logout fallback check failed: /?noauto=true must redirect to /auth/logout." >&2
    rm -f "${headers}"
    return 1
  fi

  curl -sS -D "${headers}" -o /dev/null "${PUBLIC_BASE_URL}/auth/logout"
  if ! grep -Eiq '^set-cookie:[[:space:]]*__Host-lorestage_session=.*Max-Age=0' "${headers}"; then
    echo "Logout cookie check failed: /auth/logout must clear the Lorestage SSO cookie." >&2
    rm -f "${headers}"
    return 1
  fi
  if ! grep -Eiq '^set-cookie:[[:space:]]*session-[^=]+=' "${headers}"; then
    echo "Logout cookie check failed: /auth/logout must clear the Luker session cookie." >&2
    rm -f "${headers}"
    return 1
  fi

  rm -f "${headers}"
}

echo "==> Validating Caddy config"
caddy validate --config "${CADDY_CONFIG}" >/dev/null

if [[ -d "${AUTH_DIR}" ]]; then
  echo "==> Building lorestage-auth"
  tmp_bin="$(mktemp /tmp/lorestage-auth.XXXXXX)"
  (
    cd "${AUTH_DIR}"
    go test ./...
    go build -o "${tmp_bin}" .
  )
  install -m 0755 "${tmp_bin}" "${AUTH_BIN}"
  rm -f "${tmp_bin}"
  systemctl restart "${AUTH_SERVICE}"
  wait_for_url http://127.0.0.1:18106/healthz "${AUTH_SERVICE}"
fi

echo "==> Validating Luker"
(
  cd "${LUKER_DIR}"
  node --check public/scripts/user.js
  node --check src/util.js
  node --check src/users.js
  node --check src/endpoints/users-public.js
  node --check src/server-main.js
  node --check src/endpoints/files.js
  node --check src/ws-proxy.js
  node --check src/endpoints/backends/luker-generation.js
  if [[ "${SKIP_LINT:-0}" != "1" ]]; then
    npx eslint \
      src/util.js \
      public/scripts/user.js \
      src/users.js \
      src/endpoints/users-public.js \
      src/server-main.js \
      src/endpoints/files.js \
      src/ws-proxy.js \
      src/endpoints/backends/luker-generation.js
  fi
)

echo "==> Restarting Luker"
systemctl restart "${LUKER_SERVICE}"
systemctl is-active --quiet "${AUTH_SERVICE}"
systemctl is-active --quiet "${LUKER_SERVICE}"
wait_for_url http://127.0.0.1:18103/ "${LUKER_SERVICE}"

echo "==> Verifying logout flow"
verify_logout_flow

echo "Deploy complete."
