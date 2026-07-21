$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")

Set-Location $PSScriptRoot

$npmExe = $null
if (Get-Command npm -ErrorAction SilentlyContinue) { $npmExe = "npm" }
elseif (Test-Path "C:\Program Files\nodejs\npm.cmd") { $npmExe = "C:\Program Files\nodejs\npm.cmd" }

if (-not $npmExe) {
  Write-Host "请先安装 Node.js: https://nodejs.org/" -ForegroundColor Red
  pause
  exit 1
}

Write-Host "报价工具开发服务: http://127.0.0.1:5174/" -ForegroundColor Cyan
if ($npmExe -eq "npm") { npm run dev } else { & $npmExe run dev }
