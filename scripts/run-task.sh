#!/bin/bash

###############################################################################
# 简化的Bash脚本 - 使用SSE API执行任务
#
# 使用示例：
#   ./scripts/run-task.sh check-integrity v885
#   ./scripts/run-task.sh sync-facebook v885
#   ./scripts/run-task.sh full-sync v885 --skip-check
#
# 环境变量：
#   API_URL     API服务器地址（默认: http://localhost:3000）
#   API_KEY     API密钥
###############################################################################

set -e  # 遇到错误立即退出

# 配置
API_URL="${API_URL:-https://slotssaga-v401.me2zengame.com/resource-sync-api}"
API_KEY="${API_KEY:-c878313eb2c4b29f6cd45c443501d4a3ec48a03710168beec2a691c24fc5f67e}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 解析参数
TASK_TYPE="$1"
VERSION="$2"
SKIP_CHECK=""

if [[ "$3" == "--skip-check" ]]; then
    SKIP_CHECK="true"
fi

# 使用说明
if [[ -z "$TASK_TYPE" ]] || [[ -z "$VERSION" ]]; then
    echo ""
    echo "使用方法："
    echo "  ./scripts/run-task.sh <task-type> <version> [options]"
    echo ""
    echo "任务类型："
    echo "  check-integrity    检查资源完整性"
    echo "  sync-facebook      同步Facebook资源"
    echo "  sync-native        同步Native资源"
    echo "  update-reuse       更新Reuse版本"
    echo "  full-sync          完整发布流程"
    echo ""
    echo "选项："
    echo "  --skip-check       跳过检查（仅用于full-sync）"
    echo ""
    echo "示例："
    echo "  ./scripts/run-task.sh check-integrity v885"
    echo "  ./scripts/run-task.sh full-sync v886 --skip-check"
    echo ""
    echo "环境变量："
    echo "  API_URL     API服务器地址（默认: http://localhost:3000）"
    echo "  API_KEY     API密钥"
    echo ""
    exit 1
fi

# 验证任务类型
case "$TASK_TYPE" in
    check-integrity|sync-facebook|sync-native|update-reuse|full-sync)
        ;;
    *)
        echo -e "${RED}❌ 无效的任务类型: $TASK_TYPE${NC}"
        echo "   有效的任务类型: check-integrity, sync-facebook, sync-native, update-reuse, full-sync"
        exit 1
        ;;
esac

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Resource Sync Task Runner (SSE)                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${CYAN}📍 API Server:${NC} $API_URL"
echo -e "${CYAN}📝 Task Type: ${NC} $TASK_TYPE"
echo -e "${CYAN}📦 Version:   ${NC} $VERSION"
if [[ -n "$SKIP_CHECK" ]]; then
    echo -e "${CYAN}⏭️  Skip Check: ${NC} true"
fi
echo ""

###############################################################################
# 创建任务
###############################################################################
echo -e "${BLUE}🚀 Creating task...${NC}"

# 构造请求体
if [[ "$TASK_TYPE" == "full-sync" ]] && [[ -n "$SKIP_CHECK" ]]; then
    REQUEST_BODY="{\"version\": \"$VERSION\", \"skipCheck\": true}"
else
    REQUEST_BODY="{\"version\": \"$VERSION\"}"
fi

# 创建任务
RESPONSE=$(curl -s -X POST "$API_URL/api/tasks/$TASK_TYPE" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "$REQUEST_BODY")

# 检查响应
SUCCESS=$(echo "$RESPONSE" | grep -o '"success"[[:space:]]*:[[:space:]]*true' || echo "")
if [[ -z "$SUCCESS" ]]; then
    ERROR=$(echo "$RESPONSE" | grep -o '"error"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo -e "${RED}❌ Failed to create task: $ERROR${NC}"
    echo ""
    exit 1
fi

# 提取taskId
TASK_ID=$(echo "$RESPONSE" | grep -o '"taskId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

echo -e "${GREEN}✅ Task created: $TASK_ID${NC}"
echo ""
echo "────────────────────────────────────────────────────────────"

###############################################################################
# 查询任务状态（轮询方式，因为curl不直接支持SSE）
###############################################################################
echo -e "${BLUE}📡 Monitoring task progress...${NC}"
echo ""

STATUS=""
LAST_LOG_COUNT=0

while true; do
    # 查询任务状态
    STATUS_RESPONSE=$(curl -s "$API_URL/api/tasks/$TASK_ID/status" \
        -H "X-API-Key: $API_KEY")

    # 提取状态
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | cut -d'"' -f4)
    PROGRESS=$(echo "$STATUS_RESPONSE" | grep -o '"progress"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | awk '{print $NF}')

    # 提取并显示新的日志
    CURRENT_LOG_COUNT=$(echo "$STATUS_RESPONSE" | grep -o '"timestamp"' | wc -l)
    if [[ $CURRENT_LOG_COUNT -gt $LAST_LOG_COUNT ]]; then
        # 简单显示最新几条日志（这是简化版本）
        echo -e "${CYAN}📊 Status: $STATUS | Progress: ${PROGRESS}%${NC}"
        LAST_LOG_COUNT=$CURRENT_LOG_COUNT
    fi

    # 检查是否完成
    if [[ "$STATUS" == "completed" ]]; then
        echo ""
        echo "────────────────────────────────────────────────────────────"
        echo -e "${GREEN}🎉 Task Completed Successfully!${NC}"
        echo "────────────────────────────────────────────────────────────"
        echo ""

        # 显示最终结果
        echo -e "${CYAN}📋 Final Result:${NC}"
        echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
        echo ""

        break
    elif [[ "$STATUS" == "failed" ]]; then
        ERROR_MSG=$(echo "$STATUS_RESPONSE" | grep -o '"error"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
        echo ""
        echo "────────────────────────────────────────────────────────────"
        echo -e "${RED}❌ Task Failed: $ERROR_MSG${NC}"
        echo "────────────────────────────────────────────────────────────"
        echo ""
        exit 1
    fi

    # 等待2秒后再次查询
    sleep 2
done

echo -e "${GREEN}✅ All done!${NC}"
echo ""
