/**
 * FlowPilot - 工作流执行引擎
 * 负责执行工作流：拓扑排序节点、按顺序执行、变量插值、错误重试、SSE事件推送
 *
 * 导出 executor 单例对象，提供 run(workflow, triggerData) 方法
 */

import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '../../utils/logger';
import {
  getWorkflowById,
  createExecution,
  updateExecutionStatus,
  createNodeExecution,
  updateNodeExecution,
} from '../../db/queries';
import { interpolateDeep } from './interpolator';
import { getNodeExecutor, createNodeContext } from './registry';
import { withRetry } from '../../utils/retry';
import { broadcastExecutionEvent } from '../../utils/sse';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  Execution,
  ExecutionStatus,
  ExecutionContext,
} from '../../types';

const logger = createModuleLogger('executor');

/** 默认最大重试次数 */
const MAX_RETRIES = 3;

/** 执行结果 */
export interface ExecutionResult {
  execution: Execution;
  nodeOutputs: Record<string, Record<string, unknown>>;
  success: boolean;
  error?: string;
}

/**
 * 根据工作流的边进行拓扑排序
 * @param nodes - 工作流节点数组
 * @param edges - 工作流边数组
 * @returns 排序后的节点数组
 * @throws 如果存在循环依赖则抛出错误
 */
