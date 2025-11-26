# 更新日志

## v1.1.0 - 2025-11-26

### ✨ 新增功能

#### 🔍 完整脚本输出显示
- **CLI**: 所有任务执行后都会显示**完整的**脚本stdout和stderr
- **MCP**: JSON响应中包含完整的stdout和stderr字段
- 不再截断输出内容，所有信息完整展示

#### 🤔 基于输出的交互式确认
- **改进前**: 每步完成后直接询问是否继续
- **改进后**: 先显示完整脚本输出，然后询问"根据上方输出，确认继续执行吗？"
- 用户可以根据实际输出内容判断是否成功，而不是仅依赖返回码

#### 📊 更好的错误展示
- stdout和stderr分开显示
- stderr使用黄色显示（可能是警告，不一定是错误）
- 失败时显示完整的错误信息

### 🔧 改进

#### CLI命令行
- `check`: 显示每个检查项的完整输出
- `sync-fb`: 显示同步脚本的完整输出
- `sync-native`: 显示同步脚本的完整输出
- `update-reuse`: 显示每个mv操作的完整输出
- `full-sync`: 每步都显示完整输出，并基于输出询问是否继续

#### MCP接口
- `check_resource_integrity`: details中包含每项的stdout/stderr
- `sync_facebook_resources`: 返回完整的output和error
- `sync_native_resources`: 返回完整的output和error
- `update_reuse_version`: details中包含每项的stdout/stderr
- `full_sync_pipeline`: results中每步都包含完整的stdout/stderr

### 📚 文档更新
- 新增 `OUTPUT_EXAMPLE.md` - 详细的输出示例
- 更新 `README.md` - 添加新功能说明
- 更新 `USAGE_GUIDE.md` - 更新交互流程说明
- 更新 `QUICKSTART.md` - 添加输出查看提示

### 🐛 修复
- 修复了脚本输出被截断到500字符的问题
- 修复了full-sync中输出信息不完整的问题

---

## v1.0.0 - 2025-11-26

### 初始版本

#### 核心功能
- 检查资源完整性（iOS & Android）
- 同步Facebook资源
- 同步Native资源
- 更新Reuse资源版本
- 完整发布流程自动化

#### 交互式CLI
- 版本确认提示
- 详细的成功/失败反馈
- 步骤间等待确认
- 彩色终端输出
- 进度条显示

#### MCP支持
- 标准MCP协议实现
- 5个工具函数
- JSON格式响应
- 完整的错误处理

#### 其他功能
- Winston日志系统
- 配置文件支持
- 版本号智能解析
- 完整的错误处理和日志记录
