/**
 * FlowPilot - 触发器管理器
 * 管理 cron 定时任务的注册、移除和恢复
 *
 * 导出 triggerManager 单例对象
 */

import schedule from 'node-schedule';
import { createModuleLogger } from '../../utils/logger';
import { getAllWorkflows } from '../../db/queries';
import { executor } from '../engine/executor';
import type { CronConfig, TriggerType } from '../../types';

const logger = createModuleLogger('trigger');

/** 活跃触发器映射表 */
const activeTriggers = new Map<string, schedule.Job>();

/**
 * 注册 cron 触发器
 * @param workflowId - 工作流 ID
 * @param config - Cron 配置
 */
function registerCronTrigger(workflowId: string, config: CronConfig): void {
  try {
    // 如果已存在则先移除
    if (activeTriggers.has(workflowId)) {
      removeTrigger(workflowId);
    }

    const job = schedule.scheduleJob(
      {
        rule: config.expression,
        tz: config.timezone || 'Asia/Shanghai',
      },
      async () => {
        logger.info(`Cron 触发器执行: 工作流 ${workflowId}`);
        try {
          const execution = await executor.run(workflowId, {
            triggerType: 'cron',
            triggeredAt: new Date().toISOString(),
          });
          if (execution.status === 'success') {
            logger.info(`Cron 触发执行成功: 工作流 ${workflowId}`);
          } else {
            logger.error(`Cron 触发执行失败: 工作流 ${workflowId} - ${execution.error}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : '未知错误';
          logger.error(`Cron 触发执行异常: 工作流 ${workflowId} - ${message}`);
        }
      },
    );

    if (job) {
      activeTriggers.set(workflowId, job);
      const nextRun = job.nextInvocation();
      logger.info(
        `Cron 触发器已注册: 工作流 ${workflowId}，` +
        `表达式: "${config.expression}"，` +
        `下次执行: ${nextRun?.toISOString() || '未知'}`,
      );
    } else {
      throw new Error('无法创建定时任务，请检查 cron 表达式是否有效');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    logger.error(`注册 Cron 触发器失败: 工作流 ${workflowId} - ${message}`);
    throw new Error(`注册 Cron 触发器失败: ${message}`);
  }
}

/**
 * 移除工作流的触发器
 * @param workflowId - 工作流 ID
 * @returns 是否成功移除
 */
function removeTrigger(workflowId: string): boolean {
  const job = activeTriggers.get(workflowId);
  if (job) {
    job.cancel();
    activeTriggers.delete(workflowId);
    logger.info(`触发器已移除: 工作流 ${workflowId}`);
    return true;
  }
  return false;
}

/**
 * triggerManager 单例对象
 * 提供触发器的注册、移除、恢复等操作
 */
export const triggerManager = {
  /**
   * 注册触发器
   * @param workflowId - 工作流 ID
   * @param triggerType - 触发器类型
   * @param triggerConfig - 触发器配置
   */
  async register(
    workflowId: string,
    triggerType: TriggerType,
    triggerConfig: Record<string, unknown>,
  ): Promise<void> {
    if (triggerType === 'cron') {
      registerCronTrigger(workflowId, triggerConfig as unknown as CronConfig);
    } else {
      logger.info(`触发器类型 "${triggerType}" 暂不支持自动注册: 工作流 ${workflowId}`);
    }
  },

  /**
   * 移除触发器
   * @param workflowId - 工作流 ID
   */
  async unregister(workflowId: string): Promise<void> {
    removeTrigger(workflowId);
  },

  /**
   * 恢复所有活跃工作流的触发器
   * 通常在服务器重启时调用
   */
  async restoreAll(): Promise<void> {
    logger.info('正在恢复所有活跃工作流的触发器...');

    try {
      const activeWorkflows = await getAllWorkflows('active');
      let restoredCount = 0;

      for (const workflow of activeWorkflows) {
        if (workflow.triggerType === 'cron' && workflow.triggerConfig) {
          try {
            const config = workflow.triggerConfig as unknown as CronConfig;
            registerCronTrigger(workflow.id, config);
            restoredCount++;
          } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误';
            logger.error(`恢复触发器失败: 工作流 ${workflow.id} - ${message}`);
          }
        }
      }

      logger.info(`触发器恢复完成: 成功恢复 ${restoredCount} 个，共 ${activeWorkflows.length} 个活跃工作流`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      logger.error(`恢复触发器过程出错: ${message}`);
    }
  },

  /**
   * 移除所有触发器（用于优雅关闭）
   */
  async unregisterAll(): Promise<void> {
    for (const [workflowId, job] of activeTriggers) {
      job.cancel();
    }
    activeTriggers.clear();
    logger.info('所有触发器已清除');
  },

  /**
   * 获取所有活跃触发器信息
   * @returns 活跃触发器信息数组
   */
  getActiveTriggers(): Array<{ workflowId: string; nextRun: string | null }> {
    const triggers: Array<{ workflowId: string; nextRun: string | null }> = [];

    for (const [workflowId, job] of activeTriggers) {
      const nextRun = job.nextInvocation();
      triggers.push({
        workflowId,
        nextRun: nextRun ? nextRun.toISOString() : null,
      });
    }

    return triggers;
  },
};
