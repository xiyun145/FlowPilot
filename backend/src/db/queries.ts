/**
 * FlowPilot - 数据库查询函数
 * 提供所有数据库操作的类型安全函数
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, persistDb } from './adapter';
import { createModuleLogger } from '../utils/logger';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  Execution,
  ExecutionStatus,
  NodeExecution,
  Credential,
  WorkflowStatus,
  TriggerType,
} from '../types';

const logger = createModuleLogger('db:queries');

/**
 * 初始化数据库（确保表已创建）
 */
export async function initDatabase(): Promise<void> {
  await getDb();
  logger.info('数据库初始化完成');
}

// ==================== 工作流操作 ====================

/**
 * 插入工作流
 */
export async function insertWorkflow(workflow: Workflow): Promise<void> {
  const db = await getDb();
  db.prepare(`
    INSERT INTO workflows (id, name, description, status, nodes, edges, trigger_type, trigger_config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    workflow.id,
    workflow.name,
    workflow.description || '',
    workflow.status,
    JSON.stringify(workflow.nodes),
    JSON.stringify(workflow.edges),
    workflow.triggerType || null,
    workflow.triggerConfig ? JSON.stringify(workflow.triggerConfig) : null,
    workflow.createdAt,
    workflow.updatedAt,
  );
  persistDb();
  logger.info(`工作流已插入: ${workflow.id} (${workflow.name})`);
}

/**
 * 创建新工作流
 */
export async function createWorkflow(data: {
  name: string;
  description?: string;
  status?: WorkflowStatus;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  triggerType?: TriggerType;
  triggerConfig?: Record<string, unknown>;
}): Promise<Workflow> {
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: uuidv4(),
    name: data.name,
    description: data.description || '',
    status: data.status || 'draft',
    nodes: data.nodes || [],
    edges: data.edges || [],
    triggerType: data.triggerType,
    triggerConfig: data.triggerConfig,
    createdAt: now,
    updatedAt: now,
  };
  await insertWorkflow(workflow);
  return workflow;
}

/**
 * 根据 ID 获取工作流
 */
export async function getWorkflowById(id: string): Promise<Workflow | null> {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapRowToWorkflow(row);
}

/** 别名 */
export const getWorkflow = getWorkflowById;

/**
 * 获取所有工作流
 */
export async function getAllWorkflows(status?: WorkflowStatus): Promise<Workflow[]> {
  const db = await getDb();
  const sql = status
    ? 'SELECT * FROM workflows WHERE status = ? ORDER BY updated_at DESC'
    : 'SELECT * FROM workflows ORDER BY updated_at DESC';
  const rows = status
    ? db.prepare(sql).all(status)
    : db.prepare(sql).all();
  return (rows as Array<Record<string, unknown>>).map(mapRowToWorkflow);
}

/**
 * 更新工作流
 */
export async function updateWorkflow(workflow: Workflow): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE workflows
    SET name = ?, description = ?, status = ?, nodes = ?, edges = ?,
        trigger_type = ?, trigger_config = ?, updated_at = ?
    WHERE id = ?
  `).run(
    workflow.name,
    workflow.description || '',
    workflow.status,
    JSON.stringify(workflow.nodes),
    JSON.stringify(workflow.edges),
    workflow.triggerType || null,
    workflow.triggerConfig ? JSON.stringify(workflow.triggerConfig) : null,
    now,
    workflow.id,
  );
  persistDb();
  logger.info(`工作流已更新: ${workflow.id}`);
}

/**
 * 删除工作流
 */
export async function deleteWorkflow(id: string): Promise<boolean> {
  const db = await getDb();
  const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  if (result.changes > 0) {
    persistDb();
    logger.info(`工作流已删除: ${id}`);
    return true;
  }
  return false;
}

/**
 * 获取工作流总数
 */
export async function getWorkflowCount(): Promise<number> {
  const db = await getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM workflows').get() as { count: number };
  return row.count;
}

/**
 * 按状态获取工作流数量
 */
export async function getWorkflowCountByStatus(status: WorkflowStatus): Promise<number> {
  const db = await getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM workflows WHERE status = ?').get(status) as { count: number };
  return row.count;
}

// ==================== 执行记录操作 ====================

/**
 * 创建执行记录
 */
