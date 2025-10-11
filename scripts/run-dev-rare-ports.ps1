#!/usr/bin/env pwsh

param(
  [int]$BackendPort,
  [int]$FrontendPort,
  [switch]$NoDB
)

if (-not $BackendPort) { $BackendPort = 65123 }
if (-not $FrontendPort) { $FrontendPort = 65124 }

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "🚀 启动全栈开发（固定端口 + 端口复用）" -ForegroundColor Green
Write-Host ("=" * 80) -ForegroundColor Gray

function Test-PortInUse {
  param([Parameter(Mandatory = $true)][int]$PortToTest)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $PortToTest, $null, $null)
    $completed = $iar.AsyncWaitHandle.WaitOne(600)
    if ($completed -and $client.Connected) { $client.Close(); return $true }
    $client.Close(); return $false
  } catch { return $false }
}

function Wait-ForPortUp {
  param([Parameter(Mandatory = $true)][int]$Port,[int]$TimeoutSec = 20)
  $elapsed = 0
  while ($elapsed -lt $TimeoutSec) {
    if (Test-PortInUse -PortToTest $Port) { return $true }
    Start-Sleep -Seconds 1
    $elapsed++
  }
  return (Test-PortInUse -PortToTest $Port)
}

function Write-PortFile {
  param([string]$Name,[int]$Port)
  $file = Join-Path $PSScriptRoot "${Name}_port.txt"
  $Port | Out-File -FilePath $file -Encoding utf8 -NoNewline
  return $file
}

function Maybe-Start-DB {
  if ($NoDB) { return }
  $composeAtRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "docker\docker-compose.yml"
  if (Test-Path $composeAtRoot) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
      Write-Host "🗄️ 通过 Docker Compose 启动 Postgres（若未运行）" -ForegroundColor Yellow
      try {
        Push-Location (Split-Path $PSScriptRoot -Parent)
        docker compose -f "docker\docker-compose.yml" up -d postgres | Out-Host
      } catch {
        Write-Warning "[db] docker compose failed: $($_.Exception.Message)"
      } finally {
        Pop-Location
      }
    } else {
      Write-Host "[db] Docker not found; skipping DB startup" -ForegroundColor DarkYellow
    }
  }
}

function Ensure-BackendVenvAndDeps {
  $backendDir = Join-Path $PSScriptRoot 'backend'
  $venvPath = Join-Path $backendDir '.venv'
  Push-Location $backendDir
  try {
    if (-not (Test-Path $venvPath)) {
      Write-Host "[后端] 创建虚拟环境 .venv" -ForegroundColor Yellow
      $pythonCmd = $null
      if (Get-Command python -ErrorAction SilentlyContinue) { $pythonCmd = 'python' }
      elseif (Get-Command py -ErrorAction SilentlyContinue) { $pythonCmd = 'py -3' }
      else { Write-Error "未找到 Python，请先安装 Python 3.x 并加入 PATH" }
      & $pythonCmd -m venv .venv | Out-Host
    }
    $pipExe = Join-Path $venvPath 'Scripts/pip.exe'
    $pythonExe = Join-Path $venvPath 'Scripts/python.exe'
    if (-not (Test-Path $pythonExe)) { throw "Python venv not created correctly at $venvPath" }
    if (Test-Path (Join-Path $backendDir 'requirements.txt')) {
      Write-Host "[后端] 安装依赖" -ForegroundColor Yellow
      & $pythonExe -m pip install --upgrade pip | Out-Host
      & $pipExe install -r (Join-Path $backendDir 'requirements.txt') | Out-Host
    }
    return $pythonExe
  } finally {
    Pop-Location
  }
}

function Update-FrontendApiConfig {
  param([int]$Frontend,[int]$Backend)
  $configPath = Join-Path (Join-Path $PSScriptRoot 'frontend') 'src/config/api.ts'
  $configDir = Split-Path $configPath -Parent
  if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
  $content = @(
    "// Auto-generated API configuration",
    "export const API_BASE_URL = process.env.NODE_ENV === 'production' ",
    "  ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:$Backend'",
    "  : 'http://localhost:$Backend';",
    "",
    "export const FRONTEND_URL = 'http://localhost:$Frontend';",
    ""
  ) -join "`n"
  Set-Content -Path $configPath -Value $content -Encoding UTF8
  Write-Host "[前端] 已更新 API 配置：后端=$Backend，前端=$Frontend" -ForegroundColor DarkCyan
}

