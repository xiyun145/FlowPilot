/**
 * FlowPilot - 重试工具
 * 封装 p-retry（ESM-only）以便在 CommonJS 项目中使用
 */

import type { FailedAttemptError, Options } from 'p-retry';

type PRetryFn = <T>(fn: () => Promise<T>, options?: Options) => Promise<T>;

let pRetryModule: PRetryFn | null = null;

/**
 * 获取 p-retry 实例（延迟加载，兼容 ESM-only 模块）
 */
async function getPRetry(): Promise<PRetryFn> {
  if (!pRetryModule) {
    const mod = await import('p-retry');
    pRetryModule = (mod.default ?? mod) as PRetryFn;
  }
  return pRetryModule;
}

/**
 * 带重试的异步函数执行
 * @param fn - 要执行的异步函数
 * @param options - p-retry 选项
 * @returns 执行结果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<Options>,
): Promise<T> {
  const pRetry = await getPRetry();
  return pRetry(fn, {
    retries: 3,
    minTimeout: 1000,
    ...options,
  });
}

export type { FailedAttemptError, Options as RetryOptions };
