# HTTP API 使用指南

## 📌 重要概念澄清

### API Key是固定的，不是每次申请！

**很多人的误解：**
- ❌ 每次使用API前需要先申请token
- ❌ Token有过期时间，需要刷新

**实际情况：**
- ✅ API Key是固定的，生成一次即可长期使用
- ✅ 不会过期（除非你主动更换）
- ✅ 每次请求只需要在Header中携带这个固定的Key

**类比：**
```
API Key 就像你家的钥匙：
- 一次配置，长期使用
- 不需要每次进门前去物业申请
- 只有丢失或安全考虑时才更换
```

## 🚀 快速开始（3步）

### 步骤1：生成固定的API Key（只需一次）

```bash
# 在项目目录运行
node scripts/generate-api-key.js
```

**输出示例：**
```
🔐 生成安全的API Key

─────────────────────────────────────────────────────────

✅ 推荐使用（16位字母数字组合）:

API_KEY=Kx7mN2pQ9vRs4Yt8

请将上面的API_KEY复制到 .env 文件中
─────────────────────────────────────────────────────────

📝 提示：
1. 这个Key是固定的，生成一次即可
2. 每次请求时在Header中携带: X-API-Key: Kx7mN2pQ9vRs4Yt8
3. 不要分享这个Key给任何人
4. 不要提交到Git仓库
5. 定期更换API Key（如每3个月）
```

### 步骤2：配置到服务器

**在服务器上：**

```bash
# 编辑.env文件
vi .env

# 粘贴刚才生成的Key
API_KEY=Kx7mN2pQ9vRs4Yt8

# 设置IP白名单（你本地电脑的公网IP）
ALLOWED_IPS=123.45.67.89

# 保存并退出
```

**重启服务（如果已启动）：**
```bash
pm2 restart resource-sync-api
```

### 步骤3：使用API Key调用

**每次HTTP请求都携带这个固定的Key：**

```bash
curl -X POST http://your-server:3000/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Kx7mN2pQ9vRs4Yt8" \
  -d '{"version": "v885"}'
```

**就这么简单！** 这个Key会一直有效，直到你主动更换。

## 📖 详细使用示例

### 示例1：检查资源完整性

```bash
curl -X POST http://your-server:3000/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Kx7mN2pQ9vRs4Yt8" \
  -d '{
    "version": "v885"
  }'
```

**响应：**
```json
{
  "success": true,
  "message": "所有资源检查通过",
  "details": [
    {
      "name": "Check iOS resources",
      "success": true,
      "stdout": "All files matched successfully.\nTotal files checked: 1245",
      "stderr": null
    },
    ...
  ]
}
```

### 示例2：完整发布流程

```bash
curl -X POST http://your-server:3000/api/full-sync \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Kx7mN2pQ9vRs4Yt8" \
  -d '{
    "version": "v886",
    "skipCheck": false
  }'
```

### 示例3：在脚本中使用

**Bash脚本：**

```bash
#!/bin/bash

# 配置（写在脚本开头，一次配置）
API_URL="http://your-server:3000"
API_KEY="Kx7mN2pQ9vRs4Yt8"  # 固定的Key
VERSION="v886"

# 函数：检查资源
check_resources() {
  echo "正在检查资源..."
  curl -s -X POST "$API_URL/api/check-integrity" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"version\": \"$VERSION\"}" | jq .
}

# 函数：同步Facebook
sync_facebook() {
  echo "正在同步Facebook资源..."
  curl -s -X POST "$API_URL/api/sync-facebook" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"version\": \"$VERSION\"}" | jq .
}

# 执行
check_resources
read -p "检查完成，是否继续同步Facebook? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  sync_facebook
fi
```

**Python脚本：**

