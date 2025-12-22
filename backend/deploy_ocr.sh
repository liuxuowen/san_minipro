#!/bin/bash
# 腾讯云OCR服务快速部署脚本

set -e  # 遇到错误立即退出

echo "======================================"
echo "  腾讯云OCR服务部署脚本"
echo "======================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "app.py" ]; then
    echo "错误: 请在 backend 目录下运行此脚本"
    exit 1
fi

# 1. 检查环境变量
echo "步骤 1/6: 检查环境变量配置..."
if [ ! -f ".env" ]; then
    echo "警告: .env 文件不存在，正在创建..."
    cat > .env << 'EOF'
# Flask配置
SECRET_KEY=your_secret_key_here
DATABASE_URL=sqlite:///san_minipro.db

# 微信小程序配置
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret

# 腾讯云OCR配置
TENCENT_SECRET_ID=your_tencent_secret_id_here
TENCENT_SECRET_KEY=your_tencent_secret_key_here
EOF
    echo "已创建 .env 文件，请编辑并填入正确的密钥"
    echo "提示: nano .env"
    exit 1
fi

if grep -q "your_tencent_secret_id_here" .env; then
    echo "警告: 请先配置 .env 文件中的腾讯云密钥"
    echo "提示: nano .env"
    exit 1
fi

echo "✓ 环境变量配置检查完成"
echo ""

# 2. 激活虚拟环境
echo "步骤 2/6: 激活Python虚拟环境..."
if [ ! -d ".venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv .venv
fi
source .venv/bin/activate
echo "✓ 虚拟环境已激活"
echo ""

# 3. 安装依赖
echo "步骤 3/6: 安装Python依赖..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "✓ 依赖安装完成"
echo ""

# 4. 创建OCR上传目录
echo "步骤 4/6: 创建OCR图片存储目录..."
mkdir -p ocr_uploads
chmod 755 ocr_uploads
echo "✓ 目录创建完成: $(pwd)/ocr_uploads"
echo ""

# 5. 测试OCR服务
echo "步骤 5/6: 测试OCR服务..."

# 启动Flask（后台运行）
echo "启动Flask服务..."
python app.py &
FLASK_PID=$!
echo "Flask进程ID: $FLASK_PID"

# 等待服务启动
sleep 3

# 测试健康检查
echo "测试健康检查接口..."
HEALTH_CHECK=$(curl -s http://localhost:5000/api/ocr/health)
echo "响应: $HEALTH_CHECK"

if echo "$HEALTH_CHECK" | grep -q '"status":"ok"'; then
    echo "✓ OCR服务运行正常"
else
    echo "✗ OCR服务测试失败"
    kill $FLASK_PID 2>/dev/null || true
    exit 1
fi

# 停止测试服务
echo "停止测试服务..."
kill $FLASK_PID 2>/dev/null || true
sleep 1
echo ""

# 6. 配置systemd服务
echo "步骤 6/6: 配置systemd服务..."
if [ -f "/etc/systemd/system/san_backend.service" ]; then
    echo "重启san_backend服务..."
    sudo systemctl restart san_backend
    sudo systemctl status san_backend --no-pager -l
    echo "✓ 服务已重启"
else
    echo "提示: systemd服务配置文件不存在"
    echo "请手动重启Flask服务"
fi
echo ""

# 7. 配置定期清理任务
echo "附加步骤: 配置crontab定期清理..."
echo "将添加以下crontab任务（每天凌晨3点删除7天前的图片）："
echo "0 3 * * * find $(pwd)/ocr_uploads -type f -mtime +7 -delete"
echo ""
read -p "是否添加crontab任务？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 添加crontab任务
    CRON_CMD="0 3 * * * find $(pwd)/ocr_uploads -type f -mtime +7 -delete"
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "✓ crontab任务已添加"
    crontab -l | grep "ocr_uploads"
fi
echo ""

# 完成
echo "======================================"
echo "  部署完成！"
echo "======================================"
echo ""
echo "OCR服务信息："
echo "  - 上传目录: $(pwd)/ocr_uploads"
echo "  - 文件大小限制: 4MB"
echo "  - 健康检查: http://localhost:5000/api/ocr/health"
echo "  - 使用统计: http://localhost:5000/api/ocr/stats"
echo ""
echo "下一步："
echo "  1. 在腾讯云控制台查看OCR使用情况"
echo "  2. 在小程序管理后台添加服务器域名: https://youlao.xin"
echo "  3. 测试小程序OCR功能"
echo ""
echo "查看日志："
echo "  journalctl -u san_backend -f"
echo ""
echo "手动测试API："
echo "  curl http://localhost:5000/api/ocr/health"
echo ""
