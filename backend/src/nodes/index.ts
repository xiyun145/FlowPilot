/**
 * FlowPilot - 节点注册入口文件
 * 导入所有节点模块以触发其自注册，此文件由服务器启动时导入
 */

// 基础节点
import './base/http';
import './base/code';
import './base/file';
import './base/email';
import './base/notify';

// 微信节点
import './wechat/message';
import './wechat/user';
import './wechat/material';
import './wechat/publish';

// Gemini AI 节点
import './gemini/text';
import './gemini/content';
import './gemini/vision';
