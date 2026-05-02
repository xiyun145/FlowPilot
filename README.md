# FlowPilot - 个人本地自动化工作流引擎

一款**个人本地专用、可离线运行、无功能限制**的轻量化跨平台自动化工作流引擎，核心解决个人微信公众号运营、AI内容创作、日常重复劳动的自动化需求。

## 核心特性

- **可视化拖拽编排** - 基于 React Flow 的流程编辑器，拖拽即可创建自动化工作流
- **100% 本地运行** - 数据全部存储在本地 SQLite，无任何数据上报
- **零配置启动** - 安装 Node.js 后，一条命令即可启动
- **微信公众号集成** - 完整的消息触发、自动回复、用户管理、素材管理、图文推送
- **Google Gemini AI** - 文本生成、内容处理、多模态理解，助力内容创作
- **Cron 定时任务** - 可视化配置定时任务，自动生成公众号推文
- **凭证安全存储** - AES-256-GCM 加密存储所有敏感信息

## 环境要求

- **Node.js 18+**（推荐 20 LTS）
- **操作系统**: Windows 10+ / macOS 12+ / Ubuntu 20.04+

## 快速开始

### Windows 用户

```cmd
# 双击运行 start.cmd
start.cmd
```

### Mac/Linux 用户

```bash
# 赋予执行权限并运行
chmod +x start.sh
./start.sh
```

### 手动启动

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 安装前端依赖并构建
cd ../frontend
npm install
npm run build

# 3. 配置环境变量
cp ../.env.example backend/.env
# 编辑 backend/.env，设置 ENCRYPTION_KEY

# 4. 启动服务
cd ../backend
npm start
```

启动成功后访问 **http://localhost:3210**

## 微信公众号配置教程

### 第一步：获取公众号凭证

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「设置与开发」→「基本配置」
3. 记录 AppID 和 AppSecret

### 第二步：配置服务器

1. 在公众号后台「服务器配置」中：
   - **URL**: `http://你的服务器地址:3210/api/wechat/callback`
   - **Token**: 自定义一个 token 字符串
   - **EncodingAESKey**: 点击随机生成
   - **消息加解密方式**: 安全模式（推荐）

2. 在 FlowPilot 的「凭证管理」页面：
   - 点击「添加凭证」
   - 类型选择「微信公众号」
   - 填入 AppID、AppSecret、Token、EncodingAESKey

### 第三步：创建工作流

1. 在首页点击「新建工作流」
2. 从左侧面板拖入「微信消息触发」节点
3. 添加处理节点（如 Gemini 文本生成、公众号消息回复）
4. 连接节点，配置参数
5. 保存并启用工作流

## Google Gemini 配置教程

### 第一步：获取 API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 创建 API Key

### 第二步：在 FlowPilot 中配置

1. 进入「凭证管理」页面
2. 点击「添加凭证」
3. 类型选择「Google Gemini」
4. 填入 API Key

### 第三步：使用 Gemini 节点

- **文本生成**: 自定义 Prompt，选择模型，调整温度参数
- **内容处理**: 文章润色、摘要、标题生成、改写、翻译
- **多模态理解**: 图片内容解析、OCR 识别

## 内置场景模板

### 模板1：公众号用户消息 AI 自动回复

当用户给公众号发送消息时，使用 Gemini AI 生成智能回复。

**流程**:
```
微信消息触发 → Gemini 文本生成 → 公众号消息回复
```

**配置要点**:
- 触发节点：选择「微信消息触发」
- Gemini 节点：设置 System Prompt 为「你是一个友好的公众号助手」
- 回复节点：选择「公众号消息回复」，消息类型为文本

### 模板2：每日 Gemini 生成公众号推文定时推送

每天定时使用 Gemini 生成文章，自动创建草稿。

**流程**:
```
定时触发（每天9:00） → Gemini 内容生成 → 公众号图文推送
```

**配置要点**:
- 触发节点：设置 Cron 表达式为 `0 9 * * *`
- Gemini 节点：设置生成主题和风格
- 推送节点：选择「创建草稿」，配置图文信息

