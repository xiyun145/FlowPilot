/**
 * FlowPilot - 本地文件读写节点
 * 支持读取和写入本地文件，限定在 ./data/files/ 沙箱目录内
 * 自动创建写入所需的目录结构
 */

import * as fs from 'fs';
import * as path from 'path';
import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';

/** 文件操作沙箱根目录 */
const SANDBOX_BASE = path.resolve('./data/files');

/** 规范化并校验文件路径，防止目录遍历攻击 */
function validateFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('文件路径不能为空');
  }

  // 规范化路径，解析 .. 和 .
  const normalized = path.normalize(filePath);
  const resolved = path.resolve(SANDBOX_BASE, normalized);

  // 确保解析后的路径仍在沙箱目录内
  if (!resolved.startsWith(SANDBOX_BASE)) {
    throw new Error('文件路径越界：仅允许访问 ./data/files/ 目录下的文件');
  }

  return resolved;
}

interface FileReadInput {
  content?: string;
}

const fileExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const operation = String(config.operation ?? 'read') as 'read' | 'write';
    const filePath = String(config.filePath ?? '');
    const encoding = (config.encoding ?? 'utf8') as BufferEncoding;

    const safePath = validateFilePath(filePath);

    if (operation === 'read') {
      context.logger.info(`读取文件: ${safePath}`);

      if (!fs.existsSync(safePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const stat = fs.statSync(safePath);
      if (!stat.isFile()) {
        throw new Error(`路径不是文件: ${filePath}`);
      }

      const content = fs.readFileSync(safePath, encoding);
      context.logger.info(`文件读取成功，大小: ${stat.size} 字节`);

      return { content } as Record<string, unknown>;
    }

    if (operation === 'write') {
      const fileInput = (input ?? {}) as FileReadInput;
      const content = String(fileInput.content ?? config.content ?? '');

      context.logger.info(`写入文件: ${safePath}`);

      // 自动创建目录
      const dir = path.dirname(safePath);
      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(safePath, content, encoding);
      const bytesWritten = Buffer.byteLength(content, encoding);

      context.logger.info(`文件写入成功，写入 ${bytesWritten} 字节`);

      return {
        success: true,
        bytesWritten,
      } as Record<string, unknown>;
    }

    throw new Error(`不支持的文件操作: ${operation}，仅支持 read 或 write`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`文件操作失败: ${message}`);
  }
};

registerNodeExecutor('file-operation', fileExecutor);
