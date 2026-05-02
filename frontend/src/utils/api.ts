import axios from "axios";
import { toast } from "sonner";
import type {
  ApiResponse,
  Credential,
  CredentialCreateInput,
  CredentialUpdateInput,
  Execution,
  ExecutionStats,
  NodeDefinition,
  PaginatedResponse,
  Workflow,
  WorkflowCreateInput,
  WorkflowUpdateInput,
} from "@/types";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => config,
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || "请求失败";
    toast.error(message);
    return Promise.reject(error);
  }
);

// ==================== Workflow API ====================

const workflowApi = {
  getAll: async (): Promise<Workflow[]> => {
    const res = await api.get<ApiResponse<Workflow[]>>("/workflows");
    return res.data.data;
  },

  getById: async (id: string): Promise<Workflow> => {
    const res = await api.get<ApiResponse<{ workflow: Workflow }>>(`/workflows/${id}`);
    return res.data.data.workflow;
  },

  create: async (data: WorkflowCreateInput): Promise<Workflow> => {
    const res = await api.post<ApiResponse<Workflow>>("/workflows", data);
    return res.data.data;
  },

  update: async (id: string, data: WorkflowUpdateInput): Promise<Workflow> => {
    const res = await api.put<ApiResponse<Workflow>>(`/workflows/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/workflows/${id}`);
  },

  execute: async (id: string): Promise<Execution> => {
    const res = await api.post<ApiResponse<Execution>>(
      `/workflows/${id}/execute`
    );
    return res.data.data;
  },

  toggle: async (id: string, enabled: boolean): Promise<Workflow> => {
    const res = await api.post<ApiResponse<Workflow>>(`/workflows/${id}/toggle`);
    return res.data.data;
  },

  import: async (data: string): Promise<Workflow> => {
    const res = await api.post<ApiResponse<Workflow>>("/workflows/import", {
      data,
    });
    return res.data.data;
  },
};

// ==================== Credential API ====================

const credentialApi = {
  getAll: async (): Promise<Credential[]> => {
    const res = await api.get<ApiResponse<Credential[]>>("/credentials");
    return res.data.data;
  },

  getById: async (id: string): Promise<Credential> => {
    const res = await api.get<ApiResponse<Credential>>(`/credentials/${id}`);
    return res.data.data;
  },

  create: async (data: CredentialCreateInput): Promise<Credential> => {
    const res = await api.post<ApiResponse<Credential>>("/credentials", data);
    return res.data.data;
  },

  update: async (
    id: string,
    data: CredentialUpdateInput
  ): Promise<Credential> => {
    const res = await api.put<ApiResponse<Credential>>(
      `/credentials/${id}`,
      data
    );
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/credentials/${id}`);
  },

  test: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.post<
      ApiResponse<{ success: boolean; message: string }>
    >(`/credentials/${id}/test`);
    return res.data.data;
  },
};

// ==================== Execution API ====================

const executionApi = {
  getAll: async (params?: {
    workflowId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<Execution>> => {
    const res = await api.get<ApiResponse<PaginatedResponse<Execution>>>(
      "/executions",
      { params }
    );
    return res.data.data;
  },

  getById: async (id: string): Promise<Execution> => {
    const res = await api.get<ApiResponse<Execution>>(`/executions/${id}`);
    return res.data.data;
  },

  getStats: async (): Promise<ExecutionStats> => {
    const res = await api.get<ApiResponse<ExecutionStats>>("/executions/stats");
    return res.data.data;
  },

  cancel: async (id: string): Promise<void> => {
    await api.post(`/executions/${id}/cancel`);
  },
};

// ==================== Node Definitions API ====================

const nodeDefinitionApi = {
  getAll: async (): Promise<NodeDefinition[]> => {
    const res = await api.get<ApiResponse<NodeDefinition[]>>(
      "/node-definitions"
    );
    return res.data.data;
  },
};

// ==================== SSE Helper ====================

export function createSSEConnection(
  executionId: string,
  onEvent: (event: MessageEvent) => void,
  onError?: (error: Event) => void
): EventSource {
  const eventSource = new EventSource(`/api/executions/${executionId}/events`);

  eventSource.onmessage = onEvent;
  eventSource.onerror = (error) => {
    if (onError) {
      onError(error);
    }
    eventSource.close();
  };

  return eventSource;
}

export { workflowApi, credentialApi, executionApi, nodeDefinitionApi };
export default api;
