/**
 * FlowPilot - AES-256-GCM 加密工具
 * 用于凭据的安全存储和读取
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 获取加密密钥（32字节）
 * @param key - 原始密钥字符串
 * @returns 32字节的 Buffer
 */
function deriveKey(key: string): Buffer {
  if (key.length >= 32) {
    return Buffer.from(key.slice(0, 32), 'utf-8');
  }
  // 使用 SHA-256 将短密钥扩展为 32 字节
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * 使用 AES-256-GCM 加密明文
 * @param plaintext - 待加密的明文
 * @param key - 加密密钥（默认从环境变量读取）
 * @returns 包含加密数据、IV 和认证标签的对象
 */
export function encrypt(
  plaintext: string,
  key?: string,
): { encrypted: string; iv: string; authTag: string } {
  try {
    const encryptionKey = key || process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('未配置加密密钥，请设置 ENCRYPTION_KEY 环境变量');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const derivedKey = deriveKey(encryptionKey);
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`加密失败: ${message}`);
  }
}

/**
 * 使用 AES-256-GCM 解密密文
 * @param encrypted - 十六进制编码的密文
 * @param iv - 十六进制编码的初始化向量
 * @param authTag - 十六进制编码的认证标签
 * @param key - 解密密钥（默认从环境变量读取）
 * @returns 解密后的明文
 */
export function decrypt(
  encrypted: string,
  iv: string,
  authTag: string,
  key?: string,
): string {
  try {
    const encryptionKey = key || process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('未配置加密密钥，请设置 ENCRYPTION_KEY 环境变量');
    }

    const derivedKey = deriveKey(encryptionKey);
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`解密失败: ${message}`);
  }
}

/**
 * 生成随机字符串
 * @param length - 字符串长度（默认32）
 * @returns 随机十六进制字符串
 */
export function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}
