# API 快速使用指南（5分钟上手）

## 🎯 核心概念（1分钟理解）

```
API Key = 你家的钥匙
- 生成一次，长期使用
- 不需要每次申请
- 不会过期
```

> 💡 **系统要求**：Node 16.14.0+ (支持老服务器)

## ⚡ 3步开始使用

### 1️⃣ 生成API Key（只需一次）

```bash
node scripts/generate-api-key.js
```

**得到输出：**
```
API_KEY=Kx7mN2pQ9vRs4Yt8
```

### 2️⃣ 配置到服务器

```bash
# 在服务器上编辑.env
vi .env

# 粘贴
API_KEY=Kx7mN2pQ9vRs4Yt8
ALLOWED_IPS=你的公网IP  # 运行 curl ifconfig.me 获取

# 启动服务
pm2 start ecosystem.config.cjs
```

### 3️⃣ 调用API

```bash
# 每次请求都带上这个固定的Key
curl -X POST http://your-server:3000/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Kx7mN2pQ9vRs4Yt8" \
  -d '{"version": "v885"}'
```

**就这样！** 这个Key会一直有效，不需要每次申请。

## 📝 保存为快捷命令

**创建配置文件：**
```bash
# ~/.resource-sync-config
export API_URL="http://your-server:3000"
export API_KEY="Kx7mN2pQ9vRs4Yt8"
```

**创建快捷函数：**
```bash
# ~/.bashrc 或 ~/.zshrc 添加
source ~/.resource-sync-config

function rs-check() {
  curl -s -X POST "$API_URL/api/check-integrity" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"version\": \"$1\"}" | jq .
}

function rs-sync() {
  curl -s -X POST "$API_URL/api/full-sync" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"version\": \"$1\", \"skipCheck\": false}" | jq .
}
```

**使用：**
```bash
rs-check v886
rs-sync v886
```

## 🔑 Key管理要点

### ✅ DO（应该做）
- 生成一次，长期使用
- 保存在安全的地方（.env文件）
- 定期更换（每3-6个月）

### ❌ DON'T（不要做）
- 不要每次申请新token
- 不要提交到Git
- 不要在公开渠道分享

## 📞 遇到问题？

### 401错误
```bash
# 检查Key是否正确
echo $API_KEY
cat .env | grep API_KEY
```

### 403错误
```bash
# 检查IP白名单
curl ifconfig.me  # 查看你的IP
cat .env | grep ALLOWED_IPS
```

### 连接超时
```bash
# 检查服务器
pm2 status
pm2 logs resource-sync-api
```

## 📚 需要详细说明？

- [完整使用指南](./HOW_TO_USE_API.md) - 包含所有细节
- [API示例](./API_EXAMPLES.md) - 各种编程语言示例
- [部署指南](./DEPLOYMENT.md) - 服务器部署步骤

---

**记住：API Key是固定的，生成一次即可！**
