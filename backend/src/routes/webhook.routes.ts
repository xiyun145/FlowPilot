/**
 * FlowPilot - Webhook 触发器路由
 * 接收外部 HTTP 请求并触发对应工作流执行
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as queries from '../db/queries';
import { executor } from '../core/engine/executor';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('webhook-routes');

/** Webhook 路径参数 Schema */
const WebhookParamsSchema = z.object({
  workflowId: z.string().uuid('无效的工作流 ID 格式'),
});

/**
 * Webhook 路由插件
 * 支持任意 HTTP 方法触发工作流
 */
const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * ANY /webhook/:workflowId - 接收 Webhook 请求并触发工作流
   * 支持 GET、POST、PUT、DELETE、PATCH 等所有 HTTP 方法
   */
  const handleWebhook = async (
    request: { params: unknown; body: unknown; query: unknown; headers: Record<string, string | string[] | undefined> },
    reply: { status: (code: number) => { send: (data: unknown) => unknown } },
  ) => {
    try {
      const { workflowId } = WebhookParamsSchema.parse(request.params);

      // 验证工作流是否存在
      const workflow = await queries.getWorkflowById(workflowId);
      if (!workflow) {
        return reply.status(404).send({
          error: '工作流不存在',
          code: 'NOT_FOUND',
        });
      }

      // 验证工作流是否配置了 Webhook 触发器
      if (workflow.triggerType !== 'webhook') {
        return reply.status(400).send({
          error: '该工作流未配置 Webhook 触发器',
          code: 'INVALID_TRIGGER_TYPE',
        });
      }

      // 检查 HTTP 方法是否匹配
      const webhookConfig = workflow.triggerConfig as { method?: string; path?: string } | undefined;
      if (webhookConfig?.method && webhookConfig.method !== 'ANY') {
        const requestMethod = request.headers['x-http-method-override'] as string || 'POST';
        if (webhookConfig.method !== requestMethod) {
          return reply.status(405).send({
            error: `不支持的 HTTP 方法: ${requestMethod}，期望: ${webhookConfig.method}`,
            code: 'METHOD_NOT_ALLOWED',
          });
        }
      }

      // 构建触发数据
      const triggerData: Record<string, unknown> = {
        body: request.body ?? {},
        query: request.query ?? {},
        headers: request.headers,
        method: request.headers['x-http-method-override'] || 'POST',
        timestamp: new Date().toISOString(),
      };

      log.info(`Webhook 触发工作流: ${workflowId}`);

      // 异步执行工作流（不阻塞响应）
      executor.run(workflow, triggerData).catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : '未知错误';
        log.error(`Webhook 触发的工作流执行失败: ${errMsg}`);
      });

      return reply.status(200).send({
        data: {
          message: 'Webhook 已接收，工作流正在执行',
          workflowId,
          executionTriggered: true,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的工作流 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '处理 Webhook 失败';
      log.error(`Webhook 处理失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  };

  // 注册所有 HTTP 方法
  fastify.all('/webhook/:workflowId', handleWebhook);
};

export default webhookRoutes;