export async function createExecution(
  workflowId: string,
  triggerData?: Record<string, unknown>,
): Promise<Execution> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO executions (id, workflow_id, status, trigger_data, started_at)
    VALUES (?, ?, 'pending', ?, ?)
  `).run(id, workflowId, triggerData ? JSON.stringify(triggerData) : null, now);
  persistDb();
  logger.info(`执行记录已创建: ${id} (工作流: ${workflowId})`);
  return { id, workflowId, status: 'pending', startedAt: now, triggerData };
}

/**
 * 根据 ID 获取执行记录
 */
export async function getExecutionById(id: string): Promise<Execution | null> {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapRowToExecution(row);
}

/** 别名 */
export const getExecution = getExecutionById;

/**
 * 获取工作流的执行记录
 */
export async function getExecutionsByWorkflowId(
  workflowId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<Execution[]> {
  const db = await getDb();
  const rows = db.prepare(
    'SELECT * FROM executions WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?',
  ).all(workflowId, limit, offset);
  return (rows as Array<Record<string, unknown>>).map(mapRowToExecution);
}

/** 别名 */
export const getExecutionsByWorkflow = getExecutionsByWorkflowId;

/**
 * 带过滤条件的执行记录查询
 */
export async function getExecutions(filters: {
  workflowId?: string;
  status?: ExecutionStatus;
  limit?: number;
  offset?: number;
}): Promise<Execution[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.workflowId) { conditions.push('workflow_id = ?'); params.push(filters.workflowId); }
  if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  params.push(limit, offset);
  const rows = db.prepare(`SELECT * FROM executions ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`).all(...params);
  return (rows as Array<Record<string, unknown>>).map(mapRowToExecution);
}

/**
 * 获取执行记录总数
 */
export async function getExecutionCount(filters: {
  workflowId?: string;
  status?: ExecutionStatus;
} = {}): Promise<number> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.workflowId) { conditions.push('workflow_id = ?'); params.push(filters.workflowId); }
  if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = db.prepare(`SELECT COUNT(*) as count FROM executions ${where}`).get(...params) as { count: number };
  return row.count;
}

/**
 * 获取指定时间之后的执行记录数量
 */
export async function getExecutionCountSince(since: string): Promise<number> {
  const db = await getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM executions WHERE started_at >= ?').get(since) as { count: number };
  return row.count;
}

/**
 * 获取指定工作流的执行记录数量
 */
export async function getExecutionCountByWorkflowId(workflowId: string): Promise<number> {
  return getExecutionCount({ workflowId });
}

/**
 * 更新执行状态
 */
export async function updateExecutionStatus(
  id: string,
  status: ExecutionStatus,
  error?: string,
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE executions SET status = ?, finished_at = ?, error = ? WHERE id = ?
  `).run(status, status === 'running' ? null : now, error || null, id);
  if (result.changes > 0) {
    persistDb();
    logger.info(`执行状态已更新: ${id} -> ${status}`);
    return true;
  }
  return false;
}

/**
 * 更新执行记录
 */
export async function updateExecution(execution: Execution): Promise<void> {
  const db = await getDb();
  db.prepare(`
    UPDATE executions SET status = ?, finished_at = ?, error = ?, trigger_data = ? WHERE id = ?
  `).run(
    execution.status,
    execution.finishedAt || null,
    execution.error || null,
    execution.triggerData ? JSON.stringify(execution.triggerData) : null,
    execution.id,
  );
  persistDb();
  logger.info(`执行记录已更新: ${execution.id}`);
}

/**
 * 删除工作流的所有执行记录
 */
export async function deleteExecutionsByWorkflowId(workflowId: string): Promise<void> {
  const db = await getDb();
  db.prepare(`DELETE FROM node_executions WHERE execution_id IN (SELECT id FROM executions WHERE workflow_id = ?)`).run(workflowId);
  db.prepare('DELETE FROM executions WHERE workflow_id = ?').run(workflowId);
  persistDb();
  logger.info(`工作流 ${workflowId} 的所有执行记录已删除`);
}

// ==================== 节点执行记录操作 ====================

/**
 * 创建节点执行记录
 */
export async function createNodeExecution(executionId: string, nodeId: string): Promise<NodeExecution> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO node_executions (id, execution_id, node_id, status, started_at)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(id, executionId, nodeId, now);
  persistDb();
  return { id, executionId, nodeId, status: 'pending', startedAt: now };
}

/**
 * 更新节点执行记录
 */
