#!/bin/bash

echo "🔍 智考AI平台 - 服务状态检查"
echo "================================"

# 检查数据库
echo "📦 数据库状态:"
docker ps --filter "name=postgres" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""

# 检查后端
echo "🔧 后端服务 (端口 8001):"
if curl -s http://localhost:8001/docs > /dev/null; then
    echo "✅ 后端服务运行正常"
    echo "📚 API文档: http://localhost:8001/docs"
else
    echo "❌ 后端服务未运行"
fi

echo ""

# 检查前端
echo "🎨 前端服务 (端口 3000):"
if curl -s -I http://localhost:3000 | grep -q "200 OK"; then
    echo "✅ 前端服务运行正常"
    echo "📱 前端地址: http://localhost:3000"
else
    echo "❌ 前端服务未运行"
fi

echo ""
echo "🔗 快速访问链接:"
echo "前端: http://localhost:3000"
echo "后端API: http://localhost:8001"
echo "API文档: http://localhost:8001/docs"