/**
 * sql.js 适配器
 * 提供类似 better-sqlite3 的同步 API，底层使用 sql.js
 */

import initSqlJs, { Database as SqlJsDatabase, BindParams } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('db:adapter');

/** 数据库文件路径 */
const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'flowpilot.db');

/** 预编译语句模拟 */
class PreparedStatement {
  constructor(
    private db: SqlJsDatabase,
    private sql: string,
  ) {}

  /**
   * 执行查询并返回所有结果
   */
  all(...params: unknown[]): Record<string, unknown>[] {
    try {
      const stmt = this.db.prepare(this.sql);
      stmt.bind(params as BindParams);
      const results: Record<string, unknown>[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row as Record<string, unknown>);
      }
      stmt.free();
      return results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      throw new Error(`查询执行失败: ${msg}`);
    }
  }

  /**
   * 执行查询并返回第一行结果
   */
  get(...params: unknown[]): Record<string, unknown> | undefined {
    const results = this.all(...params);
    return results[0];
  }

  /**
   * 执行 INSERT/UPDATE/DELETE
   */
  run(...params: unknown[]): { changes: number } {
    try {
      this.db.run(this.sql, params as BindParams);
      const changes = this.db.getRowsModified();
      return { changes };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      throw new Error(`SQL执行失败: ${msg}`);
    }
  }
}

/**
 * sql.js 数据库适配器
 * 提供与 better-sqlite3 兼容的 API
 */
export class DatabaseAdapter {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  /**
   * 准备 SQL 语句
   */
  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.db, sql);
  }

  /**
   * 执行多条 SQL 语句
   */
  exec(sql: string): void {
    this.db.run(sql);
  }

  /**
   * 执行单条 SQL
   */
  run(sql: string, params?: unknown[]): void {
    if (params) {
      this.db.run(sql, params as BindParams);
    } else {
      this.db.run(sql);
    }
  }

  /**
   * 获取修改的行数
   */
  getRowsModified(): number {
    return this.db.getRowsModified();
  }

  /**
   * 导出数据库为二进制数据
   */
  export(): Uint8Array {
    return this.db.export();
  }

  /**
   * 关闭数据库
   */
  close(): void {
    this.db.close();
  }
}

/** 单例数据库实例 */
let dbInstance: DatabaseAdapter | null = null;

/**
 * 保存数据库到文件
 */
function saveToFile(db: DatabaseAdapter): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    logger.error(`保存数据库失败: ${msg}`);
  }
}

/**
 * 创建数据库表结构
 */
function createTables(db: DatabaseAdapter): void {
  logger.info('正在创建数据库表结构...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      nodes TEXT NOT NULL DEFAULT '[]',
      edges TEXT NOT NULL DEFAULT '[]',
      trigger_type TEXT,
      trigger_config TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      trigger_data TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      error TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS node_executions (
      id TEXT PRIMARY KEY,
      execution_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT,
      output TEXT,
      error TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      duration INTEGER,
      FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_node_executions_execution_id ON node_executions(execution_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status)`);

  logger.info('数据库表结构创建完成');
}

/**
 * 获取数据库单例实例
 */
export async function getDb(): Promise<DatabaseAdapter> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const SQL = await initSqlJs();

    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      logger.info(`已创建数据目录: ${DB_DIR}`);
    }

    let sqlDb: SqlJsDatabase;
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      sqlDb = new SQL.Database(fileBuffer);
      logger.info(`已加载数据库: ${DB_PATH}`);
    } else {
      sqlDb = new SQL.Database();
      logger.info('创建新数据库');
    }

    dbInstance = new DatabaseAdapter(sqlDb);
    dbInstance.run('PRAGMA foreign_keys = ON');
    createTables(dbInstance);
    saveToFile(dbInstance);

    return dbInstance;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    logger.error(`数据库初始化失败: ${message}`);
    throw new Error(`数据库初始化失败: ${message}`);
  }
}

/**
 * 关闭数据库连接
 */
export function closeDb(): void {
  if (dbInstance) {
    saveToFile(dbInstance);
    dbInstance.close();
    dbInstance = null;
    logger.info('数据库连接已关闭');
  }
}

/**
 * 持久化数据库到磁盘
 */
export function persistDb(): void {
  if (dbInstance) {
    saveToFile(dbInstance);
  }
}

/**
 * 初始化数据库
 */
export async function initDatabase(): Promise<void> {
  await getDb();
}