export async function updateNodeExecution(
  id: string,
  data: Partial<{
    status: ExecutionStatus;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    error: string;
    duration: number;
  }>,
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.input !== undefined) { fields.push('input = ?'); values.push(JSON.stringify(data.input)); }
  if (data.output !== undefined) { fields.push('output = ?'); values.push(JSON.stringify(data.output)); }
  if (data.error !== undefined) { fields.push('error = ?'); values.push(data.error); }
  if (data.duration !== undefined) { fields.push('duration = ?'); values.push(data.duration); }

  if (fields.length === 0) return false;

  if (data.status && ['success', 'failed', 'cancelled'].includes(data.status)) {
    fields.push('finished_at = ?');
    values.push(now);
  }

  values.push(id);
  const result = db.prepare(`UPDATE node_executions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  if (result.changes > 0) persistDb();
  return result.changes > 0;
}

/**
 * 获取执行记录的所有节点执行
 */
export async function getNodeExecutionsByExecutionId(executionId: string): Promise<NodeExecution[]> {
  const db = await getDb();
  const rows = db.prepare(
    'SELECT * FROM node_executions WHERE execution_id = ? ORDER BY started_at ASC',
  ).all(executionId);
  return (rows as Array<Record<string, unknown>>).map(mapRowToNodeExecution);
}

/** 别名 */
export const getNodeExecutionsByExecution = getNodeExecutionsByExecutionId;

// ==================== 凭据操作 ====================

/**
 * 插入凭据
 */
export async function insertCredential(credential: Credential): Promise<void> {
  const db = await getDb();
  db.prepare(`
    INSERT INTO credentials (id, name, type, encrypted_value, iv, auth_tag, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    credential.id, credential.name, credential.type,
    credential.encryptedValue, credential.iv, credential.authTag,
    credential.createdAt, credential.updatedAt,
  );
  persistDb();
  logger.info(`凭据已插入: ${credential.id} (${credential.name})`);
}

/**
 * 创建凭据
 */
export async function createCredential(data: {
  name: string;
  type: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
}): Promise<Credential> {
  const now = new Date().toISOString();
  const credential: Credential = {
    id: uuidv4(), name: data.name, type: data.type,
    encryptedValue: data.encryptedValue, iv: data.iv, authTag: data.authTag,
    createdAt: now, updatedAt: now,
  };
  await insertCredential(credential);
  return credential;
}

/**
 * 根据 ID 获取凭据
 */
export async function getCredentialById(id: string): Promise<Credential | null> {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapRowToCredential(row);
}

/** 别名 */
export const getCredential = getCredentialById;

/**
 * 获取所有凭据
 */
export async function getAllCredentials(): Promise<Credential[]> {
  const db = await getDb();
  const rows = db.prepare('SELECT * FROM credentials ORDER BY created_at DESC').all();
  return (rows as Array<Record<string, unknown>>).map(mapRowToCredential);
}

/**
 * 更新凭据
 */
export async function updateCredential(
  id: string,
  data?: Partial<{ name: string; type: string; encryptedValue: string; iv: string; authTag: string }>,
): Promise<Credential | null> {
  const db = await getDb();
  const existing = await getCredentialById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data?.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data?.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
  if (data?.encryptedValue !== undefined) { fields.push('encrypted_value = ?'); values.push(data.encryptedValue); }
  if (data?.iv !== undefined) { fields.push('iv = ?'); values.push(data.iv); }
  if (data?.authTag !== undefined) { fields.push('auth_tag = ?'); values.push(data.authTag); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now, id);
  db.prepare(`UPDATE credentials SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  persistDb();
  logger.info(`凭据已更新: ${id}`);
  return getCredentialById(id);
}

/**
 * 删除凭据
 */
export async function deleteCredential(id: string): Promise<boolean> {
  const db = await getDb();
  const result = db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
  if (result.changes > 0) {
    persistDb();
    logger.info(`凭据已删除: ${id}`);
    return true;
  }
  return false;
}

// ==================== 映射函数 ====================

function mapRowToWorkflow(row: Record<string, unknown>): Workflow {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    status: row.status as WorkflowStatus,
    nodes: JSON.parse(row.nodes as string) as WorkflowNode[],
    edges: JSON.parse(row.edges as string) as WorkflowEdge[],
    triggerType: (row.trigger_type as TriggerType) || undefined,
    triggerConfig: row.trigger_config ? JSON.parse(row.trigger_config as string) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRowToExecution(row: Record<string, unknown>): Execution {
  return {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    status: row.status as ExecutionStatus,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string) || undefined,
    triggerData: row.trigger_data ? JSON.parse(row.trigger_data as string) : undefined,
    error: (row.error as string) || undefined,
  };
}

function mapRowToNodeExecution(row: Record<string, unknown>): NodeExecution {
  return {
    id: row.id as string,
    executionId: row.execution_id as string,
    nodeId: row.node_id as string,
    status: row.status as ExecutionStatus,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string) || undefined,
    input: row.input ? JSON.parse(row.input as string) : undefined,
    output: row.output ? JSON.parse(row.output as string) : undefined,
    error: (row.error as string) || undefined,
    duration: (row.duration as number) || undefined,
  };
}

function mapRowToCredential(row: Record<string, unknown>): Credential {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    encryptedValue: row.encrypted_value as string,
    iv: row.iv as string,
    authTag: row.auth_tag as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