export function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map<string, WorkflowNode>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // 初始化
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // 构建邻接表和入度表
  for (const edge of edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      logger.warn(`边 ${edge.id} 引用了不存在的节点，已跳过`);
      continue;
    }
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // 找出所有入度为 0 的节点（起始节点）
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const sorted: WorkflowNode[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    sorted.push(nodeMap.get(currentId)!);

    for (const neighbor of adjacency.get(currentId) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // 检测循环
  if (sorted.length !== nodes.length) {
    const missing = nodes
      .filter((n) => !sorted.find((s) => s.id === n.id))
      .map((n) => n.id);
    throw new Error(`工作流存在循环依赖，涉及节点: ${missing.join(', ')}`);
  }

  return sorted;
}

/**
 * 构建执行上下文（用于变量插值）
 * @param triggerData - 触发器数据
 * @param nodeOutputs - 已执行节点的输出
 * @returns 执行上下文对象
 */
function buildContext(
  triggerData: Record<string, unknown> | undefined,
  nodeOutputs: Record<string, Record<string, unknown>>,
): ExecutionContext {
  const nodes: Record<string, { output: Record<string, unknown> }> = {};
  for (const [nodeId, output] of Object.entries(nodeOutputs)) {
    nodes[nodeId] = { output };
  }

  return {
    trigger: triggerData || {},
    nodes,
    global: {},
  };
}

/**
 * 执行单个节点（带重试）
 * @param node - 工作流节点
 * @param input - 节点输入数据
 * @param config - 节点配置
 * @param context - 节点执行上下文
 * @returns 节点输出数据
 */
async function executeSingleNode(
  node: WorkflowNode,
  input: unknown,
  config: Record<string, unknown>,
  context: ReturnType<typeof createNodeContext>,
): Promise<Record<string, unknown>> {
  const executorFn = getNodeExecutor(node.type);

  const result = await withRetry(
    async () => {
      const output = await executorFn(input, config, context);
      return output;
    },
    {
      retries: MAX_RETRIES,
      onFailedAttempt: (error: { attemptNumber: number; retriesLeft: number; message: string }) => {
        logger.warn(
          `节点 "${node.label}" (${node.id}) 执行失败，` +
          `第 ${error.attemptNumber} 次尝试，` +
          `剩余 ${error.retriesLeft} 次重试机会: ${error.message}`,
        );
      },
    },
  );

  return result;
}

/**
 * 执行工作流
 * @param workflow - 工作流对象
 * @param triggerData - 可选的触发器数据
 * @returns 执行记录
 */
async function runWorkflow(
  workflow: Workflow,
  triggerData?: Record<string, unknown>,
): Promise<Execution> {
  logger.info(`开始执行工作流: ${workflow.id} (${workflow.name})`);

  // 1. 创建执行记录
  const execution = await createExecution(workflow.id, triggerData);
  await updateExecutionStatus(execution.id, 'running');

  // 广播执行开始事件
  broadcastExecutionEvent({
    event: 'execution:started',
    data: {
      executionId: execution.id,
      workflowId: workflow.id,
      status: 'running',
      timestamp: new Date().toISOString(),
    },
  });

  const nodeOutputs: Record<string, Record<string, unknown>> = {};

  try {
    // 2. 拓扑排序节点
    const sortedNodes = topologicalSort(workflow.nodes, workflow.edges);
    logger.info(`节点执行顺序: ${sortedNodes.map((n) => n.label).join(' -> ')}`);

    // 3. 逐个执行节点
    for (const node of sortedNodes) {
      const nodeStartTime = Date.now();

      // 创建节点执行记录
      const nodeExec = await createNodeExecution(execution.id, node.id);

      // 广播节点开始事件
      broadcastExecutionEvent({
        event: 'node:started',
        data: {
          executionId: execution.id,
          workflowId: workflow.id,
          nodeId: node.id,
          status: 'running',
          timestamp: new Date().toISOString(),
          nodeLabel: node.label,
        },
      });

      try {
        // 构建执行上下文
        const execContext = buildContext(triggerData, nodeOutputs);

        // 准备节点输入：获取前驱节点的输出
        const incomingEdges = workflow.edges.filter((e) => e.target === node.id);
        let nodeInput: unknown = {};

        if (incomingEdges.length === 1) {
          const sourceOutput = nodeOutputs[incomingEdges[0].source];
          nodeInput = sourceOutput || {};
        } else if (incomingEdges.length > 1) {
          const merged: Record<string, unknown> = {};
          for (const edge of incomingEdges) {
            const sourceOutput = nodeOutputs[edge.source];
            if (sourceOutput) {
              Object.assign(merged, sourceOutput);
            }
          }
          nodeInput = merged;
        }

        // 对节点输入和配置进行变量插值
        nodeInput = interpolateDeep(nodeInput, execContext);
        const interpolatedConfig = interpolateDeep(node.data, execContext);

        // 创建节点上下文
        const nodeContext = createNodeContext({
          workflowId: workflow.id,
          executionId: execution.id,
          nodeId: node.id,
        });

        await updateNodeExecution(nodeExec.id, {
          status: 'running',
          input: typeof nodeInput === 'object' && nodeInput !== null
            ? nodeInput as Record<string, unknown>
            : { value: nodeInput },
        });

        const output = await executeSingleNode(node, nodeInput, interpolatedConfig, nodeContext);
        const duration = Date.now() - nodeStartTime;

        // 记录成功结果
        nodeOutputs[node.id] = output;
        await updateNodeExecution(nodeExec.id, {
          status: 'success',
          output,
          duration,
        });

        // 广播节点完成事件
        broadcastExecutionEvent({
          event: 'node:completed',
          data: {
            executionId: execution.id,
            workflowId: workflow.id,
            nodeId: node.id,
            status: 'success',
            timestamp: new Date().toISOString(),
            nodeLabel: node.label,
            duration,
            output,
          },
        });

        logger.info(`节点 "${node.label}" 执行成功，耗时 ${duration}ms`);
      } catch (nodeError) {
        const duration = Date.now() - nodeStartTime;
        const errorMessage = nodeError instanceof Error ? nodeError.message : '未知错误';

        // 记录失败结果
        await updateNodeExecution(nodeExec.id, {
          status: 'failed',
          error: errorMessage,
          duration,
        });

        // 广播节点失败事件
        broadcastExecutionEvent({
          event: 'node:failed',
          data: {
            executionId: execution.id,
            workflowId: workflow.id,
            nodeId: node.id,
            status: 'failed',
            timestamp: new Date().toISOString(),
            nodeLabel: node.label,
            error: errorMessage,
            duration,
          },
        });

        // 抛出错误终止执行
        throw new Error(`节点 "${node.label}" 执行失败: ${errorMessage}`);
      }
    }

    // 4. 所有节点执行成功
    await updateExecutionStatus(execution.id, 'success');

    broadcastExecutionEvent({
      event: 'execution:completed',
      data: {
        executionId: execution.id,
        workflowId: workflow.id,
        status: 'success',
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(`工作流执行成功: ${workflow.id}，执行ID: ${execution.id}`);

    return {
      ...execution,
      status: 'success',
      finishedAt: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    // 更新执行状态为失败
    await updateExecutionStatus(execution.id, 'failed', errorMessage);

    broadcastExecutionEvent({
      event: 'execution:failed',
      data: {
        executionId: execution.id,
        workflowId: workflow.id,
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: errorMessage,
      },
    });

    logger.error(`工作流执行失败: ${workflow.id} - ${errorMessage}`);

    return {
      ...execution,
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: errorMessage,
    };
  }
}

/**
 * 执行工作流（通过 ID）
 * @param workflowId - 工作流 ID
 * @param triggerData - 可选的触发器数据
 * @returns 执行结果
 */
async function runWorkflowById(
  workflowId: string,
  triggerData?: Record<string, unknown>,
): Promise<ExecutionResult> {
  const workflow = await getWorkflowById(workflowId);
  if (!workflow) {
    throw new Error(`工作流不存在: ${workflowId}`);
  }

  const execution = await runWorkflow(workflow, triggerData);
  return {
    execution,
    nodeOutputs: {},
    success: execution.status === 'success',
    error: execution.error,
  };
}

/**
 * executor 单例对象
 * 提供 run 方法用于执行工作流
 */
export const executor = {
  /**
   * 执行工作流
   * @param workflowOrId - 工作流对象或工作流 ID
   * @param triggerData - 可选的触发器数据
   * @returns 执行记录
   */
  async run(
    workflowOrId: Workflow | string,
    triggerData?: Record<string, unknown>,
  ): Promise<Execution> {
    if (typeof workflowOrId === 'string') {
      const workflow = await getWorkflowById(workflowOrId);
      if (!workflow) {
        throw new Error(`工作流不存在: ${workflowOrId}`);
      }
      return runWorkflow(workflow, triggerData);
    }
    return runWorkflow(workflowOrId, triggerData);
  },
};

/** 导出 executeWorkflow 函数供其他模块使用 */
export const executeWorkflow = runWorkflowById;
