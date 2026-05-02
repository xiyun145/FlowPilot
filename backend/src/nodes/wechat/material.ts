/**
 * FlowPilot - 微信素材管理节点
 * 调用微信公众号素材管理 API，支持临时/永久素材的上传、列表、删除、获取
 * 支持 multipart 上传媒体文件
 */

import * as fs from 'fs';
import * as path from 'path';
import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

type MaterialAction = 'uploadTemp' | 'uploadPerm' | 'list' | 'delete' | 'get';
type MediaType = 'image' | 'voice' | 'video' | 'thumb';

interface MaterialInput {
  type?: MediaType;
  media?: string;
  mediaId?: string;
  offset?: number;
  count?: number;
}

interface WeChatCredential {
  appId: string;
  appSecret: string;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  errcode?: number;
  errmsg?: string;
}

interface WeChatApiResponse {
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
}

/** 获取微信 access_token */
async function getAccessToken(credentialId: string, getCredential: (id: string) => Promise<string | null>): Promise<string> {
  const credentialJson = await getCredential(credentialId);
  if (!credentialJson) {
    throw new Error(`未找到微信凭据: ${credentialId}`);
  }

  let cred: WeChatCredential;
  try {
    cred = JSON.parse(credentialJson) as WeChatCredential;
  } catch {
    throw new Error('微信凭据格式无效，需要 JSON: { appId, appSecret }');
  }

  if (!cred.appId || !cred.appSecret) {
    throw new Error('微信凭据不完整，需要包含 appId 和 appSecret');
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${cred.appId}&secret=${cred.appSecret}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const data = (await response.json()) as AccessTokenResponse;

  if (data.errcode || !data.access_token) {
    throw new Error(`获取 access_token 失败: ${data.errmsg ?? '未知错误'}`);
  }

  return data.access_token;
}

/** 判断路径是否为本地文件 */
function isLocalFile(mediaPath: string): boolean {
  try {
    const stat = fs.statSync(mediaPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/** 获取媒体文件 MIME 类型 */
function getMimeType(type: MediaType): string {
  const mimeMap: Record<MediaType, string> = {
    image: 'image/jpeg',
    voice: 'audio/mpeg',
    video: 'video/mp4',
    thumb: 'image/jpeg',
  };
  return mimeMap[type] ?? 'application/octet-stream';
}

/** 获取媒体文件扩展名 */
function getFileExtension(type: MediaType): string {
  const extMap: Record<MediaType, string> = {
    image: '.jpg',
    voice: '.mp3',
    video: '.mp4',
    thumb: '.jpg',
  };
  return extMap[type] ?? '.bin';
}

/** 上传临时素材 */
async function uploadTempMedia(
  accessToken: string,
  mediaPath: string,
  type: MediaType,
): Promise<WeChatApiResponse> {
  const url = `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=${type}`;

  const formData = new FormData();
  let fileBuffer: Buffer;
  let fileName: string;

  if (isLocalFile(mediaPath)) {
    fileBuffer = fs.readFileSync(mediaPath);
    fileName = path.basename(mediaPath);
  } else {
    // 假设是 URL，下载文件
    const response = await fetch(mediaPath, { signal: AbortSignal.timeout(30_000) });
    const arrayBuffer = await response.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    fileName = `media${getFileExtension(type)}`;
  }

  const blob = new Blob([fileBuffer], { type: getMimeType(type) });
  formData.append('media', blob, fileName);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  return (await response.json()) as WeChatApiResponse;
}

/** 上传永久素材 */
async function uploadPermMedia(
  accessToken: string,
  mediaPath: string,
  type: MediaType,
): Promise<WeChatApiResponse> {
  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=${type}`;

  const formData = new FormData();
  let fileBuffer: Buffer;
  let fileName: string;

  if (isLocalFile(mediaPath)) {
    fileBuffer = fs.readFileSync(mediaPath);
    fileName = path.basename(mediaPath);
  } else {
    const response = await fetch(mediaPath, { signal: AbortSignal.timeout(30_000) });
    const arrayBuffer = await response.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    fileName = `media${getFileExtension(type)}`;
  }

  const blob = new Blob([fileBuffer], { type: getMimeType(type) });
  formData.append('media', blob, fileName);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  return (await response.json()) as WeChatApiResponse;
}

const materialExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const credentialId = String(config.credentialId ?? '');
    const action = String(config.action ?? '') as MaterialAction;
    const matInput = (input ?? {}) as MaterialInput;

    if (!credentialId) {
      throw new Error('微信素材管理节点缺少 credentialId 配置');
    }
    if (!action) {
      throw new Error('微信素材管理节点缺少 action 配置');
    }

    // 获取 access_token
    const accessToken = await withRetry(
      () => getAccessToken(credentialId, context.getCredential),
      { retries: 2, minTimeout: 1000 },
    );

    switch (action) {
      case 'uploadTemp': {
        const media = String(matInput.media ?? '');
        const type = (matInput.type ?? 'image') as MediaType;
        if (!media) {
          throw new Error('上传临时素材需要 media 参数（本地路径或 URL）');
        }

        context.logger.info(`上传临时素材: ${media}，类型: ${type}`);
        const data = await withRetry(
          () => uploadTempMedia(accessToken, media, type),
          { retries: 2, minTimeout: 2000 },
        );

        return { data } as Record<string, unknown>;
      }

      case 'uploadPerm': {
        const media = String(matInput.media ?? '');
        const type = (matInput.type ?? 'image') as MediaType;
        if (!media) {
          throw new Error('上传永久素材需要 media 参数（本地路径或 URL）');
        }

        context.logger.info(`上传永久素材: ${media}，类型: ${type}`);
        const data = await withRetry(
          () => uploadPermMedia(accessToken, media, type),
          { retries: 2, minTimeout: 2000 },
        );

        return { data } as Record<string, unknown>;
      }

      case 'list': {
        const type = (matInput.type ?? 'image') as MediaType;
        const offset = Number(matInput.offset ?? 0);
        const count = Number(matInput.count ?? 20);

        context.logger.info(`获取素材列表，类型: ${type}，偏移: ${offset}，数量: ${count}`);
        const url = `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${accessToken}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, offset, count }),
          signal: AbortSignal.timeout(30_000),
        });
        const data = (await response.json()) as WeChatApiResponse;

        if (data.errcode && data.errcode !== 0) {
          throw new Error(`获取素材列表失败: ${data.errmsg}`);
        }

        return { data } as Record<string, unknown>;
      }

      case 'delete': {
        const mediaId = String(matInput.mediaId ?? '');
        if (!mediaId) {
          throw new Error('删除素材需要 mediaId 参数');
        }

        context.logger.info(`删除永久素材: ${mediaId}`);
        const url = `https://api.weixin.qq.com/cgi-bin/material/del_material?access_token=${accessToken}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_id: mediaId }),
          signal: AbortSignal.timeout(30_000),
        });
        const data = (await response.json()) as WeChatApiResponse;

        if (data.errcode && data.errcode !== 0) {
          throw new Error(`删除素材失败: ${data.errmsg}`);
        }

        return { data } as Record<string, unknown>;
      }

      case 'get': {
        const mediaId = String(matInput.mediaId ?? '');
        if (!mediaId) {
          throw new Error('获取素材需要 mediaId 参数');
        }

        context.logger.info(`获取素材: ${mediaId}`);
        const url = `https://api.weixin.qq.com/cgi-bin/material/get_material?access_token=${accessToken}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_id: mediaId }),
          signal: AbortSignal.timeout(30_000),
        });
        const data = (await response.json()) as WeChatApiResponse;

        if (data.errcode && data.errcode !== 0) {
          throw new Error(`获取素材失败: ${data.errmsg}`);
        }

        return { data } as Record<string, unknown>;
      }

      default:
        throw new Error(`不支持的素材操作: ${action}，支持: uploadTemp, uploadPerm, list, delete, get`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`微信素材管理操作失败: ${message}`);
  }
};

registerNodeExecutor('wechat-material', materialExecutor);
