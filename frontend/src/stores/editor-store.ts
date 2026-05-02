import { create } from "zustand";
import type { Workflow, WorkflowNode, WorkflowEdge } from "@/types";

interface EditorSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface EditorState {
  selectedNodeId: string | null;
  isPanelOpen: boolean;
  zoom: number;
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];

  selectNode: (nodeId: string) => void;
  deselectNode: () => void;
  setPanelOpen: (open: boolean) => void;
  setZoom: (zoom: number) => void;
  pushUndo: (snapshot: EditorSnapshot) => void;
  undo: (currentSnapshot: EditorSnapshot) => EditorSnapshot | null;
  redo: (currentSnapshot: EditorSnapshot) => EditorSnapshot | null;
  clearHistory: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedNodeId: null,
  isPanelOpen: false,
  zoom: 1,
  undoStack: [],
  redoStack: [],

  selectNode: (nodeId: string) => {
    set({ selectedNodeId: nodeId, isPanelOpen: true });
  },

  deselectNode: () => {
    set({ selectedNodeId: null, isPanelOpen: false });
  },

  setPanelOpen: (open: boolean) => {
    set({ isPanelOpen: open });
    if (!open) {
      set({ selectedNodeId: null });
    }
  },

  setZoom: (zoom: number) => {
    set({ zoom });
  },

  pushUndo: (snapshot: EditorSnapshot) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), snapshot],
      redoStack: [],
    }));
  },

  undo: (currentSnapshot: EditorSnapshot) => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;

    const previous = undoStack[undoStack.length - 1];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, currentSnapshot],
    }));
    return previous;
  },

  redo: (currentSnapshot: EditorSnapshot) => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;

    const next = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, currentSnapshot],
    }));
    return next;
  },

  clearHistory: () => {
    set({ undoStack: [], redoStack: [] });
  },
}));
