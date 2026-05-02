/**
 * FlowPilot - 微信被动回复消息节点
 * 生成微信公众号被动回复 XML，支持文本、图片、语音、图文消息
 * 通过微信 API 获取 access_token 并处理消息回复
 */

import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

type WeChatMsgType = 'text' | 'image' | 'news' | 'voice';

interface WeChatMessageInput {
  toUser: string;
  fromUser: string;
  msgType?: WeChatMsgType;
  content?: string;
  mediaId?: string;
  articles?: WeChatArticle[];
}

interface WeChatArticle {
  title: string;
  description?: string;
  picUrl?: string;
  url: string;
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

/** 转义 XML 特殊字符 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 生成微信被动回复 XML */
function buildReplyXml(toUser: string, fromUser: string, msgType: WeChatMsgType, content: string): string {
  const timestamp = Math.floor(Date.now() / 1000);

  switch (msgType) {
    case 'text':
      return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;

    case 'image':
      return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[image]]></MsgType>
<Image><MediaId><![CDATA[${content}]]></MediaId></Image>
</xml>`;

    case 'voice':
      return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[voice]]></MsgType>
<Voice><MediaId><![CDATA[${content}]]></MediaId></Voice>
</xml>`;

    default:
      throw new Error(`不支持的消息类型: ${msgType}`);
  }
}

/** 生成图文回复 XML */
function buildNewsReplyXml(toUser: string, fromUser: string, articles: WeChatArticle[]): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const articleCount = articles.length;
  const items = articles
    .map(
      (a) => `<item>
<Title><![CDATA[${escapeXml(a.title)}]]></Title>
<Description><![CDATA[${escapeXml(a.description ?? '')}]]></Description>
<PicUrl><![CDATA[${a.picUrl ?? ''}]]></PicUrl>
<Url><![CDATA[${a.url}]]></Url>
</item>`,
    )
    .join('\n');

  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[news]]></MsgType>
<ArticleCount>${articleCount}</ArticleCount>
<Articles>
${items}
</Articles>
</xml>`;
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
    throw new Error(`获取 access_token 失败: ${data.errmsg ?? '未知错误'} (错误码: ${data.errcode ?? 'N/A'})`);
  }

  return data.access_token;
}

const messageExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const credentialId = String(config.credentialId ?? '');
    const msgInput = input as WeChatMessageInput;

    // 参数校验
    if (!credentialId) {
      throw new Error('微信消息节点缺少 credentialId 配置');
    }
    if (!msgInput?.toUser) {
      throw new Error('微信消息缺少 toUser（接收方 OpenID）');
    }
    if (!msgInput?.fromUser) {
      throw new Error('微信消息缺少 fromUser（发送方 OpenID/公众号ID）');
    }

    const msgType: WeChatMsgType = (msgInput.msgType ?? config.msgType ?? 'text') as WeChatMsgType;
    const content = String(msgInput.content ?? config.content ?? '');
    const mediaId = String(msgInput.mediaId ?? config.mediaId ?? '');
    const articles = (msgInput.articles ?? []) as WeChatArticle[];

    // 获取 access_token
    const accessToken = await withRetry(
      () => getAccessToken(credentialId, context.getCredential),
      { retries: 2, minTimeout: 1000 },
    );

    let xmlResponse: string;

    if (msgType === 'news') {
      if (!articles || articles.length === 0) {
        throw new Error('图文消息必须包含至少一篇文章');
      }
      // 上传图文消息素材
      const uploadUrl = `https://api.weixin.qq.com/cgi-bin/media/uploadnews?access_token=${accessToken}`;
      const uploadResponse = await withRetry(
        async () => {
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles }),
            signal: AbortSignal.timeout(30_000),
          });
          return (await res.json()) as { media_id?: string; errcode?: number; errmsg?: string };
        },
        { retries: 2, minTimeout: 1000 },
      );

      if (uploadResponse.errcode || !uploadResponse.media_id) {
        throw new Error(`上传图文素材失败: ${uploadResponse.errmsg ?? '未知错误'}`);
      }

      // 使用上传后的 media_id 回复
      xmlResponse = buildReplyXml(msgInput.toUser, msgInput.fromUser, 'image', uploadResponse.media_id);
    } else if (msgType === 'image' || msgType === 'voice') {
      if (!mediaId && !content) {
        throw new Error(`${msgType} 消息需要 mediaId 或 content`);
      }
      xmlResponse = buildReplyXml(msgInput.toUser, msgInput.fromUser, msgType, mediaId || content);
    } else {
      // text
      if (!content) {
        throw new Error('文本消息内容不能为空');
      }
      xmlResponse = buildReplyXml(msgInput.toUser, msgInput.fromUser, 'text', content);
    }

    context.logger.info(`微信消息回复已生成，类型: ${msgType}，接收方: ${msgInput.toUser}`);

    return {
      success: true,
      response: xmlResponse,
    } as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`微信消息回复失败: ${message}`);
  }
};

registerNodeExecutor('wechat-message-reply', messageExecutor);
