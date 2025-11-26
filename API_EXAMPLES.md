# API 调用示例

本文档提供HTTP API的详细调用示例。

## 前置条件

1. 服务器已部署并启动API服务
2. 已设置API_KEY
3. 你的IP在白名单中（或白名单为*）

## 基础调用

### 健康检查

```bash
curl http://your-server:3000/health
```

**响应：**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-26T14:30:00.000Z"
}
```

### 获取API文档

```bash
curl http://your-server:3000/api \
  -H "X-API-Key: your-api-key"
```

## 任务调用

### 1. 检查资源完整性

```bash
curl -X POST http://your-server:3000/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "version": "v885"
  }'
```

**成功响应：**
```json
{
  "success": true,
  "message": "所有资源检查通过",
  "details": [
    {
      "name": "Check iOS resources",
      "success": true,
      "stdout": "Checking iOS manifest...\nAll files matched successfully.\nTotal files checked: 1245",
      "stderr": null
    },
    {
      "name": "Check Android resources",
      "success": true,
      "stdout": "Checking Android manifest...\nAll files matched successfully.\nTotal files checked: 1387",
      "stderr": null
    },
    {
      "name": "Match version",
      "success": true,
      "stdout": "Matching version wtc v885\nVersion check passed",
      "stderr": null
    }
  ]
}
```

### 2. 同步Facebook资源

```bash
curl -X POST http://your-server:3000/api/sync-facebook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "version": "v885"
  }'
```

**成功响应：**
```json
{
  "success": true,
  "message": "Facebook资源同步成功",
  "stdout": "Starting Facebook client sync for wtc v885...\nFacebook sync completed successfully.",
  "stderr": null
}
```

### 3. 同步Native资源

```bash
curl -X POST http://your-server:3000/api/sync-native \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "version": "v885"
  }'
```

### 4. 更新Reuse版本

```bash
# 自动计算nginx版本（version - 2）
curl -X POST http://your-server:3000/api/update-reuse \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "version": "v885"
  }'

# 手动指定nginx版本
curl -X POST http://your-server:3000/api/update-reuse \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "version": "v885",
    "nginxReuseVersion": "v883"
  }'
```

**成功响应：**
```json
{
  "success": true,
  "message": "Reuse版本更新成功",
  "nginxReuseVersion": "v883",
  "details": [
    {
      "name": "Move wtc version to reuse",
      "success": true,
      "stdout": null,
      "stderr": null
    },
    {
      "name": "Move wtc_fb version to reuse",
      "success": true,
      "stdout": null,
      "stderr": null
    },
    {
      "name": "Move nginx wtc to reuse",
      "success": true,
      "stdout": null,
      "stderr": null
    },
    {
      "name": "Move nginx wtc_fb to reuse",
      "success": true,
      "stdout": null,
      "stderr": null
    }
  ]
}
```

### 5. 完整发布流程

```bash
curl -X POST http://your-server:3000/api/full-sync \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "version": "v885",
    "skipCheck": false
  }'
```

**成功响应：**
```json
{
  "success": true,
  "message": "完整发布流程执行成功",
  "results": [
    {
      "step": "检查资源完整性",
      "success": true,
      "details": [...]
    },
    {
      "step": "同步Facebook资源",
      "success": true,
      "stdout": "...",
      "stderr": null
    },
    {
      "step": "同步Native资源",
      "success": true,
      "stdout": "...",
      "stderr": null
    }
  ]
}
```

## 错误响应

### 401 - 未授权（API Key错误）

```json
{
  "success": false,
  "error": "Unauthorized: Invalid API key"
}
```

### 403 - 禁止访问（IP不在白名单）

```json
{
  "success": false,
  "error": "Access denied: IP not in whitelist"
}
```

### 400 - 参数错误

```json
{
  "success": false,
  "error": "Missing required parameter: version"
}
```

### 429 - 请求过多

```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

