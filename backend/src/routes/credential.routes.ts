/**
 * FlowPilot - 凭据 API 路由
 * 提供凭据的创建、查询、更新、删除和测试功能
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as credentialService from '../services/credential.service';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('credential-routes');

/** 创建凭据的请求体 Schema */
const CreateCredentialSchema = z.object({
  name: z.string().min(1, '凭据名称不能为空').max(100, '凭据名称不能超过100个字符'),
  type: z.string().min(1, '凭据类型不能为空'),
  value: z.string().min(1, '凭据值不能为空'),
});

/** 更新凭据的请求体 Schema */
const UpdateCredentialSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  value: z.string().min(1).optional(),
});

/** 凭据 ID 参数 Schema */
const CredentialIdSchema = z.object({
  id: z.string().uuid('无效的凭据 ID 格式'),
});

/** 测试凭据的请求体 Schema */
const TestCredentialSchema = z.object({
  type: z.string().min(1, '凭据类型不能为空'),
});

/**
 * 凭据路由插件
 */
const credentialRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/credentials - 创建凭据
   */
  fastify.post('/api/credentials', async (request, reply) => {
    try {
      const body = CreateCredentialSchema.parse(request.body);
      const credential = await credentialService.createCredential(
        body.name,
        body.type,
        body.value,
      );
      return reply.status(201).send({ data: credential });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '请求参数验证失败',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '创建凭据失败';
      log.error(`创建凭据失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/credentials - 获取所有凭据列表（值已脱敏）
   */
  fastify.get('/api/credentials', async (_request, reply) => {
    try {
      const credentials = await credentialService.getAllCredentials();
      return reply.status(200).send({ data: credentials, total: credentials.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取凭据列表失败';
      log.error(`获取凭据列表失败: ${message}`);
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * GET /api/credentials/:id - 获取单个凭据（解密）
   */
  fastify.get('/api/credentials/:id', async (request, reply) => {
    try {
      const { id } = CredentialIdSchema.parse(request.params);
      const credential = await credentialService.getCredentialDecrypted(id);
      return reply.status(200).send({ data: credential });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的凭据 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '获取凭据详情失败';
      log.error(`获取凭据详情失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * PUT /api/credentials/:id - 更新凭据
   */
  fastify.put('/api/credentials/:id', async (request, reply) => {
    try {
      const { id } = CredentialIdSchema.parse(request.params);
      const body = UpdateCredentialSchema.parse(request.body);
      const credential = await credentialService.updateCredential(id, body);
      return reply.status(200).send({ data: credential });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '请求参数验证失败',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '更新凭据失败';
      log.error(`更新凭据失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * DELETE /api/credentials/:id - 删除凭据
   */
  fastify.delete('/api/credentials/:id', async (request, reply) => {
    try {
      const { id } = CredentialIdSchema.parse(request.params);
      await credentialService.deleteCredential(id);
      return reply.status(200).send({ data: { message: '凭据已删除' } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '无效的凭据 ID',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '删除凭据失败';
      log.error(`删除凭据失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });

  /**
   * POST /api/credentials/:id/test - 测试凭据有效性
   */
  fastify.post('/api/credentials/:id/test', async (request, reply) => {
    try {
      const { id } = CredentialIdSchema.parse(request.params);
      const body = TestCredentialSchema.parse(request.body);
      const result = await credentialService.testCredential(id, body.type);
      return reply.status(200).send({ data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: '请求参数验证失败',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }
      const message = error instanceof Error ? error.message : '测试凭据失败';
      log.error(`测试凭据失败: ${message}`);
      if (message.includes('不存在')) {
        return reply.status(404).send({ error: message, code: 'NOT_FOUND' });
      }
      return reply.status(500).send({ error: message });
    }
  });
};

export default credentialRoutes;
