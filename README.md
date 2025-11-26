# Slots Resource Sync

资源同步和管理工具，支持CLI和MCP两种调用方式。

## 功能特性

### 核心功能
- ✅ 检查资源完整性（iOS & Android）
- 📤 同步Facebook资源
- 📤 同步Native资源
- 🔄 更新Reuse资源版本
- 🚀 完整发布流程自动化

### CLI交互式功能
- 🎯 **交互式CLI** - 每步执行前确认版本，执行后详细反馈
- 🔐 **安全控制** - 步骤间等待确认，防止误操作
- ⚠️ **Reuse版本确认** - 显示计算好的版本号，需确认后才执行（避免安全事故）
- 📺 **完整输出展示** - 显示脚本的完整stdout/stderr，便于判断执行结果
- 🤔 **基于输出决策** - 查看输出后再决定是否继续下一步

### 远程访问
- 🌐 **HTTP API服务器** - 支持远程调用，可部署到服务器
- 🔑 **多层安全认证** - API Key + IP白名单 + 速率限制
- 🤖 **MCP协议支持** - 本地AI工具可通过MCP调用
- 📊 **PM2进程管理** - 自动重启、日志管理、性能监控

### 其他
- 📝 完整的日志记录和错误处理
- 🛠️ 灵活的配置管理

## 快速开始

**第一次使用？** 👉 查看 [快速入门指南](./QUICKSTART.md)

**想了解详细功能？** 👉 查看 [使用指南](./USAGE_GUIDE.md)

**想查看输出示例？** 👉 查看 [输出示例](./OUTPUT_EXAMPLE.md)

**需要部署到远程服务器？** 👉 查看 [部署指南](./DEPLOYMENT.md)

**需要API调用示例？** 👉 查看 [API示例](./API_EXAMPLES.md)

**如何使用API Key？** 👉 查看 [API使用指南](./HOW_TO_USE_API.md) ⭐推荐

## 系统要求

- **Node.js**: 16.14.0 或更高（支持Node 16，适合老服务器）
- **npm**: 8.0.0 或更高

> 💡 **老服务器友好**：本项目已针对 Node 16 优化，可在较老的服务器上运行。详见 [Node 16兼容性说明](./NODE16_COMPATIBILITY.md)

## 安装

```bash
npm install
```

## 配置

编辑 `config/default.json` 文件，根据你的环境调整路径：

```json
{
  "paths": {
    "home": "/home/ec2-user",
    "match": "/home/ec2-user/match",
    "wtc": "/home/ec2-user/wtc",
    "wtc_fb": "/home/ec2-user/wtc_fb",
    "nginx": "/export/nginx/https",
    "assets_config": "/home/ec2-user/wtc/assets_config"
  },
  "defaults": {
    "versionOffset": 2
  }
}
```

## 使用方式

### 1. CLI 命令行方式

#### 安装全局命令（可选）

```bash
npm link
```

之后可以直接使用 `resource-sync` 命令。

#### 查看帮助

```bash
node src/cli.js --help
```

#### 任务1: 检查资源完整性

```bash
# 交互式（默认，会确认版本）
node src/cli.js check -v v885

# 跳过确认
node src/cli.js check -v v885 --no-confirm
```

**交互式流程示例：**
```
============================================================
  准备执行: 资源完整性检查
============================================================

? 确认版本号是 v885 吗? (Y/n)

🚀 开始执行: 资源完整性检查
   版本: v885
   时间: 2025-11-26 10:30:00

检查详情:

✅ 1. Check iOS resources - 通过
✅ 2. Check Android resources - 通过
✅ 3. Match version - 通过

============================================================
✅ 资源完整性检查 - 执行成功
============================================================
📦 版本: v885
💬 版本 v885 资源无异常，所有检查项通过

详细信息:
  • iOS资源: ✅ 完整
  • Android资源: ✅ 完整
  • 版本匹配: ✅ 通过
============================================================
```

#### 任务2: 同步Facebook资源

```bash
node src/cli.js sync-fb -v v885
```

#### 任务3: 同步Native资源

```bash
node src/cli.js sync-native -v v885
```

#### 任务4: 更新Reuse版本

```bash
# 使用默认的nginx版本（version-2）
node src/cli.js update-reuse -v v885

# 指定nginx版本
node src/cli.js update-reuse -v v885 -n v880
```

#### 完整发布流程（推荐使用，交互式）

