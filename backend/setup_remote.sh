#!/bin/bash

# 进入项目目录
cd /opt/projects/san_backend

# 1. 创建虚拟环境 (如果不存在)
if [ ! -d ".venv" ]; then
    echo "正在创建 Python 虚拟环境..."
    # 尝试创建，如果失败则尝试安装依赖并重试
    if ! python3 -m venv .venv; then
        echo "⚠️ venv 创建失败，尝试安装 python3-venv..."
        if command -v apt-get &> /dev/null; then
            apt-get update
            # 尝试安装通用包，如果失败尝试特定版本（根据报错提示）
            apt-get install -y python3-venv || apt-get install -y python3.13-venv
            
            # 清理残留并重试
            rm -rf .venv
            python3 -m venv .venv
        fi
    fi
fi

# 2. 安装/更新依赖
echo "正在安装依赖..."
./.venv/bin/pip install -r requirements.txt

# 3. 配置 Systemd 服务
echo "配置 Systemd 服务..."
cp san_backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable san_backend

# 4. 重启服务
echo "重启服务..."
systemctl restart san_backend

echo "部署完成！服务状态："
systemctl status san_backend --no-pager
