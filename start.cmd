@echo off
chcp 65001 >nul 2>&1
mode con: cp select=65001 >nul 2>&1
set LANG=zh_CN.UTF-8
set PYTHONIOENCODING=utf-8
setlocal enabledelayedexpansion

echo ============================================
echo   FlowPilot - 个人自动化工作流引擎
echo ============================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未检测到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -v') do (
    set NODE_VER=%%a
    set NODE_VER=!NODE_VER:v=!
)

echo Node.js 版本:
node -v

:: 安装后端依赖
echo.
echo [1/4] 安装后端依赖...
cd backend
if not exist "node_modules" (
    call npm install
) else (
    echo 后端依赖已存在，跳过安装
)

:: 安装前端依赖
echo.
echo [2/4] 安装前端依赖...
cd ..\frontend
if not exist "node_modules" (
    call npm install
) else (
    echo 前端依赖已存在，跳过安装
)

:: 构建前端
echo.
echo [3/4] 构建前端...
call npm run build

:: 回到根目录
cd ..

:: 初始化环境变量
if not exist "backend\.env" (
    echo.
    echo [4/4] 初始化环境配置...
    copy .env.example backend\.env >nul
    echo 已创建环境配置文件 backend\.env
    echo 请手动修改 ENCRYPTION_KEY 为随机32位字符串
) else (
    echo.
    echo [4/4] 环境配置已存在，跳过初始化
)

:: 创建数据目录
if not exist "backend\data\files" mkdir "backend\data\files"

:: 启动服务
echo.
echo ============================================
echo   启动 FlowPilot 服务...
echo   访问地址: http://localhost:3210
echo ============================================
echo.
cd backend
chcp 65001 >nul 2>&1
node dist/index.js