执行检查 -> 同步FB -> 同步Native 的完整流程，**每步完成后会等待你确认继续**：

```bash
# 交互式完整流程（推荐）
node src/cli.js full-sync -v v885

# 跳过资源检查
node src/cli.js full-sync -v v885 --skip-check

# 跳过所有确认（危险！仅在自动化脚本中使用）
node src/cli.js full-sync -v v885 --no-confirm
```

**交互式流程示例：**
```
🚀 完整发布流程

版本: v885
时间: 2025-11-26 10:30:00

? 确认版本号是 v885 吗? Yes

进度: [██████████░░░░░░░░░░░░░░░░░░░░] 33% (1/3)
当前步骤: 检查资源完整性

🚀 开始执行: 检查资源完整性
...
✅ 资源完整性检查 - 执行成功

────────────────────────────────────────────────────────────
📋 下一步: 同步Facebook资源
────────────────────────────────────────────────────────────

? 请选择操作:
❯ ✅ 继续执行
  ⏸️  暂停（稍后继续）
  ❌ 取消退出

进度: [████████████████████░░░░░░░░░░] 66% (2/3)
当前步骤: 同步Facebook资源

🚀 开始执行: 同步Facebook资源
...
✅ Facebook资源同步 - 执行成功

────────────────────────────────────────────────────────────
📋 下一步: 同步Native资源
────────────────────────────────────────────────────────────

? 请选择操作: ✅ 继续执行

...最终完成...

============================================================
  执行摘要
============================================================
  版本: v885
  总任务数: 3
  成功: 3

  🎉 所有任务执行成功！
============================================================
```

### 2. 远程API方式（推荐用于生产环境）

#### 为什么需要远程API？

MCP协议只能在本地使用。当你需要从本地AI工具调用远程服务器上的任务时，需要使用HTTP API。

#### 🆕 两种API服务器

**标准API** (`api-server.js`)：
- 同步响应，等待任务完成后返回结果
- 适合快速任务（<30秒）
- 可能会超时

**SSE API** (`api-server-sse.js`) **←推荐**：
- ✅ 异步任务，立即返回taskId
- ✅ 实时流式输出，每行stdout/stderr都实时推送
- ✅ 不会超时，适合长时间任务
- ✅ 支持进度显示

👉 **详细使用方法请查看 [SSE_API_GUIDE.md](./SSE_API_GUIDE.md)**

#### 部署到远程服务器

详细步骤请查看 [部署指南](./DEPLOYMENT.md)

**快速开始（SSE API - 推荐）：**

```bash
# 1. 在服务器上安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
vi .env  # 设置API_KEY和ALLOWED_IPS

# 3. 使用PM2启动SSE API服务器
pm2 start ecosystem.config.cjs --only resource-sync-api-sse

# 4. 设置开机自启动
pm2 startup
pm2 save

# 5. 测试（使用HTML客户端）
open examples/sse-client-example.html
```

**如果使用标准API：**

```bash
# 启动标准API服务器
pm2 start ecosystem.config.cjs --only resource-sync-api
```

---

## 🚀 像之前一样简单使用SSE API

**不想写复杂的客户端代码？我们提供了简化脚本！**

### 快速使用（推荐）

```bash
# 1. 配置环境变量（一次性）
export API_URL=http://your-server:3000
export API_KEY=your-api-key

# 2. 使用Node.js包装脚本（像之前一样简单！）
node scripts/run-task.js check-integrity v885
node scripts/run-task.js sync-facebook v885
node scripts/run-task.js full-sync v885 --skip-check

# 或使用Bash脚本（不需要Node.js）
chmod +x scripts/run-task.sh
./scripts/run-task.sh check-integrity v885
```

**特点：**
- ✅ 像之前一样简单（一行命令）
- ✅ 实时看到脚本输出
- ✅ 不会超时
- ✅ 有进度显示

👉 **详细说明请查看 [简单使用指南](./SIMPLE_USAGE.md)**

---

#### API调用示例（如果需要自己写客户端）

```bash
# 检查资源完整性
curl -X POST http://your-server:3000/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885"}'

# 完整发布流程
curl -X POST http://your-server:3000/api/full-sync \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885", "skipCheck": false}'
```

#### 安全性保障

- ✅ **API Key认证** - 每个请求必须携带正确的API Key
- ✅ **IP白名单** - 只允许指定IP访问
- ✅ **速率限制** - 防止暴力破解和DDoS
- ✅ **请求日志** - 所有请求都被记录
- ✅ **Nginx反向代理** - 可配置HTTPS加密

