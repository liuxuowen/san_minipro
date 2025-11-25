#!/bin/bash

# ================= 配置信息 =================
SERVER_IP="101.201.106.39"
SERVER_USER="root"  # 默认使用 root，如果是 ubuntu/centos 等用户请修改此处
PEM_PATH="/Users/liuxu/liuxu.pem"
REMOTE_PATH="/opt/projects/san_backend"
LOCAL_PATH="./backend/"
# ===========================================

# 检查 PEM 文件是否存在
if [ ! -f "$PEM_PATH" ]; then
    echo "❌ 错误: 找不到密钥文件: $PEM_PATH"
    exit 1
fi

# 检查本地后端目录是否存在
if [ ! -d "$LOCAL_PATH" ]; then
    echo "❌ 错误: 找不到本地后端目录: $LOCAL_PATH"
    exit 1
fi

# 检查 .env 文件是否存在
if [ ! -f "$LOCAL_PATH/.env" ]; then
    echo "⚠️ 警告: 本地没有找到 .env 文件，服务器将使用默认配置或环境变量可能缺失！"
fi

echo "🚀 开始部署后端代码到 $SERVER_IP ..."

# 1. 确保远程目录存在
# 使用 -o StrictHostKeyChecking=no 避免第一次连接时的 yes/no 确认
echo "📂 正在检查并创建远程目录: $REMOTE_PATH"
ssh -i "$PEM_PATH" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_PATH"

if [ $? -ne 0 ]; then
    echo "❌ 无法连接到服务器或创建目录失败，请检查 IP、用户名和密钥文件。"
    exit 1
fi

# 2. 使用 rsync 同步文件
# -a: 归档模式，保留权限、时间等
# -v: 显示详细过程
# -z: 压缩传输
# --delete: 删除远程目录中本地不存在的文件（保持一致）
# -I: 忽略修改时间，强制检查文件内容
echo "🔄 正在同步文件..."
rsync -avzI --delete \
    -e "ssh -i $PEM_PATH -o StrictHostKeyChecking=no" \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.DS_Store' \
    --exclude '.git' \
    --exclude 'venv' \
    --exclude '.venv' \
    --exclude '.idea' \
    "$LOCAL_PATH" \
    "$SERVER_USER@$SERVER_IP:$REMOTE_PATH"

if [ $? -eq 0 ]; then
    echo "✅ 代码同步成功！"
    
    echo "🚀 正在远程执行环境配置和服务重启..."
    ssh -i "$PEM_PATH" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "bash $REMOTE_PATH/setup_remote.sh"
    
    if [ $? -eq 0 ]; then
        echo "✅ 服务部署并重启成功！"
    else
        echo "❌ 远程脚本执行失败"
        exit 1
    fi
else
    echo "❌ 同步失败"
    exit 1
fi
