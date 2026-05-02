/**
 * FlowPilot - 节点定义目录服务
 * 提供所有可用节点类型的完整定义，包含配置模式、输入输出端口
 * 用于前端编辑器左侧面板的节点列表渲染
 */

import type { NodeDefinition } from '../types';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('node-definition-service');

/**
 * 所有节点定义的静态注册表
 * 涵盖触发器、微信、Gemini 和通用动作节点
 */
const NODE_DEFINITIONS: NodeDefinition[] = [
  // ========== 触发器节点 ==========
  {
    type: 'cron_trigger',
    name: '定时触发',
    category: 'trigger',
    description: '按 Cron 表达式定时触发工作流执行',
    icon: '⏰',
    inputs: [],
    outputs: [
      { name: 'trigger', label: '触发数据', type: 'object', required: true },
    ],
    configSchema: [
      {
        name: 'expression',
        label: 'Cron 表达式',
        type: 'cron',
        placeholder: '*/5 * * * *',
        required: true,
      },
      {
        name: 'timezone',
        label: '时区',
        type: 'text',
        placeholder: 'Asia/Shanghai',
        required: false,
        defaultValue: 'Asia/Shanghai',
      },
    ],
  },
  {
    type: 'webhook_trigger',
    name: 'Webhook 触发',
    category: 'trigger',
    description: '通过 HTTP 请求触发工作流执行',
    icon: '🔗',
    inputs: [],
    outputs: [
      { name: 'body', label: '请求体', type: 'object', required: true },
      { name: 'headers', label: '请求头', type: 'object', required: false },
      { name: 'query', label: '查询参数', type: 'object', required: false },
    ],
    configSchema: [
      {
        name: 'path',
        label: 'Webhook 路径',
        type: 'text',
        placeholder: '/my-webhook',
        required: true,
      },
      {
        name: 'method',
        label: 'HTTP 方法',
        type: 'select',
        options: [
          { label: 'POST', value: 'POST' },
          { label: 'GET', value: 'GET' },
          { label: 'PUT', value: 'PUT' },
          { label: 'ANY', value: 'ANY' },
        ],
        required: true,
        defaultValue: 'POST',
      },
    ],
  },
  {
    type: 'wechat_message_trigger',
    name: '微信消息触发',
    category: 'trigger',
    description: '接收微信公众号消息触发工作流执行',
    icon: '💬',
    inputs: [],
    outputs: [
      { name: 'message', label: '消息内容', type: 'object', required: true },
      { name: 'fromUser', label: '发送者', type: 'string', required: true },
      { name: 'msgType', label: '消息类型', type: 'string', required: true },
    ],
    configSchema: [
      {
        name: 'appId',
        label: 'AppID',
        type: 'text',
        placeholder: 'wx...',
        required: true,
      },
      {
        name: 'appSecret',
        label: 'AppSecret',
        type: 'password',
        required: true,
      },
      {
        name: 'token',
        label: 'Token',
        type: 'text',
        required: true,
      },
      {
        name: 'encodingAesKey',
        label: '消息加解密密钥',
        type: 'password',
        required: false,
      },
    ],
  },

  // ========== 微信公众号节点 ==========
  {
    type: 'wechat_send_message',
    name: '发送微信消息',
    category: 'wechat',
    description: '通过微信公众号发送模板消息或客服消息',
    icon: '📤',
    inputs: [
      { name: 'toUser', label: '接收用户', type: 'string', required: true },
      { name: 'content', label: '消息内容', type: 'string', required: true },
    ],
    outputs: [
      { name: 'result', label: '发送结果', type: 'object', required: true },
    ],
    configSchema: [
      {
        name: 'credentialId',
        label: '微信凭据',
        type: 'credential',
        required: true,
      },
      {
        name: 'messageType',
        label: '消息类型',
        type: 'select',
        options: [
          { label: '客服消息', value: 'customer_service' },
          { label: '模板消息', value: 'template' },
        ],
        required: true,
        defaultValue: 'customer_service',
      },
      {
        name: 'templateId',
        label: '模板ID',
        type: 'text',
        placeholder: '仅模板消息需要',
        required: false,
      },
    ],
  },
  {
    type: 'wechat_get_user',
    name: '获取用户信息',
    category: 'wechat',
    description: '获取微信公众号用户的基本信息',
    icon: '👤',
    inputs: [
      { name: 'openId', label: '用户 OpenID', type: 'string', required: true },
    ],
    outputs: [
      { name: 'userInfo', label: '用户信息', type: 'object', required: true },
    ],
    configSchema: [
      {
        name: 'credentialId',
        label: '微信凭据',
        type: 'credential',
        required: true,
      },
    ],
  },
  {
    type: 'wechat_manage_material',
    name: '素材管理',
    category: 'wechat',
    description: '管理微信公众号的永久/临时素材（图片、语音、视频等）',
    icon: '🖼️',
    inputs: [
      { name: 'mediaFile', label: '媒体文件', type: 'file', required: false },
      { name: 'mediaId', label: '素材 MediaID', type: 'string', required: false },
    ],
    outputs: [
      { name: 'result', label: '操作结果', type: 'object', required: true },
    ],
    configSchema: [
      {
        name: 'credentialId',
        label: '微信凭据',
        type: 'credential',
        required: true,
      },
      {
        name: 'action',
        label: '操作类型',
        type: 'select',
        options: [
          { label: '上传素材', value: 'upload' },
          { label: '获取素材', value: 'get' },
          { label: '删除素材', value: 'delete' },
          { label: '获取素材列表', value: 'list' },
        ],
        required: true,
      },
      {
        name: 'mediaType',
        label: '素材类型',
        type: 'select',
        options: [
          { label: '图片', value: 'image' },
          { label: '语音', value: 'voice' },
          { label: '视频', value: 'video' },
          { label: '缩略图', value: 'thumb' },
        ],
        required: false,
      },
    ],
  },
  {
    type: 'wechat_publish',
    name: '发布公众号文章',
    category: 'wechat',
    description: '发布微信公众号图文消息（草稿箱 → 发布）',
    icon: '📝',
    inputs: [
      { name: 'title', label: '文章标题', type: 'string', required: true },
      { name: 'content', label: '文章正文（HTML）', type: 'string', required: true },
      { name: 'thumbMediaId', label: '封面素材ID', type: 'string', required: false },
    ],
    outputs: [
      { name: 'publishId', label: '发布ID', type: 'string', required: true },
      { name: 'articleUrl', label: '文章链接', type: 'string', required: false },
    ],
    configSchema: [
      {
        name: 'credentialId',
        label: '微信凭据',
        type: 'credential',
        required: true,
      },
      {
        name: 'author',
        label: '作者',
        type: 'text',
        placeholder: '作者名称',
        required: false,
      },
      {
        name: 'digest',
        label: '摘要',
        type: 'textarea',
        placeholder: '文章摘要（选填）',
        required: false,
      },
    ],
  },

  // ========== Gemini AI 节点 ==========
  {
    type: 'gemini_text',
    name: 'Gemini 文本生成',
    category: 'gemini',
    description: '使用 Google Gemini 模型生成文本内容',
    icon: '✨',
    inputs: [
      { name: 'prompt', label: '提示词', type: 'string', required: true },
      { name: 'systemInstruction', label: '系统指令', type: 'string', required: false },
    ],
    outputs: [
      { name: 'text', label: '生成文本', type: 'string', required: true },
      { name: 'usage', label: 'Token 用量', type: 'object', required: false },
    ],
    configSchema: [
      {
        name: 'apiKey',
        label: 'Gemini API Key',
        type: 'credential',
        required: true,
      },
      {
        name: 'model',
        label: '模型',
        type: 'select',
        options: [
          { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
          { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
          { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
        ],
        required: true,
        defaultValue: 'gemini-2.0-flash',
      },
      {
        name: 'maxTokens',
        label: '最大输出 Token',
        type: 'number',
        required: false,
        defaultValue: 2048,
      },
      {
        name: 'temperature',
        label: '温度 (0-1)',
        type: 'number',
        required: false,
        defaultValue: 0.7,
      },
    ],
  },
  {
    type: 'gemini_content',
    name: 'Gemini 内容分析',
    category: 'gemini',
    description: '使用 Gemini 分析和提取文本内容中的结构化信息',
    icon: '🔍',
    inputs: [
      { name: 'content', label: '待分析内容', type: 'string', required: true },
      { name: 'instruction', label: '分析指令', type: 'string', required: true },
    ],
    outputs: [
      { name: 'result', label: '分析结果', type: 'object', required: true },
    ],
    configSchema: [
      {
        name: 'apiKey',
        label: 'Gemini API Key',
        type: 'credential',
        required: true,
      },
      {
        name: 'model',
        label: '模型',
        type: 'select',
        options: [
          { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
          { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
        ],
        required: true,
        defaultValue: 'gemini-2.0-flash',
      },
      {
        name: 'outputFormat',
        label: '输出格式',
        type: 'select',
        options: [
          { label: 'JSON', value: 'json' },
          { label: '纯文本', value: 'text' },
        ],
        required: false,
        defaultValue: 'json',
      },
    ],
  },
  {
    type: 'gemini_vision',
    name: 'Gemini 视觉分析',
    category: 'gemini',
    description: '使用 Gemini Vision 模型分析图片内容',
    icon: '👁️',
    inputs: [
      { name: 'imageUrl', label: '图片 URL', type: 'string', required: false },
      { name: 'imageBase64', label: '图片 Base64', type: 'string', required: false },
      { name: 'prompt', label: '分析提示', type: 'string', required: true },
    ],
    outputs: [
      { name: 'description', label: '图片描述', type: 'string', required: true },
      { name: 'details', label: '详细信息', type: 'object', required: false },
    ],
    configSchema: [
      {
        name: 'apiKey',
        label: 'Gemini API Key',
        type: 'credential',
        required: true,
      },
      {
        name: 'model',
        label: '模型',
        type: 'select',
        options: [
          { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
          { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
        ],
        required: true,
        defaultValue: 'gemini-2.0-flash',
      },
    ],
  },

  // ========== 通用动作节点 ==========
  {
    type: 'http_request',
    name: 'HTTP 请求',
    category: 'action',
    description: '发送 HTTP 请求到指定 URL',
    icon: '🌐',
    inputs: [
      { name: 'url', label: '请求 URL', type: 'string', required: true },
      { name: 'body', label: '请求体', type: 'object', required: false },
      { name: 'headers', label: '请求头', type: 'object', required: false },
    ],
    outputs: [
      { name: 'statusCode', label: '状态码', type: 'number', required: true },
      { name: 'body', label: '响应体', type: 'object', required: true },
      { name: 'headers', label: '响应头', type: 'object', required: false },
    ],
    configSchema: [
      {
        name: 'method',
        label: 'HTTP 方法',
        type: 'select',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' },
          { label: 'PATCH', value: 'PATCH' },
        ],
        required: true,
        defaultValue: 'GET',
      },
      {
        name: 'timeout',
        label: '超时时间（毫秒）',
        type: 'number',
        required: false,
        defaultValue: 30000,
      },
      {
        name: 'contentType',
        label: 'Content-Type',
        type: 'select',
        options: [
          { label: 'application/json', value: 'application/json' },
          { label: 'application/x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
          { label: 'text/plain', value: 'text/plain' },
        ],
        required: false,
        defaultValue: 'application/json',
      },
    ],
  },
  {
    type: 'code_execute',
    name: '代码执行',
    category: 'action',
    description: '在安全沙箱中执行自定义 JavaScript 代码',
    icon: '💻',
    inputs: [
      { name: 'input', label: '输入数据', type: 'object', required: false },
    ],
    outputs: [
      { name: 'output', label: '执行结果', type: 'object', required: true },
      { name: 'logs', label: '日志输出', type: 'array', required: false },
    ],
    configSchema: [
      {
        name: 'code',
        label: 'JavaScript 代码',
        type: 'textarea',
        placeholder: '// 可用变量: input, env\n// 返回值将作为输出\nreturn { result: input.value * 2 };',
        required: true,
      },
      {
        name: 'timeout',
        label: '超时时间（毫秒）',
        type: 'number',
        required: false,
        defaultValue: 5000,
      },
    ],
  },
  {
    type: 'file_operation',
    name: '文件操作',
    category: 'action',
    description: '读取、写入或操作本地文件',
    icon: '📁',
    inputs: [
      { name: 'content', label: '文件内容', type: 'string', required: false },
      { name: 'filePath', label: '文件路径', type: 'string', required: false },
    ],
    outputs: [
      { name: 'content', label: '文件内容', type: 'string', required: false },
      { name: 'filePath', label: '文件路径', type: 'string', required: true },
      { name: 'size', label: '文件大小', type: 'number', required: false },
    ],
    configSchema: [
      {
        name: 'operation',
        label: '操作类型',
        type: 'select',
        options: [
          { label: '读取文件', value: 'read' },
          { label: '写入文件', value: 'write' },
          { label: '追加写入', value: 'append' },
          { label: '删除文件', value: 'delete' },
          { label: '检查存在', value: 'exists' },
        ],
        required: true,
      },
      {
        name: 'path',
        label: '文件路径',
        type: 'text',
        placeholder: '/path/to/file.txt',
        required: true,
      },
      {
        name: 'encoding',
        label: '编码',
        type: 'select',
        options: [
          { label: 'UTF-8', value: 'utf-8' },
          { label: 'Base64', value: 'base64' },
        ],
        required: false,
        defaultValue: 'utf-8',
      },
    ],
  },
  {
    type: 'send_email',
    name: '发送邮件',
    category: 'action',
    description: '通过 SMTP 发送电子邮件',
    icon: '📧',
    inputs: [
      { name: 'to', label: '收件人', type: 'string', required: true },
      { name: 'subject', label: '邮件主题', type: 'string', required: true },
      { name: 'body', label: '邮件正文', type: 'string', required: true },
      { name: 'html', label: 'HTML 正文', type: 'string', required: false },
    ],
    outputs: [
      { name: 'success', label: '发送状态', type: 'boolean', required: true },
      { name: 'messageId', label: '消息ID', type: 'string', required: false },
    ],
    configSchema: [
      {
        name: 'credentialId',
        label: '邮箱凭据',
        type: 'credential',
        required: true,
      },
      {
        name: 'from',
        label: '发件人',
        type: 'text',
        placeholder: 'sender@example.com',
        required: true,
      },
      {
        name: 'cc',
        label: '抄送',
        type: 'text',
        placeholder: 'cc@example.com（选填）',
        required: false,
      },
    ],
  },
  {
    type: 'send_notification',
    name: '发送通知',
    category: 'action',
    description: '发送系统内通知或推送消息',
    icon: '🔔',
    inputs: [
      { name: 'title', label: '通知标题', type: 'string', required: true },
      { name: 'message', label: '通知内容', type: 'string', required: true },
    ],
    outputs: [
      { name: 'success', label: '发送状态', type: 'boolean', required: true },
    ],
    configSchema: [
      {
        name: 'channel',
        label: '通知渠道',
        type: 'select',
        options: [
          { label: '系统通知', value: 'system' },
          { label: '邮件通知', value: 'email' },
          { label: 'Webhook 推送', value: 'webhook' },
        ],
        required: true,
        defaultValue: 'system',
      },
      {
        name: 'webhookUrl',
        label: 'Webhook URL',
        type: 'text',
        placeholder: 'https://hooks.example.com/...',
        required: false,
      },
    ],
  },
];

/**
 * 获取所有节点定义
 * @returns 所有节点定义列表
 */
export async function getAllNodeDefinitions(): Promise<NodeDefinition[]> {
  try {
    return [...NODE_DEFINITIONS];
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取节点定义列表失败: ${message}`);
  }
}

/**
 * 根据类型获取单个节点定义
 * @param type - 节点类型标识
 * @returns 匹配的节点定义，未找到返回 null
 */
export async function getNodeDefinition(type: string): Promise<NodeDefinition | null> {
  try {
    const definition = NODE_DEFINITIONS.find((def) => def.type === type);
    if (!definition) {
      log.warn(`未找到节点定义: ${type}`);
      return null;
    }
    return { ...definition };
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    throw new Error(`获取节点定义失败: ${message}`);
  }
}
