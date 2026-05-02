import React, { useState, useEffect, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useWorkflowStore } from "@/stores/workflow-store";
import { useEditorStore } from "@/stores/editor-store";
import { useCredentialStore } from "@/stores/credential-store";
import CronBuilder from "./CronBuilder";
import VariableHelper from "./VariableHelper";
import type { ConfigField, NodeDefinition } from "@/types";
import { X, Trash2, Save, Settings } from "lucide-react";

const ConfigPanel: React.FC = () => {
  const { currentWorkflow, updateNodeData, removeNode } = useWorkflowStore();
  const { selectedNodeId, deselectNode } = useEditorStore();
  const { credentials, fetchAll: fetchCredentials } = useCredentialStore();

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const [localLabel, setLocalLabel] = useState("");
  const [dirty, setDirty] = useState(false);

  const selectedNode = currentWorkflow?.nodes?.find(
    (n) => n.id === selectedNodeId
  );

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  useEffect(() => {
    if (selectedNode) {
      setLocalConfig({ ...selectedNode.data.config });
      setLocalLabel(selectedNode.data.label);
      setDirty(false);
    }
  }, [selectedNodeId, selectedNode]);

  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      setLocalConfig((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    },
    []
  );

  const handleLabelChange = useCallback((value: string) => {
    setLocalLabel(value);
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedNodeId) return;
    updateNodeData(selectedNodeId, {
      config: localConfig,
      label: localLabel,
    });
    setDirty(false);
  }, [selectedNodeId, localConfig, localLabel, updateNodeData]);

  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return;
    removeNode(selectedNodeId);
    deselectNode();
  }, [selectedNodeId, removeNode, deselectNode]);

  const handleInsertVariable = useCallback(
    (variable: string) => {
      // This will be called from VariableHelper
      // For now, we just copy to clipboard
      navigator.clipboard.writeText(variable);
    },
    []
  );

  if (!selectedNode || !selectedNodeId) {
    return (
      <div className="flex h-full w-80 flex-col items-center justify-center border-l border-border bg-card">
        <Settings className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">选择一个节点进行配置</p>
      </div>
    );
  }

  // Try to find node definition for field configs
  const definition = getNodeDefinition(selectedNode.data.type);
  const fields = definition?.inputFields || [];

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">节点配置</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={deselectNode}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* Node Label */}
          <div className="space-y-1.5">
            <Label htmlFor="node-label">节点名称</Label>
            <Input
              id="node-label"
              value={localLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="输入节点名称"
            />
          </div>

          <Separator />

          {/* Node Type Info */}
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">类型:</span>
            <span className="text-xs font-medium text-foreground">
              {selectedNode.data.type}
            </span>
          </div>

          {/* Dynamic Fields */}
          {fields.length > 0 && (
            <div className="space-y-4">
              {fields.map((field) => (
                <FormField
                  key={field.key}
                  field={field}
                  value={localConfig[field.key]}
                  onChange={(val) => handleConfigChange(field.key, val)}
                  credentials={credentials}
                  currentNodeId={selectedNodeId}
                  onInsertVariable={handleInsertVariable}
                />
              ))}
            </div>
          )}

          {/* Fallback: show raw config editor if no definition */}
          {fields.length === 0 && (
            <div className="space-y-1.5">
              <Label>配置 (JSON)</Label>
              <Textarea
                value={JSON.stringify(localConfig, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setLocalConfig(parsed);
                    setDirty(true);
                  } catch {
                    // ignore invalid JSON
                  }
                }}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Variable Helper */}
      <VariableHelper
        currentNodeId={selectedNodeId}
        onInsert={handleInsertVariable}
      />

      {/* Footer Actions */}
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            onClick={handleSave}
            disabled={!dirty}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            保存
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ==================== Form Field Component ====================

interface FormFieldProps {
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  credentials: { id: string; name: string; type: string }[];
  currentNodeId: string;
  onInsertVariable: (variable: string) => void;
}

const FormField: React.FC<FormFieldProps> = ({
  field,
  value,
  onChange,
  credentials,
}) => {
  const stringValue = value !== undefined && value !== null ? String(value) : "";
  const numberValue = typeof value === "number" ? value : 0;
  const booleanValue = typeof value === "boolean" ? value : false;

  const filteredCredentials = field.credentialType
    ? credentials.filter((c) => c.type === field.credentialType)
    : credentials;

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={field.key}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Textarea
            id={field.key}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={field.rows || 4}
          />
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={field.key}
            type="number"
            value={numberValue}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
          />
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
        </div>
      );

    case "select":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select
            value={stringValue}
            onValueChange={(val) => onChange(val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || "请选择"} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
        </div>
      );

    case "password":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={field.key}
            type="password"
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
        </div>
      );

    case "credential":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select
            value={stringValue}
            onValueChange={(val) => onChange(val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择凭据" />
            </SelectTrigger>
            <SelectContent>
              {filteredCredentials.map((cred) => (
                <SelectItem key={cred.id} value={cred.id}>
                  {cred.name}
                </SelectItem>
              ))}
              {filteredCredentials.length === 0 && (
                <SelectItem value="__none__" disabled>
                  暂无可用凭据
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
        </div>
      );

    case "cron":
      return (
        <div className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <CronBuilder
            value={stringValue || "* * * * *"}
            onChange={(val) => onChange(val)}
          />
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between">
          <Label>{field.label}</Label>
          <Switch
            checked={booleanValue}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      );

    case "code":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Textarea
            id={field.key}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || "// JavaScript 代码"}
            rows={field.rows || 10}
            className="font-mono text-xs"
          />
          {field.description && (
            <p className="text-[10px] text-muted-foreground">
              {field.description}
            </p>
          )}
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            value={stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </div>
      );
  }
};

