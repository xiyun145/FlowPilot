import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExecutionStore } from "@/stores/execution-store";
import { useWorkflowStore } from "@/stores/workflow-store";
import type { Execution, ExecutionStatus, NodeExecution } from "@/types";
import {
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  StopCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

const statusConfig: Record<
  ExecutionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline"; icon: React.ElementType }
> = {
  pending: { label: "等待中", variant: "secondary", icon: Clock },
  running: { label: "运行中", variant: "default", icon: RefreshCw },
  success: { label: "成功", variant: "success", icon: CheckCircle2 },
  failed: { label: "失败", variant: "destructive", icon: XCircle },
  cancelled: { label: "已取消", variant: "warning", icon: StopCircle },
};

const nodeStatusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" }
> = {
  pending: { label: "等待", variant: "secondary" },
  running: { label: "运行中", variant: "default" },
  success: { label: "成功", variant: "success" },
  failed: { label: "失败", variant: "destructive" },
  skipped: { label: "跳过", variant: "outline" },
};

const ExecutionLogs: React.FC = () => {
  const navigate = useNavigate();
  const {
    executions,
    loading,
    fetchExecutions,
    fetchDetail,
    currentExecution,
    cancelExecution,
  } = useExecutionStore();
  const { workflows, fetchAll: fetchWorkflows } = useWorkflowStore();

  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflows();
    fetchExecutions();
  }, [fetchWorkflows, fetchExecutions]);

  useEffect(() => {
    fetchExecutions({
      workflowId: workflowFilter === "all" ? undefined : workflowFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    });
  }, [workflowFilter, statusFilter, fetchExecutions]);

  const handleExpand = useCallback(
    async (execution: Execution) => {
      if (expandedId === execution.id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(execution.id);
      await fetchDetail(execution.id);
    },
    [expandedId, fetchDetail]
  );

  const handleCancel = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await cancelExecution(id);
    },
    [cancelExecution]
  );

  const handleRefresh = useCallback(() => {
    fetchExecutions({
      workflowId: workflowFilter === "all" ? undefined : workflowFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    });
  }, [workflowFilter, statusFilter, fetchExecutions]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">
                执行日志
              </h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center gap-3">
          <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择工作流" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部工作流</SelectItem>
              {workflows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="success">成功</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
              <SelectItem value="running">运行中</SelectItem>
              <SelectItem value="pending">等待中</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Execution List */}
      <main className="mx-auto max-w-7xl px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">暂无执行记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {executions.map((execution) => {
              const statusInfo = statusConfig[execution.status];
              const StatusIcon = statusInfo.icon;
              const isExpanded = expandedId === execution.id;

              return (
                <Card key={execution.id} className="overflow-hidden">
                  <div
                    className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
                    onClick={() => handleExpand(execution)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <StatusIcon
                          className={`h-4 w-4 ${
                            execution.status === "running"
                              ? "animate-spin text-primary"
                              : ""
                          }`}
                        />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {execution.workflowName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {execution.triggerType === "manual"
                            ? "手动触发"
                            : execution.triggerType === "cron"
                            ? "定时触发"
                            : "Webhook 触发"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          {dayjs(execution.startTime).format(
                            "MM-DD HH:mm:ss"
                          )}
                        </div>
                        {execution.duration && (
                          <div className="text-xs text-muted-foreground">
                            耗时 {(execution.duration / 1000).toFixed(1)}s
                          </div>
                        )}
                      </div>
                      {execution.status === "running" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => handleCancel(execution.id, e)}
                        >
                          <StopCircle className="mr-1 h-3 w-3" />
                          取消
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && currentExecution?.id === execution.id && (
                    <>
                      <Separator />
                      <CardContent className="p-4">
                        <h4 className="mb-3 text-xs font-medium text-muted-foreground">
                          节点执行详情
                        </h4>
                        {currentExecution.nodeExecutions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            暂无节点执行信息
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {currentExecution.nodeExecutions.map(
                              (nodeExec: NodeExecution) => {
                                const nodeStatus =
                                  nodeStatusConfig[nodeExec.status];

                                return (
                                  <div
                                    key={nodeExec.nodeId}
                                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Badge
                                        variant={nodeStatus.variant}
                                        className="w-14 justify-center"
                                      >
                                        {nodeStatus.label}
                                      </Badge>
                                      <div>
                                        <div className="text-xs font-medium text-foreground">
                                          {nodeExec.nodeName}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                          {nodeExec.nodeType}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      {nodeExec.duration && (
                                        <div className="text-xs text-muted-foreground">
                                          {nodeExec.duration}ms
                                        </div>
                                      )}
                                      {nodeExec.error && (
                                        <div className="max-w-xs truncate text-xs text-destructive">
                                          {nodeExec.error}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}

                        {execution.error && (
                          <div className="mt-4 rounded-md bg-destructive/10 p-3">
                            <div className="text-xs font-medium text-destructive">
                              错误信息
                            </div>
                            <div className="mt-1 text-xs text-destructive/80">
                              {execution.error}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default ExecutionLogs;
