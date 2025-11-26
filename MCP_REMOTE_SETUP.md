# MCP远程服务器配置指南

## 🎯 架构说明

```
┌─────────────────┐         ┌─────────────────┐         ┌──────────────────┐
│  Claude Desktop │  MCP    │  本地MCP服务器   │   HTTP   │ 远程SSE API服务器 │
│   (你的电脑)     │ ←────→ │ mcp-server-      │ ←──────→ │  (远程服务器)     │
│                 │         │    remote.js     │   SSE    │   端口:3000      │
└─────────────────┘         └─────────────────┘         └──────────────────┘
```

**工作流程：**
1. 你在Claude Desktop中输入："请检查v885版本的资源完整性"
2. Claude调用本地MCP服务器的工具
3. 本地MCP服务器通过HTTP连接到远程API服务器
4. 远程服务器执行任务，通过SSE实时推送输出
5. 本地MCP服务器接收输出，返回给Claude Desktop
6. 你在Claude Desktop中看到实时输出

**优点：**
- ✅ 在Claude Desktop中使用，交互式体验好
- ✅ 调用远程服务器，不需要在本地执行脚本
- ✅ 支持长时间任务，不会超时
- ✅ 实时看到脚本输出

---

## 🚀 快速配置

### 步骤1：在远程服务器上启动SSE API

```bash
# SSH到远程服务器
ssh user@your-server

# 进入项目目录
cd /home/ec2-user/slots-resource-sync

# 启动SSE API服务器
pm2 start ecosystem.config.cjs --only resource-sync-api-sse

# 查看状态
pm2 status
pm2 logs resource-sync-api-sse
```

### 步骤2：在本地电脑上配置MCP

