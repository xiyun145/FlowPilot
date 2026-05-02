/**
 * FlowPilot - 工作流 API 路由
 * 提供工作流的 CRUD、手动执行、切换状态和导入功能
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as workflowService from '../services/workflow.service';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('workflow-routes');

/** 创建工作流的请求体 Schema */
const CreateWorkflowSchema = z.object({
  name: z.string().min(1, '工作流名称不能为空').max(100, '工作流名称不能超过100个字符'),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    nodeType: z.enum(['trigger', 'wechat', 'gemini', 'action', 'logic']),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.unknown()),
    label: z.string(),
  })).optional(),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
  })).optional(),
  triggerType: z.enum(['cron', 'webhook', 'wechat_message']).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
});

/** 更新工作流的请求体 Schema */
const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    nodeType: z.enum(['trigger', 'wechat', 'gemini', 'action', 'logic']),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.unknown()),
    label: z.string(),
  })).optional(),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
  })).optional(),
  triggerType: z.enum(['cron', 'webhook', 'wechat_message']).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
});

/** 工作流 ID 参数 Schema */
const WorkflowIdSchema = z.object({
  id: z.string().uuid('无效的工作流 ID 格式'),
});

/** 导入工作流请求体 Schema */
const ImportWorkflowSchema = z.object({
  jsonData: z.string().min(1, 'JSON 数据不能为空'),
});

/**
 * 工作流路由插件
 */
const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/workflows - 创建工作流
   */
  fastify.post('/api/workflows', async (request, reply) => {
    try {
      const body = CreateWorkflowSchema.parse(request.body);
      const workflow = await workflowService.createWorkflow(body);
      return reply.status(201).send({ data: workflow });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '请求参数验证失败',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '创建工作流失败';
      log.error(`创建工作流失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/workflows - 获取所有工作流列表
   */
  fastify.get('/api/workflows', async (_request, reply) => {
    try {
      const { getAllWorkflows } = await import('../db/queries');
      const workflows = await getAllWorkflows();
      return reply.status(200).send({ data: workflows, total: workflows.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取工作流列表失败';
      log.error(`获取工作流列表失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/workflows/:id - 获取单个工作流
   */
  fastify.get('/api/workflows/:id', async (request, reply) => {
    try {
      const { id } = WorkflowIdSchema.parse(request.params);
      const result = await workflowService.getWorkflowWithStats(id);
      return reply.status(200).send({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的工作流 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '获取工作流详情失败';
      log.error(`获取工作流详情失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * PUT /api/workflows/:id - 更新工作流
   */
  fastify.put('/api/workflows/:id', async (request, reply) => {
    try {
      const { id } = WorkflowIdSchema.parse(request.params);
      const body = UpdateWorkflowSchema.parse(request.body);
      const workflow = await workflowService.updateWorkflow(id, body);
      return reply.status(200).send({ data: workflow });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '请求参数验证失败',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '更新工作流失败';
      log.error(`更新工作流失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * DELETE /api/workflows/:id - 删除工作流
   */
  fastify.delete('/api/workflows/:id', async (request, reply) => {
    try {
      const { id } = WorkflowIdSchema.parse(request.params);
      await workflowService.deleteWorkflow(id);
      return reply.status(200).send({ data: { message: '工作流已删除' } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的工作流 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '删除工作流失败';
      log.error(`删除工作流失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * POST /api/workflows/:id/execute - 手动执行工作流
   */
  fastify.post('/api/workflows/:id/execute', async (request, reply) => {
    try {
      const { id } = WorkflowIdSchema.parse(request.params);
      const triggerData = (request.body as Record<string, unknown>) ?? {};
      const execution = await workflowService.executeWorkflow(id, triggerData);
      return reply.status(200).send({ data: execution });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的工作流 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '执行工作流失败';
      log.error(`执行工作流失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * POST /api/workflows/:id/toggle - 切换工作流激活/暂停状态
   */
  fastify.post('/api/workflows/:id/toggle', async (request, reply) => {
    try {
      const { id } = WorkflowIdSchema.parse(request.params);
      const workflow = await workflowService.toggleWorkflow(id);
      return reply.status(200).send({ data: workflow });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的工作流 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '切换工作流状态失败';
      log.error(`切换工作流状态失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * POST /api/workflows/import - 从 JSON 导入工作流
   */
  fastify.post('/api/workflows/import', async (request, reply) => {
    try {
      const { jsonData } = ImportWorkflowSchema.parse(request.body);
      const workflow = await workflowService.importWorkflow(jsonData);
      return reply.status(201).send({ data: workflow });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '请求参数验证失败',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '导入工作流失败';
      log.error(`导入工作流失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });
};

export default workflowRoutes;
