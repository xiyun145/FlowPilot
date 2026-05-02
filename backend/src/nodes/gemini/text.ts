/**
 * FlowPilot - Gemini 文本生成节点
 * 使用 Google Generative AI SDK 生成文本
 * 支持系统指令、多轮对话上下文、温度和 token 控制
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

type GeminiModel = 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';

interface GeminiTextInput {
  prompt?: string;
  context?: Array<{ role: string; parts: string }>;
}

interface GeminiCredential {
  apiKey: string;
}

interface GeminiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const DEFAULT_MODEL: GeminiModel = 'gemini-2.0-flash';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 8192;

const textExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const credentialId = String(config.credentialId ?? '');
    const model = String(config.model ?? DEFAULT_MODEL) as GeminiModel;
    const prompt = String(config.prompt ?? (input as GeminiTextInput)?.prompt ?? '');
    const temperature = Number(config.temperature ?? DEFAULT_TEMPERATURE);
    const maxTokens = Number(config.maxTokens ?? DEFAULT_MAX_TOKENS);
    const systemInstruction = String(config.systemInstruction ?? '');
    const conversationContext = ((input as GeminiTextInput)?.context ?? []) as Array<{ role: string; parts: string }>;

    // 参数校验
    if (!credentialId) {
      throw new Error('Gemini 文本节点缺少 credentialId 配置');
    }
    if (!prompt) {
      throw new Error('Gemini 文本节点缺少 prompt（提示词）');
    }

    // 温度范围校验
    if (temperature < 0 || temperature > 2) {
      throw new Error('temperature 必须在 0-2 之间');
    }

    context.logger.info(`调用 Gemini 模型: ${model}，温度: ${temperature}，最大 token: ${maxTokens}`);

    // 获取 API Key
    const credentialJson = await context.getCredential(credentialId);
    if (!credentialJson) {
      throw new Error(`未找到 Gemini 凭据: ${credentialId}`);
    }

    let cred: GeminiCredential;
    try {
      cred = JSON.parse(credentialJson) as GeminiCredential;
    } catch {
      throw new Error('Gemini 凭据格式无效，需要 JSON: { apiKey }');
    }

    if (!cred.apiKey) {
      throw new Error('Gemini 凭据缺少 apiKey 字段');
    }

    // 初始化 Gemini 客户端
    const genAI = new GoogleGenerativeAI(cred.apiKey);
    const generativeModel = genAI.getGenerativeModel({
      model,
      ...(systemInstruction ? { systemInstruction } : {}),
    });

    // 构建消息历史
    const history = conversationContext.map((msg) => ({
      role: msg.role === 'model' ? ('model' as const) : ('user' as const),
      parts: [{ text: msg.parts }],
    }));

    // 使用 p-retry 调用 API
    const result = await withRetry(
      async () => {
        if (history.length > 0) {
          // 有上下文时使用多轮对话
          const chat = generativeModel.startChat({ history });
          const response = await chat.sendMessage(prompt);
          return response;
        } else {
          // 无上下文时直接生成
          const response = await generativeModel.generateContent(prompt);
          return response;
        }
      },
      { retries: 2, minTimeout: 2000 },
    );

    const response = result.response;
    const text = response.text();
    const usageMetadata = response.usageMetadata;

    const usage: GeminiUsage = {
      promptTokens: usageMetadata?.promptTokenCount ?? 0,
      completionTokens: usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: usageMetadata?.totalTokenCount ?? 0,
    };

    context.logger.info(`Gemini 生成完成，token 用量: ${usage.totalTokens}`);

    return {
      text,
      usage,
    } as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini 文本生成失败: ${message}`);
  }
};

registerNodeExecutor('gemini-text', textExecutor);