### 3. MCP 方式

#### 🆕 两种MCP服务器

**本地MCP** (`mcp-server.js`) - 仅限本地：
- 在本地执行脚本
- 适合脚本就在本地的场景
- 可能有超时问题

**远程MCP** (`mcp-server-remote.js`) **←推荐**：
- ✅ 调用远程SSE API服务器
- ✅ 在Claude Desktop中使用，体验好
- ✅ 支持长时间任务，不超时
- ✅ 实时显示脚本输出

👉 **详细配置请查看 [MCP远程配置指南](./MCP_REMOTE_SETUP.md)**

#### 配置远程MCP（推荐）

在你的 Claude Desktop 配置文件中添加：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "slots-resource-sync-remote": {
      "command": "node",
      "args": ["/本地路径/slots-resource-sync/src/mcp-server-remote.js"],
      "env": {
        "API_URL": "http://your-server:3000",
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

**使用示例**（在Claude Desktop中）：
```
你：请帮我检查v885版本的资源完整性

Claude：好的，我来帮你检查...
[实时显示脚本输出]
✅ 检查完成！所有资源正常。
```

---

#### 配置本地MCP（传统方式）

在你的 AI 工具配置文件中添加：

**对于 Claude Desktop (macOS):**

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "slots-resource-sync": {
      "command": "node",
      "args": ["/path/to/slots-resource-sync/src/mcp-server.js"]
    }
  }
}
```

**对于 Claude Desktop (Windows):**

编辑 `%APPDATA%\Claude\claude_desktop_config.json`

#### 可用的 MCP 工具

1. **check_resource_integrity** - 检查资源完整性
   - 参数: `version` (必需)

2. **sync_facebook_resources** - 同步Facebook资源
   - 参数: `version` (必需)

3. **sync_native_resources** - 同步Native资源
   - 参数: `version` (必需)

4. **update_reuse_version** - 更新Reuse版本
   - 参数: `version` (必需), `nginxReuseVersion` (可选)

5. **full_sync_pipeline** - 完整发布流程
   - 参数: `version` (必需), `skipCheck` (可选)

#### 在 AI 工具中使用示例

```
请帮我检查 v885 版本的资源完整性

请同步 v885 的 Facebook 资源

请执行 v885 的完整发布流程
```

## 项目结构

```
slots-resource-sync/
├── config/
│   └── default.json          # 配置文件
├── src/
│   ├── cli.js               # CLI 命令行工具
│   ├── mcp-server.js        # MCP 服务器
│   ├── tasks/
│   │   └── index.js         # 核心任务逻辑
│   └── utils/
│       ├── logger.js        # 日志工具
│       ├── config.js        # 配置加载
│       └── version.js       # 版本号处理
├── logs/                    # 日志目录（自动创建）
├── package.json
└── README.md
```

## 日志

所有操作都会记录到 `logs/` 目录：

- `combined.log` - 所有日志
- `error.log` - 仅错误日志

## 安全注意事项

1. **权限**: 确保运行用户有权限访问所有配置中的路径
2. **备份**: 执行 `update-reuse` 前建议先备份数据
3. **验证**: 建议先在测试环境验证所有命令

## 版本号格式

支持的版本号格式：
- `v885` (推荐)
- `885`

版本号计算示例：
- `v885 - 2 = v883`
- `v1000 - 2 = v998`

## 错误处理

- CLI 模式：失败时会显示错误信息并退出（exit code 1）
- MCP 模式：返回包含错误详情的 JSON 响应
- 所有错误都会记录到日志文件

## 常见问题

### Q: 如何在本地测试？

A: 修改 `config/default.json` 中的路径，指向本地测试目录。

### Q: 版本号计算错误怎么办？

A: 使用 `update-reuse` 命令的 `-n` 参数手动指定 nginx 版本号。

### Q: 任务执行失败后如何恢复？

A: 查看 `logs/error.log` 了解详情，根据具体情况手动回滚或重试。

## 开发

### 添加新任务

1. 在 `src/tasks/index.js` 中实现任务函数
2. 在 `src/cli.js` 中添加 CLI 命令
3. 在 `src/mcp-server.js` 中添加 MCP 工具定义

### 运行测试

```bash
npm test
```

## License

ISC
