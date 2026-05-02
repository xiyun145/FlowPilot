/**
 * FlowPilot - 节点执行器注册表
 * 使用注册表模式管理所有节点类型的执行器函数
 */

import { createModuleLogger } from '../../utils/logger';
import { getCredential } from '../../db/queries';
import { decrypt } from '../../utils/crypto';
import type { NodeExecutorFunction, NodeContext, NodeDefinition } from '../../types';

const logger = createModuleLogger('registry');

/** 节点执行器注册表 */
const executorRegistry = new Map<string, NodeExecutorFunction>();

/** 节点定义注册表 */
const definitionRegistry = new Map<string, NodeDefinition>();

/**
 * 注册节点执行器
 * @param type - 节点类型标识符
 * @param executor - 执行器函数
 */
export function registerNodeExecutor(type: string, executor: NodeExecutorFunction): void {
  if (executorRegistry.has(type)) {
    logger.warn(`节点执行器 "${type}" 已存在，将被覆盖`);
  }
  executorRegistry.set(type, executor);
  logger.info(`节点执行器已注册: ${type}`);
}

/**
 * 获取节点执行器
 * @param type - 节点类型标识符
 * @returns 执行器函数
 * @throws 如果执行器未注册则抛出错误
 */
export function getNodeExecutor(type: string): NodeExecutorFunction {
  const executor = executorRegistry.get(type);
  if (!executor) {
    throw new Error(`未找到节点执行器: "${type}"，请确认该节点类型已注册`);
  }
  return executor;
}

/**
 * 注册节点定义
 * @param definition - 节点定义对象
 */
export function registerNodeDefinition(definition: NodeDefinition): void {
  if (definitionRegistry.has(definition.type)) {
    logger.warn(`节点定义 "${definition.type}" 已存在，将被覆盖`);
  }
  definitionRegistry.set(definition.type, definition);
  logger.info(`节点定义已注册: ${definition.type} (${definition.name})`);
}

/**
 * 获取节点定义
 * @param type - 节点类型标识符
 * @returns 节点定义对象或 undefined
 */
export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return definitionRegistry.get(type);
}

/**
 * 获取所有已注册的节点定义
 * @returns 节点定义数组
 */
export function getAllNodeDefinitions(): NodeDefinition[] {
  return Array.from(definitionRegistry.values());
}

/**
 * 检查节点执行器是否已注册
 * @param type - 节点类型标识符
 * @returns 是否已注册
 */
export function hasNodeExecutor(type: string): boolean {
  return executorRegistry.has(type);
}

/**
 * 获取所有已注册的节点类型列表
 * @returns 节点类型标识符数组
 */
export function getRegisteredNodeTypes(): string[] {
  return Array.from(executorRegistry.keys());
}

/**
 * 创建节点上下文对象
 * @param params - 上下文参数
 * @returns 节点上下文对象
 */
export function createNodeContext(params: {
  workflowId: string;
  executionId: string;
  nodeId: string;
}): NodeContext {
  return {
    workflowId: params.workflowId,
    executionId: params.executionId,
    nodeId: params.nodeId,
    getCredential: async (credentialId: string): Promise<string | null> => {
      try {
        const credential = await getCredential(credentialId);
        if (!credential) return null;
        return decrypt(credential.encryptedValue, credential.iv, credential.authTag);
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        logger.error(`获取凭据失败: ${credentialId} - ${message}`);
        return null;
      }
    },
    logger: {
      info: (message: string, meta?: Record<string, unknown>) => {
        if (meta) logger.info(meta, `[${params.nodeId}] ${message}`);
        else logger.info(`[${params.nodeId}] ${message}`);
      },
      warn: (message: string, meta?: Record<string, unknown>) => {
        if (meta) logger.warn(meta, `[${params.nodeId}] ${message}`);
        else logger.warn(`[${params.nodeId}] ${message}`);
      },
      error: (message: string, meta?: Record<string, unknown>) => {
        if (meta) logger.error(meta, `[${params.nodeId}] ${message}`);
        else logger.error(`[${params.nodeId}] ${message}`);
      },
      debug: (message: string, meta?: Record<string, unknown>) => {
        if (meta) logger.debug(meta, `[${params.nodeId}] ${message}`);
        else logger.debug(`[${params.nodeId}] ${message}`);
      },
    },
  };
}

/**
 * 清空所有注册表（用于测试）
 */
export function clearRegistry(): void {
  executorRegistry.clear();
  definitionRegistry.clear();
  logger.info('所有节点注册表已清空');
}
