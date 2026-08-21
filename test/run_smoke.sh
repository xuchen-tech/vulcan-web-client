#!/usr/bin/env bash
# vulcan-web-client 端到端冒烟
#
# 假定 vulcan_server 已在给定端口运行（开发默认）：
#   ./vulcan/build/vulcan_server 4840 --ws 4843
#
# 环境变量：
#   TCP_PORT      OPC UA TCP 端口（仅用于提示，默认 4840）
#   WS_PORT       WebSocket 端口（默认 4843）
#   WSOPCUA_URL   完整 WS URL（默认 ws://127.0.0.1:${WS_PORT}/opcua）
#   WSOPCUA_*     见 test/e2e_smoke.mjs
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TCP_PORT="${TCP_PORT:-4840}"
WS_PORT="${WS_PORT:-4843}"
WSOPCUA_URL="${WSOPCUA_URL:-ws://127.0.0.1:${WS_PORT}/opcua}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if ! (exec 3<>"/dev/tcp/127.0.0.1/${WS_PORT}") 2>/dev/null; then
  fail "WebSocket 端口 ${WS_PORT} 不可达。请先启动 vulcan_server：
  ./vulcan/build/vulcan_server ${TCP_PORT} --ws ${WS_PORT}"
fi
exec 3>&-

cd "$ROOT_DIR"

echo "== vitest =="
npm run test

echo
echo "== e2e smoke (${WSOPCUA_URL}) =="
env WSOPCUA_URL="$WSOPCUA_URL" node test/e2e_smoke.mjs

echo
echo "PASS run_smoke.sh"
