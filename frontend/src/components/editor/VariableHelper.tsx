import React, { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useWorkflowStore } from "@/stores/workflow-store";
import { Braces, ChevronRight } from "lucide-react";

interface VariableHelperProps {
  currentNodeId: string;
  onInsert: (variable: string) => void;
}

interface VariableItem {
  path: string;
  label: string;
  sourceNode: string;
}

const VariableHelper: React.FC<VariableHelperProps> = ({
  currentNodeId,
  onInsert,
}) => {
  const currentWorkflow = useWorkflowStore((state) => state.currentWorkflow);

  const variables = useMemo(() => {
    if (!currentWorkflow) return [];

    const currentNodeIndex = currentWorkflow.nodes.findIndex(
      (n) => n.id === currentNodeId
    );
    if (currentNodeIndex <= 0) return [];

    // Get all nodes before the current one
    const previousNodes = currentWorkflow.nodes.slice(0, currentNodeIndex);
    const items: VariableItem[] = [];

    for (const node of previousNodes) {
      // Standard output variable
      items.push({
        path: `{{$node.${node.id}.output}}`,
        label: "输出数据",
        sourceNode: node.data.label,
      });

      // Common output fields
      const commonFields = ["text", "data", "result", "status", "message", "content"];
      for (const field of commonFields) {
        items.push({
          path: `{{$node.${node.id}.output.${field}}}`,
          label: field,
          sourceNode: node.data.label,
        });
      }
    }

    // Add global variables
    items.push(
      { path: "{{$now}}", label: "当前时间", sourceNode: "系统变量" },
      { path: "{{$today}}", label: "今天日期", sourceNode: "系统变量" },
      { path: "{{$timestamp}}", label: "时间戳", sourceNode: "系统变量" },
      { path: "{{$randomId}}", label: "随机ID", sourceNode: "系统变量" }
    );

    return items;
  }, [currentWorkflow, currentNodeId]);

  const groupedVariables = useMemo(() => {
    const groups: Record<string, VariableItem[]> = {};
    for (const v of variables) {
      if (!groups[v.sourceNode]) {
        groups[v.sourceNode] = [];
      }
      groups[v.sourceNode].push(v);
    }
    return groups;
  }, [variables]);

  if (variables.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground">
        没有可用变量
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-1.5 px-3 py-2">
        <Braces className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">可用变量</span>
      </div>
      <ScrollArea className="max-h-48">
        <div className="px-3 pb-3">
          {Object.entries(groupedVariables).map(([source, vars]) => (
            <div key={source} className="mb-2">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {source}
              </div>
              <div className="space-y-0.5">
                {vars.map((v) => (
                  <Button
                    key={v.path}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-full justify-start text-xs font-mono"
                    onClick={() => onInsert(v.path)}
                    title={`点击插入: ${v.path}`}
                  >
                    <ChevronRight className="mr-1 h-3 w-3 text-muted-foreground" />
                    <span className="text-primary">{v.path}</span>
                    <span className="ml-1.5 text-muted-foreground">
                      ({v.label})
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default VariableHelper;
