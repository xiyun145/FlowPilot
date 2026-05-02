import { create } from "zustand";
import { toast } from "sonner";
import { workflowApi } from "@/utils/api";
import type { Workflow, WorkflowCreateInput, WorkflowUpdateInput, WorkflowNode, WorkflowEdge } from "@/types";

interface WorkflowState {
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  loading: boolean;
  saving: boolean;

  fetchAll: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  create: (data: WorkflowCreateInput) => Promise<Workflow | null>;
  update: (id: string, data: WorkflowUpdateInput) => Promise<void>;
  delete: (id: string) => Promise<void>;
  execute: (id: string) => Promise<void>;
  toggle: (id: string, enabled: boolean) => Promise<void>;
  importWorkflow: (data: string) => Promise<Workflow | null>;

  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  addNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (edgeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNode["data"]>) => void;

  setCurrentWorkflow: (workflow: Workflow | null) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  currentWorkflow: null,
  loading: false,
  saving: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const workflows = await workflowApi.getAll();
      set({ workflows });
    } catch {
      toast.error("获取工作流列表失败");
    } finally {
      set({ loading: false });
    }
  },

  fetchById: async (id: string) => {
    set({ loading: true });
    try {
      const workflow = await workflowApi.getById(id);
      set({ currentWorkflow: workflow });
    } catch {
      toast.error("获取工作流详情失败");
    } finally {
      set({ loading: false });
    }
  },

  create: async (data: WorkflowCreateInput) => {
    set({ saving: true });
    try {
      const workflow = await workflowApi.create(data);
      set((state) => ({ workflows: [...state.workflows, workflow] }));
      toast.success("工作流创建成功");
      return workflow;
    } catch {
      toast.error("创建工作流失败");
      return null;
    } finally {
      set({ saving: false });
    }
  },

  update: async (id: string, data: WorkflowUpdateInput) => {
    set({ saving: true });
    try {
      const workflow = await workflowApi.update(id, data);
      set((state) => ({
        workflows: state.workflows.map((w) => (w.id === id ? workflow : w)),
        currentWorkflow:
          state.currentWorkflow?.id === id ? workflow : state.currentWorkflow,
      }));
    } catch {
      toast.error("保存工作流失败");
    } finally {
      set({ saving: false });
    }
  },

  delete: async (id: string) => {
    try {
      await workflowApi.delete(id);
      set((state) => ({
        workflows: state.workflows.filter((w) => w.id !== id),
        currentWorkflow:
          state.currentWorkflow?.id === id ? null : state.currentWorkflow,
      }));
      toast.success("工作流已删除");
    } catch {
      toast.error("删除工作流失败");
    }
  },

  execute: async (id: string) => {
    try {
      await workflowApi.execute(id);
      toast.success("工作流已开始执行");
    } catch {
      toast.error("执行工作流失败");
    }
  },

  toggle: async (id: string, enabled: boolean) => {
    try {
      const workflow = await workflowApi.toggle(id, enabled);
      set((state) => ({
        workflows: state.workflows.map((w) => (w.id === id ? workflow : w)),
        currentWorkflow:
          state.currentWorkflow?.id === id ? workflow : state.currentWorkflow,
      }));
      toast.success(enabled ? "工作流已启用" : "工作流已禁用");
    } catch {
      toast.error("切换工作流状态失败");
    }
  },

  importWorkflow: async (data: string) => {
    set({ saving: true });
    try {
      const workflow = await workflowApi.import(data);
      set((state) => ({ workflows: [...state.workflows, workflow] }));
      toast.success("工作流导入成功");
      return workflow;
    } catch {
      toast.error("导入工作流失败");
      return null;
    } finally {
      set({ saving: false });
    }
  },

  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => {
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.map((n) =>
            n.id === nodeId ? { ...n, position } : n
          ),
        },
      };
    });
  },

  addNode: (node: WorkflowNode) => {
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: [...state.currentWorkflow.nodes, node],
        },
      };
    });
  },

  removeNode: (nodeId: string) => {
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.filter((n) => n.id !== nodeId),
          edges: state.currentWorkflow.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          ),
        },
      };
    });
  },

  addEdge: (edge: WorkflowEdge) => {
    set((state) => {
      if (!state.currentWorkflow) return state;
      const exists = state.currentWorkflow.edges.some(
        (e) => e.source === edge.source && e.target === edge.target
      );
      if (exists) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          edges: [...state.currentWorkflow.edges, edge],
        },
      };
    });
  },

  removeEdge: (edgeId: string) => {
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          edges: state.currentWorkflow.edges.filter((e) => e.id !== edgeId),
        },
      };
    });
  },

  updateNodeData: (nodeId: string, data: Partial<WorkflowNode["data"]>) => {
    set((state) => {
      if (!state.currentWorkflow) return state;
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          nodes: state.currentWorkflow.nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
          ),
        },
      };
    });
  },

  setCurrentWorkflow: (workflow: Workflow | null) => {
    set({ currentWorkflow: workflow });
  },
}));
