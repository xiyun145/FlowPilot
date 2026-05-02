import { useEffect, useCallback } from "react";
import { useEditorStore } from "@/stores/editor-store";
import type { WorkflowNode, WorkflowEdge } from "@/types";

interface UseUndoRedoOptions {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onRestore: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
}

export function useUndoRedo({ nodes, edges, onRestore }: UseUndoRedoOptions) {
  const { undo, redo, pushUndo } = useEditorStore();

  const handleUndo = useCallback(() => {
    const snapshot = undo({ nodes, edges });
    if (snapshot) {
      onRestore(snapshot.nodes, snapshot.edges);
    }
  }, [nodes, edges, undo, onRestore]);

  const handleRedo = useCallback(() => {
    const snapshot = redo({ nodes, edges });
    if (snapshot) {
      onRestore(snapshot.nodes, snapshot.edges);
    }
  }, [nodes, edges, redo, onRestore]);

  const saveSnapshot = useCallback(() => {
    pushUndo({ nodes, edges });
  }, [nodes, edges, pushUndo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "z" &&
        !e.shiftKey
      ) {
        e.preventDefault();
        handleUndo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  return { saveSnapshot, handleUndo, handleRedo };
}
