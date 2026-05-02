/**
 * FlowPilot - HTTP 请求节点
 * 发送 HTTP 请求，支持 GET/POST/PUT/DELETE 方法
 * 配置覆盖输入，引擎层负责变量插值
 */

import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

const DEFAULT_TIMEOUT = 30_000;
const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;
type HttpMethod = (typeof SUPPORTED_METHODS)[number];

interface HttpRequestInput {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
}

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
}

/** 将 headers 的迭代器转换为普通对象 */
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/** 解析响应体，根据 Content-Type 自动判断格式 */
async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (!text) return null;

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  // 尝试自动解析 JSON
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

const httpExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const reqInput = (input ?? {}) as HttpRequestInput;

    // 配置值覆盖输入值
    const url = String(config.url ?? reqInput.url ?? '');
    const method = String(config.method ?? reqInput.method ?? 'GET').toUpperCase() as HttpMethod;
    const headers = (config.headers ?? reqInput.headers ?? {}) as Record<string, string>;
    const body = config.body ?? reqInput.body;
    const timeout = Number(config.timeout ?? DEFAULT_TIMEOUT);

    // 参数校验
    if (!url) {
      throw new Error('HTTP 请求缺少 url 参数');
    }
    if (!SUPPORTED_METHODS.includes(method)) {
      throw new Error(`不支持的 HTTP 方法: ${method}，支持: ${SUPPORTED_METHODS.join(', ')}`);
    }

    context.logger.info(`发送 ${method} 请求: ${url}`);

    // 构建请求头
    const requestHeaders = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      requestHeaders.set(key, String(value));
    }

    // 如果有 body 且未设置 Content-Type，自动设置
    if (body && !requestHeaders.has('content-type')) {
      if (typeof body === 'object') {
        requestHeaders.set('content-type', 'application/json');
      }
    }

    // 构建请求体
    let requestBody: string | undefined;
    if (body !== undefined && method !== 'GET') {
      requestBody = typeof body === 'object' ? JSON.stringify(body) : String(body);
    }

    // 使用 p-retry 发送请求
    const result = await withRetry<HttpResponse>(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: requestBody,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const data = await parseResponseBody(response);
          const responseHeaders = headersToObject(response.headers);

          if (!response.ok) {
            const errorMsg = typeof data === 'object' ? JSON.stringify(data) : String(data);
            throw new Error(`HTTP 请求失败，状态码: ${response.status}，响应: ${errorMsg}`);
          }

          return {
            status: response.status,
            headers: responseHeaders,
            data,
          };
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      },
      { retries: 2, minTimeout: 1000 },
    );

    context.logger.info(`HTTP 请求完成，状态码: ${result.status}`);

    return {
      status: result.status,
      headers: result.headers,
      data: result.data,
    } as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`HTTP 请求执行失败: ${message}`);
  }
};

registerNodeExecutor('http-request', httpExecutor);
