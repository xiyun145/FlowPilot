#!/bin/bash
# FlowPilot 一键启动脚本 (Mac/Linux)
# 使用方法: chmod +x start.sh && ./start.sh

set -e

echo "============================================"
echo "  FlowPilot - 个人自动化工作流引擎"
echo "============================================"
echo ""

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "错误: 未检测到 Node.js，请先安装 Node.js 18+"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "错误: Node.js 版本过低，需要 18+，当前版本: $(node -v)"
    exit 1
fi

echo "Node.js 版本: $(node -v)"

# 安装后端依赖
echo ""
echo "[1/4] 安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "后端依赖已存在，跳过安装"
fi

# 安装前端依赖
echo ""
echo "[2/4] 安装前端依赖..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "前端依赖已存在，跳过安装"
fi

# 构建前端
echo ""
echo "[3/4] 构建前端..."
npm run build

# 回到根目录
cd ..

# 初始化环境变量
if [ ! -f "backend/.env" ]; then
    echo ""
    echo "[4/4] 初始化环境配置..."
    cp .env.example backend/.env
    # 生成随机加密密钥
    ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s/your-32-char-encryption-key-here/$ENCRYPTION_KEY/" backend/.env
    echo "已生成随机加密密钥并写入 backend/.env"
else
    echo ""
    echo "[4/4] 环境配置已存在，跳过初始化"
fi

# 创建数据目录
mkdir -p backend/data/files

# 启动服务
echo ""
echo "============================================"
echo "  启动 FlowPilot 服务..."
echo "  访问地址: http://localhost:3210"
echo "============================================"
echo ""
cd backend
npm start
