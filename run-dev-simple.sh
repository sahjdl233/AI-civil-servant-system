#!/bin/bash

# 智考AI平台 - 简单启动脚本

echo "🚀 智考AI平台 - 启动中..."

# 检查并启动数据库
echo "📦 启动PostgreSQL数据库..."
docker-compose up -d postgres

# 等待数据库启动
sleep 5

# 运行数据库迁移
echo "🔄 运行数据库迁移..."
cd backend && alembic upgrade head
cd ..

# 启动后端 (端口 8001)
echo "🔧 启动后端服务..."
cd backend
uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 启动前端 (端口 3000)
echo "🎨 启动前端服务..."
cd frontend
npm run dev -- --port 3000 &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 启动完成！"
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:8001"
echo "📚 API文档: http://localhost:8001/docs"
echo ""
echo "按 Ctrl+C 停止服务"

# 等待用户中断
trap "echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; docker-compose down; exit" INT

wait