## 节点说明

### 触发节点
| 节点 | 说明 |
|------|------|
| 定时触发 | Cron 表达式定时触发工作流 |
| Webhook 触发 | HTTP 请求触发工作流 |
| 微信消息触发 | 用户给公众号发消息时触发 |

### 微信公众号节点
| 节点 | 说明 |
|------|------|
| 消息回复 | 回复文本、图片、图文、语音消息 |
| 用户管理 | 获取用户信息、标签管理、关注列表 |
| 素材管理 | 上传/获取/删除临时和永久素材 |
| 图文推送 | 创建草稿、发布图文、群发消息 |

### Gemini 节点
| 节点 | 说明 |
|------|------|
| 文本生成 | 自定义 Prompt 生成文本 |
| 内容处理 | 润色、摘要、标题生成、改写、翻译 |
| 多模态理解 | 图片解析、OCR、图片文案生成 |

### 基础工具节点
| 节点 | 说明 |
|------|------|
| HTTP 请求 | 发送 HTTP 请求到外部 API |
| 代码执行 | 沙箱中执行 JavaScript 代码 |
| 文件读写 | 读取/写入本地文件 |
| 邮件发送 | 通过 SMTP 发送邮件 |
| 系统通知 | 发送系统通知消息 |

## 变量语法

在节点配置中使用 `{{}}` 语法引用上游数据：

```javascript
// 引用触发数据
{{$trigger.content}}
{{$trigger.fromUser}}

// 引用指定节点输出
{{$node.gemini1.output.text}}
{{$node.http1.output.data.id}}

// 引用全局变量
{{$global.workflowName}}
```

## 常见问题

### Q: 启动后无法访问页面？

1. 检查端口 3210 是否被占用
2. 确认前端已正确构建（backend/public 目录存在）
3. 检查后端日志是否有错误信息

### Q: 微信公众号消息无法触发？

1. 确认公众号服务器配置 URL 正确
2. 检查 Token 和 EncodingAESKey 是否与 FlowPilot 中配置一致
3. 确认工作流已启用，且触发节点为「微信消息触发」
4. 检查服务器是否可从公网访问（需要域名和公网 IP）

### Q: Gemini API 调用失败？

1. 检查 API Key 是否正确
2. 确认网络可访问 Google 服务
3. 检查 API 配额是否用尽

### Q: 定时任务不执行？

1. 确认工作流已启用
2. 检查 Cron 表达式是否正确
3. 确认服务未重启（重启后自动恢复）

### Q: 如何备份数据？

数据文件位于 `backend/data/flowpilot.db`，直接复制此文件即可备份全部数据。

### Q: 如何迁移数据？

将 `flowpilot.db` 文件复制到新环境的 `backend/data/` 目录下即可。

## 技术架构

```
flowpilot/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── core/           # 核心引擎
│   │   │   ├── engine/     # 执行引擎、变量插值、节点注册
│   │   │   ├── trigger/    # 触发器管理
│   │   │   └── scheduler/  # 调度系统
│   │   ├── nodes/          # 节点实现
│   │   │   ├── wechat/     # 微信公众号节点
│   │   │   ├── gemini/     # Gemini AI 节点
│   │   │   └── base/       # 基础工具节点
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── db/             # 数据库
│   │   ├── utils/          # 工具函数
│   │   └── types/          # 类型定义
│   ├── public/             # 前端构建产物
│   └── data/               # 本地数据存储
├── frontend/               # 前端应用
│   └── src/
│       ├── components/     # React 组件
│       │   ├── editor/     # 流程编辑器
│       │   ├── ui/         # UI 组件库
│       │   └── nodes/      # 节点组件
│       ├── pages/          # 页面
│       ├── stores/         # 状态管理
│       ├── hooks/          # 自定义 Hook
│       └── utils/          # 工具函数
├── start.sh                # Mac/Linux 启动脚本
├── start.cmd               # Windows 启动脚本
└── README.md               # 项目文档
```

## 许可证

MIT License - 个人使用完全免费