// ==================== Helper ====================

function getNodeDefinition(type: string): NodeDefinition | undefined {
  // This is a simplified lookup. In production, this would come from the store/API
  const definitions = getLocalDefinitions();
  return definitions.find((d) => d.type === type);
}

function getLocalDefinitions(): NodeDefinition[] {
  return [
    {
      type: "cron-trigger",
      name: "定时触发",
      description: "按 Cron 表达式定时触发",
      category: "trigger",
      icon: "clock",
      color: "bg-blue-500/20",
      inputFields: [
        { key: "cron", label: "Cron 表达式", type: "cron", required: true, defaultValue: "* * * * *" },
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
        { key: "method", label: "方法", type: "select", options: [
          { label: "GET", value: "GET" },
          { label: "POST", value: "POST" },
        ], defaultValue: "POST" },
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
        { key: "credential", label: "凭据", type: "credential", credentialType: "wechat", required: true },
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
        { key: "data", label: "模板数据 (JSON)", type: "textarea", required: true },
        { key: "credential", label: "凭据", type: "credential", credentialType: "wechat", required: true },
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
        { key: "model", label: "模型", type: "select", options: [
          { label: "Gemini Pro", value: "gemini-pro" },
          { label: "Gemini Pro Vision", value: "gemini-pro-vision" },
        ], defaultValue: "gemini-pro" },
        { key: "credential", label: "凭据", type: "credential", credentialType: "gemini", required: true },
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
        { key: "method", label: "方法", type: "select", options: [
          { label: "GET", value: "GET" },
          { label: "POST", value: "POST" },
          { label: "PUT", value: "PUT" },
          { label: "DELETE", value: "DELETE" },
        ], defaultValue: "GET" },
        { key: "headers", label: "请求头 (JSON)", type: "textarea" },
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
        { key: "expression", label: "条件表达式", type: "text", required: true, description: "返回 true/false 的表达式" },
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
        { key: "mapping", label: "映射规则 (JSON)", type: "textarea", required: true },
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
        { key: "duration", label: "等待时间(秒)", type: "number", required: true, defaultValue: 1, min: 0 },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ];
}

export default ConfigPanel;
