# deploy_nginx.ps1
# PowerShell 脚本：部署 Nginx 配置到远程服务器

# ================= 配置信息 =================
$ServerIP = "101.201.106.39"
$ServerUser = "root"
# 请修改为您本地的 PEM 密钥路径
$PemPath = "C:\Users\liuxu\Documents\liuxu.pem" 
# 如果您的 PEM 路径在 WSL 或其他位置，请相应修改。
# 例如: $PemPath = "$env:USERPROFILE\.ssh\id_rsa"

$LocalConfigPath = ".\backend\san_nginx.conf"
$RemoteTempPath = "/tmp/san_nginx.conf"
$NginxAvailablePath = "/etc/nginx/sites-available/san_nginx"
$NginxEnabledPath = "/etc/nginx/sites-enabled/san_nginx"
$LocalCertPath = ".\backend\ssl\youlao.xin.pem"
$LocalKeyPath = ".\backend\ssl\youlao.xin.key"
$RemoteSSLDir = "/etc/nginx/ssl"
# ===========================================

# 检查 PEM 文件是否存在
if (-not (Test-Path $PemPath)) {
    Write-Host "❌ 错误: 找不到密钥文件: $PemPath" -ForegroundColor Red
    Write-Host "请在脚本中修改 `$PemPath 变量为正确的路径。" -ForegroundColor Yellow
    exit 1
}

# 检查本地配置文件是否存在
if (-not (Test-Path $LocalConfigPath)) {
    Write-Host "❌ 错误: 找不到本地配置文件: $LocalConfigPath" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 开始部署 Nginx 配置到 $ServerIP ..." -ForegroundColor Cyan

# 1. 上传配置文件到临时目录
Write-Host "📤 正在上传配置文件..." -ForegroundColor Cyan
# 使用 scp 上传
scp -i "$PemPath" -o StrictHostKeyChecking=no "$LocalConfigPath" "$ServerUser@$ServerIP`:$RemoteTempPath"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 上传失败，请检查网络连接或密钥文件。" -ForegroundColor Red
    exit 1
}

# 1.5 上传 SSL 证书
Write-Host "🔐 正在上传 SSL 证书..." -ForegroundColor Cyan
# 创建远程 SSL 目录
ssh -i "$PemPath" -o StrictHostKeyChecking=no "$ServerUser@$ServerIP" "mkdir -p $RemoteSSLDir"

# 上传证书文件
scp -i "$PemPath" -o StrictHostKeyChecking=no "$LocalCertPath" "$ServerUser@$ServerIP`:$RemoteSSLDir/"
scp -i "$PemPath" -o StrictHostKeyChecking=no "$LocalKeyPath" "$ServerUser@$ServerIP`:$RemoteSSLDir/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SSL 证书上传失败。" -ForegroundColor Red
    exit 1
}

# 2. 在服务器上执行配置命令
Write-Host "🔧 正在应用 Nginx 配置..." -ForegroundColor Cyan

$RemoteScript = @"
# 检查是否安装了 Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 Nginx 未安装，正在安装..."
    apt-get update && apt-get install -y nginx
fi

# 移动配置文件
mv $RemoteTempPath $NginxAvailablePath

# 创建软链接 (如果不存在)
if [ ! -L $NginxEnabledPath ]; then
    ln -s $NginxAvailablePath $NginxEnabledPath
    echo "🔗 已创建软链接"
else
    echo "🔗 软链接已存在"
fi

# 移除默认配置 (可选，防止冲突)
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
    echo "🗑️ 已移除默认 default 配置"
fi

# 测试配置
echo "🔍 测试 Nginx 配置..."

if nginx -t; then
    # 重载 Nginx
    echo "🔄 重载 Nginx..."
    systemctl reload nginx
    echo "✅ Nginx 部署成功！"
else
    echo "❌ Nginx 配置测试失败，请检查配置文件。"
    exit 1
fi
"@.Replace("`r", "")

# 执行远程脚本
ssh -i "$PemPath" -o StrictHostKeyChecking=no "$ServerUser@$ServerIP" "$RemoteScript"

if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉 部署完成！" -ForegroundColor Green
} else {
    Write-Host "❌ 部署过程中出现错误。" -ForegroundColor Red
}
