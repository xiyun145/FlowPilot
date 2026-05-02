/**
 * FlowPilot - SSE (Server-Sent Events) 路由
 * 提供执行进度的实时推送和全局执行事件流
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { EventEmitter } from 'events';
import * as executionService from '../services/execution.service';
import { createModuleLogger } from '../utils/logger';
import type { SSEEvent } from '../types';

const log = createModuleLogger('sse-routes');

/** 全局事件总线，用于 SSE 推送 */
export const sseEventBus = new EventEmitter();

/** SSE 事件类型 */
type SSEEventType = SSEEvent['event'];

/** 执行 ID 参数 Schema */
const ExecutionIdSchema = z.object({
  id: z.string().uuid('无效的执行 ID 格式'),
});

/**
 * 向客户端发送 SSE 事件
 * @param reply - Fastify Reply 对象
 * @param event - 事件名称
 * @param data - 事件数据
 */
function sendSSEEvent(
  reply: FastifyReply,
  event: string,
  data: Record<string, unknown>,
): void {
  try {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    reply.raw.write(payload);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '未知错误';
    log.error(`发送 SSE 事件失败: ${errMsg}`);
  }
}

/**
 * SSE 路由插件
 */
const sseRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/sse/executions/:id - 单个执行的 SSE 进度流
   * 客户端通过此连接实时获取某个执行的节点进度
   */
  fastify.get('/api/sse/executions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = ExecutionIdSchema.parse(request.params);

      // 设置 SSE 响应头
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // 立即发送连接建立事件
      sendSSEEvent(reply, 'connected', {
        executionId: id,
        timestamp: new Date().toISOString(),
      });

      // 先推送当前执行状态
      try {
        const detail = await executionService.getExecutionDetail(id);
        sendSSEEvent(reply, 'execution:status', {
          executionId: id,
          status: detail.execution.status,
          startedAt: detail.execution.startedAt,
          finishedAt: detail.execution.finishedAt,
          nodeExecutions: detail.nodeExecutions,
        });
      } catch {
        // 执行可能尚未创建，忽略错误
      }

      // 监听特定执行的事件
      const onExecutionEvent = (event: SSEEvent) => {
        if (event.data.executionId === id) {
          sendSSEEvent(reply, event.event, event.data);
        }
      };

      sseEventBus.on('execution:event', onExecutionEvent);

      // 心跳保活（每 30 秒）
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(':heartbeat\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // 客户端断开连接时清理
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        sseEventBus.off('execution:event', onExecutionEvent);
        log.debug(`SSE 连接已关闭: 执行 ${id}`);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.raw.writeHead(400, { 'Content-Type': 'application/json' });
        reply.raw.end(JSON.stringify({
          error: '无效的执行 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        }));
        return;
      }
      const message = error instanceof Error ? error.message : '建立 SSE 连接失败';
      log.error(`SSE 连接失败: ${message}`);
      reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({ error: message }));
    }
  });

  /**
   * GET /api/sse/events - 全局执行事件流
   * 接收所有工作流的执行事件
   */
  fastify.get('/api/sse/events', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 设置 SSE 响应头
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // 发送连接建立事件
      sendSSEEvent(reply, 'connected', {
        timestamp: new Date().toISOString(),
        message: '已连接到全局事件流',
      });

      // 监听所有执行事件
      const onExecutionEvent = (event: SSEEvent) => {
        sendSSEEvent(reply, event.event, event.data);
      };

      sseEventBus.on('execution:event', onExecutionEvent);

      // 心跳保活（每 30 秒）
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(':heartbeat\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // 客户端断开连接时清理
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        sseEventBus.off('execution:event', onExecutionEvent);
        log.debug('全局 SSE 连接已关闭');
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '建立全局 SSE 连接失败';
      log.error(`全局 SSE 连接失败: ${message}`);
      reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
      reply.raw.end(JSON.stringify({ error: message }));
    }
  });
};

/**
 * 向 SSE 事件总线发送执行事件
 * 由执行引擎调用，通知所有 SSE 客户端
 * @param event - SSE 事件
 */
export function emitExecutionEvent(event: SSEEvent): void {
  sseEventBus.emit('execution:event', event);
}

export default sseRoutes;
