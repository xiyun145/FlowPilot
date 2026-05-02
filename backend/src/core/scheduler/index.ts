/**
 * FlowPilot - Cron 表达式辅助工具
 * 提供 cron 表达式验证、解析、下次执行时间计算和中文描述
 */

import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('scheduler');

/** Cron 字段名称映射 */
const FIELD_NAMES = ['分钟', '小时', '日', '月', '星期'];

/** 月份名称 */
const MONTH_NAMES = [
  '', '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

/** 星期名称 */
const DAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 验证单个 cron 字段
 * @param field - 字段值
 * @param min - 最小值
 * @param max - 最大值
 * @param fieldName - 字段名称（用于错误提示）
 * @returns 是否有效
 */
function validateCronField(field: string, min: number, max: number, fieldName: string): boolean {
  // 通配符
  if (field === '*') return true;

  // 逗号分隔的多个值
  const parts = field.split(',');
  for (const part of parts) {
    // 步进值 (*/n)
    if (part.startsWith('*/')) {
      const step = parseInt(part.slice(2), 10);
      if (isNaN(step) || step < 1) {
        throw new Error(`${fieldName}字段步进值无效: ${part}`);
      }
      return true;
    }

    // 范围 (n-m)
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
        throw new Error(`${fieldName}字段范围无效: ${part}，有效范围: ${min}-${max}`);
      }
      return true;
    }

    // 单个数值
    const num = parseInt(part, 10);
    if (isNaN(num) || num < min || num > max) {
      throw new Error(`${fieldName}字段值无效: ${part}，有效范围: ${min}-${max}`);
    }
  }

  return true;
}

/**
 * 解析并验证 cron 表达式
 * @param expr - cron 表达式（5个字段：分 时 日 月 星期）
 * @returns 验证后的 cron 表达式
 * @throws 如果表达式无效则抛出错误
 */
export function parseCronExpression(expr: string): string {
  if (typeof expr !== 'string' || expr.trim().length === 0) {
    throw new Error('Cron 表达式不能为空');
  }

  const fields = expr.trim().split(/\s+/);

  if (fields.length !== 5) {
    throw new Error(`Cron 表达式必须包含5个字段（分 时 日 月 星期），当前有 ${fields.length} 个`);
  }

  // 验证各字段范围
  const ranges: Array<[number, number]> = [
    [0, 59],   // 分钟
    [0, 23],   // 小时
    [1, 31],   // 日
    [1, 12],   // 月
    [0, 7],    // 星期（0 和 7 都表示星期日）
  ];

  for (let i = 0; i < 5; i++) {
    validateCronField(fields[i], ranges[i][0], ranges[i][1], FIELD_NAMES[i]);
  }

  logger.debug(`Cron 表达式验证通过: ${expr}`);
  return expr.trim();
}

/**
 * 计算 cron 表达式的下一次执行时间
 * 使用简单的计算方法（适用于标准 cron 表达式）
 * @param expr - cron 表达式
 * @returns 下次执行的 Date 对象
 */
export function getNextRunTime(expr: string): Date {
  const validated = parseCronExpression(expr);
  const fields = validated.split(' ');
  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = fields;

  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);

  // 解析分钟
  if (minuteField !== '*') {
    const minute = parseInt(minuteField.replace('*/', ''), 10);
    if (minuteField.startsWith('*/')) {
      const currentMinute = now.getMinutes();
      const nextMinute = Math.ceil((currentMinute + 1) / minute) * minute;
      next.setMinutes(nextMinute >= 60 ? nextMinute - 60 : nextMinute);
      if (nextMinute >= 60) {
        next.setHours(next.getHours() + 1);
      }
    } else {
      next.setMinutes(minute);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
    }
  } else {
    next.setMinutes(now.getMinutes() + 1);
  }

  // 解析小时
  if (hourField !== '*') {
    const hour = parseInt(hourField.replace('*/', ''), 10);
    if (hourField.startsWith('*/')) {
      const currentHour = now.getHours();
      const nextHour = Math.ceil((currentHour + 1) / hour) * hour;
      next.setHours(nextHour >= 24 ? nextHour - 24 : nextHour);
      if (nextHour >= 24) {
        next.setDate(next.getDate() + 1);
      }
    } else {
      next.setHours(hour);
    }
  }

  // 对于简单的通配符情况，如果计算的时间已过去，则移到下一天
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * 生成人类可读的 cron 表达式描述（中文）
 * @param expr - cron 表达式
 * @returns 中文描述字符串
 */
export function describeCronExpression(expr: string): string {
  const validated = parseCronExpression(expr);
  const fields = validated.split(' ');
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

  const parts: string[] = [];

  // 月份描述
  if (month !== '*') {
    if (month.startsWith('*/')) {
      parts.push(`每${month.slice(2)}个月`);
    } else if (month.includes(',')) {
      parts.push(`在 ${month.split(',').map((m) => MONTH_NAMES[parseInt(m)] || m + '月').join('、')}`);
    } else {
      parts.push(`在 ${MONTH_NAMES[parseInt(month)] || month + '月'}`);
    }
  }

  // 日期描述
  if (dayOfMonth !== '*') {
    if (dayOfMonth.startsWith('*/')) {
      parts.push(`每${dayOfMonth.slice(2)}天`);
    } else {
      parts.push(`${dayOfMonth}日`);
    }
  }

  // 星期描述
  if (dayOfWeek !== '*') {
    if (dayOfWeek === '1-5') {
      parts.push('工作日');
    } else if (dayOfWeek === '0,6' || dayOfWeek === '6,0') {
      parts.push('周末');
    } else if (dayOfWeek.includes(',')) {
      parts.push(
        `每${dayOfWeek.split(',').map((d) => DAY_NAMES[parseInt(d)] || d).join('、')}`,
      );
    } else if (dayOfWeek.includes('-')) {
      const [start, end] = dayOfWeek.split('-').map(Number);
      parts.push(`${DAY_NAMES[start] || start}到${DAY_NAMES[end] || end}`);
    } else {
      parts.push(`每${DAY_NAMES[parseInt(dayOfWeek)] || dayOfWeek}`);
    }
  }

  // 小时描述
  if (hour !== '*') {
    if (hour.startsWith('*/')) {
      parts.push(`每${hour.slice(2)}小时`);
    } else {
      parts.push(`${hour}时`);
    }
  }

  // 分钟描述
  if (minute !== '*') {
    if (minute.startsWith('*/')) {
      parts.push(`每${minute.slice(2)}分钟`);
    } else {
      parts.push(`${minute}分`);
    }
  }

  // 特殊常见表达式
  if (validated === '* * * * *') return '每分钟执行';
  if (validated === '0 * * * *') return '每小时整点执行';
  if (validated === '0 0 * * *') return '每天午夜执行';
  if (validated === '0 0 * * 1-5') return '每个工作日午夜执行';
  if (validated === '0 0 1 * *') return '每月1日午夜执行';
  if (validated === '0 9 * * *') return '每天上午9点执行';
  if (validated === '0 9 * * 1-5') return '每个工作日上午9点执行';
  if (validated === '30 8 * * 1') return '每周一上午8点30分执行';
  if (validated === '0 0 1 1 *') return '每年1月1日午夜执行';

  return parts.join('') + '执行';
}
