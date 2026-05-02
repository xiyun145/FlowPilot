/**
 * FlowPilot - 工作流业务逻辑服务
 * 提供工作流的创建、更新、执行、切换、删除和导入等核心功能
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow,
  WorkflowStatus,
  TriggerType,
  WorkflowNode,
  WorkflowEdge,
  CronConfig,
  WebhookConfig,
  WechatConfig,
  Execution,
} from '../types';
import * as queries from '../db/queries';
import { executor } from '../core/engine/executor';
import { triggerManager } from '../core/trigger/manager';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('workflow-service');

/** 创建工作流的参数 */
interface CreateWorkflowData {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  triggerType?: TriggerType;
  triggerConfig?: CronConfig | WebhookConfig | WechatConfig | Record<string, unknown>;
}

/** 更新工作流的参数 */
interface UpdateWorkflowData {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  triggerType?: TriggerType;
  triggerConfig?: CronConfig | WebhookConfig | WechatConfig | Record<string, unknown>;
  status?: WorkflowStatus;
}

/** 工作流统计信息 */
interface WorkflowWithStats {
  workflow: Workflow;
  lastExecution: Execution | null;
  executionCount: number;
}

/**
 * 创建新的工作流
 * @param data - 工作流数据
 * @returns 创建的工作流
 */
export async function createWorkflow(data: CreateWorkflowData): Promise<Workflow> {
  try {
    const now = new Date().toISOString();
    const workflow: Workflow = {
      id: uuidv4(),
      name: data.name,
      description: data.description ?? '',
      status: 'draft',
      nodes: data.nodes ?? [],
      edges: data.edges ?? [],
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig,
      createdAt: now,
      updatedAt: now,
    };

    await queries.insertWorkflow(workflow);
    log.info(`工作流已创建: ${workflow.id} - ${workflow.name}`);
    return workflow;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`创建工作流失败: ${message}`);
  }
}

/**
 * 更新工作流
 * @param id - 工作流ID
 * @param data - 需要更新的字段
 * @returns 更新后的工作流
 */
export async function updateWorkflow(id: string, data: UpdateWorkflowData): Promise<Workflow> {
  try {
    const existing = await queries.getWorkflowById(id);
    if (!existing) {
      throw new Error(`工作流不存在: ${id}`);
    }

    const updated: Workflow = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await queries.updateWorkflow(updated);
    log.info(`工作流已更新: ${id}`);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`更新工作流失败: ${message}`);
  }
}

/**
 * 执行工作流
 * @param id - 工作流ID
 * @param triggerData - 触发数据（可选）
 * @returns 执行记录
 */
export async function executeWorkflow(
  id: string,
  triggerData?: Record<string, unknown>,
): Promise<Execution> {
  try {
    const workflow = await queries.getWorkflowById(id);
    if (!workflow) {
      throw new Error(`工作流不存在: ${id}`);
    }

    log.info(`开始执行工作流: ${id} - ${workflow.name}`);
    const execution = await executor.run(workflow, triggerData);
    log.info(`工作流执行完成: ${id}, 状态: ${execution.status}`);
    return execution;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`执行工作流失败: ${message}`);
  }
}

/**
 * 切换工作流的激活/暂停状态
 * @param id - 工作流ID
 * @returns 更新后的工作流
 */
export async function toggleWorkflow(id: string): Promise<Workflow> {
  try {
    const workflow = await queries.getWorkflowById(id);
    if (!workflow) {
      throw new Error(`工作流不存在: ${id}`);
    }

    const newStatus: WorkflowStatus = workflow.status === 'active' ? 'paused' : 'active';

    if (newStatus === 'active') {
      // 激活：注册触发器
      if (workflow.triggerType && workflow.triggerConfig) {
        await triggerManager.register(workflow.id, workflow.triggerType, workflow.triggerConfig as Record<string, unknown>);
        log.info(`触发器已注册: 工作流 ${id}, 类型 ${workflow.triggerType}`);
      }
    } else {
      // 暂停：移除触发器
      await triggerManager.unregister(workflow.id);
      log.info(`触发器已移除: 工作流 ${id}`);
    }

    const updated: Workflow = {
      ...workflow,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    await queries.updateWorkflow(updated);
    log.info(`工作流状态已切换: ${id} -> ${newStatus}`);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`切换工作流状态失败: ${message}`);
  }
}

/**
 * 删除工作流及其所有执行记录
 * @param id - 工作流ID
 */
export async function deleteWorkflow(id: string): Promise<void> {
  try {
    const workflow = await queries.getWorkflowById(id);
    if (!workflow) {
      throw new Error(`工作流不存在: ${id}`);
    }

    // 如果是激活状态，先移除触发器
    if (workflow.status === 'active') {
      await triggerManager.unregister(id);
    }

    // 删除所有关联的执行记录
    await queries.deleteExecutionsByWorkflowId(id);
    // 删除工作流
    await queries.deleteWorkflow(id);

    log.info(`工作流已删除: ${id} - ${workflow.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`删除工作流失败: ${message}`);
  }
}

/**
 * 获取工作流及其统计信息
 * @param id - 工作流ID
 * @returns 工作流详情及执行统计
 */
export async function getWorkflowWithStats(id: string): Promise<WorkflowWithStats> {
  try {
    const workflow = await queries.getWorkflowById(id);
    if (!workflow) {
      throw new Error(`工作流不存在: ${id}`);
    }

    const executions = await queries.getExecutionsByWorkflowId(id, 1, 0);
    const executionCount = await queries.getExecutionCountByWorkflowId(id);

    return {
      workflow,
      lastExecution: executions.length > 0 ? executions[0] : null,
      executionCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取工作流统计信息失败: ${message}`);
  }
}

/**
 * 从 JSON 模板导入工作流
 * @param jsonData - JSON 格式的工作流数据
 * @returns 导入的工作流
 */
export async function importWorkflow(jsonData: string): Promise<Workflow> {
  try {
    const parsed = JSON.parse(jsonData) as Record<string, unknown>;

    if (!parsed.name || typeof parsed.name !== 'string') {
      throw new Error('JSON 数据缺少有效的 name 字段');
    }

    const data: CreateWorkflowData = {
      name: parsed.name as string,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      nodes: Array.isArray(parsed.nodes) ? (parsed.nodes as WorkflowNode[]) : undefined,
      edges: Array.isArray(parsed.edges) ? (parsed.edges as WorkflowEdge[]) : undefined,
      triggerType: parsed.triggerType as TriggerType | undefined,
      triggerConfig: parsed.triggerConfig as CronConfig | WebhookConfig | WechatConfig | undefined,
    };

    const workflow = await createWorkflow(data);
    log.info(`工作流已从 JSON 导入: ${workflow.id} - ${workflow.name}`);
    return workflow;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`导入工作流失败: ${message}`);
  }
}
