import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWorkflowStore } from "@/stores/workflow-store";
import {
  Plus,
  Play,
  Trash2,
  Edit3,
  Upload,
  Loader2,
  Clock,
  GitBranch,
  Workflow,
  Zap,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { workflows, loading, fetchAll, create, delete: deleteWorkflow, toggle, execute } =
    useWorkflowStore();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState("");
  const [creating, setCreating] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreateNew = useCallback(async () => {
    setCreating(true);
    try {
      const workflow = await create({
        name: "新建工作流",
        description: "",
        nodes: [
          {
            id: "start",
            type: "manual-trigger",
            nodeType: "trigger",
            label: "手动触发",
            position: { x: 250, y: 150 },
            data: {
              label: "手动触发",
              type: "manual-trigger",
              config: {},
            },
          },
        ],
        edges: [],
      });
      if (workflow) {
        navigate(`/workflow/${workflow.id}`);
      }
    } finally {
      setCreating(false);
    }
  }, [create, navigate]);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("确定要删除这个工作流吗？")) {
        await deleteWorkflow(id);
      }
    },
    [deleteWorkflow]
  );

  const handleExecute = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExecutingId(id);
      try {
        await execute(id);
      } finally {
        setExecutingId(null);
      }
    },
    [execute]
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      await toggle(id, enabled);
    },
    [toggle]
  );

  const handleImport = useCallback(async () => {
    if (!importData.trim()) {
      toast.error("请粘贴工作流数据");
      return;
    }
    try {
      const workflow = await useWorkflowStore.getState().importWorkflow(importData);
      if (workflow) {
        setImportDialogOpen(false);
        setImportData("");
        fetchAll();
      }
    } catch {
      // error handled by API interceptor
    }
  }, [importData, fetchAll]);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setImportData(content);
      };
      reader.readAsText(file);
    },
    []
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">FlowPilot</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/logs")}
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              执行日志
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/credentials")}
            >
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />
              凭据管理
            </Button>
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  导入
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>导入工作流</DialogTitle>
                  <DialogDescription>
                    粘贴工作流 JSON 数据或选择文件导入
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="cursor-pointer"
                  />
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="粘贴 JSON 数据..."
                    className="h-40 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setImportDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button onClick={handleImport}>导入</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={handleCreateNew} disabled={creating}>
              {creating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
              )}
              新建工作流
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <Workflow className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              还没有工作流
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              创建你的第一个自动化工作流，让 FlowPilot 帮你完成重复任务
            </p>
            <Button onClick={handleCreateNew} disabled={creating}>
              <Plus className="mr-1.5 h-4 w-4" />
              创建第一个工作流
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                onClick={() => navigate(`/workflow/${workflow.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="truncate text-base">
                        {workflow.name}
                      </CardTitle>
                      {workflow.description && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={workflow.enabled ? "success" : "secondary"}
                      className="ml-2 shrink-0"
                    >
                      {workflow.enabled ? "已启用" : "已禁用"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {workflow.nodes.length} 个节点
                    </span>
                    {workflow.lastExecutedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dayjs(workflow.lastExecutedAt).fromNow()}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={workflow.enabled}
                        onCheckedChange={(checked) =>
                          handleToggle(workflow.id, checked)
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleExecute(workflow.id, e)}
                        disabled={executingId === workflow.id || !workflow.enabled}
                        title="执行"
                      >
                        {executingId === workflow.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/workflow/${workflow.id}`);
                        }}
                        title="编辑"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(workflow.id, e)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
