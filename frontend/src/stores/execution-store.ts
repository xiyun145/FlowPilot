import { create } from "zustand";
import { toast } from "sonner";
import { executionApi, createSSEConnection } from "@/utils/api";
import type {
  Execution,
  ExecutionStats,
  NodeExecutionStatus,
  SSEEvent,
} from "@/types";

interface ExecutionState {
  executions: Execution[];
  currentExecution: Execution | null;
  nodeExecutionStatuses: Map<string, NodeExecutionStatus>;
  sseConnection: EventSource | null;
  loading: boolean;
  stats: ExecutionStats | null;

  fetchExecutions: (params?: {
    workflowId?: string;
    status?: string;
  }) => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  connectSSE: (executionId: string) => void;
  disconnectSSE: () => void;
  updateNodeStatus: (nodeId: string, status: NodeExecutionStatus) => void;
  cancelExecution: (id: string) => Promise<void>;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executions: [],
  currentExecution: null,
  nodeExecutionStatuses: new Map(),
  sseConnection: null,
  loading: false,
  stats: null,

  fetchExecutions: async (params) => {
    set({ loading: true });
    try {
      const result = await executionApi.getAll(params);
      set({ executions: result.items });
    } catch {
      toast.error("获取执行记录失败");
    } finally {
      set({ loading: false });
    }
  },

  fetchDetail: async (id: string) => {
    set({ loading: true });
    try {
      const execution = await executionApi.getById(id);
      set({ currentExecution: execution });

      const statusMap = new Map<string, NodeExecutionStatus>();
      execution.nodeExecutions.forEach((ne) => {
        statusMap.set(ne.nodeId, ne.status);
      });
      set({ nodeExecutionStatuses: statusMap });
    } catch {
      toast.error("获取执行详情失败");
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await executionApi.getStats();
      set({ stats });
    } catch {
      // silent fail
    }
  },

  connectSSE: (executionId: string) => {
    const { sseConnection } = get();
    if (sseConnection) {
      sseConnection.close();
    }

    const eventSource = createSSEConnection(
      executionId,
      (event: MessageEvent) => {
        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);
          const { nodeExecutionStatuses } = get();
          const newMap = new Map(nodeExecutionStatuses);

          switch (sseEvent.type) {
            case "node_start":
              if (sseEvent.nodeId) {
                newMap.set(sseEvent.nodeId, "running");
                set({ nodeExecutionStatuses: newMap });
              }
              break;
            case "node_complete":
              if (sseEvent.nodeId) {
                newMap.set(sseEvent.nodeId, "success");
                set({ nodeExecutionStatuses: newMap });
              }
              break;
            case "node_error":
              if (sseEvent.nodeId) {
                newMap.set(sseEvent.nodeId, "failed");
                set({ nodeExecutionStatuses: newMap });
              }
              break;
            case "execution_complete":
              toast.success("工作流执行完成");
              get().fetchDetail(executionId);
              break;
            case "execution_error":
              toast.error("工作流执行失败");
              get().fetchDetail(executionId);
              break;
          }
        } catch {
          // ignore parse errors
        }
      },
      () => {
        set({ sseConnection: null });
      }
    );

    set({ sseConnection: eventSource });
  },

  disconnectSSE: () => {
    const { sseConnection } = get();
    if (sseConnection) {
      sseConnection.close();
      set({ sseConnection: null });
    }
  },

  updateNodeStatus: (nodeId: string, status: NodeExecutionStatus) => {
    set((state) => {
      const newMap = new Map(state.nodeExecutionStatuses);
      newMap.set(nodeId, status);
      return { nodeExecutionStatuses: newMap };
    });
  },

  cancelExecution: async (id: string) => {
    try {
      await executionApi.cancel(id);
      toast.success("已取消执行");
    } catch {
      toast.error("取消执行失败");
    }
  },
}));
