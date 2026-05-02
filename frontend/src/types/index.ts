// ==================== Node Definition Types ====================

export interface ConfigFieldOption {
  label: string;
  value: string;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "password" | "credential" | "cron" | "boolean" | "code";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: ConfigFieldOption[];
  description?: string;
  credentialType?: string;
  rows?: number;
  min?: number;
  max?: number;
}

export interface NodeDefinition {
  type: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  inputFields: ConfigField[];
  outputFields?: ConfigField[];
  hasInput?: boolean;
  hasOutput?: boolean;
}

// ==================== Workflow Types ====================

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorkflowNodeData {
  label: string;
  type: string;
  config: Record<string, unknown>;
  description?: string;
  icon?: string;
  color?: string;
}

export type NodeCategory = "trigger" | "wechat" | "gemini" | "action" | "logic";

export interface WorkflowNode {
  id: string;
  type: string;
  nodeType: NodeCategory;
  label: string;
  position: NodePosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated?: boolean;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
  executionCount: number;
  tags?: string[];
}

export interface WorkflowCreateInput {
  name: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface WorkflowUpdateInput {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  enabled?: boolean;
}

// ==================== Execution Types ====================

export type ExecutionStatus = "pending" | "running" | "success" | "failed" | "cancelled";
export type NodeExecutionStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface NodeExecution {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: NodeExecutionStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  triggerType: "manual" | "cron" | "webhook";
  startTime: string;
  endTime?: string;
  duration?: number;
  nodeExecutions: NodeExecution[];
  error?: string;
  createdAt: string;
}

export interface ExecutionStats {
  total: number;
  success: number;
  failed: number;
  running: number;
  avgDuration: number;
}

// ==================== Credential Types ====================

export type CredentialType = "wechat" | "gemini" | "smtp" | "custom";

export interface Credential {
  id: string;
  name: string;
  type: CredentialType;
  maskedValue: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialCreateInput {
  name: string;
  type: CredentialType;
  value: string;
  config?: Record<string, string>;
}

export interface CredentialUpdateInput {
  name?: string;
  value?: string;
  config?: Record<string, string>;
}

// ==================== SSE Types ====================

export interface SSEEvent {
  type: "node_start" | "node_complete" | "node_error" | "execution_start" | "execution_complete" | "execution_error" | "log";
  executionId: string;
  nodeId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
