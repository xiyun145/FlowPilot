/**
 * FlowPilot - 微信发布管理节点
 * 调用微信公众号草稿、发布、群发 API
 * 支持创建草稿、发布文章、按标签群发消息
 */

import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

type PublishAction = 'addDraft' | 'publish' | 'massSend';

interface PublishArticle {
  title: string;
  thumb_media_id: string;
  author?: string;
  digest?: string;
  content: string;
  url?: string;
}

interface PublishInput {
  articles?: PublishArticle[];
  toAll?: boolean;
  tagId?: number;
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
async function callWeChatApi(url: string, body: Record<string, unknown>): Promise<WeChatApiResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await response.json()) as WeChatApiResponse;

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`微信 API 错误: ${data.errmsg ?? '未知错误'} (错误码: ${data.errcode})`);
  }

  return data;
}

const publishExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const credentialId = String(config.credentialId ?? '');
    const action = String(config.action ?? '') as PublishAction;
    const pubInput = (input ?? {}) as PublishInput;

    if (!credentialId) {
      throw new Error('微信发布节点缺少 credentialId 配置');
    }
    if (!action) {
      throw new Error('微信发布节点缺少 action 配置');
    }

    // 获取 access_token
    const accessToken = await withRetry(
      () => getAccessToken(credentialId, context.getCredential),
      { retries: 2, minTimeout: 1000 },
    );

    switch (action) {
      case 'addDraft': {
        const articles = pubInput.articles ?? [];
        if (articles.length === 0) {
          throw new Error('创建草稿需要至少一篇文章（articles 参数）');
        }

        // 校验必填字段
        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          if (!article.title) {
            throw new Error(`第 ${i + 1} 篇文章缺少 title`);
          }
          if (!article.thumb_media_id) {
            throw new Error(`第 ${i + 1} 篇文章缺少 thumb_media_id（封面图片素材ID）`);
          }
          if (!article.content) {
            throw new Error(`第 ${i + 1} 篇文章缺少 content（正文 HTML）`);
          }
        }

        context.logger.info(`创建草稿，包含 ${articles.length} 篇文章`);
        const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`;
        const data = await withRetry(
          () => callWeChatApi(url, { articles }),
          { retries: 2, minTimeout: 1000 },
        );

        return { data } as Record<string, unknown>;
      }

      case 'publish': {
        // 从输入中获取 media_id（草稿 ID）
        const mediaId = String(
          (pubInput as Record<string, unknown>).media_id ?? config.mediaId ?? '',
        );
        if (!mediaId) {
          throw new Error('发布文章需要 media_id（草稿ID）参数');
        }

        context.logger.info(`发布文章: ${mediaId}`);
        const url = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${accessToken}`;
        const data = await withRetry(
          () => callWeChatApi(url, { media_id: mediaId }),
          { retries: 2, minTimeout: 1000 },
        );

        return { data } as Record<string, unknown>;
      }

      case 'massSend': {
        const toAll = Boolean(pubInput.toAll ?? false);
        const tagId = pubInput.tagId;

        // 获取消息内容（支持从 config 或 input 获取）
        const content = String(config.content ?? '');
        const mediaId = String(config.mediaId ?? '');
        const msgType = String(config.msgType ?? 'text');

        if (!toAll && tagId === undefined) {
          throw new Error('群发消息需要设置 toAll=true 或指定 tagId');
        }

        // 构建群发请求体
        const massSendBody: Record<string, unknown> = {};

        if (toAll) {
          massSendBody.filter = { is_to_all: true };
        } else {
          massSendBody.filter = { is_to_all: false, tag_id: tagId };
        }

        // 根据消息类型设置内容
        switch (msgType) {
          case 'text':
            if (!content) {
              throw new Error('文本群发需要 content 参数');
            }
            massSendBody.text = { content };
            massSendBody.msgtype = 'text';
            break;
          case 'image':
          case 'voice':
          case 'video':
            if (!mediaId) {
              throw new Error(`${msgType} 群发需要 mediaId 参数`);
            }
            massSendBody[msgType] = { media_id: mediaId };
            massSendBody.msgtype = msgType;
            break;
          case 'mpnews':
            if (!mediaId) {
              throw new Error('图文群发需要 mediaId（草稿ID）参数');
            }
            massSendBody.mpnews = { media_id: mediaId };
            massSendBody.msgtype = 'mpnews';
            break;
          default:
            throw new Error(`不支持的群发消息类型: ${msgType}`);
        }

        context.logger.info(`群发消息，类型: ${msgType}，目标: ${toAll ? '全部用户' : `标签 ${tagId}`}`);
        const url = `https://api.weixin.qq.com/cgi-bin/message/mass/sendall?access_token=${accessToken}`;
        const data = await withRetry(
          () => callWeChatApi(url, massSendBody),
          { retries: 2, minTimeout: 2000 },
        );

        return { data } as Record<string, unknown>;
      }

      default:
        throw new Error(`不支持的发布操作: ${action}，支持: addDraft, publish, massSend`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`微信发布操作失败: ${message}`);
  }
};

registerNodeExecutor('wechat-publish', publishExecutor);
