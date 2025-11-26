# SSE API 使用指南

## 🚀 什么是SSE？

**SSE (Server-Sent Events)** 是一种服务器向客户端推送实时数据的技术，非常适合长时间运行的任务。

### 为什么使用SSE？

**问题**：资源同步脚本执行时间很长（几分钟甚至更长），使用传统HTTP请求会导致：
- ⏱️ **请求超时**：HTTP请求有超时限制，长时间任务会超时
- 🔇 **无实时反馈**：必须等待任务完成才能看到结果
- 📊 **无进度显示**：不知道任务执行到哪一步

**解决方案**：SSE API
- ✅ **异步任务**：立即返回taskId，任务在后台执行
- ✅ **实时流式输出**：脚本的每一行输出都实时推送到客户端
- ✅ **进度跟踪**：实时显示任务进度
- ✅ **不超时**：SSE连接可以长时间保持

---

## 📦 部署SSE API服务器

### 1. 安装依赖

```bash
cd /home/ec2-user/slots-resource-sync
npm install
```

新增依赖：
- `eventsource`: SSE客户端库（用于Node.js示例）
- `node-fetch`: HTTP客户端（用于Node.js示例）

### 2. 启动SSE API服务器

#### 方式A：直接运行（测试用）

```bash
npm run api:sse

# 或
node src/api-server-sse.js
```

#### 方式B：使用PM2（生产环境推荐）

```bash
# 停止旧的API服务器（如果在运行）
pm2 stop resource-sync-api
pm2 delete resource-sync-api

# 启动SSE API服务器
pm2 start ecosystem.config.cjs --only resource-sync-api-sse

# 查看状态
pm2 status

# 查看日志
pm2 logs resource-sync-api-sse

# 设置开机自启动
pm2 startup
pm2 save
```

### 3. 验证服务启动

```bash
# 健康检查
curl http://localhost:3000/health

# 查看API文档
curl http://localhost:3000/api
```

---

## 🎯 API使用方法

### 工作流程

```
1. 创建任务      → POST /api/tasks/{type}
   ↓
2. 获取taskId    → 立即返回
   ↓
3. 连接SSE流     → GET /api/tasks/{taskId}/stream
   ↓
4. 实时接收输出  → 脚本的每一行stdout/stderr
   ↓
5. 任务完成      → 收到completed事件，连接关闭
```

### 可用的任务类型

| 任务类型 | 端点 | 说明 |
|---------|------|------|
| `check-integrity` | POST /api/tasks/check-integrity | 检查资源完整性 |
| `sync-facebook` | POST /api/tasks/sync-facebook | 同步Facebook资源 |
| `sync-native` | POST /api/tasks/sync-native | 同步Native资源 |
| `update-reuse` | POST /api/tasks/update-reuse | 更新Reuse版本 |
| `full-sync` | POST /api/tasks/full-sync | 完整发布流程 |

---

## 📡 使用示例

### 示例1：使用浏览器（HTML页面）

打开 `examples/sse-client-example.html` 文件：

```bash
# 在本地打开HTML文件
open examples/sse-client-example.html

# 或在服务器上启动一个简单的HTTP服务器
cd examples
python3 -m http.server 8080
# 然后访问 http://your-server:8080/sse-client-example.html
```

**功能：**
- 📋 选择任务类型
- 📝 输入版本号
- 🚀 启动任务
- 📊 实时查看输出
- 📈 显示进度条

### 示例2：使用Node.js客户端

```bash
# 设置环境变量
export API_URL=http://localhost:3000
export API_KEY=your-api-key

# 运行示例
npm run example:sse

# 或指定参数
node examples/sse-client-example.js v885 check-integrity
```

