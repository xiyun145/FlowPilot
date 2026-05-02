/**
 * FlowPilot - Gemini 内容处理节点
 * 预置多种内容处理操作：润色、摘要、标题生成、改写、翻译
 * 每种操作使用专门设计的提示词模板
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

type ContentOperation = 'polish' | 'summarize' | 'titleGenerate' | 'rewrite' | 'translate';
type GeminiModel = 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';

interface ContentInput {
  text: string;
}

interface GeminiCredential {
  apiKey: string;
}

const DEFAULT_MODEL: GeminiModel = 'gemini-2.0-flash';
const DEFAULT_TEMPERATURE = 0.7;

/** 操作类型到中文名称的映射 */
const OPERATION_NAMES: Record<ContentOperation, string> = {
  polish: '润色',
  summarize: '摘要',
  titleGenerate: '标题生成',
  rewrite: '改写',
  translate: '翻译',
};

/** 构建各操作的提示词 */
function buildPrompt(operation: ContentOperation, text: string, targetLanguage?: string, customPrompt?: string): string {
  if (customPrompt) {
    return `${customPrompt}\n\n原文内容:\n${text}`;
  }

  switch (operation) {
    case 'polish':
      return `请对以下文本进行润色，保持原意的同时提升表达质量、流畅度和专业性。只返回润色后的文本，不要添加额外说明。\n\n原文:\n${text}`;

    case 'summarize':
      return `请对以下文本进行摘要，提取核心要点，生成简洁精炼的摘要。摘要应保留关键信息，去除冗余内容。只返回摘要文本，不要添加额外说明。\n\n原文:\n${text}`;

    case 'titleGenerate':
      return `请根据以下文本内容生成 3-5 个吸引人的标题候选。标题应简洁有力，能够准确概括文章主旨。每个标题占一行，不要添加编号或其他说明。\n\n文本内容:\n${text}`;

    case 'rewrite':
      return `请对以下文本进行改写，使用不同的表达方式重新组织内容，保持核心含义不变。改写后的文本应有明显不同的句式和用词。只返回改写后的文本，不要添加额外说明。\n\n原文:\n${text}`;

    case 'translate':
      if (!targetLanguage) {
        return `请将以下文本翻译成英文。保持原文的语气和风格，确保翻译准确自然。只返回翻译后的文本，不要添加额外说明。\n\n原文:\n${text}`;
      }
      return `请将以下文本翻译成${targetLanguage}。保持原文的语气和风格，确保翻译准确自然。只返回翻译后的文本，不要添加额外说明。\n\n原文:\n${text}`;

    default:
      throw new Error(`不支持的内容处理操作: ${operation}`);
  }
}

const contentExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const credentialId = String(config.credentialId ?? '');
    const model = String(config.model ?? DEFAULT_MODEL) as GeminiModel;
    const operation = String(config.operation ?? 'polish') as ContentOperation;
    const targetLanguage = String(config.targetLanguage ?? '');
    const customPrompt = String(config.customPrompt ?? '');
    const temperature = Number(config.temperature ?? DEFAULT_TEMPERATURE);

    const contentInput = (input ?? {}) as ContentInput;
    const text = String(contentInput.text ?? '');

    // 参数校验
    if (!credentialId) {
      throw new Error('Gemini 内容处理节点缺少 credentialId 配置');
    }
    if (!text) {
      throw new Error('Gemini 内容处理节点缺少输入文本');
    }

    const operationName = OPERATION_NAMES[operation];
    if (!operationName) {
      throw new Error(`不支持的内容处理操作: ${operation}，支持: ${Object.keys(OPERATION_NAMES).join(', ')}`);
    }

    context.logger.info(`执行内容${operationName}，模型: ${model}`);

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

    // 初始化模型
    const genAI = new GoogleGenerativeAI(cred.apiKey);
    const generativeModel = genAI.getGenerativeModel({ model });

    // 构建提示词
    const prompt = buildPrompt(operation, text, targetLanguage || undefined, customPrompt || undefined);

    // 调用 API
    const result = await withRetry(
      async () => generativeModel.generateContent(prompt),
      { retries: 2, minTimeout: 2000 },
    );

    const responseText = result.response.text();

    context.logger.info(`内容${operationName}完成`);

    return {
      text: responseText,
      operation,
    } as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini 内容处理失败: ${message}`);
  }
};

registerNodeExecutor('gemini-content', contentExecutor);
