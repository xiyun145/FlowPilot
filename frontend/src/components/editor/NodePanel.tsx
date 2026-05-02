import React, { useState, useMemo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { nodeDefinitionApi } from "@/utils/api";
import type { NodeDefinition } from "@/types";
import { Search, GripVertical } from "lucide-react";
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

const categoryLabels: Record<string, string> = {
  trigger: "触发节点",
  wechat: "微信公众号",
  gemini: "Google Gemini",
  utility: "基础工具",
};

const categoryOrder = ["trigger", "wechat", "gemini", "utility"];

const NodePanel: React.FC = () => {
  const [search, setSearch] = useState("");
  const [definitions, setDefinitions] = useState<NodeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDefinitions = async () => {
      try {
        const defs = await nodeDefinitionApi.getAll();
        setDefinitions(defs);
      } catch {
        // Use fallback definitions
        setDefinitions(getFallbackDefinitions());
      } finally {
        setLoading(false);
      }
    };
    fetchDefinitions();
  }, []);

  const groupedDefinitions = useMemo(() => {
    const filtered = definitions.filter(
      (def) =>
        def.name.toLowerCase().includes(search.toLowerCase()) ||
        def.description.toLowerCase().includes(search.toLowerCase()) ||
        def.type.toLowerCase().includes(search.toLowerCase())
    );

    const groups: Record<string, NodeDefinition[]> = {};
    for (const def of filtered) {
      if (!groups[def.category]) {
        groups[def.category] = [];
      }
      groups[def.category].push(def);
    }
    return groups;
  }, [definitions, search]);

  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    nodeType: string,
    definition: NodeDefinition
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData(
      "application/node-definition",
      JSON.stringify(definition)
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <h2 className="mb-2 text-sm font-semibold text-foreground">节点面板</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索节点..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            categoryOrder.map((category) => {
              const nodes = groupedDefinitions[category];
              if (!nodes || nodes.length === 0) return null;

              return (
                <div key={category} className="mb-4">
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {categoryLabels[category] || category}
                  </h3>
                  <div className="space-y-1">
                    {nodes.map((def) => {
                      const IconComponent =
                        iconMap[def.icon] || Settings;

                      return (
                        <div
                          key={def.type}
                          className="flex cursor-grab items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 transition-colors hover:border-border hover:bg-accent active:cursor-grabbing"
                          draggable
                          onDragStart={(e) =>
                            onDragStart(e, def.type, def)
                          }
                        >
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded ${def.color || "bg-primary/20"}`}
                          >
                            <IconComponent className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">
                              {def.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {def.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

function getFallbackDefinitions(): NodeDefinition[] {
  return [
    {
      type: "cron-trigger",
      name: "定时触发",
      description: "按 Cron 表达式定时触发",
      category: "trigger",
      icon: "clock",
      color: "bg-blue-500/20",
      inputFields: [
        {
          key: "cron",
          label: "Cron 表达式",
          type: "cron",
          required: true,
          defaultValue: "* * * * *",
        },
      ],
      hasInput: false,
      hasOutput: true,
    },
    {
      type: "webhook-trigger",
      name: "Webhook 触发",
      description: "通过 HTTP 请求触发",
      category: "trigger",
      icon: "webhook",
      color: "bg-purple-500/20",
      inputFields: [
        { key: "path", label: "路径", type: "text", required: true },
      ],
      hasInput: false,
      hasOutput: true,
    },
    {
      type: "manual-trigger",
      name: "手动触发",
      description: "手动点击执行",
      category: "trigger",
      icon: "play",
      color: "bg-green-500/20",
      inputFields: [],
      hasInput: false,
      hasOutput: true,
    },
    {
      type: "wechat-message",
      name: "发送微信消息",
      description: "通过微信公众号发送消息",
      category: "wechat",
      icon: "message-square",
      color: "bg-green-500/20",
      inputFields: [
        { key: "to", label: "接收者", type: "text", required: true },
        { key: "content", label: "消息内容", type: "textarea", required: true },
        {
          key: "credential",
          label: "凭据",
          type: "credential",
          credentialType: "wechat",
          required: true,
        },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      type: "wechat-template",
      name: "发送模板消息",
      description: "发送微信模板消息",
      category: "wechat",
      icon: "file-text",
      color: "bg-green-500/20",
      inputFields: [
        { key: "templateId", label: "模板ID", type: "text", required: true },
        { key: "to", label: "接收者", type: "text", required: true },
        { key: "data", label: "模板数据", type: "textarea", required: true },
        {
          key: "credential",
          label: "凭据",
          type: "credential",
          credentialType: "wechat",
          required: true,
        },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      type: "gemini-chat",
      name: "Gemini 对话",
      description: "使用 Google Gemini 进行 AI 对话",
      category: "gemini",
      icon: "bot",
      color: "bg-blue-500/20",
      inputFields: [
        { key: "prompt", label: "提示词", type: "textarea", required: true },
        {
          key: "model",
          label: "模型",
          type: "select",
          options: [
            { label: "Gemini Pro", value: "gemini-pro" },
            { label: "Gemini Pro Vision", value: "gemini-pro-vision" },
          ],
          defaultValue: "gemini-pro",
        },
        {
          key: "credential",
          label: "凭据",
          type: "credential",
          credentialType: "gemini",
          required: true,
        },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      type: "http-request",
      name: "HTTP 请求",
      description: "发送 HTTP 请求",
      category: "utility",
      icon: "globe",
      color: "bg-orange-500/20",
      inputFields: [
        { key: "url", label: "URL", type: "text", required: true },
        {
          key: "method",
          label: "方法",
          type: "select",
          options: [
            { label: "GET", value: "GET" },
            { label: "POST", value: "POST" },
            { label: "PUT", value: "PUT" },
            { label: "DELETE", value: "DELETE" },
          ],
          defaultValue: "GET",
        },
        { key: "headers", label: "请求头", type: "textarea" },
        { key: "body", label: "请求体", type: "textarea" },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      type: "code-exec",
      name: "代码执行",
      description: "运行自定义 JavaScript 代码",
      category: "utility",
      icon: "code",
      color: "bg-yellow-500/20",
      inputFields: [
        { key: "code", label: "代码", type: "code", required: true, rows: 10 },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      type: "condition",
      name: "条件判断",
      description: "根据条件分支执行",
      category: "utility",
      icon: "git-branch",
      color: "bg-purple-500/20",
      inputFields: [
        { key: "expression", label: "条件表达式", type: "text", required: true },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      type: "data-transform",
      name: "数据转换",
      description: "转换和映射数据",
      category: "utility",
      icon: "filter",
      color: "bg-cyan-500/20",
      inputFields: [
        { key: "mapping", label: "映射规则", type: "textarea", required: true },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      type: "delay",
      name: "延时等待",
      description: "等待指定时间后继续",
      category: "utility",
      icon: "clock",
      color: "bg-gray-500/20",
      inputFields: [
        { key: "duration", label: "等待时间(秒)", type: "number", required: true, defaultValue: 1 },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ];
}

export default NodePanel;
