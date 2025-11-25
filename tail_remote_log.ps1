# Windows PowerShell Log Tail Script
# ================= Configuration =================
$SERVER_IP = "101.201.106.39"
$SERVER_USER = "root"
# Please modify the PEM_PATH to your actual .pem file path on Windows
$PEM_PATH = "C:\Users\liuxu\Documents\liuxu.pem"
# ===========================================

if (-not (Test-Path $PEM_PATH)) {
    Write-Host "[-] Error: Key file not found: $PEM_PATH" -ForegroundColor Red
    Write-Host "Please edit the script and update `$PEM_PATH variable."
    exit 1
}

Write-Host "[*] Connecting to server to tail logs..." -ForegroundColor Cyan
ssh -i "$PEM_PATH" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "journalctl -u san_backend -f -n 50"