```python
import requests
import json

# 配置（写在文件开头，一次配置）
API_URL = "http://your-server:3000"
API_KEY = "Kx7mN2pQ9vRs4Yt8"  # 固定的Key

class ResourceSyncClient:
    def __init__(self, api_url, api_key):
        self.api_url = api_url
        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": api_key  # 每次请求都用同一个Key
        }

    def check_integrity(self, version):
        response = requests.post(
            f"{self.api_url}/api/check-integrity",
            headers=self.headers,
            json={"version": version}
        )
        return response.json()

    def sync_facebook(self, version):
        response = requests.post(
            f"{self.api_url}/api/sync-facebook",
            headers=self.headers,
            json={"version": version}
        )
        return response.json()

    def full_sync(self, version, skip_check=False):
        response = requests.post(
            f"{self.api_url}/api/full-sync",
            headers=self.headers,
            json={"version": version, "skipCheck": skip_check}
        )
        return response.json()

# 使用
client = ResourceSyncClient(API_URL, API_KEY)

# 检查资源
result = client.check_integrity("v886")
print(json.dumps(result, indent=2))

# 完整发布
if result['success']:
    print("\n开始完整发布...")
    full_result = client.full_sync("v886")
    print(json.dumps(full_result, indent=2))
```

**Node.js脚本：**

```javascript
const axios = require('axios');

// 配置（写在文件开头，一次配置）
const API_URL = 'http://your-server:3000';
const API_KEY = 'Kx7mN2pQ9vRs4Yt8';  // 固定的Key

class ResourceSyncClient {
  constructor(apiUrl, apiKey) {
    this.apiUrl = apiUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey  // 每次请求都用同一个Key
    };
  }

  async checkIntegrity(version) {
    const response = await axios.post(
      `${this.apiUrl}/api/check-integrity`,
      { version },
      { headers: this.headers }
    );
    return response.data;
  }

  async syncFacebook(version) {
    const response = await axios.post(
      `${this.apiUrl}/api/sync-facebook`,
      { version },
      { headers: this.headers }
    );
    return response.data;
  }

  async fullSync(version, skipCheck = false) {
    const response = await axios.post(
      `${this.apiUrl}/api/full-sync`,
      { version, skipCheck },
      { headers: this.headers }
    );
    return response.data;
  }
}

// 使用
const client = new ResourceSyncClient(API_URL, API_KEY);

(async () => {
  // 检查资源
  const result = await client.checkIntegrity('v886');
  console.log(JSON.stringify(result, null, 2));

  // 完整发布
  if (result.success) {
    console.log('\n开始完整发布...');
    const fullResult = await client.fullSync('v886');
    console.log(JSON.stringify(fullResult, null, 2));
  }
})();
```

## 🔑 关于API Key的常见问题

### Q1: 需要每次申请token吗？

**A:** 不需要！API Key是固定的。

- ❌ 不需要申请
- ❌ 不会过期
- ✅ 生成一次，长期使用

### Q2: 如何获取API Key？

**A:** 运行生成脚本，一次性生成：

```bash
node scripts/generate-api-key.js
```

复制生成的Key到 `.env` 文件，就完成了。

### Q3: 多久需要更换一次？

**A:** 建议：

- 正常情况：每3-6个月更换一次
- 发现泄露：立即更换
- 人员变动：视情况更换

更换方法：
```bash
# 1. 重新生成
node scripts/generate-api-key.js

# 2. 更新.env文件
vi .env  # 替换API_KEY

# 3. 重启服务
pm2 restart resource-sync-api
```

### Q4: Key可以多人共用吗？

**A:** 可以，但不推荐。

**当前实现：**
- 一个服务器使用一个API Key
- 所有授权用户共用这个Key

**如果需要多用户管理：**

可以扩展为多Key模式（需要修改代码）：

```javascript
// config/api-keys.json
{
  "keys": [
    {"key": "key1", "user": "张三", "permissions": ["read", "write"]},
    {"key": "key2", "user": "李四", "permissions": ["read"]}
  ]
}
```

但对于你的场景（团队内部使用），一个Key通常就够了。

### Q5: Key丢失了怎么办？

**A:** 重新生成并更新：

```bash
# 1. 生成新Key
node scripts/generate-api-key.js

# 2. 更新服务器.env
ssh your-server
cd /home/ec2-user/slots-resource-sync
vi .env  # 替换新Key
pm2 restart resource-sync-api

# 3. 更新本地脚本中的Key
# 更新你的调用脚本中的API_KEY变量
```

### Q6: 请求被拒绝（401错误）？

**A:** 检查Key是否正确：

