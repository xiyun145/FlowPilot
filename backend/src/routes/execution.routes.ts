/**
 * FlowPilot - 执行记录 API 路由
 * 提供执行记录的查询、取消和统计功能
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as executionService from '../services/execution.service';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('execution-routes');

/** 执行记录查询参数 Schema */
const ListExecutionsSchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** 执行 ID 参数 Schema */
const ExecutionIdSchema = z.object({
  id: z.string().uuid('无效的执行 ID 格式'),
});

/**
 * 执行记录路由插件
 */
const executionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/executions/stats - 获取全局统计信息
   * 注意：此路由必须在 /:id 之前注册，避免被参数路由匹配
   */
  fastify.get('/api/executions/stats', async (_request, reply) => {
    try {
      const stats = await executionService.getStats();
      return reply.status(200).send({ data: stats });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取统计信息失败';
      log.error(`获取统计信息失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/executions - 获取执行记录列表（支持过滤和分页）
   */
  fastify.get('/api/executions', async (request, reply) => {
    try {
      const filters = ListExecutionsSchema.parse(request.query);
      const result = await executionService.getExecutions(filters);
      return reply.status(200).send({
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '查询参数验证失败',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '获取执行记录失败';
      log.error(`获取执行记录失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/executions/:id - 获取执行详情
   */
  fastify.get('/api/executions/:id', async (request, reply) => {
    try {
      const { id } = ExecutionIdSchema.parse(request.params);
      const detail = await executionService.getExecutionDetail(id);
      return reply.status(200).send({ data: detail });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的执行 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '获取执行详情失败';
      log.error(`获取执行详情失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * POST /api/executions/:id/cancel - 取消执行
   */
  fastify.post('/api/executions/:id/cancel', async (request, reply) => {
    try {
      const { id } = ExecutionIdSchema.parse(request.params);
      const execution = await executionService.cancelExecution(id);
      return reply.status(200).send({ data: execution });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的执行 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '取消执行失败';
      log.error(`取消执行失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(400).send({ error: message });
    }
  });
};

export default executionRoutes;
