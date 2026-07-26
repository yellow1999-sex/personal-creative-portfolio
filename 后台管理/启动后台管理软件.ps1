$ErrorActionPreference = 'Stop'
$adminRoot = $PSScriptRoot
$siteRoot = Split-Path $adminRoot -Parent

function Test-PortFree([int]$Port) {
  $listener = $null
  try { $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port); $listener.Start(); return $true }
  catch { return $false }
  finally { if ($listener) { $listener.Stop() } }
}
function Find-FreePort([int]$StartPort) { foreach ($port in $StartPort..($StartPort + 30)) { if (Test-PortFree $port) { return $port } }; throw '没有找到可用的本地端口。' }

try {
  if (-not (Test-Path -LiteralPath (Join-Path $siteRoot 'package.json'))) { throw '没有找到网站项目。' }
  if (-not (Test-Path -LiteralPath (Join-Path $siteRoot 'node_modules\vite\bin\vite.js'))) { throw '网站所需组件不完整，请先在网站目录执行 npm.cmd install。' }
  $vitePort = Find-FreePort 5173
  $apiPort = Find-FreePort 4399
  $env:EDITOR_VITE_PORT = "$vitePort"
  $env:EDITOR_API_PORT = "$apiPort"
  $url = "http://127.0.0.1:$vitePort/editor"
  [System.IO.File]::WriteAllText((Join-Path $adminRoot '后台地址.txt'), $url)
  Write-Host '正在启动作品集网站后台。请保持此窗口开启。' -ForegroundColor Cyan
  Write-Host "后台地址：$url" -ForegroundColor Green
  Set-Location -LiteralPath $siteRoot
  & node editor-server.mjs
  if ($LASTEXITCODE -ne 0) { throw "后台已异常退出，代码：$LASTEXITCODE" }
} catch {
  Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