```bash
# 1. 检查服务器配置
ssh your-server
cat /home/ec2-user/slots-resource-sync/.env | grep API_KEY

# 2. 检查你的请求
# 确保Header中的Key和服务器一致
curl -v http://your-server:3000/api/check-integrity \
  -H "X-API-Key: Kx7mN2pQ9vRs4Yt8" \
  ...

# 3. 查看日志
pm2 logs resource-sync-api
```

### Q7: 如何查看我的公网IP（用于白名单）？

```bash
# 方法1
curl ifconfig.me

# 方法2
curl icanhazip.com

# 方法3
curl https://api.ipify.org
```

然后将这个IP添加到 `.env` 的 `ALLOWED_IPS` 中。

## 🎯 最佳实践

### 1. 安全存储API Key

**不要：**
- ❌ 硬编码在代码中
- ❌ 提交到Git仓库
- ❌ 在公共渠道分享（Slack/Email等）

**应该：**
- ✅ 存储在 `.env` 文件中
- ✅ 使用环境变量
- ✅ 使用密钥管理工具（如AWS Secrets Manager）

### 2. 环境变量方式

```bash
# 设置环境变量
export API_KEY="Kx7mN2pQ9vRs4Yt8"
export API_URL="http://your-server:3000"

# 在脚本中使用
curl -X POST "$API_URL/api/check-integrity" \
  -H "X-API-Key: $API_KEY" \
  -d '{"version": "v885"}'
```

### 3. 配置文件方式（推荐）

```bash
# ~/.resource-sync/config
API_URL=http://your-server:3000
API_KEY=Kx7mN2pQ9vRs4Yt8
```

```bash
# 在脚本中加载
source ~/.resource-sync/config

curl -X POST "$API_URL/api/check-integrity" \
  -H "X-API-Key: $API_KEY" \
  -d '{"version": "v885"}'
```

### 4. 权限管理

```bash
# 保护配置文件
chmod 600 ~/.resource-sync/config
chmod 600 .env
```

## 📱 在AI工具中使用

虽然AI工具可能不直接支持HTTP请求，但可以这样使用：

### 方式1：包装脚本

创建一个简单的命令行工具：

```bash
# ~/.local/bin/rsync-api
#!/bin/bash
source ~/.resource-sync/config

case "$1" in
  check)
    curl -s -X POST "$API_URL/api/check-integrity" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d "{\"version\": \"$2\"}" | jq .
    ;;
  sync-fb)
    curl -s -X POST "$API_URL/api/sync-facebook" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d "{\"version\": \"$2\"}" | jq .
    ;;
  full)
    curl -s -X POST "$API_URL/api/full-sync" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $API_KEY" \
      -d "{\"version\": \"$2\", \"skipCheck\": false}" | jq .
    ;;
  *)
    echo "Usage: rsync-api {check|sync-fb|full} <version>"
    exit 1
    ;;
esac
```

```bash
chmod +x ~/.local/bin/rsync-api

# 使用
rsync-api check v886
rsync-api full v886
```

在AI工具中：
```
你：检查v886的资源
AI：[执行] rsync-api check v886
AI：检查结果显示...
```

## 🔒 安全检查清单

部署前检查：

- [ ] 已生成强API Key（至少16位）
- [ ] API Key已安全存储（.env文件）
- [ ] 已配置IP白名单（不使用*）
- [ ] .env文件权限正确（600）
- [ ] API Key未提交到Git
- [ ] 已设置HTTPS（如果可能）
- [ ] 日志记录正常工作
- [ ] 定期更换计划已制定

## 📞 故障排查

### 问题：401 Unauthorized

```bash
# 检查Key是否匹配
# 服务器端
cat .env | grep API_KEY

# 本地端
echo $API_KEY  # 或检查你的脚本
```

### 问题：403 Forbidden

```bash
# 检查你的公网IP
curl ifconfig.me

# 检查服务器白名单
cat .env | grep ALLOWED_IPS
```

### 问题：连接超时

```bash
# 检查服务器是否运行
pm2 status

# 检查防火墙
sudo firewall-cmd --list-ports

# 检查端口监听
netstat -tulpn | grep 3000
```

## 总结

记住这三点：

1. **API Key是固定的** - 生成一次，长期使用
2. **每次请求都携带** - Header: `X-API-Key: your-key`
3. **妥善保管** - 不分享，不提交，定期更换

就这么简单！
