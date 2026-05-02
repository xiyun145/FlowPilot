/**
 * FlowPilot - SMTP 邮件发送节点
 * 使用 nodemailer 通过 SMTP 协议发送邮件
 * 支持纯文本和 HTML 格式，凭据从凭据管理中获取
 */

import * as nodemailer from 'nodemailer';
import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

/** SMTP 凭据结构 */
interface SmtpCredential {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface EmailInput {
  to?: string;
  subject?: string;
  body?: string;
}

const emailExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const credentialId = String(config.credentialId ?? '');
    const emailInput = (input ?? {}) as EmailInput;

    const to = String(config.to ?? emailInput.to ?? '');
    const subject = String(config.subject ?? emailInput.subject ?? '');
    const body = String(config.body ?? emailInput.body ?? '');
    const isHtml = Boolean(config.isHtml ?? false);

    // 参数校验
    if (!credentialId) {
      throw new Error('邮件节点缺少 credentialId 配置');
    }
    if (!to) {
      throw new Error('邮件发送缺少收件人地址');
    }
    if (!subject) {
      throw new Error('邮件发送缺少主题');
    }
    if (!body) {
      throw new Error('邮件发送缺少正文内容');
    }

    context.logger.info(`准备发送邮件至: ${to}，主题: ${subject}`);

    // 获取 SMTP 凭据
    const credentialJson = await context.getCredential(credentialId);
    if (!credentialJson) {
      throw new Error(`未找到凭据: ${credentialId}`);
    }

    let smtpConfig: SmtpCredential;
    try {
      smtpConfig = JSON.parse(credentialJson) as SmtpCredential;
    } catch {
      throw new Error('SMTP 凭据格式无效，需要 JSON: { host, port, user, pass }');
    }

    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      throw new Error('SMTP 凭据不完整，需要包含 host、port、user、pass 字段');
    }

    // 创建 SMTP 传输
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port ?? 587,
      secure: smtpConfig.port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    // 使用 p-retry 发送邮件
    const result = await withRetry(
      async () => {
        const info = await transporter.sendMail({
          from: smtpConfig.user,
          to,
          subject,
          ...(isHtml ? { html: body } : { text: body }),
        });
        return info;
      },
      { retries: 2, minTimeout: 2000 },
    );

    context.logger.info(`邮件发送成功，Message-ID: ${result.messageId}`);

    return {
      success: true,
      messageId: result.messageId,
    } as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`邮件发送失败: ${message}`);
  }
};

registerNodeExecutor('email-send', emailExecutor);
