/**
 * FlowPilot - 主服务器入口
 * 初始化 Fastify 实例，注册插件和路由，启动 HTTP 服务
 */

import 'dotenv/config';
import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { createModuleLogger } from './utils/logger';
import { initDatabase } from './db/queries';
import { triggerManager } from './core/trigger/manager';
import workflowRoutes from './routes/workflow.routes';
import credentialRoutes from './routes/credential.routes';
import executionRoutes from './routes/execution.routes';
import nodeDefinitionRoutes from './routes/node-definition.routes';
import webhookRoutes from './routes/webhook.routes';
import wechatRoutes from './routes/wechat.routes';
import sseRoutes from './routes/sse.routes';

const log = createModuleLogger('server');

/** 服务器端口 */
const PORT = parseInt(process.env.PORT ?? '3210', 10);

/** 主机地址 */
const HOST = process.env.HOST ?? '0.0.0.0';

/**
 * 创建并配置 Fastify 实例
 */
async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // ========== 注册插件 ==========

  // CORS 跨域支持
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  // 静态文件服务（前端构建产物）
  const publicDir = path.resolve(process.cwd(), 'public');
  await fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
    wildcard: false,
    decorateReply: false,
  });

  // ========== 注册路由 ==========

  await fastify.register(workflowRoutes);
  await fastify.register(credentialRoutes);
  await fastify.register(executionRoutes);
  await fastify.register(nodeDefinitionRoutes);
  await fastify.register(webhookRoutes);
  await fastify.register(wechatRoutes);
  await fastify.register(sseRoutes);

  // ========== 健康检查 ==========

  fastify.get('/api/health', async (_request, reply) => {
    return reply.status(200).send({
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  });

  // ========== 404 处理 ==========

  fastify.setNotFoundHandler(async (request, reply) => {
    // 如果请求的是 API 路径，返回 JSON 404
    if (request.url.startsWith('/api/') || request.url.startsWith('/webhook/')) {
      return reply.status(404).send({
        error: '接口不存在',
        code: 'NOT_FOUND',
        path: request.url,
      });
    }

    // 非 API 路径尝试返回 index.html（SPA 路由支持）
    try {
      return reply.sendFile('index.html');
    } catch {
      return reply.status(404).send({ error: '页面不存在' });
    }
  });

  // ========== 全局错误处理 ==========

  fastify.setErrorHandler((error, _request, reply) => {
    log.error(`未处理的错误: ${error.message}`);
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? '服务器内部错误' : error.message,
      code: 'INTERNAL_ERROR',
    });
  });

  return fastify;
}

/**
 * 主启动流程
 */
async function main() {
  try {
    log.info('FlowPilot 后端服务启动中...');

    // 1. 初始化数据库
    log.info('正在初始化数据库...');
    initDatabase();
    log.info('数据库初始化完成');

    // 2. 创建服务器实例
    const fastify = await createServer();

    // 3. 恢复活跃工作流的触发器
    log.info('正在恢复触发器...');
    try {
      await triggerManager.restoreAll();
      log.info('触发器恢复完成');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '未知错误';
      log.warn(`触发器恢复失败（非致命）: ${errMsg}`);
    }

    // 4. 启动 HTTP 服务
    await fastify.listen({ port: PORT, host: HOST });

    // 5. 输出启动信息
    const activeWorkflows = await getActiveWorkflowCount();
    log.info('========================================');
    log.info('FlowPilot 后端服务已启动');
    log.info(`  端口: ${PORT}`);
    log.info(`  数据库: ${process.env.DB_PATH ?? './data/flowpilot.db'}`);
    log.info(`  活跃工作流: ${activeWorkflows}`);
    log.info(`  环境: ${process.env.NODE_ENV ?? 'development'}`);
    log.info('========================================');

    // 6. 优雅关闭处理
    const gracefulShutdown = async (signal: string) => {
      log.info(`收到 ${signal} 信号，正在优雅关闭...`);
      try {
        await triggerManager.unregisterAll();
        await fastify.close();
        log.info('服务已安全关闭');
        process.exit(0);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '未知错误';
        log.error(`关闭过程中出错: ${errMsg}`);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '未知错误';
    log.error(`服务启动失败: ${errMsg}`);
    process.exit(1);
  }
}

/**
 * 获取活跃工作流数量
 */
async function getActiveWorkflowCount(): Promise<number> {
  try {
    const { getWorkflowCountByStatus } = await import('./db/queries');
    return getWorkflowCountByStatus('active');
  } catch {
    return 0;
  }
}

// 启动服务
main();
