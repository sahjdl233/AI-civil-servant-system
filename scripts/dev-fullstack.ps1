# 智考AI平台 - 动态端口全栈启动脚本

param(
    [int]$BackendPort = 0,  # 0表示自动分配
    [int]$FrontendPort = 0  # 0表示自动分配
)

# 函数：检查端口是否被占用
function Test-Port {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
}

# 函数：获取可用端口
function Get-AvailablePort {
    param([int]$StartPort = 3000)
    
    for ($port = $StartPort; $port -lt 65535; $port++) {
        if (Test-Port -Port $port) {
            return $port
        }
    }
    throw "无法找到可用端口"
}

Write-Host "🚀 智考AI平台 - 启动中..." -ForegroundColor Green

# 检查Docker是否运行
try {
    docker ps | Out-Null
    Write-Host "✅ Docker 运行正常" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker 未运行，请先启动Docker" -ForegroundColor Red
    exit 1
}

# 启动数据库
Write-Host "📦 启动PostgreSQL数据库..." -ForegroundColor Yellow
docker compose -f ".\docker\docker-compose.yml" up -d postgres

# 等待数据库启动
Start-Sleep -Seconds 5

# 确定后端端口
if ($BackendPort -eq 0) {
    $BackendPort = Get-AvailablePort -StartPort 8001
}
Write-Host "🔧 后端端口: $BackendPort" -ForegroundColor Cyan

# 确定前端端口
if ($FrontendPort -eq 0) {
    $FrontendPort = Get-AvailablePort -StartPort 3000
}
Write-Host "🎨 前端端口: $FrontendPort" -ForegroundColor Cyan

# 设置环境变量
$env:BACKEND_PORT = $BackendPort
$env:FRONTEND_PORT = $FrontendPort

# 启动后端
Write-Host "🔧 启动后端服务..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd backend; uvicorn main:app --host 0.0.0.0 --port $BackendPort --reload" -WindowStyle Normal

# 等待后端启动
Start-Sleep -Seconds 3

# 启动前端
Write-Host "🎨 启动前端服务..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd frontend; npm run dev -- --port $FrontendPort" -WindowStyle Normal

# 显示访问地址
Write-Host ""
Write-Host "🎉 启动完成！" -ForegroundColor Green
Write-Host "📱 前端地址: http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host "🔧 后端API: http://localhost:$BackendPort" -ForegroundColor Cyan
Write-Host "📚 API文档: http://localhost:$BackendPort/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Yellow

# 保持脚本运行
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "🛑 正在停止服务..." -ForegroundColor Red
}