/**
 * FlowPilot - Server-Sent Events 事件发射器
 * 单例模式，用于广播工作流执行的实时事件
 */

import { IncomingMessage, ServerResponse } from 'http';
import { createModuleLogger } from './logger';
import type { SSEEvent } from '../types';

const logger = createModuleLogger('sse');

/** SSE 客户端连接管理器 */
class SSEManager {
  private clients: Set<ServerResponse> = new Set();

  /**
   * 添加 SSE 客户端连接
   * @param res - HTTP 响应对象
   */
  addClient(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });

    // 发送初始连接确认
    res.write('data: {"type":"connected"}\n\n');

    this.clients.add(res);
    logger.info(`SSE 客户端已连接，当前连接数: ${this.clients.size}`);

    // 心跳保活
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    // 客户端断开时清理
    res.on('close', () => {
      clearInterval(heartbeat);
      this.removeClient(res);
    });
  }

  /**
   * 移除 SSE 客户端连接
   * @param res - HTTP 响应对象
   */
  removeClient(res: ServerResponse): void {
    this.clients.delete(res);
    logger.info(`SSE 客户端已断开，当前连接数: ${this.clients.size}`);
  }

  /**
   * 向所有客户端广播事件
   * @param event - 事件名称
   * @param data - 事件数据
   */
  broadcast(event: string, data: Record<string, unknown>): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let sentCount = 0;

    for (const client of this.clients) {
      if (!client.writableEnded) {
        client.write(message);
        sentCount++;
      } else {
        this.clients.delete(client);
      }
    }

    logger.debug(`SSE 事件已广播: ${event}，发送给 ${sentCount} 个客户端`);
  }

  /**
   * 向指定客户端发送事件
   * @param res - 目标客户端响应对象
   * @param event - 事件名称
   * @param data - 事件数据
   */
  sendTo(res: ServerResponse, event: string, data: Record<string, unknown>): void {
    if (!res.writableEnded) {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      res.write(message);
    }
  }

  /**
   * 获取当前连接的客户端数量
   * @returns 客户端数量
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * 关闭所有客户端连接
   */
  closeAll(): void {
    for (const client of this.clients) {
      if (!client.writableEnded) {
        client.end();
      }
    }
    this.clients.clear();
    logger.info('所有 SSE 客户端连接已关闭');
  }
}

/** 全局单例 SSE 管理器 */
export const sseManager = new SSEManager();

/**
 * 广播执行事件的便捷方法
 * @param event - SSE 事件
 */
export function broadcastExecutionEvent(event: SSEEvent): void {
  sseManager.broadcast(event.event, event.data);
}

export default sseManager;
