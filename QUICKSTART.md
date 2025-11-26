# 快速入门

## 第一次使用

### 1. 安装依赖

```bash
cd /Users/daiyunchao/Documents/works/slots-resource-sync
npm install
```

### 2. 配置路径

编辑 `config/default.json`，确保所有路径正确：

```json
{
  "paths": {
    "home": "/home/ec2-user",
    "match": "/home/ec2-user/match",
    "wtc": "/home/ec2-user/wtc",
    "wtc_fb": "/home/ec2-user/wtc_fb",
    "nginx": "/export/nginx/https",
    "assets_config": "/home/ec2-user/wtc/assets_config"
  }
}
```

### 3. 测试工具

```bash
# 查看帮助
node src/cli.js --help

# 测试版本号验证
node src/cli.js check -v v885 --no-confirm
```

## 常用命令速查

### 单步操作

```bash
# 1. 检查资源（交互式）
node src/cli.js check -v v885

# 2. 同步Facebook资源
node src/cli.js sync-fb -v v885

# 3. 同步Native资源
node src/cli.js sync-native -v v885

# 4. 更新Reuse版本
node src/cli.js update-reuse -v v885
```

### 完整流程（推荐）

```bash
# 交互式完整发布（推荐）
node src/cli.js full-sync -v v885

# 跳过资源检查
node src/cli.js full-sync -v v885 --skip-check
```

### 无确认模式（自动化）

```bash
# 危险！仅在完全确认的情况下使用
node src/cli.js full-sync -v v885 --no-confirm
```

## 交互式功能说明

### 每步会发生什么

1. **版本确认**
   - 系统会询问：`确认版本号是 v885 吗?`
   - 输入 `Y` 继续，`n` 取消

2. **执行任务**
   - 显示开始信息：版本号、时间
   - 执行具体操作
   - 显示详细结果

3. **成功反馈**（以检查资源为例）
   ```
   ✅ 资源完整性检查 - 执行成功
   📦 版本: v885
   💬 版本 v885 资源无异常，所有检查项通过

   详细信息:
     • iOS资源: ✅ 完整
     • Android资源: ✅ 完整
     • 版本匹配: ✅ 通过
   ```

4. **失败反馈**
   ```
   ❌ 资源完整性检查 - 执行失败
   💥 错误: 部分资源检查未通过
   提示: 请查看日志文件了解详细信息
   ```

5. **步骤间等待**（仅 full-sync）
   ```
   📋 下一步: 同步Facebook资源

   ? 请选择操作:
   ❯ ✅ 继续执行
     ⏸️  暂停（稍后继续）
     ❌ 取消退出
   ```

## 典型使用场景

### 场景1：发布新版本 v886

```bash
# 步骤1：先检查资源完整性
node src/cli.js check -v v886
# 等待确认 -> 执行 -> 查看结果

# 步骤2：如果检查通过，执行完整发布
node src/cli.js full-sync -v v886
# 确认版本 -> 资源检查 -> 确认继续 -> 同步FB -> 确认继续 -> 同步Native -> 完成

# 步骤3：（可选）更新reuse版本
node src/cli.js update-reuse -v v885
```

### 场景2：只更新某个渠道

```bash
# 只更新Facebook渠道
node src/cli.js sync-fb -v v885

# 或只更新Native渠道
node src/cli.js sync-native -v v885
```

### 场景3：在自动化脚本中使用

```bash
#!/bin/bash
VERSION="v886"

# 检查资源（无确认）
if node src/cli.js check -v $VERSION --no-confirm; then
  echo "资源检查通过，开始发布"

  # 执行完整发布（无确认）
  node src/cli.js full-sync -v $VERSION --no-confirm

  if [ $? -eq 0 ]; then
    echo "发布成功"
  else
    echo "发布失败"
    exit 1
  fi
else
  echo "资源检查失败"
  exit 1
fi
```

## 查看日志

```bash
# 实时查看所有日志
tail -f logs/combined.log

# 只查看错误
tail -f logs/error.log

# 查看最近的日志
tail -n 50 logs/combined.log
```

## 遇到问题？

1. **版本号格式错误**
   - 确保格式是 `v885` 或 `885`
   - 不要有空格或特殊字符

2. **路径不存在**
   - 检查 `config/default.json` 中的路径配置
   - 确保有权限访问这些路径

3. **任务执行失败**
   - 查看终端输出的错误信息
   - 检查 `logs/error.log`
   - 确认服务器上的脚本文件存在

4. **想要更详细的说明？**
   - 查看 `USAGE_GUIDE.md` 了解每个功能的详细说明
   - 查看 `README.md` 了解项目整体架构

## 下一步

- 阅读 [USAGE_GUIDE.md](./USAGE_GUIDE.md) 了解详细功能
- 配置 MCP 服务器，通过AI工具调用（见 README.md）
- 根据实际需求调整配置文件