function Ensure-FrontendDeps {
  $frontendDir = Join-Path $PSScriptRoot 'frontend'
  Push-Location $frontendDir
  try {
    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
      Write-Host "[前端] 安装 Node 依赖 (npm install)" -ForegroundColor Yellow
      & npm install | Out-Host
    }
  } finally {
    Pop-Location
  }
}

function Run-DBMigrations {
  param([string]$BackendDir,[string]$PythonExe,[int]$Retries = 10)
  if ($NoDB) { Write-Host "[db] NoDB 开关启用，跳过迁移" -ForegroundColor Yellow; return }
  # 等待 5432 端口可用
  if (-not (Wait-ForPortUp -Port 5433 -TimeoutSec 45)) {
    Write-Warning "[db] 端口 5432 未就绪，可能数据库尚未启动"
  }
  for ($i=0; $i -lt $Retries; $i++) {
    try {
      Push-Location $BackendDir
      $alembicCmd = Join-Path (Split-Path $PythonExe -Parent) 'alembic.exe'
      if (Test-Path $alembicCmd) {
        & $alembicCmd upgrade head | Out-Host
      } else {
        alembic upgrade head | Out-Host
      }
      Write-Host "[db] Alembic 迁移完成" -ForegroundColor Green
      return
    } catch {
      Write-Warning "[db] 迁移失败(第$($i+1)次)：$($_.Exception.Message)"
      Start-Sleep -Seconds 3
    } finally {
      Pop-Location
    }
  }
  throw "[db] 多次尝试迁移仍失败，请检查数据库连接/权限配置"
}

function Start-Backend {
  param([int]$Port)
  $backendDir = Join-Path $PSScriptRoot 'backend'
  if (Test-PortInUse -PortToTest $Port) {
    Write-Host "🟢 Backend already running · http://localhost:$Port" -ForegroundColor Cyan
    Write-PortFile -Name 'backend' -Port $Port | Out-Null
    return $null
  }
  $pythonExe = Ensure-BackendVenvAndDeps
  Maybe-Start-DB
  # 判断是否使用 SQLite 以避免本地未装 Docker/Postgres 时直接失败
  $useSQLite = $NoDB -or (-not (Wait-ForPortUp -Port 5432 -TimeoutSec 45))
  if ($useSQLite) {
    Write-Host "[后端] 未检测到 Postgres，使用 SQLite 本地文件 dev.db，跳过迁移" -ForegroundColor DarkYellow
  } else {
    Run-DBMigrations -BackendDir $backendDir -PythonExe $pythonExe
  }
  Write-Host "🔧 Starting Backend on port $Port" -ForegroundColor Yellow
  $job = Start-Job -ScriptBlock {
    param($root, $py, $port, $dbUrl)
    Set-Location (Join-Path $root 'backend')
    if ($dbUrl) { $env:DATABASE_URL = $dbUrl }
    & $py -m uvicorn app.main:app --reload --host 0.0.0.0 --port $port
  } -ArgumentList $PSScriptRoot, $pythonExe, $Port, ($useSQLite ? "sqlite:///./dev.db" : $null)
  return $job
}

function Start-Frontend {
  param([int]$Port,[int]$BackendPort)
  $frontendDir = Join-Path $PSScriptRoot 'frontend'
  if (Test-PortInUse -PortToTest $Port) {
    Write-Host "🟢 Frontend already running · http://localhost:$Port" -ForegroundColor Cyan
    Update-FrontendApiConfig -Frontend $Port -Backend $BackendPort
    Write-PortFile -Name 'frontend' -Port $Port | Out-Null
    return $null
  }
  Ensure-FrontendDeps
  Update-FrontendApiConfig -Frontend $Port -Backend $BackendPort
  Write-Host "🔧 Starting Frontend on port $Port" -ForegroundColor Yellow
  $job = Start-Job -ScriptBlock {
    param($root, $port)
    Set-Location (Join-Path $root 'frontend')
    $env:NODE_OPTIONS = "--max_old_space_size=4096"
    $env:FRONTEND_PORT = $port
    & node start-server.js | Out-Host
  } -ArgumentList $PSScriptRoot, $Port
  return $job
}

