/**
 * FlowPilot - 系统通知节点
 * 通过控制台输出格式化的通知消息，同时写入执行日志
 * 跨平台兼容，无需原生依赖
 */

import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';

interface NotifyInput {
  title?: string;
  body?: string;
}

/** 生成格式化的通知消息 */
function formatNotification(title: string, body: string): string {
  const separator = '='.repeat(50);
  const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  return [
    '',
    separator,
    `[FlowPilot 通知] ${title}`,
    `时间: ${timestamp}`,
    separator,
    body,
    separator,
    '',
  ].join('\n');
}

const notifyExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const notifyInput = (input ?? {}) as NotifyInput;

    const title = String(config.title ?? notifyInput.title ?? '系统通知');
    const body = String(config.body ?? notifyInput.body ?? '');
    const sound = Boolean(config.sound ?? false);

    if (!body) {
      throw new Error('通知内容不能为空');
    }

    const formatted = formatNotification(title, body);

    // 输出到控制台
    console.log(formatted);

    // 写入执行日志
    context.logger.info(`[通知] ${title}: ${body}`);

    if (sound) {
      // 使用终端响铃字符提示（跨平台兼容）
      process.stdout.write('\x07');
      context.logger.debug('通知提示音已触发');
    }

    return { success: true } as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`通知发送失败: ${message}`);
  }
};

registerNodeExecutor('system-notify', notifyExecutor);