**输出示例：**
```
🚀 Resource Sync API - Node.js SSE Client

API URL: http://localhost:3000
Task Type: check-integrity
Version: v885

📝 Creating task: check-integrity...

✅ Task created successfully!
   Task ID: 123e4567-e89b-12d3-a456-426614174000
   Stream URL: http://localhost:3000/api/tasks/123e4567-e89b-12d3-a456-426614174000/stream

📡 Connecting to SSE stream...

────────────────────────────────────────────────────────────
✅ SSE connection established

📡 Stream connected for task: 123e4567-e89b-12d3-a456-426614174000
   Status: running
   Progress: 0%

📋 [15:30:45] Executing: cd /home/ec2-user/match && ./match -seed ...
   [15:30:46] Checking iOS manifest...
   [15:30:47] All files matched successfully.
   [15:30:47] Total files checked: 1245

📊 Task Update:
   Status: running
   Progress: 33%

📋 [15:30:48] Executing: cd /home/ec2-user/match && ./match -seed ...
   [15:30:49] Checking Android manifest...
   [15:30:50] All files matched successfully.
   [15:30:50] Total files checked: 1387

📊 Task Update:
   Status: completed
   Progress: 100%

────────────────────────────────────────────────────────────
🎉 Task completed successfully!
────────────────────────────────────────────────────────────
```

### 示例3：使用curl + jq（查询任务状态）

```bash
# 1. 创建任务
TASK_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tasks/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885"}')

# 2. 提取taskId
TASK_ID=$(echo $TASK_RESPONSE | jq -r '.taskId')
echo "Task ID: $TASK_ID"

# 3. 查询任务状态
curl -s http://localhost:3000/api/tasks/$TASK_ID/status \
  -H "X-API-Key: your-api-key" | jq .

# 4. 连接SSE流（需要支持SSE的客户端）
# curl不直接支持SSE，需要使用其他工具或编程语言
```

### 示例4：Python客户端

```python
import requests
import sseclient  # pip install sseclient-py
import json

API_URL = "http://localhost:3000"
API_KEY = "your-api-key"
VERSION = "v885"

# 1. 创建任务
response = requests.post(
    f"{API_URL}/api/tasks/check-integrity",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    },
    json={"version": VERSION}
)

data = response.json()
task_id = data['taskId']
print(f"Task created: {task_id}")

# 2. 连接SSE流
stream_url = f"{API_URL}/api/tasks/{task_id}/stream"
response = requests.get(stream_url, stream=True, headers={"X-API-Key": API_KEY})

client = sseclient.SSEClient(response)

# 3. 接收实时输出
for event in client.events():
    data = json.loads(event.data)

    if data['type'] == 'log':
        log = data['log']
        print(f"[{log['level']}] {log['message']}")

    elif data['type'] == 'update':
        task = data['task']
        print(f"Progress: {task['progress']}% - Status: {task['status']}")

        if task['status'] in ['completed', 'failed']:
            print("Task finished!")
            break

    elif data['type'] == 'end':
        break
```

---

## 📊 SSE事件格式

### 连接建立时

```json
{
  "type": "connected",
  "task": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "type": "check-integrity",
    "status": "pending",
    "progress": 0,
    "createdAt": "2025-11-26T10:30:00.000Z"
  }
}
```

### 日志输出

```json
{
  "type": "log",
  "log": {
    "timestamp": "2025-11-26T10:30:01.234Z",
    "level": "stdout",
    "message": "Checking iOS manifest..."
  }
}
```

日志级别：
- `info`: 信息日志
- `stdout`: 脚本标准输出
- `stderr`: 脚本错误输出
- `success`: 成功消息
- `error`: 错误消息

### 任务更新

```json
{
  "type": "update",
  "task": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "running",
    "progress": 50,
    "logs": [...],
    "result": null,
    "error": null
  }
}
```

### 任务完成

```json
{
  "type": "update",
  "task": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "completed",
    "progress": 100,
    "result": {
      "success": true,
      "results": [...]
    },
    "completedAt": "2025-11-26T10:35:00.000Z"
  }
}
```

