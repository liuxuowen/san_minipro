# Windows PowerShell Database Migration Script
# ================= Configuration =================
$SERVER_IP = "101.201.106.39"
$SERVER_USER = "root"
$PEM_PATH = "C:\Users\liuxu\Documents\liuxu.pem"
$REMOTE_PATH = "/opt/projects/san_backend"
# ===========================================

if (-not (Test-Path $PEM_PATH)) {
    Write-Host "[-] Error: Key file not found: $PEM_PATH" -ForegroundColor Red
    exit 1
}

Write-Host "[*] Connecting to $SERVER_IP to run database migration..." -ForegroundColor Cyan

$Command = "cd $REMOTE_PATH && source venv/bin/activate && python migrate_group.py"

ssh -i "$PEM_PATH" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" $Command

if ($LASTEXITCODE -eq 0) {
    Write-Host "[+] Migration script executed." -ForegroundColor Green
    Write-Host "[*] Restarting backend service..." -ForegroundColor Cyan
    ssh -i "$PEM_PATH" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "systemctl restart san_backend"
    Write-Host "[+] Service restarted." -ForegroundColor Green
} else {
    Write-Host "[-] Migration failed." -ForegroundColor Red
}
