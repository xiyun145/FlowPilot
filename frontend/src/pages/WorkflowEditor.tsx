import React, { useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflowStore } from "@/stores/workflow-store";
import { useEditorStore } from "@/stores/editor-store";
import TopBar from "@/components/editor/TopBar";
import FlowEditor from "@/components/editor/FlowEditor";
import NodePanel from "@/components/editor/NodePanel";
import ConfigPanel from "@/components/editor/ConfigPanel";
import { Loader2 } from "lucide-react";

const WorkflowEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentWorkflow, loading, fetchById, update } = useWorkflowStore();
  const { clearHistory } = useEditorStore();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (id) {
      fetchById(id);
      clearHistory();
    }
    return () => {
      useWorkflowStore.getState().setCurrentWorkflow(null);
      useEditorStore.getState().deselectNode();
    };
  }, [id, fetchById, clearHistory]);

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (!id || !currentWorkflow) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      update(id, {
        nodes: currentWorkflow.nodes,
        edges: currentWorkflow.edges,
        name: currentWorkflow.name,
        description: currentWorkflow.description,
      });
    }, 2000);
  }, [id, currentWorkflow, update]);

  // Trigger auto-save when nodes or edges change
  useEffect(() => {
    triggerAutoSave();
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [currentWorkflow?.nodes, currentWorkflow?.edges, triggerAutoSave]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentWorkflow || !id) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">工作流未找到</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-background">
        <TopBar workflowId={id} />
        <div className="flex flex-1 overflow-hidden">
          <NodePanel />
          <div className="flex-1">
            <FlowEditor workflowId={id} />
          </div>
          <ConfigPanel />
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default WorkflowEditor;
