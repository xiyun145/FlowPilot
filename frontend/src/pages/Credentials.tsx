import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCredentialStore } from "@/stores/credential-store";
import type { CredentialType, CredentialCreateInput } from "@/types";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  TestTube2,
  Loader2,
  Key,
  Shield,
  MessageSquare,
  Bot,
  Mail,
  Settings,
  Zap,
} from "lucide-react";
import dayjs from "dayjs";

const typeConfig: Record<
  CredentialType,
  { label: string; icon: React.ElementType; color: string }
> = {
  wechat: {
    label: "微信公众号",
    icon: MessageSquare,
    color: "bg-green-500/20 text-green-400",
  },
  gemini: {
    label: "Google Gemini",
    icon: Bot,
    color: "bg-blue-500/20 text-blue-400",
  },
  smtp: {
    label: "SMTP 邮件",
    icon: Mail,
    color: "bg-orange-500/20 text-orange-400",
  },
  custom: {
    label: "自定义",
    icon: Settings,
    color: "bg-purple-500/20 text-purple-400",
  },
};

const Credentials: React.FC = () => {
  const navigate = useNavigate();
  const {
    credentials,
    loading,
    fetchAll,
    create,
    update,
    delete: deleteCredential,
    test: testCredential,
  } = useCredentialStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CredentialCreateInput>({
    name: "",
    type: "custom",
    value: "",
  });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOpenCreate = useCallback(() => {
    setEditingId(null);
    setFormData({ name: "", type: "custom", value: "" });
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback(
    (credential: { id: string; name: string; type: CredentialType }) => {
      setEditingId(credential.id);
      setFormData({
        name: credential.name,
        type: credential.type,
        value: "",
      });
      setDialogOpen(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!formData.name.trim() || !formData.value.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, {
          name: formData.name,
          value: formData.value,
        });
      } else {
        await create(formData);
      }
      setDialogOpen(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  }, [editingId, formData, create, update, fetchAll]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (window.confirm("确定要删除这个凭据吗？使用此凭据的工作流将无法正常运行。")) {
        await deleteCredential(id);
      }
    },
    [deleteCredential]
  );

  const handleTest = useCallback(
    async (id: string) => {
      setTestingId(id);
      try {
        await testCredential(id);
      } finally {
        setTestingId(null);
      }
    },
    [testCredential]
  );

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
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">
                凭据管理
              </h1>
            </div>
          </div>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加凭据
          </Button>
        </div>
      </header>

      {/* Credential List */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : credentials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <Key className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              还没有凭据
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              添加 API 密钥、令牌等凭据，用于工作流中的节点连接
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              添加第一个凭据
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {credentials.map((credential) => {
              const typeInfo =
                typeConfig[credential.type as CredentialType] ||
                typeConfig.custom;
              const TypeIcon = typeInfo.icon;

              return (
                <Card key={credential.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${typeInfo.color}`}
                        >
                          <TypeIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm">
                            {credential.name}
                          </CardTitle>
                          <Badge variant="secondary" className="mt-1">
                            {typeInfo.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {credential.maskedValue}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      创建于{" "}
                      {dayjs(credential.createdAt).format("YYYY-MM-DD HH:mm")}
                    </div>

                    <div className="mt-4 flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleTest(credential.id)}
                        disabled={testingId === credential.id}
                      >
                        {testingId === credential.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <TestTube2 className="mr-1 h-3 w-3" />
                        )}
                        测试
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleOpenEdit({
                            id: credential.id,
                            name: credential.name,
                            type: credential.type as CredentialType,
                          })
                        }
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(credential.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "编辑凭据" : "添加凭据"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "更新凭据信息，留空值则保持不变"
                : "添加新的 API 密钥或令牌"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cred-name">凭据名称</Label>
              <Input
                id="cred-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="例如：我的 Gemini API Key"
              />
            </div>

            <div className="space-y-1.5">
              <Label>凭据类型</Label>
              <Select
                value={formData.type}
                onValueChange={(val: CredentialType) =>
                  setFormData((prev) => ({ ...prev, type: val }))
                }
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cred-value">
                {editingId ? "新值（留空则保持不变）" : "凭据值"}
              </Label>
              <Input
                id="cred-value"
                type="password"
                value={formData.value}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, value: e.target.value }))
                }
                placeholder={
                  editingId ? "输入新值或留空" : "输入 API Key 或令牌"
                }
              />
            </div>

            {/* Type-specific hints */}
            {formData.type === "wechat" && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">
                  微信公众号凭据
                </p>
                <p>请填入微信公众号的 AppID 或 Access Token</p>
              </div>
            )}
            {formData.type === "gemini" && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">
                  Google Gemini API Key
                </p>
                <p>请从 Google AI Studio 获取 API Key</p>
              </div>
            )}
            {formData.type === "smtp" && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">
                  SMTP 邮箱密码
                </p>
                <p>请填入邮箱的 SMTP 授权码（非登录密码）</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving || !formData.name.trim() || (!editingId && !formData.value.trim())
              }
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {editingId ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Credentials;
