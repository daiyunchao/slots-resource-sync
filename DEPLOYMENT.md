# 远程部署指南

本文档介绍如何将资源同步工具部署到远程服务器，并通过HTTP API进行访问。

## 目录

- [为什么需要HTTP API](#为什么需要http-api)
- [安全性设计](#安全性设计)
- [部署步骤](#部署步骤)
- [API使用方法](#api使用方法)
- [运维管理](#运维管理)
- [故障排查](#故障排查)

## 为什么需要HTTP API

MCP协议默认使用stdio通信，**只能在本地使用**。当你需要：
- 从本地AI工具调用远程服务器上的任务
- 多人协作使用同一个服务
- 集成到CI/CD流程中

就需要HTTP API提供远程访问能力。

## 安全性设计

### 三层安全防护

```
请求 → [1. IP白名单] → [2. API Key认证] → [3. 速率限制] → 任务执行
```

### 代理信任配置说明

根据你的部署架构，需要正确配置 `TRUST_PROXY`：

#### 场景1：直接访问API服务器（不推荐生产环境）
```
客户端 → http://your-server:3000
```
配置：`TRUST_PROXY=false`

#### 场景2：单层Nginx反向代理（推荐）
```
客户端 → Nginx (80/443) → API服务器 (3000)
```
配置：`TRUST_PROXY=1`

#### 场景3：CDN + Nginx（如使用Cloudflare）
```
客户端 → Cloudflare CDN → Nginx → API服务器 (3000)
```
配置：`TRUST_PROXY=2`

#### 场景4：本地反向代理
```
客户端 → 本地Nginx (127.0.0.1) → API服务器 (127.0.0.1:3000)
```
配置：`TRUST_PROXY=loopback`

⚠️ **安全警告**：
- **永远不要使用 `TRUST_PROXY=true`**，这会信任所有代理，攻击者可以伪造IP绕过限流
- 只信任确切数量的代理跳数
- 错误的配置可能导致：
  - IP白名单失效
  - 速率限制被绕过
  - 日志记录错误的客户端IP

#### 1. IP白名单

只允许指定IP访问，其他IP直接拒绝。

```bash
# 只允许特定IP
ALLOWED_IPS=192.168.1.100,10.0.0.50

# 允许所有IP（不推荐）
ALLOWED_IPS=*
```

#### 2. API Key认证

每个请求必须在Header中携带正确的API Key。

```bash
# 生成安全的API Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 3. 速率限制

防止暴力破解和DDoS攻击。

- 15分钟内最多100个请求
- 超出限制返回429错误

### 额外安全建议

1. **使用Nginx反向代理 + HTTPS**
   - 加密传输数据
   - 隐藏真实端口
   - 添加额外的安全层

2. **VPN或内网访问**
   - 最安全的方式
   - 不暴露公网端口

3. **日志审计**
   - 所有请求都记录到日志
   - 定期检查异常访问

## 部署步骤

### 步骤1：准备服务器环境

```bash
# SSH连接到服务器
ssh ec2-user@your-server-ip

# 安装Node.js (支持Node 16，适合老服务器)
# 推荐使用Node 16 LTS
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs

# 验证版本（应该 >= 16.14.0）
node -v
npm -v

# 安装PM2 (全局)
sudo npm install -g pm2

# 创建项目目录
mkdir -p /home/ec2-user/slots-resource-sync
cd /home/ec2-user/slots-resource-sync
```

> 💡 **注意**：本项目完全支持 Node 16.14.0+，无需升级到 Node 18/20。如果你的服务器已有 Node 16，可以直接使用。详见 [Node 16兼容性说明](./NODE16_COMPATIBILITY.md)

### 步骤2：上传代码

**方式A：使用Git（推荐）**

```bash
git clone your-repo-url .
```

**方式B：使用SCP**

```bash
# 在本地执行
scp -r /Users/daiyunchao/Documents/works/slots-resource-sync/* ec2-user@your-server-ip:/home/ec2-user/slots-resource-sync/
```

### 步骤3：配置环境变量

```bash
cd /home/ec2-user/slots-resource-sync

# 复制环境变量模板
cp .env.example .env

# 编辑配置
vi .env
```

**重要配置：**

```bash
# API端口
API_PORT=3000

# 生成并设置API Key（必须！）
API_KEY=<使用上面的命令生成>

# 设置IP白名单（强烈推荐！）
# 你本地机器的公网IP，多个用逗号分隔
ALLOWED_IPS=123.45.67.89,98.76.54.32

# CORS设置
CORS_ORIGIN=*

# 代理信任设置（重要！）
# 如果使用Nginx等反向代理，设置为1（信任第一层代理）
# 如果直接访问API服务器，设置为false
TRUST_PROXY=1

# 生产环境
NODE_ENV=production
```

### 步骤4：配置路径

编辑 `config/default.json`，确保路径正确：

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

### 步骤5：安装依赖

```bash
npm install
```

### 步骤6：测试运行

```bash
# 直接运行测试
npm run api

# 应该看到：
# 🚀 API Server is running on http://localhost:3000
# 📚 API Documentation: http://localhost:3000/api
# 💚 Health check: http://localhost:3000/health
```

按 Ctrl+C 停止。

### 步骤7：使用PM2启动

```bash
# 启动服务
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs resource-sync-api

# 设置开机自启动
pm2 startup
pm2 save
```

### 步骤8：配置防火墙

```bash
# 如果使用firewalld
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# 如果使用iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo service iptables save
```

### 步骤9：测试API

```bash
# 健康检查（不需要认证）
curl http://your-server-ip:3000/health

# 应该返回：
# {"success":true,"status":"healthy","timestamp":"..."}
```

### 步骤10：验证代理配置

**重要**：验证 `TRUST_PROXY` 配置是否正确，确保安全功能正常工作。

```bash
# 1. 检查日志中的客户端IP
pm2 logs resource-sync-api --lines 20

# 应该看到类似：
# API Request: GET /health, ip: <你的真实公网IP>

# 2. 如果看到的是 127.0.0.1 或代理IP，说明配置有误
# 检查当前配置
cat .env | grep TRUST_PROXY

# 3. 测试API调用（会记录IP）
curl -X POST http://your-server-ip:3000/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885"}'

# 4. 再次查看日志，确认IP正确
pm2 logs resource-sync-api --lines 5

# 5. 如果IP不正确，调整TRUST_PROXY值
vi .env
# 修改 TRUST_PROXY=1 (如果是单层代理)
# 或 TRUST_PROXY=false (如果直接访问)

# 重启服务
pm2 restart resource-sync-api
```

**如何判断配置正确**：
- ✅ 日志中显示的IP是你的真实公网IP（运行 `curl ifconfig.me` 获取）
- ✅ IP白名单正常工作（未授权IP被拒绝）
- ✅ 没有 `express-rate-limit` 的警告信息

**常见配置错误**：
```bash
# 错误1: TRUST_PROXY=true (不安全！)
# 修正: TRUST_PROXY=1

# 错误2: TRUST_PROXY=1 但直接访问API服务器
# 修正: TRUST_PROXY=false

# 错误3: TRUST_PROXY=false 但通过Nginx访问
# 修正: TRUST_PROXY=1
```

## API使用方法

### 在本地调用远程API

#### 1. 检查资源完整性

```bash
curl -X POST http://your-server-ip:3000/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885"}'
```

**响应示例：**

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

#### 2. 同步Facebook资源

```bash
curl -X POST http://your-server-ip:3000/api/sync-facebook \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885"}'
```

#### 3. 同步Native资源

```bash
curl -X POST http://your-server-ip:3000/api/sync-native \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885"}'
```

#### 4. 更新Reuse版本

```bash
curl -X POST http://your-server-ip:3000/api/update-reuse \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "version": "v885",
    "nginxReuseVersion": "v883"
  }'
```

#### 5. 完整发布流程

```bash
curl -X POST http://your-server-ip:3000/api/full-sync \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "version": "v885",
    "skipCheck": false
  }'
```

### 在AI工具中使用

虽然不能直接使用MCP，但可以通过AI工具的HTTP请求功能调用API：

**在Claude Desktop中：**

1. 可以要求AI帮你构造curl命令
2. 或者编写一个简单的脚本调用API

**示例对话：**

```
你：请帮我检查服务器上v886版本的资源完整性

AI：好的，我来帮你调用API检查。

[AI执行curl命令]

AI：检查结果：
- iOS资源：✅ 完整 (1245个文件)
- Android资源：✅ 完整 (1387个文件)
- 版本匹配：✅ 通过

所有资源检查通过，可以继续下一步操作。
```

## 使用Nginx反向代理（可选但推荐）

### 为什么使用Nginx？

1. **HTTPS加密** - 保护API Key不被窃听
2. **隐藏端口** - 使用标准80/443端口
3. **负载均衡** - 支持多实例
4. **额外安全** - 限流、防护

### Nginx配置示例

```bash
# 安装Nginx
sudo yum install -y nginx

# 编辑配置
sudo vi /etc/nginx/conf.d/resource-sync.conf
```

**配置内容：**

```nginx
upstream resource_sync_api {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;  # 或使用IP

    # 如果有SSL证书
    # listen 443 ssl;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://resource_sync_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 请求体大小限制
        client_max_body_size 10M;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;  # 任务可能需要较长时间
    }

    # 限流
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**启动Nginx：**

```bash
sudo nginx -t  # 测试配置
sudo systemctl start nginx
sudo systemctl enable nginx
```

**使用Nginx后的访问方式：**

```bash
# 不再需要指定端口3000
curl -X POST http://your-domain.com/api/check-integrity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"version": "v885"}'
```

## 运维管理

### PM2常用命令

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs resource-sync-api

# 只查看最近100行
pm2 logs resource-sync-api --lines 100

# 重启服务
pm2 restart resource-sync-api

# 停止服务
pm2 stop resource-sync-api

# 删除进程
pm2 delete resource-sync-api

# 查看详细信息
pm2 show resource-sync-api

# 监控
pm2 monit
```

### 日志管理

```bash
# 应用日志
tail -f logs/combined.log
tail -f logs/error.log

# PM2日志
tail -f logs/pm2-out.log
tail -f logs/pm2-error.log

# 清理旧日志
pm2 flush
```

### 更新代码

```bash
# 拉取最新代码
cd /home/ec2-user/slots-resource-sync
git pull

# 安装依赖
npm install

# 重启服务
pm2 restart resource-sync-api

# 或使用PM2的部署功能
pm2 deploy production update
```

### 性能监控

```bash
# 安装PM2监控（可选）
pm2 install pm2-server-monit

# 查看监控数据
pm2 web  # 启动Web界面，访问 http://your-server-ip:9615
```

## 故障排查

### 问题1：API无法访问

**检查步骤：**

```bash
# 1. 检查服务是否运行
pm2 status

# 2. 检查端口是否监听
netstat -tulpn | grep 3000

# 3. 检查防火墙
sudo firewall-cmd --list-all

# 4. 检查日志
pm2 logs resource-sync-api --lines 50
```

### 问题2：401 Unauthorized

**原因：API Key不正确**

```bash
# 检查.env文件
cat .env | grep API_KEY

# 确认请求Header正确
# X-API-Key: <你的API Key>
```

### 问题3：403 Access Denied

**原因：IP不在白名单中**

```bash
# 检查你的公网IP
curl ifconfig.me

# 检查白名单配置
cat .env | grep ALLOWED_IPS

# 临时允许所有IP（测试用）
# 编辑 .env，设置 ALLOWED_IPS=*
# 然后重启：pm2 restart resource-sync-api
```

### 问题4：任务执行失败

```bash
# 查看详细错误日志
tail -f logs/error.log

# 检查脚本路径和权限
ls -la /home/ec2-user/wtc
ls -la /export/nginx/https

# 手动测试CLI
node src/cli.js check -v v885 --no-confirm
```

### 问题5：服务频繁重启

```bash
# 查看PM2日志
pm2 logs resource-sync-api

# 检查内存使用
pm2 show resource-sync-api

# 增加内存限制（如果需要）
# 编辑 ecosystem.config.cjs
# max_memory_restart: '1G'
pm2 restart resource-sync-api
```

## 安全检查清单

部署前请确认：

- [ ] 已设置强API Key（至少32字符）
- [ ] 已配置IP白名单（不使用*）
- [ ] 已配置防火墙规则
- [ ] 日志记录正常工作
- [ ] 定期检查访问日志
- [ ] 考虑使用Nginx + HTTPS
- [ ] 考虑使用VPN或内网访问
- [ ] 已设置PM2开机自启动
- [ ] 已配置日志轮转

## 最佳实践

1. **不要在生产环境使用 `ALLOWED_IPS=*`**
2. **定期轮换API Key**
3. **使用HTTPS（如果可能）**
4. **监控异常请求**
5. **定期备份配置和日志**
6. **使用内网访问（最安全）**

## 总结

```
本地AI工具
    ↓ (HTTP + API Key)
远程API服务器 (PM2 + Node.js)
    ↓ (执行任务)
服务器本地资源
```

这样你就可以在本地通过AI工具，安全地调用远程服务器上的资源同步任务了！