### 流结束

```json
{
  "type": "end"
}
```

---

## 🔍 任务状态查询API

如果不需要实时输出，只需要查询任务状态：

```bash
# 查询单个任务
curl http://localhost:3000/api/tasks/{taskId}/status \
  -H "X-API-Key: your-api-key"

# 查询所有任务
curl http://localhost:3000/api/tasks \
  -H "X-API-Key: your-api-key"
```

---

## ⚙️ 与标准API的对比

| 特性 | 标准API<br>(`api-server.js`) | SSE API<br>(`api-server-sse.js`) |
|------|------------------------------|-----------------------------------|
| **响应方式** | 同步，等待完成后返回 | 异步，立即返回taskId |
| **超时风险** | ⚠️ 长时间任务会超时 | ✅ 不会超时 |
| **实时输出** | ❌ 无 | ✅ 实时流式推送 |
| **进度显示** | ❌ 无 | ✅ 实时进度更新 |
| **适用场景** | 快速任务（<30秒） | 长时间任务（分钟级） |
| **客户端复杂度** | 简单（普通HTTP） | 中等（需要SSE支持） |
| **端口占用** | 3000 | 3000 |

**推荐：**
- 资源同步任务通常需要几分钟，**推荐使用SSE API**
- 如果只是快速查询或测试，可以使用标准API

---

## 🛠️ 开发和调试

### 查看服务器日志

```bash
# PM2日志
pm2 logs resource-sync-api-sse

# 应用日志
tail -f logs/combined.log
tail -f logs/error.log

# PM2专用日志
tail -f logs/pm2-out-sse.log
tail -f logs/pm2-error-sse.log
```

### 测试SSE连接

```bash
# 使用curl（会持续输出）
curl -N http://localhost:3000/api/tasks/{taskId}/stream \
  -H "X-API-Key: your-api-key"

# 使用websocat（如果安装了）
websocat --http-upgrade http://localhost:3000/api/tasks/{taskId}/stream
```

### 常见问题

#### 1. SSE连接立即断开

**原因**：可能是Nginx缓冲导致

**解决**：在Nginx配置中添加：
```nginx
location /api/tasks/ {
    proxy_pass http://localhost:3000;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header X-Accel-Buffering no;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding off;
}
```

#### 2. 任务状态一直是pending

**原因**：任务执行器出错

**解决**：
```bash
# 查看错误日志
tail -f logs/error.log

# 查看PM2日志
pm2 logs resource-sync-api-sse --err
```

#### 3. 客户端收不到日志

**原因**：脚本输出被缓冲

**解决**：确保脚本使用无缓冲输出
```bash
# Python脚本
python -u your_script.py

# Bash脚本（已支持）
# 使用 spawn 代替 exec，自动支持实时输出
```

---

## 🔐 安全考虑

SSE API使用与标准API相同的安全机制：
- ✅ API Key认证
- ✅ IP白名单
- ✅ 速率限制
- ✅ HTTPS（通过Nginx）

**注意事项：**
1. **不要在公开网络暴露SSE端点**，使用VPN或内网访问
2. **定期清理旧任务**：任务管理器最多保留100个任务记录
3. **监控内存使用**：大量并发SSE连接会占用内存

---

## 📚 更多资源

- [SSE标准规范](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [MDN SSE文档](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

---

## 🎉 总结

SSE API完美解决了长时间任务的问题：

```
传统HTTP:  [===等待3分钟===]  → 超时 ❌

SSE API:   立即返回 → [===实时输出===] → 完成 ✅
           ↓           ↓  ↓  ↓  ↓  ↓
           taskId     进度 日志 状态 结果
```

**开始使用：**
```bash
# 1. 启动服务器
pm2 start ecosystem.config.cjs --only resource-sync-api-sse

# 2. 打开浏览器示例
open examples/sse-client-example.html

# 3. 创建任务并实时查看输出！
```
