# 简单使用指南 - 像之前一样简单！

## 🎯 三种使用方式

### 方式1️⃣：使用Node.js包装脚本（推荐，实时输出）

**像之前一样简单，但支持长时间任务和实时输出！**

```bash
# 配置环境变量（一次性）
export API_URL=http://your-server:3000
export API_KEY=your-api-key

# 使用（就像之前一样简单！）
node scripts/run-task.js check-integrity v885
node scripts/run-task.js sync-facebook v885
node scripts/run-task.js sync-native v885
node scripts/run-task.js full-sync v885
node scripts/run-task.js full-sync v885 --skip-check
```

**优点：**
- ✅ 像之前一样简单（一行命令）
- ✅ 实时看到脚本输出
- ✅ 不会超时
- ✅ 有进度显示

**输出示例：**
```
╔════════════════════════════════════════════════════════════╗
║          Resource Sync Task Runner (SSE)                  ║
╚════════════════════════════════════════════════════════════╝

📍 API Server: http://your-server:3000
📝 Task Type:  check-integrity
📦 Version:    v885

🚀 Creating task...
✅ Task created: 123e4567-e89b-12d3-a456-426614174000

────────────────────────────────────────────────────────────
📡 Connected to task stream

📋 [15:30:45] Executing: cd /home/ec2-user/match && ./match ...
   [15:30:46] Checking iOS manifest...
   [15:30:47] All files matched successfully.
   [15:30:47] Total files checked: 1245

📊 Status: running | Progress: 33%

📋 [15:30:48] Executing: cd /home/ec2-user/match && ./match ...
   [15:30:49] Checking Android manifest...
   [15:30:50] All files matched successfully.

📊 Status: completed | Progress: 100%

────────────────────────────────────────────────────────────
🎉 Task Completed Successfully!
────────────────────────────────────────────────────────────

✅ All done!
```

---

### 方式2️⃣：使用Bash脚本（不需要Node.js，但更新稍慢）

**如果服务器没有Node.js，使用纯Bash脚本：**

```bash
# 配置环境变量（一次性）
export API_URL=http://your-server:3000
export API_KEY=your-api-key

# 添加执行权限（首次使用）
chmod +x scripts/run-task.sh

# 使用
./scripts/run-task.sh check-integrity v885
./scripts/run-task.sh sync-facebook v885
./scripts/run-task.sh full-sync v885
```

**优点：**
- ✅ 不需要Node.js
- ✅ 不会超时
- ✅ 一行命令

**缺点：**
- ⚠️ 使用轮询方式，每2秒更新一次（不是真正的实时）
- ⚠️ 日志显示较少

---

### 方式3️⃣：继续使用标准API（最简单，但有超时风险）

**如果你的任务通常很快完成（<2分钟），可以继续用之前的方式：**

```bash
# 在服务器上启动标准API（不是SSE）
pm2 stop resource-sync-api-sse
pm2 start ecosystem.config.cjs --only resource-sync-api

# 使用方式完全不变
curl -X POST http://your-server:3000/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885"}'
```

**优点：**
- ✅ 最简单，一行curl
- ✅ 不需要任何额外工具

**缺点：**
- ❌ 长时间任务会超时
- ❌ 看不到实时输出
- ❌ 没有进度显示

---

## 📦 快速设置

### 在远程服务器上：

```bash
cd /home/ec2-user/slots-resource-sync

# 1. 安装依赖
npm install

# 2. 启动SSE API服务器
pm2 start ecosystem.config.cjs --only resource-sync-api-sse

# 3. 查看状态
pm2 logs resource-sync-api-sse
```

### 在本地使用：

#### 选项A：Node.js脚本（推荐）

```bash
# 1. 克隆或下载项目到本地
cd /path/to/local/slots-resource-sync

# 2. 配置环境变量
export API_URL=http://your-remote-server:3000
export API_KEY=your-api-key

# 3. 使用！
node scripts/run-task.js check-integrity v885
```

#### 选项B：Bash脚本