#### macOS配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "slots-resource-sync-remote": {
      "command": "node",
      "args": [
        "/Users/daiyunchao/Documents/works/slots-resource-sync/src/mcp-server-remote.js"
      ],
      "env": {
        "API_URL": "https://slotssaga-v401.me2zengame.com/resource-sync-api",
        "API_KEY": "c878313eb2c4b29f6cd45c443501d4a3ec48a03710168beec2a691c24fc5f67e"
      }
    }
  }
}
```

**重要提示：**
- 将 `/Users/你的用户名/Documents/works/slots-resource-sync` 改为你本地项目的实际路径
- 将 `your-server-ip` 改为你远程服务器的IP地址
- 将 `your-api-key` 改为你的实际API Key

#### Windows配置

编辑 `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "slots-resource-sync-remote": {
      "command": "node",
      "args": [
        "C:\\path\\to\\slots-resource-sync\\src\\mcp-server-remote.js"
      ],
      "env": {
        "API_URL": "http://your-server-ip:3000",
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### 步骤3：在本地安装依赖

```bash
cd /Users/你的用户名/Documents/works/slots-resource-sync

# 安装依赖（如果还没安装）
npm install
```

需要的依赖：
- `@modelcontextprotocol/sdk`
- `node-fetch`
- `eventsource`

这些依赖在 `package.json` 中已经包含了。

### 步骤4：重启Claude Desktop

1. 完全退出Claude Desktop（不是最小化）
2. 重新打开Claude Desktop
3. 在设置中查看MCP服务器状态，应该看到 `slots-resource-sync-remote` 已连接

### 步骤5：测试使用

在Claude Desktop中输入：

```
请帮我检查v885版本的资源完整性
```

或者：

```
请执行v886的完整发布流程
```

Claude会自动调用远程MCP工具，你会看到实时输出！

---

## 📝 可用的MCP工具

在Claude Desktop中，这些工具会自动可用：

### 1. check_resource_integrity_remote
检查资源完整性（远程执行）

**使用示例：**
```
请检查v885版本的资源完整性
帮我验证v886的资源是否完整
```

### 2. sync_facebook_resources_remote
同步Facebook资源（远程执行）

**使用示例：**
```
请同步v885的Facebook资源
帮我发布v886的FB版本
```

### 3. sync_native_resources_remote
同步Native资源（远程执行）

**使用示例：**
```
请同步v885的Native资源
帮我发布v886的Native版本
```

### 4. update_reuse_version_remote
更新Reuse版本（远程执行）

**使用示例：**
```
请更新v885的reuse版本
帮我把v886移动到reuse_version
```

### 5. full_sync_pipeline_remote
完整发布流程（远程执行）

**使用示例：**
```
请执行v885的完整发布流程
帮我发布v886版本（包括检查和同步）
请发布v886，但跳过检查步骤
```

---

## 🔍 查看MCP日志

如果遇到问题，可以查看MCP服务器日志：

### macOS/Linux

```bash
# MCP服务器的日志会输出到 stderr
# 在 Claude Desktop 日志中查看：
tail -f ~/Library/Logs/Claude/mcp*.log
```

### 手动测试MCP服务器

```bash
cd /Users/你的用户名/Documents/works/slots-resource-sync

# 设置环境变量
export API_URL=http://your-server:3000
export API_KEY=your-api-key

# 运行MCP服务器（会等待stdin输入）
node src/mcp-server-remote.js

# 发送测试请求（需要符合MCP协议）
```

---

## 🆚 三种MCP服务器对比

| 特性 | mcp-server.js<br>(本地) | mcp-server-remote.js<br>(远程) |
|------|------------------------|-------------------------------|
| **运行位置** | 在本地执行脚本 | 调用远程API |
| **适用场景** | 脚本在本地 | 脚本在远程服务器 |
| **超时风险** | ⚠️ 长任务可能有问题 | ✅ 无超时风险 |
| **实时输出** | ⚠️ 有限 | ✅ 完整实时输出 |
| **网络要求** | 无 | 需要连接远程服务器 |
| **配置复杂度** | 简单 | 需要配置API_URL和API_KEY |

---

## 🛠️ 故障排查

### 问题1：MCP服务器未连接

**检查：**

```bash
# 1. 验证配置文件路径是否正确
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 2. 验证Node.js可用
node --version

# 3. 验证MCP服务器文件存在
ls -la /path/to/slots-resource-sync/src/mcp-server-remote.js

# 4. 手动测试运行
cd /path/to/slots-resource-sync
export API_URL=http://your-server:3000
export API_KEY=your-api-key
node src/mcp-server-remote.js
```

### 问题2：无法连接到远程API

**检查：**

```bash
# 1. 测试网络连接
curl http://your-server:3000/health

# 2. 验证API Key
curl http://your-server:3000/api \
  -H "X-API-Key: your-api-key"

# 3. 检查防火墙
# 确保端口3000可以从本地访问

# 4. 检查远程服务器状态
ssh user@your-server
pm2 status
pm2 logs resource-sync-api-sse
```

### 问题3：任务执行失败

**检查远程服务器日志：**

```bash
# SSH到远程服务器
ssh user@your-server

# 查看PM2日志
pm2 logs resource-sync-api-sse --lines 50

# 查看应用日志
cd /home/ec2-user/slots-resource-sync
tail -f logs/error.log
tail -f logs/combined.log
```

### 问题4：依赖缺失

```bash
# 在本地项目目录
cd /path/to/slots-resource-sync

# 检查依赖
npm list @modelcontextprotocol/sdk
npm list eventsource
npm list node-fetch

# 重新安装
npm install
```

---

## 📋 完整设置检查清单

### 远程服务器：

- [ ] Node.js >= 16.14.0 已安装
- [ ] 项目代码已上传
- [ ] `npm install` 已执行
- [ ] `.env` 文件已配置（API_KEY, ALLOWED_IPS, TRUST_PROXY）
- [ ] SSE API服务器已启动：`pm2 status` 显示 `resource-sync-api-sse` 运行中
- [ ] 防火墙已开放3000端口
- [ ] 健康检查通过：`curl http://localhost:3000/health`

### 本地电脑：

- [ ] Node.js >= 16.14.0 已安装
- [ ] 项目代码已克隆到本地
- [ ] `npm install` 已执行
- [ ] Claude Desktop 已安装
- [ ] MCP配置文件已正确编辑
- [ ] API_URL 和 API_KEY 已正确设置
- [ ] Claude Desktop 已重启
- [ ] 可以从本地访问远程服务器：`curl http://your-server:3000/health`

---

## 🎉 开始使用

配置完成后，在Claude Desktop中直接对话：

```
你：请帮我检查v885版本的资源完整性

Claude：好的，我来帮你检查v885版本的资源完整性。

[调用 check_resource_integrity_remote 工具]

📡 Connected to remote task stream

🚀 Task started: 123e4567-e89b-12d3-a456-426614174000
   Type: check-integrity
   Status: running

📋 [15:30:45] Executing: cd /home/ec2-user/match && ./match ...
   [15:30:46] Checking iOS manifest...
   [15:30:47] All files matched successfully.
   [15:30:47] Total files checked: 1245

📊 Progress: 33% | Status: running

📋 [15:30:48] Executing: cd /home/ec2-user/match && ./match ...
   [15:30:49] Checking Android manifest...
   [15:30:50] All files matched successfully.
   [15:30:50] Total files checked: 1387

📊 Progress: 100% | Status: completed

────────────────────────────────────────────────────────────
🎉 Task Completed Successfully!
────────────────────────────────────────────────────────────

检查结果：v885版本的所有资源检查通过！
- iOS资源：✅ 完整 (1245个文件)
- Android资源：✅ 完整 (1387个文件)
- 版本匹配：✅ 通过
```

---

## 💡 提示和技巧

### 1. 创建快捷方式

在 `~/.zshrc` 或 `~/.bashrc` 中添加：

```bash
# 重启Claude Desktop的快捷命令
alias restart-claude='killall Claude && open -a Claude'
```

### 2. 查看MCP状态

在Claude Desktop的设置中，可以查看MCP服务器的连接状态。

### 3. 多个MCP服务器

你可以同时配置本地版和远程版：

```json
{
  "mcpServers": {
    "slots-resource-sync-local": {
      "command": "node",
      "args": ["/path/to/src/mcp-server.js"]
    },
    "slots-resource-sync-remote": {
      "command": "node",
      "args": ["/path/to/src/mcp-server-remote.js"],
      "env": {
        "API_URL": "http://your-server:3000",
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

Claude会自动选择合适的工具（远程版工具名称带 `_remote` 后缀）。

---

## 🔐 安全建议

1. **不要在公开网络暴露API端口**
   - 使用VPN
   - 或使用SSH隧道：
     ```bash
     ssh -L 3000:localhost:3000 user@your-server
     # 然后在本地使用 API_URL=http://localhost:3000
     ```

2. **使用强API Key**
   ```bash
   # 生成安全的API Key
   node scripts/generate-api-key.js
   ```

3. **配置IP白名单**
   ```bash
   # 在远程服务器的 .env 中
   ALLOWED_IPS=你的本地公网IP
   ```

4. **使用HTTPS**
   - 配置Nginx反向代理
   - 使用SSL证书

---

## 📚 相关文档

- [SSE API详细指南](./SSE_API_GUIDE.md)
- [简单使用指南](./SIMPLE_USAGE.md)
- [部署指南](./DEPLOYMENT.md)

---

**现在你可以在Claude Desktop中愉快地管理远程服务器上的资源同步任务了！** 🎉
