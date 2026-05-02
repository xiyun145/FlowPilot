/**
 * FlowPilot - Pino 日志工具
 * 提供统一的日志记录功能，开发环境使用 pino-pretty 格式化输出
 */

import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

/** 确保日志目录存在 */
const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/** 判断是否为开发环境 */
const isDev = process.env.NODE_ENV !== 'production';

/** Windows: 确保控制台使用 UTF-8 代码页（修复中文乱码） */
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore', timeout: 3000 });
  } catch {
    // 忽略错误
  }
  process.env.LANG = process.env.LANG || 'zh_CN.UTF-8';
}

/** 创建 pino 日志实例 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  },
  isDev
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      })
    : pino.destination(path.join(logDir, 'flowpilot.log')),
);

/**
 * 为特定模块创建子日志器
 * @param module - 模块名称
 * @returns 子日志器实例
 */
export function createModuleLogger(module: string): pino.Logger {
  return logger.child({ module });
}

export default logger;
