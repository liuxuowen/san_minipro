#!/bin/bash

# ================= 配置信息 =================
SERVER_IP="101.201.106.39"
SERVER_USER="root"
PEM_PATH="/Users/liuxu/liuxu.pem"
# ===========================================

echo "🚀 连接到服务器查看实时日志..."
ssh -i "$PEM_PATH" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "journalctl -u san_backend -f -n 50"
