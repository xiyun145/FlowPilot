FROM node:20-alpine

WORKDIR /app

# 安装后端依赖
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# 安装前端依赖并构建
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 复制后端代码
COPY backend/ ./backend/

# 创建数据目录
RUN mkdir -p /app/backend/data/files

# 暴露端口
EXPOSE 3210

# 启动服务
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
