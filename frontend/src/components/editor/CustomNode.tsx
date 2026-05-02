import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useExecutionStore } from "@/stores/execution-store";
import {
  Play,
  Webhook,
  Clock,
  MessageSquare,
  Bot,
  Wrench,
  Zap,
  Mail,
  Globe,
  Database,
  Filter,
  GitBranch,
  Code,
  FileText,
  Settings,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  play: Play,
  webhook: Webhook,
  clock: Clock,
  "message-square": MessageSquare,
  bot: Bot,
  wrench: Wrench,
  zap: Zap,
  mail: Mail,
  globe: Globe,
  database: Database,
  filter: Filter,
  "git-branch": GitBranch,
  code: Code,
  "file-text": FileText,
  settings: Settings,
};

const statusColors: Record<string, string> = {
  idle: "border-border",
  running: "border-blue-500 shadow-blue-500/20 shadow-lg animate-pulse",
  success: "border-green-500 shadow-green-500/20 shadow-lg",
  failed: "border-red-500 shadow-red-500/20 shadow-lg",
  skipped: "border-yellow-500/50",
};

const statusDotColors: Record<string, string> = {
  idle: "bg-muted-foreground",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  failed: "bg-red-500",
  skipped: "bg-yellow-500",
};

interface CustomNodeData {
  label: string;
  type: string;
  config: Record<string, unknown>;
  icon?: string;
  color?: string;
  description?: string;
  [key: string]: unknown;
}

interface CustomNodeProps {
  data: CustomNodeData;
  selected?: boolean;
  id: string;
}

const CustomNode: React.FC<CustomNodeProps> = ({ data, selected, id }) => {
  const nodeExecutionStatuses = useExecutionStore(
    (state) => state.nodeExecutionStatuses
  );
  const status = nodeExecutionStatuses.get(id) || "idle";

  const IconComponent = iconMap[data.icon || "settings"] || Settings;

  const configSummary = Object.entries(data.config || {})
    .filter(([_, v]) => v !== undefined && v !== "")
    .slice(0, 2)
    .map(([k, v]) => {
      const displayValue =
        typeof v === "string" && v.length > 20
          ? v.substring(0, 20) + "..."
          : String(v);
      return `${k}: ${displayValue}`;
    });

  return (
    <div
      className={cn(
        "relative min-w-[180px] max-w-[240px] rounded-lg border-2 bg-card transition-all duration-200",
        statusColors[status],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary !border-primary"
      />

      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded",
            data.color || "bg-primary/20"
          )}
        >
          <IconComponent className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {data.label}
        </span>
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            statusDotColors[status]
          )}
          title={status}
        />
      </div>

      {configSummary.length > 0 && (
        <div className="px-3 py-1.5">
          {configSummary.map((item, index) => (
            <div
              key={index}
              className="truncate text-[10px] text-muted-foreground"
            >
              {item}
            </div>
          ))}
        </div>
      )}

      {configSummary.length === 0 && (
        <div className="px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground/50 italic">
            点击配置节点
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary !border-primary"
      />
    </div>
  );
};

export default memo(CustomNode);
