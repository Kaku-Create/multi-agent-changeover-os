#!/usr/bin/env bash
# 多智能体协同换产管理系统 - 停止脚本
# 通过 PID 文件 + 端口兜底两种方式终止，避免遗留子进程
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/server.pid"
PORT=3001

kill_pid() {
    local pid="$1"
    kill -0 "$pid" 2>/dev/null || return 0
    kill "$pid" 2>/dev/null || true
    for i in 1 2 3 4 5 6 7 8 9 10; do
        kill -0 "$pid" 2>/dev/null || return 0
        sleep 0.2
    done
    kill -9 "$pid" 2>/dev/null || true
}

pids_by_port() {
    ss -ltnp 2>/dev/null | awk -v p=":${PORT}" '$4 ~ p {print $0}' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
}

stopped=0

if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
        echo "[stop.sh] 终止 PID=${pid}"
        kill_pid "$pid"
        stopped=1
    fi
    rm -f "$PID_FILE"
fi

remaining="$(pids_by_port)"
if [ -n "$remaining" ]; then
    for pid in $remaining; do
        echo "[stop.sh] 兜底终止端口 ${PORT} 占用 PID=${pid}"
        kill_pid "$pid"
        stopped=1
    done
fi

for i in 1 2 3 4 5; do
    pids="$(pids_by_port)"
    [ -z "$pids" ] && break
    sleep 0.3
done

if [ "$stopped" -eq 0 ]; then
    echo "[stop.sh] 未发现运行中的服务"
else
    echo "[stop.sh] 已停止"
fi
exit 0
