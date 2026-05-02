import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useWorkflowStore } from "@/stores/workflow-store";
import {
  ArrowLeft,
  Save,
  Play,
  ScrollText,
  Loader2,
  Check,
} from "lucide-react";

interface TopBarProps {
  workflowId: string;
}

const TopBar: React.FC<TopBarProps> = ({ workflowId }) => {
  const navigate = useNavigate();
  const { currentWorkflow, saving, update, execute, toggle } =
    useWorkflowStore();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(currentWorkflow?.name || "");
  const [executing, setExecuting] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveName = useCallback(async () => {
    if (!currentWorkflow || !name.trim()) return;
    if (name !== currentWorkflow.name) {
      await update(workflowId, { name: name.trim() });
    }
    setEditingName(false);
  }, [currentWorkflow, name, workflowId, update]);

  const handleSave = useCallback(async () => {
    if (!currentWorkflow) return;
    await update(workflowId, {
      nodes: currentWorkflow.nodes,
      edges: currentWorkflow.edges,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [currentWorkflow, workflowId, update]);

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    try {
      await execute(workflowId);
    } finally {
      setExecuting(false);
    }
  }, [workflowId, execute]);

  const handleToggle = useCallback(
    async (enabled: boolean) => {
      await toggle(workflowId, enabled);
    },
    [workflowId, toggle]
  );

  if (!currentWorkflow) return null;

  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          title="返回"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {editingName ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveName();
              if (e.key === "Escape") {
                setName(currentWorkflow.name);
                setEditingName(false);
              }
            }}
            className="h-8 w-64 text-sm font-semibold"
            autoFocus
          />
        ) : (
          <h1
            className="cursor-pointer text-sm font-semibold text-foreground hover:text-primary transition-colors"
            onClick={() => {
              setName(currentWorkflow.name);
              setEditingName(true);
            }}
            title="点击编辑名称"
          >
            {currentWorkflow.name}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-xs text-muted-foreground">
            {currentWorkflow.enabled ? "已启用" : "已禁用"}
          </span>
          <Switch
            checked={currentWorkflow.enabled}
            onCheckedChange={handleToggle}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/logs")}
          title="查看日志"
        >
          <ScrollText className="mr-1.5 h-3.5 w-3.5" />
          日志
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          title="保存"
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          保存
        </Button>

        <Button
          size="sm"
          onClick={handleExecute}
          disabled={executing || !currentWorkflow.enabled}
          title="执行"
        >
          {executing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          执行
        </Button>
      </div>
    </div>
  );
};

export default TopBar;
