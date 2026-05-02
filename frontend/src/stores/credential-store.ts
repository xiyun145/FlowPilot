import { create } from "zustand";
import { toast } from "sonner";
import { credentialApi } from "@/utils/api";
import type { Credential, CredentialCreateInput, CredentialUpdateInput } from "@/types";

interface CredentialState {
  credentials: Credential[];
  loading: boolean;

  fetchAll: () => Promise<void>;
  create: (data: CredentialCreateInput) => Promise<Credential | null>;
  update: (id: string, data: CredentialUpdateInput) => Promise<void>;
  delete: (id: string) => Promise<void>;
  test: (id: string) => Promise<boolean>;
}

export const useCredentialStore = create<CredentialState>((set) => ({
  credentials: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const credentials = await credentialApi.getAll();
      set({ credentials });
    } catch {
      toast.error("获取凭据列表失败");
    } finally {
      set({ loading: false });
    }
  },

  create: async (data: CredentialCreateInput) => {
    try {
      const credential = await credentialApi.create(data);
      set((state) => ({
        credentials: [...state.credentials, credential],
      }));
      toast.success("凭据创建成功");
      return credential;
    } catch {
      toast.error("创建凭据失败");
      return null;
    }
  },

  update: async (id: string, data: CredentialUpdateInput) => {
    try {
      const credential = await credentialApi.update(id, data);
      set((state) => ({
        credentials: state.credentials.map((c) =>
          c.id === id ? credential : c
        ),
      }));
      toast.success("凭据更新成功");
    } catch {
      toast.error("更新凭据失败");
    }
  },

  delete: async (id: string) => {
    try {
      await credentialApi.delete(id);
      set((state) => ({
        credentials: state.credentials.filter((c) => c.id !== id),
      }));
      toast.success("凭据已删除");
    } catch {
      toast.error("删除凭据失败");
    }
  },

  test: async (id: string) => {
    try {
      const result = await credentialApi.test(id);
      if (result.success) {
        toast.success("凭据测试通过");
      } else {
        toast.error(`凭据测试失败: ${result.message}`);
      }
      return result.success;
    } catch {
      toast.error("凭据测试失败");
      return false;
    }
  },
}));
