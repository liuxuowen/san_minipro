# Windows PowerShell Deployment Script
# ================= Configuration =================
$SERVER_IP = "101.201.106.39"
$SERVER_USER = "root"
# Please modify the PEM_PATH to your actual .pem file path on Windows
$PEM_PATH = "C:\Users\liuxu\Documents\liuxu.pem"
$REMOTE_PATH = "/opt/projects/san_backend"
$LOCAL_PATH = ".\backend"
# ===========================================

# Check PEM file
if (-not (Test-Path $PEM_PATH)) {
    Write-Host "[-] Error: Key file not found: $PEM_PATH" -ForegroundColor Red
    Write-Host "Please edit the script and update `$PEM_PATH variable."
    exit 1
}

# Check local directory
if (-not (Test-Path $LOCAL_PATH)) {
    Write-Host "[-] Error: Local backend directory not found: $LOCAL_PATH" -ForegroundColor Red
    exit 1
}

Write-Host "[*] Starting deployment to $SERVER_IP ..." -ForegroundColor Cyan

# 1. Create remote directory
Write-Host "[*] Checking/Creating remote directory: $REMOTE_PATH" -ForegroundColor Cyan
ssh -i "$PEM_PATH" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_PATH"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Connection failed. Check IP, username, and key file." -ForegroundColor Red
    exit 1
}

# 2. Package and Upload
# Use tar (Windows 10+ includes tar)
$TimeStamp = Get-Date -Format "yyyyMMddHHmmss"
$TarFile = "deploy_package_$TimeStamp.tar.gz"

Write-Host "[*] Packaging files..." -ForegroundColor Cyan
# Exclude unnecessary files
tar --exclude "__pycache__" --exclude "*.pyc" --exclude ".git" --exclude "venv" --exclude ".idea" -czf $TarFile -C $LOCAL_PATH .

if (-not (Test-Path $TarFile)) {
    Write-Host "[-] Packaging failed" -ForegroundColor Red
    exit 1
}

Write-Host "[*] Uploading files..." -ForegroundColor Cyan
scp -i "$PEM_PATH" -o StrictHostKeyChecking=no $TarFile "$SERVER_USER@${SERVER_IP}:$REMOTE_PATH/$TarFile"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Upload failed" -ForegroundColor Red
    Remove-Item $TarFile
    exit 1
}

# 3. Extract and Restart Service
Write-Host "[*] Extracting and restarting service..." -ForegroundColor Cyan
# We add a sed command to remove Windows carriage returns (\r) from .sh files to avoid "required file not found" errors
# Also add chmod +x to ensure scripts are executable
# Execute setup_remote.sh to handle dependencies, db init, and service restart
$RemoteCommand = "cd $REMOTE_PATH && tar -xzf $TarFile && rm $TarFile && sed -i 's/\r$//' *.sh && chmod +x *.sh && bash setup_remote.sh"
ssh -i "$PEM_PATH" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" $RemoteCommand

# Clean up local file
Remove-Item $TarFile

Write-Host "[+] Deployment complete!" -ForegroundColor Green
