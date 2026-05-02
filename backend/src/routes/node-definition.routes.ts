/**
 * FlowPilot - 节点定义 API 路由
 * 提供所有可用节点类型定义的查询接口
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as nodeDefinitionService from '../services/node-definition.service';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('node-definition-routes');

/** 节点类型参数 Schema */
const NodeTypeSchema = z.object({
  type: z.string().min(1, '节点类型不能为空'),
});

/**
 * 节点定义路由插件
 */
const nodeDefinitionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/node-definitions - 获取所有节点定义
   */
  fastify.get('/api/node-definitions', async (_request, reply) => {
    try {
      const definitions = await nodeDefinitionService.getAllNodeDefinitions();
      return reply.status(200).send({ data: definitions, total: definitions.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取节点定义列表失败';
      log.error(`获取节点定义列表失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/node-definitions/:type - 获取单个节点定义
   */
  fastify.get('/api/node-definitions/:type', async (request, reply) => {
    try {
      const { type } = NodeTypeSchema.parse(request.params);
      const definition = await nodeDefinitionService.getNodeDefinition(type);
      if (!definition) {
        return reply.status(404).send({
          error: `未找到节点定义: ${type}`,
          code: 'NOT_FOUND',
        });
      }
      return reply.status(200).send({ data: definition });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的节点类型',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '获取节点定义失败';
      log.error(`获取节点定义失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });
};

export default nodeDefinitionRoutes;
