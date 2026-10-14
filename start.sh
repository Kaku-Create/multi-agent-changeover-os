#!/usr/bin/env bash
# 多智能体协同换产管理系统 - 启动脚本
# 端口固定 3001；生产模式（不启用热重载）；不主动清理 web 缓存
# 返回码：0=已运行或启动成功；2=启动失败
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT/server"
WEB_DIR="$ROOT/web"
LOG_FILE="$ROOT/server.log"
PID_FILE="$ROOT/server.pid"
PORT=3001

is_listening() {
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -E "(^|:)${PORT}$" >/dev/null 2>&1
}

pid_alive() {
    [ -f "$PID_FILE" ] || return 1
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    [ -n "$pid" ] || return 1
    kill -0 "$pid" 2>/dev/null
}

if is_listening; then
    echo "[start.sh] 端口 ${PORT} 已在监听，已视为运行中"
    exit 0
fi

if pid_alive; then
    echo "[start.sh] PID 文件记录进程存在但端口未监听；先 stop.sh 再启动"
    exit 2
fi

[ -d "$SERVER_DIR" ] || { echo "[start.sh] 缺少目录 $SERVER_DIR" >&2; exit 2; }
[ -f "$SERVER_DIR/dist/index.js" ] || { echo "[start.sh] 缺少 $SERVER_DIR/dist/index.js，请先构建" >&2; exit 2; }
[ -d "$WEB_DIR/dist" ] || { echo "[start.sh] 缺少 $WEB_DIR/dist，请先 npm run build" >&2; exit 2; }

echo "[start.sh] 启动后端服务（生产模式）"
export MODE=online
export PORT=$PORT
nohup node "$SERVER_DIR/dist/index.js" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

for i in 1 2 3 4 5 6 7 8 9 10; do
    if is_listening; then
        echo "[start.sh] 启动成功 PID=${SERVER_PID} PORT=${PORT}"
        exit 0
    fi
    sleep 0.5
done

echo "[start.sh] 启动超时，请查看 $LOG_FILE" >&2
exit 2
