/**
 * FlowPilot - Gemini 视觉分析节点
 * 使用 Gemini 的多模态能力分析图片内容
 * 支持 URL 和本地文件路径两种图片输入方式
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI, type InlineDataPart, type FileDataPart } from '@google/generative-ai';
import { registerNodeExecutor } from '../../core/engine/registry';
import type { NodeExecutorFunction } from '../../types';
import { withRetry } from '../../utils/retry';

type GeminiModel = 'gemini-2.0-flash' | 'gemini-1.5-pro' | 'gemini-1.5-flash';

interface VisionInput {
  imageUrl?: string;
  imagePath?: string;
  prompt?: string;
}

interface GeminiCredential {
  apiKey: string;
}

const DEFAULT_MODEL: GeminiModel = 'gemini-2.0-flash';
const DEFAULT_PROMPT = '请详细描述这张图片的内容。';

/** 图片路径到 MIME 类型的映射 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return mimeMap[ext] ?? 'image/jpeg';
}

/** 从本地文件读取图片为 base64 */
function readLocalImageAsBase64(filePath: string): { data: string; mimeType: string } {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`图片文件不存在: ${filePath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new Error(`路径不是文件: ${filePath}`);
  }

  const mimeType = getMimeType(resolvedPath);
  const buffer = fs.readFileSync(resolvedPath);
  const data = buffer.toString('base64');

  return { data, mimeType };
}

/** 从 URL 获取图片为 base64 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });

  if (!response.ok) {
    throw new Error(`下载图片失败，HTTP 状态码: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  let mimeType = 'image/jpeg';

  if (contentType.includes('image/png')) mimeType = 'image/png';
  else if (contentType.includes('image/gif')) mimeType = 'image/gif';
  else if (contentType.includes('image/webp')) mimeType = 'image/webp';
  else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) mimeType = 'image/jpeg';

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const data = buffer.toString('base64');

  return { data, mimeType };
}

/** 构建图片内容部分（支持 URL 和 base64） */
function buildImagePart(
  imageUrl?: string,
  imageBase64?: string,
  mimeType?: string,
): FileDataPart | InlineDataPart {
  if (imageUrl && !imageBase64) {
    // URL 方式：使用 fileData
    return {
      fileData: {
        mimeType: mimeType ?? 'image/jpeg',
        fileUri: imageUrl,
      },
    };
  }

  // base64 方式：使用 inlineData
  return {
    inlineData: {
      mimeType: mimeType ?? 'image/jpeg',
      data: imageBase64 ?? '',
    },
  };
}

const visionExecutor: NodeExecutorFunction = async (input, config, context) => {
  try {
    const credentialId = String(config.credentialId ?? '');
    const model = String(config.model ?? DEFAULT_MODEL) as GeminiModel;
    const configPrompt = String(config.prompt ?? '');
    const configImageUrl = String(config.imageUrl ?? '');

    const visionInput = (input ?? {}) as VisionInput;
    const prompt = configPrompt || visionInput.prompt || DEFAULT_PROMPT;
    const imageUrl = visionInput.imageUrl ?? configImageUrl;
    const imagePath = visionInput.imagePath ?? '';

    // 参数校验
    if (!credentialId) {
      throw new Error('Gemini 视觉节点缺少 credentialId 配置');
    }
    if (!imageUrl && !imagePath) {
      throw new Error('Gemini 视觉节点需要 imageUrl 或 imagePath 参数');
    }

    context.logger.info(`调用 Gemini 视觉分析，模型: ${model}`);

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

    // 获取图片数据
    let imagePart: FileDataPart | InlineDataPart;

    if (imagePath) {
      // 本地文件
      context.logger.info(`读取本地图片: ${imagePath}`);
      const { data, mimeType } = readLocalImageAsBase64(imagePath);
      imagePart = buildImagePart(undefined, data, mimeType);
    } else {
      // URL
      context.logger.info(`获取远程图片: ${imageUrl}`);

      // 判断是否可以直接使用 URL（Gemini 支持某些可公开访问的 URL）
      if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
        try {
          // 先尝试直接使用 URL
          imagePart = buildImagePart(imageUrl, undefined, undefined);
        } catch {
          // 如果失败，下载为 base64
          const { data, mimeType } = await fetchImageAsBase64(imageUrl);
          imagePart = buildImagePart(undefined, data, mimeType);
        }
      } else {
        const { data, mimeType } = await fetchImageAsBase64(imageUrl);
        imagePart = buildImagePart(undefined, data, mimeType);
      }
    }

    // 初始化模型
    const genAI = new GoogleGenerativeAI(cred.apiKey);
    const generativeModel = genAI.getGenerativeModel({ model });

    // 调用多模态 API
    const result = await withRetry(
      async () =>
        generativeModel.generateContent([
          imagePart,
          { text: prompt },
        ]),
      { retries: 2, minTimeout: 3000 },
    );

    const text = result.response.text();

    context.logger.info('Gemini 视觉分析完成');

    return {
      text,
      description: text,
    } as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini 视觉分析失败: ${message}`);
  }
};

registerNodeExecutor('gemini-vision', visionExecutor);
