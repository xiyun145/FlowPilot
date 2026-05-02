/**
 * FlowPilot - JavaScript 代码执行节点
 * 在沙箱环境中执行用户提供的 JavaScript 代码
 * 使用 vm2 隔离执行，阻止访问 require、process、fs 等危险模块
 */

import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { NodeVM } from 'vm2';

const DEFAULT_TIMEOUT = 5000;

const codeExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const code = String(config.code ?? '');
    const timeout = Number(config.timeout ?? DEFAULT_TIMEOUT);

    if (!code.trim()) {
      throw new Error('代码执行节点缺少 code 配置');
    }

    context.logger.info(`开始执行代码，超时: ${timeout}ms`);

    // 创建安全沙箱
    const vm = new NodeVM({
      timeout,
      sandbox: {},
      require: {
        external: false,
        builtin: [],
        root: '',
        mock: {},
      },
      eval: false,
      wasm: false,
      fixAsync: true,
    });

    // 构建沙箱全局变量
    const sandboxGlobals: Record<string, unknown> = {
      $input: input ?? {},
      $env: { ...process.env } as Record<string, string>,
      $workflow: {
        workflowId: context.workflowId,
        executionId: context.executionId,
        nodeId: context.nodeId,
      },
    };

    // 注入全局变量到沙箱
    for (const [key, value] of Object.entries(sandboxGlobals)) {
      vm.setGlobal(key, value);
    }

    // 包装用户代码为 async 函数
    const wrappedCode = `
      module.exports = async function() {
        ${code}
      };
    `;

    // 编译并执行
    const scriptFn = vm.run(wrappedCode) as () => Promise<unknown>;
    const result = await scriptFn();

    context.logger.info('代码执行完成');

    return { result: result ?? null } as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Script execution timed out')) {
      throw new Error(`代码执行超时（${config.timeout ?? DEFAULT_TIMEOUT}ms）`);
    }
    throw new Error(`代码执行失败: ${message}`);
  }
};

registerNodeExecutor('code-execute', codeExecutor);
