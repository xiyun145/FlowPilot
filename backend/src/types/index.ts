/**
 * FlowPilot - 全局类型定义
 * 定义工作流引擎中使用的所有 TypeScript 接口和类型
 */

/** 工作流状态 */
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'error';

/** 执行状态 */
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

/** 节点类型分类 */
export type NodeType = 'trigger' | 'wechat' | 'gemini' | 'action' | 'logic';

/** 触发器类型 */
export type TriggerType = 'cron' | 'webhook' | 'wechat_message';

/** 工作流节点定义 */
export interface WorkflowNode {
  id: string;
  type: string;
  nodeType: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  label: string;
}

/** 工作流边（连接线）定义 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/** 工作流定义 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggerType?: TriggerType;
  triggerConfig?: CronConfig | WebhookConfig | WechatConfig | Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** 执行记录 */
export interface Execution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  triggerData?: Record<string, unknown>;
  error?: string;
}

/** 节点执行记录 */
export interface NodeExecution {
  id: string;
  executionId: string;
  nodeId: string;
  status: ExecutionStatus;
  startedAt: string;
  finishedAt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

/** 凭据定义 */
export interface Credential {
  id: string;
  name: string;
  type: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  createdAt: string;
  updatedAt: string;
}

/** 节点端口定义 */
export interface NodePort {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

/** 配置字段定义 */
export interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'password' | 'credential' | 'cron';
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  required: boolean;
  defaultValue?: unknown;
}

/** 节点定义（用于注册和UI渲染） */
export interface NodeDefinition {
  type: string;
  name: string;
  category: NodeType;
  description: string;
  icon: string;
  inputs: NodePort[];
  outputs: NodePort[];
  configSchema: ConfigField[];
}

/** Cron 触发器配置 */
export interface CronConfig {
  expression: string;
  timezone?: string;
}

/** Webhook 触发器配置 */
export interface WebhookConfig {
  path: string;
  method: string;
}

/** 微信消息触发器配置 */
export interface WechatConfig {
  appId: string;
  appSecret: string;
  token: string;
  encodingAesKey: string;
}

/** 节点执行上下文 */
export interface NodeContext {
  workflowId: string;
  executionId: string;
  nodeId: string;
  /** 获取已解密的凭据值 */
  getCredential: (credentialId: string) => Promise<string | null>;
  /** 节点级日志记录器 */
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
    debug: (message: string, meta?: Record<string, unknown>) => void;
  };
}

/** 节点执行器函数类型 */
export type NodeExecutorFunction = (
  input: unknown,
  config: Record<string, unknown>,
  context: NodeContext,
) => Promise<Record<string, unknown>>;

/** 执行上下文（用于变量插值） */
export interface ExecutionContext {
  /** 当前触发器数据 */
  trigger: Record<string, unknown>;
  /** 所有节点的输出，按节点ID索引 */
  nodes: Record<string, { output: Record<string, unknown> }>;
  /** 全局变量 */
  global: Record<string, unknown>;
}

/** SSE 事件类型 */
export interface SSEEvent {
  event: 'execution:started' | 'execution:completed' | 'execution:failed' | 'node:started' | 'node:completed' | 'node:failed';
  data: {
    executionId: string;
    workflowId: string;
    nodeId?: string;
    status?: ExecutionStatus;
    timestamp: string;
    [key: string]: unknown;
  };
}
