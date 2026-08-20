#!/usr/bin/env bash
# vulcan WebSocket OPC UA 客户端端到端测试（@wsopcua/wsopcua）
#
# 流程：
#   1. 生成临时 pki（vulcan_server 自动产出 server_cert.der/key.der）；
#   2. openssl 生成客户端证书，放入服务端 trust（ApplCerts/trusted/certs）；
#   3. 启动 vulcan_server <tcp> --pki <pki> --ws <wss>；
#   4. 运行 ws_web_client_test.mjs（wss 连接 + 读/写/浏览）；
#   5. 清理。
#
# 环境变量：TCP_PORT（默认 14840）、WSS_PORT（默认 14843）、
#           WSOPCUA_CA_FILE（可选，正式 CA 校验；缺省信任本地自签名证书）、
#           WSOPCUA_NODE_ID（demo Speed 节点，默认按运行时索引 ns=2）、
#           WSOPCUA_USER/WSOPCUA_PASSWORD（默认 admin/admin123）
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(dirname "$SCRIPT_DIR")"
VULCAN_DIR="$(dirname "$WEB_DIR")"
BUILD_DIR="${VULCAN_DIR}/build"
SERVER_BIN="${BUILD_DIR}/vulcan_server"

TCP_PORT="${TCP_PORT:-14840}"
WSS_PORT="${WSS_PORT:-14843}"
WSOPCUA_NODE_ID="${WSOPCUA_NODE_ID:-ns=2;i=6011}"
WSOPCUA_USER="${WSOPCUA_USER:-admin}"
WSOPCUA_PASSWORD="${WSOPCUA_PASSWORD:-admin123}"

fail() {
    echo "FAIL: $*" >&2
    exit 1
}

[ -x "$SERVER_BIN" ] || fail "vulcan_server not found at $SERVER_BIN (build first)"

TMP="$(mktemp -d /tmp/vulcan_ws_web_XXXXXX)"
PKI="${TMP}/pki"
mkdir -p "$PKI/ApplCerts/trusted/certs"

# 1) 客户端证书（PEM），SAN 带 URI（wsopcua 从证书 SAN 取 applicationUri）
OPENSSL_CONF="${OPENSSL_CONF:-/etc/ssl/openssl.cnf}" \
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
    -keyout "$TMP/client_key.pem" -out "$TMP/client_cert.pem" \
    -subj "/C=CN/O=JSZG/CN=VulcanWebClient@localhost" \
    -addext "subjectAltName=DNS:localhost,URI:urn:jszg:vulcan:webclient" 2>/dev/null \
    || fail "openssl client certificate generation"

# 2) 服务端信任客户端证书（SignAndEncrypt 必需）
cp "$TMP/client_cert.pem" "$PKI/ApplCerts/trusted/certs/client_cert.pem"

# 3) 启动 vulcan_server（--pki 自动生成 server 证书；--ws 要求 pki）
"$SERVER_BIN" "$TCP_PORT" --pki "$PKI" --ws "$WSS_PORT" >"$TMP/server.log" 2>&1 &
SERVER_PID=$!
cleanup() {
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
    rm -rf "$TMP"
}
trap cleanup EXIT

# 等待 wss 端口就绪（最多 15s）
ready=0
for i in $(seq 1 30); do
    if (exec 3<>"/dev/tcp/127.0.0.1/$WSS_PORT") 2>/dev/null; then
        exec 3>&-
        ready=1
        break
    fi
    sleep 0.5
done
[ "$ready" -eq 1 ] || { echo "server log:"; cat "$TMP/server.log"; fail "wss port $WSS_PORT not ready"; }

# 4) 运行 wsopcua 端到端测试
echo "server log tail:"
head -40 "$TMP/server.log"
echo

cd "$WEB_DIR"
CA_ENV=()
if [ -n "${WSOPCUA_CA_FILE:-}" ]; then
    CA_ENV=(WSOPCUA_CA_FILE="$WSOPCUA_CA_FILE")
fi
env \
    WSOPCUA_URL="wss://localhost:${WSS_PORT}/opcua" \
    WSOPCUA_NODE_ID="$WSOPCUA_NODE_ID" \
    WSOPCUA_CLIENT_CERT="$TMP/client_cert.pem" \
    WSOPCUA_CLIENT_KEY="$TMP/client_key.pem" \
    "${CA_ENV[@]}" \
    WSOPCUA_USER="$WSOPCUA_USER" \
    WSOPCUA_PASSWORD="$WSOPCUA_PASSWORD" \
    node test/ws_web_client_test.mjs
RC=$?

exit $RC