# 启动顺序：确保 DB 就绪并迁移 → 启动/复用后端 → 启动/复用前端
$backendDir = Join-Path $PSScriptRoot 'backend'
$pyExeForMigrate = Ensure-BackendVenvAndDeps
Maybe-Start-DB
if (-not $NoDB -and (Wait-ForPortUp -Port 5433 -TimeoutSec 45)) {
  Run-DBMigrations -BackendDir $backendDir -PythonExe $pyExeForMigrate
} else {
  Write-Host "[db] 跳过预迁移：未启用或数据库未就绪（将继续启动后端）" -ForegroundColor DarkYellow
}

$backendJob = Start-Backend -Port $BackendPort
if ($backendJob) {
  if (-not (Wait-ForPortUp -Port $BackendPort -TimeoutSec 45)) {
    Write-Warning "[后端] 未在超时内开放端口 $BackendPort，请查看 Job 输出"
    try { Receive-Job -Id $backendJob.Id -Keep | Out-Host } catch { }
  }
}
Write-PortFile -Name 'backend' -Port $BackendPort | Out-Null

$frontendJob = Start-Frontend -Port $FrontendPort -BackendPort $BackendPort
if ($frontendJob) {
  if (-not (Wait-ForPortUp -Port $FrontendPort -TimeoutSec 60)) {
    Write-Warning "[前端] 未在超时内开放端口 $FrontendPort，尝试查看日志"
    try { Receive-Job -Id $frontendJob.Id -Keep | Out-Host } catch { }
  }
}
Write-PortFile -Name 'frontend' -Port $FrontendPort | Out-Null

Write-Host ""; Write-Host ("=" * 80) -ForegroundColor Green
Write-Host "✅ 服务已就绪" -ForegroundColor Green
Write-Host ("=" * 80) -ForegroundColor Green
Write-Host "🌐 前端:  http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host "🧩 后端:  http://localhost:$BackendPort  （根路径将跳转到管理页面）" -ForegroundColor Magenta
Write-Host "   📋 管理页: http://localhost:$BackendPort  或  http://localhost:$BackendPort/admin" -ForegroundColor Magenta
Write-Host "   📚 API 文档: http://localhost:$BackendPort/docs" -ForegroundColor Magenta
Write-Host ""; Write-Host "⏹ 关闭：在此窗口按 Ctrl+C（持续前台运行，便于观察）" -ForegroundColor Yellow
Write-Host ("=" * 80) -ForegroundColor Green

try {
  while ($true) {
    if ($backendJob -and (Get-Job -Id $backendJob.Id -ErrorAction SilentlyContinue)) {
      $bState = (Get-Job -Id $backendJob.Id).State
      if ($bState -ne 'Running') { Write-Warning "[后端] Job 状态=$bState"; break }
    }
    if ($frontendJob -and (Get-Job -Id $frontendJob.Id -ErrorAction SilentlyContinue)) {
      $fState = (Get-Job -Id $frontendJob.Id).State
      if ($fState -ne 'Running') { Write-Warning "[前端] Job 状态=$fState"; break }
    }
    Start-Sleep -Seconds 5
  }
} catch {
  Write-Host "`n🛑 停止服务..." -ForegroundColor Yellow
} finally {
  if ($backendJob) { Stop-Job -Id $backendJob.Id -PassThru | Remove-Job | Out-Null }
  if ($frontendJob) { Stop-Job -Id $frontendJob.Id -PassThru | Remove-Job | Out-Null }
  Write-Host "🧹 已停止。" -ForegroundColor Gray
}
