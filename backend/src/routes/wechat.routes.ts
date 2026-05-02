/**
 * FlowPilot - 微信公众号路由
 * 处理微信服务器验证和消息接收，触发对应工作流
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { parseStringPromise, Builder } from 'xml2js';
import { z } from 'zod';
import * as queries from '../db/queries';
import { executor } from '../core/engine/executor';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('wechat-routes');

/** 微信验证请求参数 Schema */
const WechatVerifySchema = z.object({
  signature: z.string(),
  timestamp: z.string(),
  nonce: z.string(),
  echostr: z.string(),
});

/** 微信消息 XML 结构 */
interface WechatMessage {
  xml: {
    ToUserName: string[];
    FromUserName: string[];
    CreateTime: string[];
    MsgType: string[];
    Content?: string[];
    MsgId?: string[];
    MediaId?: string[];
    PicUrl?: string[];
    Event?: string[];
    EventKey?: string[];
  };
}

/**
 * 验证微信服务器签名
 * 算法：sha1(sort(token, timestamp, nonce))
 * @param token - 公众号 Token
 * @param timestamp - 时间戳
 * @param nonce - 随机数
 * @param signature - 微信传来的签名
 * @returns 签名是否有效
 */
function verifyWechatSignature(
  token: string,
  timestamp: string,
  nonce: string,
  signature: string,
): boolean {
  try {
    const arr = [token, timestamp, nonce].sort();
    const str = arr.join('');
    const hash = crypto.createHash('sha1').update(str).digest('hex');
    return hash === signature;
  } catch {
    return false;
  }
}

/**
 * 根据消息内容构建 XML 回复
 * @param toUser - 接收方（用户 OpenID）
 * @param fromUser - 发送方（公众号原始ID）
 * @param content - 回复内容
 * @returns XML 格式的回复消息
 */
function buildTextReply(toUser: string, fromUser: string, content: string): string {
  const builder = new Builder({
    rootName: 'xml',
    cdata: true,
    renderOpts: { pretty: false },
  });

  return builder.buildObject({
    ToUserName: toUser,
    FromUserName: fromUser,
    CreateTime: Math.floor(Date.now() / 1000).toString(),
    MsgType: 'text',
    Content: content,
  });
}

/**
 * 微信公众号路由插件
 */
const wechatRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/wechat/callback - 微信服务器配置验证
   * 微信会发送 GET 请求验证服务器地址的有效性
   */
  fastify.get('/api/wechat/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = WechatVerifySchema.parse(request.query);

      // 查找配置了此 Token 的工作流
      const workflows = await queries.getAllWorkflows();
      let matchedToken: string | null = null;

      for (const wf of workflows) {
        if (wf.triggerType === 'wechat_message' && wf.triggerConfig) {
          const config = wf.triggerConfig as { token?: string };
          if (config.token) {
            matchedToken = config.token;
            break;
          }
        }
      }

      if (!matchedToken) {
        log.warn('未找到配置了微信触发器的工作流');
        return reply.status(403).send('验证失败：未配置微信触发器');
      }

      // 验证签名
      const isValid = verifyWechatSignature(
        matchedToken,
        query.timestamp,
        query.nonce,
        query.signature,
      );

      if (!isValid) {
        log.warn('微信签名验证失败');
        return reply.status(403).send('签名验证失败');
      }

      // 验证通过，返回 echostr
      log.info('微信服务器验证通过');
      return reply.status(200).send(query.echostr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send('参数不完整');
      }
      const message = error instanceof Error ? error.message : '微信验证失败';
      log.error(`微信验证失败: ${message}`);
      return reply.status(500).send('服务器内部错误');
    }
  });

  /**
   * POST /api/wechat/callback - 接收微信消息
   * 微信将用户消息以 XML 格式 POST 到此地址
   */
  fastify.post('/api/wechat/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as string;
      if (!body || typeof body !== 'string') {
        return reply.status(200).send('success');
      }

      // 解析 XML 消息
      const parsed = (await parseStringPromise(body)) as WechatMessage;
      const msg = parsed.xml;

      if (!msg || !msg.FromUserName || !msg.FromUserName[0]) {
        return reply.status(200).send('success');
      }

      const fromUser = msg.FromUserName[0];
      const toUser = msg.ToUserName?.[0] ?? '';
      const msgType = msg.MsgType?.[0] ?? 'text';
      const content = msg.Content?.[0] ?? '';
      const event = msg.Event?.[0] ?? '';
      const eventKey = msg.EventKey?.[0] ?? '';
      const msgId = msg.MsgId?.[0] ?? '';
      const mediaId = msg.MediaId?.[0] ?? '';
      const picUrl = msg.PicUrl?.[0] ?? '';

      log.info(`收到微信消息: from=${fromUser}, type=${msgType}, content=${content}`);

      // 构建触发数据
      const triggerData: Record<string, unknown> = {
        fromUser,
        toUser,
        msgType,
        content,
        event,
        eventKey,
        msgId,
        mediaId,
        picUrl,
        timestamp: new Date().toISOString(),
      };

      // 查找匹配的微信触发器工作流
      const workflows = await queries.getAllWorkflows();
      let matchedWorkflow = workflows.find(
        (wf) => wf.triggerType === 'wechat_message' && wf.status === 'active',
      );

      if (!matchedWorkflow) {
        log.warn('未找到激活的微信触发器工作流');
        // 返回空字符串表示不回复
        return reply.status(200).send('success');
      }

      // 异步触发工作流执行
      log.info(`微信消息触发工作流: ${matchedWorkflow.id}`);
      executor.run(matchedWorkflow, triggerData).catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : '未知错误';
        log.error(`微信触发的工作流执行失败: ${errMsg}`);
      });

      // 返回 success 阻止微信重试（不进行被动回复）
      return reply.status(200).send('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '处理微信消息失败';
      log.error(`处理微信消息失败: ${message}`);
      return reply.status(200).send('success');
    }
  });
};

export default wechatRoutes;