### 500 - 服务器错误

```json
{
  "success": false,
  "error": "Invalid version format: v88. Expected format: v123 or 123"
}
```

## 在脚本中使用

### Bash脚本

```bash
#!/bin/bash

API_URL="http://your-server:3000"
API_KEY="your-api-key"
VERSION="v885"

# 检查资源
echo "正在检查资源完整性..."
response=$(curl -s -X POST "$API_URL/api/check-integrity" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{\"version\": \"$VERSION\"}")

# 解析结果
success=$(echo "$response" | jq -r '.success')

if [ "$success" == "true" ]; then
  echo "✅ 资源检查通过"

  # 继续同步
  echo "正在同步Facebook资源..."
  curl -X POST "$API_URL/api/sync-facebook" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"version\": \"$VERSION\"}"
else
  echo "❌ 资源检查失败"
  echo "$response" | jq .
  exit 1
fi
```

### Python脚本

```python
import requests
import json

API_URL = "http://your-server:3000"
API_KEY = "your-api-key"
VERSION = "v885"

def check_integrity(version):
    response = requests.post(
        f"{API_URL}/api/check-integrity",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY
        },
        json={"version": version}
    )
    return response.json()

def sync_facebook(version):
    response = requests.post(
        f"{API_URL}/api/sync-facebook",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": API_KEY
        },
        json={"version": version}
    )
    return response.json()

# 执行任务
print("检查资源完整性...")
result = check_integrity(VERSION)

if result['success']:
    print("✅ 资源检查通过")
    print("同步Facebook资源...")
    sync_result = sync_facebook(VERSION)
    print(json.dumps(sync_result, indent=2))
else:
    print("❌ 资源检查失败")
    print(json.dumps(result, indent=2))
```

### Node.js脚本

```javascript
const axios = require('axios');

const API_URL = 'http://your-server:3000';
const API_KEY = 'your-api-key';
const VERSION = 'v885';

async function checkIntegrity(version) {
  const response = await axios.post(
    `${API_URL}/api/check-integrity`,
    { version },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    }
  );
  return response.data;
}

async function syncFacebook(version) {
  const response = await axios.post(
    `${API_URL}/api/sync-facebook`,
    { version },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    }
  );
  return response.data;
}

async function main() {
  try {
    console.log('检查资源完整性...');
    const checkResult = await checkIntegrity(VERSION);

    if (checkResult.success) {
      console.log('✅ 资源检查通过');
      console.log('同步Facebook资源...');
      const syncResult = await syncFacebook(VERSION);
      console.log(JSON.stringify(syncResult, null, 2));
    } else {
      console.log('❌ 资源检查失败');
      console.log(JSON.stringify(checkResult, null, 2));
    }
  } catch (error) {
    console.error('错误:', error.message);
  }
}

main();
```

## 测试工具

### 使用自带测试脚本

```bash
# 设置环境变量
export API_URL=http://your-server:3000
export API_KEY=your-api-key
export VERSION=v885

# 运行测试
./scripts/test-api.sh
```

### 使用Postman

1. 导入API端点
2. 设置Header: `X-API-Key: your-api-key`
3. 设置Body为JSON格式
4. 发送请求

### 使用HTTPie

```bash
# 安装HTTPie
pip install httpie

# 调用API
http POST http://your-server:3000/api/check-integrity \
  X-API-Key:your-api-key \
  version=v885
```

## 注意事项

1. **API Key安全**
   - 不要在代码中硬编码API Key
   - 使用环境变量存储
   - 定期更换API Key

2. **错误处理**
   - 总是检查 `success` 字段
   - 记录完整的响应用于调试
   - 实现重试机制（针对网络错误）

3. **超时设置**
   - 某些任务可能需要较长时间
   - 设置合理的超时时间（建议5分钟）

4. **并发控制**
   - 同一时间不要运行多个相同任务
   - 注意速率限制（15分钟100次请求）
