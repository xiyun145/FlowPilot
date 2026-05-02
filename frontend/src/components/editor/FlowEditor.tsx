import React, { useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  BackgroundVariant,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import CustomNode from "./CustomNode";
import { useWorkflowStore } from "@/stores/workflow-store";
import { useEditorStore } from "@/stores/editor-store";
import { useExecutionStore } from "@/stores/execution-store";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import type { WorkflowNode, WorkflowEdge, NodeDefinition } from "@/types";

// Simple ID generator
function generateId(): string {
  return (
    "node_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 9)
  );
}

function generateEdgeId(): string {
  return (
    "edge_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 9)
  );
}

interface FlowEditorProps {
  workflowId: string;
}

const nodeTypes: NodeTypes = {
  custom: CustomNode as unknown as React.FC,
};

const defaultEdgeOptions = {
  type: "default",
  animated: true,
  style: {
    stroke: "#3b82f6",
    strokeWidth: 2,
    strokeDasharray: "5 5",
  },
};

const FlowEditor: React.FC<FlowEditorProps> = ({ workflowId }) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    currentWorkflow,
    updateNodePosition,
    addNode,
    addEdge: addEdgeToStore,
    removeEdge,
    update,
  } = useWorkflowStore();
  const { selectNode, selectedNodeId } = useEditorStore();
  const nodeExecutionStatuses = useExecutionStore(
    (state) => state.nodeExecutionStatuses
  );

  // Convert workflow nodes to React Flow format
  const flowNodes: Node[] = useMemo(() => {
    if (!currentWorkflow) return [];
    return currentWorkflow.nodes.map((n) => ({
      id: n.id,
      type: "custom",
      position: n.position,
      data: n.data as unknown as Record<string, unknown>,
      selected: n.id === selectedNodeId,
    }));
  }, [currentWorkflow, selectedNodeId]);

  const flowEdges: Edge[] = useMemo(() => {
    if (!currentWorkflow) return [];
    return currentWorkflow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      animated: true,
      style: {
        stroke: "#3b82f6",
        strokeWidth: 2,
      },
    }));
  }, [currentWorkflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync nodes/edges when workflow changes
  React.useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Undo/Redo
  const { saveSnapshot } = useUndoRedo({
    nodes: currentWorkflow?.nodes || [],
    edges: currentWorkflow?.edges || [],
    onRestore: (restoredNodes, restoredEdges) => {
      if (currentWorkflow) {
        update(workflowId, {
          nodes: restoredNodes,
          edges: restoredEdges,
        });
      }
    },
  });

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      // Track position changes
      for (const change of changes) {
        if (
          change.type === "position" &&
          change.position &&
          !change.dragging
        ) {
          updateNodePosition(change.id, change.position);
        }
        if (change.type === "remove") {
          // Handled by store
        }
      }
    },
    [onNodesChange, updateNodePosition]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);

      for (const change of changes) {
        if (change.type === "remove") {
          removeEdge(change.id);
        }
      }
    },
    [onEdgesChange, removeEdge]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Validate: don't connect to self
      if (connection.source === connection.target) return;

      // Validate: no duplicate connections
      const exists = edges.some(
        (e) =>
          e.source === connection.source && e.target === connection.target
      );
      if (exists) return;

      saveSnapshot();

      const newEdge: WorkflowEdge = {
        id: generateEdgeId(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        animated: true,
      };

      addEdgeToStore(newEdge);
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: newEdge.id,
            animated: true,
            style: { stroke: "#3b82f6", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [edges, addEdgeToStore, setEdges, saveSnapshot]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    useEditorStore.getState().deselectNode();
  }, []);

  // Drag & Drop handler
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      const definitionStr = event.dataTransfer.getData(
        "application/node-definition"
      );

      if (!type || !reactFlowWrapper.current) return;

      saveSnapshot();

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 90,
        y: event.clientY - bounds.top - 20,
      };

      let definition: NodeDefinition | null = null;
      try {
        definition = definitionStr ? JSON.parse(definitionStr) : null;
      } catch {
        // ignore
      }

      const newNode: WorkflowNode = {
        id: generateId(),
        type,
        nodeType: (definition?.category as WorkflowNode["nodeType"]) || "action",
        label: definition?.name || type,
        position,
        data: {
          label: definition?.name || type,
          type,
          config: getDefaultConfig(definition),
          icon: definition?.icon,
          color: definition?.color,
          description: definition?.description,
        },
      };

      addNode(newNode);
    },
    [addNode, saveSnapshot]
  );

  // Node color based on execution status
  const getNodeColor = useCallback(
    (node: Node) => {
      const status = nodeExecutionStatuses.get(node.id);
      switch (status) {
        case "running":
          return "#3b82f6";
        case "success":
          return "#22c55e";
        case "failed":
          return "#ef4444";
        default:
          return "#6b7280";
      }
    },
    [nodeExecutionStatuses]
  );

  return (
    <div ref={reactFlowWrapper} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode="Delete"
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(240, 5%, 20%)"
        />
        <Controls
          position="bottom-left"
          className="!bg-card !border-border !shadow-lg"
        />
        <MiniMap
          position="bottom-right"
          nodeColor={getNodeColor}
          maskColor="rgba(0, 0, 0, 0.5)"
          className="!bg-card !border-border"
        />
      </ReactFlow>
    </div>
  );
};

function getDefaultConfig(definition: NodeDefinition | null): Record<string, unknown> {
  if (!definition) return {};

  const config: Record<string, unknown> = {};
  for (const field of definition.inputFields ?? []) {
    if (field.defaultValue !== undefined) {
      config[field.key] = field.defaultValue;
    }
  }
  return config;
}

export default FlowEditor;
