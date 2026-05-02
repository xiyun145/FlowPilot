/**
 * FlowPilot - 凭据管理服务
 * 提供凭据的加密存储、解密读取、列表展示（脱敏）和测试功能
 */

import { v4 as uuidv4 } from 'uuid';
import type { Credential } from '../types';
import * as queries from '../db/queries';
import { encrypt, decrypt } from '../utils/crypto';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('credential-service');

/** 创建凭据的参数 */
interface CreateCredentialData {
  name: string;
  type: string;
  value: string;
}

/** 更新凭据的参数 */
interface UpdateCredentialData {
  name?: string;
  value?: string;
}

/** 脱敏后的凭据（列表展示用） */
interface MaskedCredential {
  id: string;
  name: string;
  type: string;
  maskedValue: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 对凭据值进行脱敏处理
 * @param value - 原始凭据值
 * @returns 脱敏后的字符串
 */
function maskValue(value: string): string {
  if (value.length <= 8) {
    return '****';
  }
  return value.slice(0, 4) + '****' + value.slice(-4);
}

/**
 * 创建新凭据（加密存储）
 * @param name - 凭据名称
 * @param type - 凭据类型
 * @param value - 凭据明文值
 * @returns 创建的凭据记录
 */
export async function createCredential(
  name: string,
  type: string,
  value: string,
): Promise<Credential> {
  try {
    const { encrypted, iv, authTag } = encrypt(value);
    const now = new Date().toISOString();

    const credential: Credential = {
      id: uuidv4(),
      name,
      type,
      encryptedValue: encrypted,
      iv,
      authTag,
      createdAt: now,
      updatedAt: now,
    };

    await queries.insertCredential(credential);
    log.info(`凭据已创建: ${credential.id} - ${name} (${type})`);
    return credential;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`创建凭据失败: ${message}`);
  }
}

/**
 * 获取凭据并解密
 * @param id - 凭据ID
 * @returns 包含解密值的凭据对象
 */
export async function getCredentialDecrypted(
  id: string,
): Promise<Credential & { decryptedValue: string }> {
  try {
    const credential = await queries.getCredentialById(id);
    if (!credential) {
      throw new Error(`凭据不存在: ${id}`);
    }

    const decryptedValue = decrypt(credential.encryptedValue, credential.iv, credential.authTag);
    return { ...credential, decryptedValue };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取凭据失败: ${message}`);
  }
}

/**
 * 获取所有凭据列表（值已脱敏）
 * @returns 脱敏后的凭据列表
 */
export async function getAllCredentials(): Promise<MaskedCredential[]> {
  try {
    const credentials = await queries.getAllCredentials();
    return credentials.map((cred) => ({
      id: cred.id,
      name: cred.name,
      type: cred.type,
      maskedValue: maskValue(cred.encryptedValue),
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取凭据列表失败: ${message}`);
  }
}

/**
 * 更新凭据
 * @param id - 凭据ID
 * @param data - 需要更新的字段
 * @returns 更新后的凭据
 */
export async function updateCredential(
  id: string,
  data: UpdateCredentialData,
): Promise<Credential> {
  try {
    const existing = await queries.getCredentialById(id);
    if (!existing) {
      throw new Error(`凭据不存在: ${id}`);
    }

    let updated: Credential = {
      ...existing,
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) {
      updated.name = data.name;
    }

    if (data.value !== undefined) {
      const { encrypted, iv, authTag } = encrypt(data.value);
      updated.encryptedValue = encrypted;
      updated.iv = iv;
      updated.authTag = authTag;
    }

    await queries.updateCredential(id, updated);
    log.info(`凭据已更新: ${id}`);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`更新凭据失败: ${message}`);
  }
}

/**
 * 删除凭据
 * @param id - 凭据ID
 */
export async function deleteCredential(id: string): Promise<void> {
  try {
    const existing = await queries.getCredentialById(id);
    if (!existing) {
      throw new Error(`凭据不存在: ${id}`);
    }

    await queries.deleteCredential(id);
    log.info(`凭据已删除: ${id} - ${existing.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`删除凭据失败: ${message}`);
  }
}

/**
 * 测试凭据是否有效
 * @param id - 凭据ID
 * @param type - 凭据类型
 * @returns 测试结果
 */
export async function testCredential(
  id: string,
  type: string,
): Promise<{ valid: boolean; message: string }> {
  try {
    const credential = await queries.getCredentialById(id);
    if (!credential) {
      throw new Error(`凭据不存在: ${id}`);
    }

    const decryptedValue = decrypt(credential.encryptedValue, credential.iv, credential.authTag);

    // 根据凭据类型执行不同的验证逻辑
    switch (type) {
      case 'wechat_mp': {
        // 测试微信公众号凭据：尝试获取 access_token
        const config = JSON.parse(decryptedValue) as { appId: string; appSecret: string };
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appId}&secret=${config.appSecret}`;
        const response = await fetch(url);
        const result = (await response.json()) as { access_token?: string; errcode?: number; errmsg?: string };
        if (result.access_token) {
          return { valid: true, message: '微信凭据验证成功' };
        }
        return { valid: false, message: `微信凭据验证失败: ${result.errmsg ?? '未知错误'}` };
      }

      case 'email': {
        // 邮箱凭据：检查 JSON 格式是否合法
        const emailConfig = JSON.parse(decryptedValue) as { host: string; port: number; user: string; pass: string };
        if (emailConfig.host && emailConfig.user && emailConfig.pass) {
          return { valid: true, message: '邮箱凭据格式正确' };
        }
        return { valid: false, message: '邮箱凭据格式不完整' };
      }

      case 'api_key': {
        // API Key：检查非空
        if (decryptedValue.length > 0) {
          return { valid: true, message: 'API Key 已配置' };
        }
        return { valid: false, message: 'API Key 为空' };
      }

      default:
        // 默认：仅检查能否成功解密
        if (decryptedValue.length > 0) {
          return { valid: true, message: '凭据验证成功' };
        }
        return { valid: false, message: '凭据值为空' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    return { valid: false, message: `凭据测试失败: ${message}` };
  }
}