```bash
# 1. 下载脚本到本地
scp your-server:/path/to/slots-resource-sync/scripts/run-task.sh ~/run-task.sh
chmod +x ~/run-task.sh

# 2. 配置环境变量
export API_URL=http://your-remote-server:3000
export API_KEY=your-api-key

# 3. 使用！
~/run-task.sh check-integrity v885
```

#### 选项C：创建别名（最方便）

在 `~/.bashrc` 或 `~/.zshrc` 中添加：

```bash
# 配置
export API_URL=http://your-remote-server:3000
export API_KEY=your-api-key

# 别名
alias rs-check='node /path/to/scripts/run-task.js check-integrity'
alias rs-sync-fb='node /path/to/scripts/run-task.js sync-facebook'
alias rs-sync-native='node /path/to/scripts/run-task.js sync-native'
alias rs-full-sync='node /path/to/scripts/run-task.js full-sync'

# 使用别名
rs-check v885
rs-full-sync v885 --skip-check
```

---

## 🔄 从标准API迁移到SSE API

| 之前（标准API） | 现在（SSE API - 推荐） |
|----------------|----------------------|
| `curl -X POST http://server:3000/api/check-integrity ...` | `node scripts/run-task.js check-integrity v885` |
| `curl -X POST http://server:3000/api/sync-facebook ...` | `node scripts/run-task.js sync-facebook v885` |
| `curl -X POST http://server:3000/api/full-sync ...` | `node scripts/run-task.js full-sync v885` |

**区别：**
- ✅ 命令更简单（不需要写Header和JSON）
- ✅ 实时看到输出
- ✅ 不会超时
- ⚠️ 需要Node.js环境（或使用Bash脚本）

---

## 📊 对比总结

| 方式 | 命令复杂度 | 需要工具 | 实时输出 | 超时风险 | 推荐度 |
|-----|-----------|---------|---------|---------|--------|
| **Node.js脚本** | ⭐ 简单 | Node.js | ✅ 是 | ✅ 无 | ⭐⭐⭐⭐⭐ |
| **Bash脚本** | ⭐ 简单 | curl | ⚠️ 延迟 | ✅ 无 | ⭐⭐⭐⭐ |
| **标准API** | ⭐⭐ 一般 | curl | ❌ 否 | ❌ 有 | ⭐⭐ |
| **直接SSE** | ⭐⭐⭐ 复杂 | 编程 | ✅ 是 | ✅ 无 | ⭐⭐⭐ |

---

## 💡 我的建议

### 如果你经常使用，推荐：
```bash
# 1. 使用Node.js脚本
# 2. 创建别名
# 3. 一行命令搞定，像之前一样简单！

rs-check v885
rs-full-sync v886
```

### 如果只是偶尔使用，推荐：
```bash
# 直接运行脚本
node scripts/run-task.js check-integrity v885
```

### 如果任务很快（<2分钟），可以：
```bash
# 继续用标准API，最简单
curl -X POST http://server:3000/api/check-integrity ...
```

---

## 🆘 遇到问题？

### 问题1：找不到node命令

```bash
# 安装Node.js（使用nvm）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 16
nvm use 16

# 或使用Bash脚本（不需要Node.js）
./scripts/run-task.sh check-integrity v885
```

### 问题2：权限被拒绝

```bash
# Bash脚本需要执行权限
chmod +x scripts/run-task.sh
```

### 问题3：API_KEY未设置

```bash
# 方式A：环境变量
export API_KEY=your-api-key

# 方式B：写入 ~/.bashrc（永久）
echo 'export API_KEY=your-api-key' >> ~/.bashrc
source ~/.bashrc

# 方式C：直接修改脚本中的默认值
```

---

## 🎉 开始使用

```bash
# 1. 配置一次
export API_URL=http://your-server:3000
export API_KEY=your-api-key

# 2. 使用（就这么简单！）
node scripts/run-task.js check-integrity v885

# 3. 看到实时输出，不会超时，完美！✨
```
