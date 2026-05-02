/**
 * FlowPilot - 执行管理服务
 * 提供执行记录的查询、取消、日志获取和统计功能
 */

import type { Execution, NodeExecution, ExecutionStatus } from '../types';
import * as queries from '../db/queries';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('execution-service');

interface ExecutionFilters {
  workflowId?: string;
  status?: ExecutionStatus;
  page?: number;
  pageSize?: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface ExecutionDetail {
  execution: Execution;
  nodeExecutions: NodeExecution[];
}

interface ExecutionStats {
  totalWorkflows: number;
  activeWorkflows: number;
  executionsToday: number;
  successRate: number;
}

/**
 * 获取执行记录列表（分页）
 */
export async function getExecutions(filters: ExecutionFilters): Promise<PaginatedResult<Execution>> {
  try {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const executions = await queries.getExecutions({
      workflowId: filters.workflowId,
      status: filters.status,
      limit: pageSize,
      offset,
    });

    const total = await queries.getExecutionCount({
      workflowId: filters.workflowId,
      status: filters.status,
    });

    return { data: executions, total, page, pageSize };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取执行记录失败: ${message}`);
  }
}

/**
 * 获取执行详情
 */
export async function getExecutionDetail(id: string): Promise<ExecutionDetail> {
  try {
    const execution = await queries.getExecutionById(id);
    if (!execution) {
      throw new Error(`执行记录不存在: ${id}`);
    }
    const nodeExecutions = await queries.getNodeExecutionsByExecutionId(id);
    return { execution, nodeExecutions };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取执行详情失败: ${message}`);
  }
}

/**
 * 取消执行
 */
export async function cancelExecution(id: string): Promise<Execution> {
  try {
    const execution = await queries.getExecutionById(id);
    if (!execution) {
      throw new Error(`执行记录不存在: ${id}`);
    }
    if (execution.status !== 'pending' && execution.status !== 'running') {
      throw new Error(`无法取消状态为 ${execution.status} 的执行`);
    }
    await queries.updateExecutionStatus(id, 'cancelled');
    log.info(`执行已取消: ${id}`);
    return { ...execution, status: 'cancelled', finishedAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`取消执行失败: ${message}`);
  }
}

/**
 * 获取执行日志
 */
export async function getExecutionLogs(id: string): Promise<ExecutionDetail> {
  try {
    const execution = await queries.getExecutionById(id);
    if (!execution) {
      throw new Error(`执行记录不存在: ${id}`);
    }
    const nodeExecutions = await queries.getNodeExecutionsByExecutionId(id);
    return { execution, nodeExecutions };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取执行日志失败: ${message}`);
  }
}

/**
 * 获取全局统计信息
 */
export async function getStats(): Promise<ExecutionStats> {
  try {
    const totalWorkflows = await queries.getWorkflowCount();
    const activeWorkflows = await queries.getWorkflowCountByStatus('active');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const executionsToday = await queries.getExecutionCountSince(todayStr);

    const totalRecent = await queries.getExecutionCount({});
    const successRecent = await queries.getExecutionCount({ status: 'success' });
    const successRate = totalRecent > 0 ? Math.round((successRecent / totalRecent) * 100) : 0;

    return { totalWorkflows, activeWorkflows, executionsToday, successRate };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取统计信息失败: ${message}`);
  }
}
