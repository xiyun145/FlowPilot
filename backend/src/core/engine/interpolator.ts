/**
 * FlowPilot - 变量插值引擎
 * 解析和替换模板中的变量表达式，支持嵌套对象访问
 *
 * 支持的变量语法:
 * - {{$node.<nodeId>.output.<field>}} - 引用节点输出
 * - {{$trigger.<field>}} - 引用触发器数据
 * - {{$global.<var>}} - 引用全局变量
 */

import { createModuleLogger } from '../../utils/logger';
import type { ExecutionContext } from '../../types';

const logger = createModuleLogger('interpolator');

/** 变量表达式正则匹配模式 */
const VARIABLE_PATTERN = /\{\{\$((?:node|trigger|global)\.[^}]+)\}\}/g;

/**
 * 根据路径从对象中获取值
 * 支持点号分隔的路径和数组索引，如 data.items[0].name
 * @param obj - 源对象
 * @param path - 属性路径
 * @returns 解析后的值
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  // 将路径拆分为属性链，支持 array[0] 语法
  const parts: string[] = [];
  let current = '';

  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    if (char === '.') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (char === '[') {
      if (current) {
        parts.push(current);
        current = '';
      }
      // 找到对应的 ]
      const endBracket = path.indexOf(']', i + 1);
      if (endBracket === -1) {
        throw new Error(`无效的路径语法: 缺少右方括号，位置 ${i}`);
      }
      const indexStr = path.slice(i + 1, endBracket);
      parts.push(indexStr);
      i = endBracket;
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current);
  }

  // 沿属性链获取值
  let result: unknown = obj;
  for (const part of parts) {
    if (result === null || result === undefined) {
      return undefined;
    }
    if (typeof result === 'object') {
      result = (result as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return result;
}

/**
 * 解析变量路径，提取类型和具体路径
 * @param expression - 变量表达式（不含花括号）
 * @returns 解析结果
 */
function parseVariablePath(expression: string): {
  type: 'node' | 'trigger' | 'global';
  path: string;
  nodeId?: string;
} {
  const parts = expression.split('.');

  if (parts[0] === 'node' && parts.length >= 3) {
    // $node.<nodeId>.output.<field> 或 $node.<nodeId>.output
    const nodeId = parts[1];
    const remainingPath = parts.slice(2).join('.');
    return { type: 'node', path: remainingPath, nodeId };
  }

  if (parts[0] === 'trigger') {
    const remainingPath = parts.slice(1).join('.');
    return { type: 'trigger', path: remainingPath };
  }

  if (parts[0] === 'global') {
    const remainingPath = parts.slice(1).join('.');
    return { type: 'global', path: remainingPath };
  }

  throw new Error(`无效的变量表达式: $${expression}`);
}

/**
 * 根据变量类型和路径从执行上下文中获取值
 * @param parsed - 解析后的变量路径
 * @param context - 执行上下文
 * @returns 变量值
 */
function resolveVariable(
  parsed: ReturnType<typeof parseVariablePath>,
  context: ExecutionContext,
): unknown {
  switch (parsed.type) {
    case 'node': {
      if (!parsed.nodeId) return undefined;
      const nodeData = context.nodes[parsed.nodeId];
      if (!nodeData) return undefined;
      return getNestedValue(nodeData, parsed.path);
    }
    case 'trigger': {
      return getNestedValue(context.trigger, parsed.path);
    }
    case 'global': {
      return getNestedValue(context.global, parsed.path);
    }
    default:
      return undefined;
  }
}

/**
 * 对字符串进行变量插值
 * 替换所有 {{$xxx}} 表达式为实际值
 * @param template - 包含变量表达式的模板字符串
 * @param context - 执行上下文
 * @returns 替换后的字符串
 */
export function interpolate(template: string, context: ExecutionContext): string {
  if (typeof template !== 'string') {
    return String(template);
  }

  return template.replace(VARIABLE_PATTERN, (match, expression: string) => {
    try {
      const parsed = parseVariablePath(expression);
      const value = resolveVariable(parsed, context);

      if (value === undefined || value === null) {
        logger.warn(`变量未找到: $${expression}`);
        return match; // 保留原始表达式
      }

      // 如果值是对象或数组，序列化为 JSON
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      logger.error(`变量解析失败: $${expression} - ${message}`);
      return match;
    }
  });
}

/**
 * 深度遍历对象，对所有字符串值进行变量插值
 * @param obj - 待处理的对象
 * @param context - 执行上下文
 * @returns 处理后的对象副本
 */
export function interpolateDeep<T>(obj: T, context: ExecutionContext): T {
  if (typeof obj === 'string') {
    // 如果整个字符串就是一个变量表达式，保留原始类型
    const singleMatch = obj.match(/^\{\{\$((?:node|trigger|global)\.[^}]+)\}\}$/);
    if (singleMatch) {
      try {
        const parsed = parseVariablePath(singleMatch[1]);
        const value = resolveVariable(parsed, context);
        if (value !== undefined && value !== null) {
          return value as T;
        }
      } catch {
        // 回退到字符串替换
      }
    }
    return interpolate(obj, context) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateDeep(item, context)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateDeep(value, context);
    }
    return result as T;
  }

  return obj;
}

/**
 * 检查字符串是否包含变量表达式
 * @param str - 待检查的字符串
 * @returns 是否包含变量
 */
export function hasVariables(str: string): boolean {
  return VARIABLE_PATTERN.test(str);
}
