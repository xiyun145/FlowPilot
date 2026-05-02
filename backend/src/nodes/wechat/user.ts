/**
 * FlowPilot - 微信用户管理节点
 * 调用微信公众号用户管理 API，支持获取用户信息、关注者列表、标签管理
 * 自动处理分页获取完整关注者列表
 */

import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

type WeChatUserAction = 'getInfo' | 'getFollowers' | 'createTag' | 'tagUsers';

interface WeChatUserInput {
  openId?: string;
  tagName?: string;
  tagId?: number;
  userList?: string[];
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

/** 调用微信 API */
async function callWeChatApi(url: string, body?: Record<string, unknown>): Promise<WeChatApiResponse> {
  const options: RequestInit = {
    signal: AbortSignal.timeout(30_000),
  };

  if (body) {
    options.method = 'POST';
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = (await response.json()) as WeChatApiResponse;

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`微信 API 错误: ${data.errmsg ?? '未知错误'} (错误码: ${data.errcode})`);
  }

  return data;
}

/** 分页获取全部关注者 OpenID 列表 */
async function getAllFollowers(accessToken: string): Promise<{ total: number; count: number; list: string[] }> {
  const allOpenIds: string[] = [];
  let nextOpenId = '';
  let total = 0;

  do {
    const url = `https://api.weixin.qq.com/cgi-bin/user/get?access_token=${accessToken}&next_openid=${nextOpenId}`;
    const data = await withRetry(
      () => callWeChatApi(url),
      { retries: 2, minTimeout: 1000 },
    );

    total = Number(data.total ?? 0);
    const dataObj = data.data as { openid?: string[] } | undefined;
    const openIds = dataObj?.openid ?? [];

    allOpenIds.push(...openIds);
    nextOpenId = String(data.next_openid ?? '');

    // 如果返回空列表或没有 next_openid，停止分页
    if (openIds.length === 0 || !nextOpenId) break;
  } while (true);

  return { total, count: allOpenIds.length, list: allOpenIds };
}

const userExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const credentialId = String(config.credentialId ?? '');
    const action = String(config.action ?? '') as WeChatUserAction;
    const userInput = (input ?? {}) as WeChatUserInput;

    if (!credentialId) {
      throw new Error('微信用户管理节点缺少 credentialId 配置');
    }
    if (!action) {
      throw new Error('微信用户管理节点缺少 action 配置');
    }

    // 获取 access_token
    const accessToken = await withRetry(
      () => getAccessToken(credentialId, context.getCredential),
      { retries: 2, minTimeout: 1000 },
    );

    switch (action) {
      case 'getInfo': {
        const openId = String(userInput.openId ?? '');
        if (!openId) {
          throw new Error('获取用户信息需要 openId 参数');
        }

        context.logger.info(`获取用户信息: ${openId}`);
        const url = `https://api.weixin.qq.com/cgi-bin/user/info?access_token=${accessToken}&openid=${openId}&lang=zh_CN`;
        const data = await withRetry(
          () => callWeChatApi(url),
          { retries: 2, minTimeout: 1000 },
        );

        return { data } as Record<string, unknown>;
      }

      case 'getFollowers': {
        context.logger.info('获取关注者列表');
        const result = await getAllFollowers(accessToken);
        context.logger.info(`获取关注者完成，总数: ${result.total}，本次获取: ${result.count}`);

        return {
          data: {
            total: result.total,
            count: result.count,
            openIds: result.list,
          },
        } as Record<string, unknown>;
      }

      case 'createTag': {
        const tagName = String(userInput.tagName ?? '');
        if (!tagName) {
          throw new Error('创建标签需要 tagName 参数');
        }

        context.logger.info(`创建用户标签: ${tagName}`);
        const url = `https://api.weixin.qq.com/cgi-bin/tags/create?access_token=${accessToken}`;
        const data = await withRetry(
          () => callWeChatApi(url, { tag: { name: tagName } }),
          { retries: 2, minTimeout: 1000 },
        );

        return { data } as Record<string, unknown>;
      }

      case 'tagUsers': {
        const tagId = userInput.tagId;
        const userList = userInput.userList ?? [];
        if (tagId === undefined) {
          throw new Error('批量打标签需要 tagId 参数');
        }
        if (userList.length === 0) {
          throw new Error('批量打标签需要 userList 参数（OpenID 数组）');
        }

        context.logger.info(`为 ${userList.length} 个用户打标签 ${tagId}`);
        const url = `https://api.weixin.qq.com/cgi-bin/tags/members/batchtagging?access_token=${accessToken}`;
        const data = await withRetry(
          () => callWeChatApi(url, { tagid: tagId, openid_list: userList }),
          { retries: 2, minTimeout: 1000 },
        );

        return { data } as Record<string, unknown>;
      }

      default:
        throw new Error(`不支持的用户管理操作: ${action}，支持: getInfo, getFollowers, createTag, tagUsers`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`微信用户管理操作失败: ${message}`);
  }
};

registerNodeExecutor('wechat-user', userExecutor);
