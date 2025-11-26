#!/bin/bash

# API测试脚本

# 配置
API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-your-api-key}"
VERSION="${VERSION:-v885}"

echo "=================================="
echo "  API 测试脚本"
echo "=================================="
echo ""
echo "API URL: $API_URL"
echo "VERSION: $VERSION"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试健康检查
echo -e "${YELLOW}测试 1: 健康检查${NC}"
response=$(curl -s "$API_URL/health")
if echo "$response" | grep -q "healthy"; then
    echo -e "${GREEN}✅ 健康检查通过${NC}"
    echo "$response" | jq .
else
    echo -e "${RED}❌ 健康检查失败${NC}"
    echo "$response"
fi
echo ""

# 测试API文档
echo -e "${YELLOW}测试 2: 获取API文档${NC}"
response=$(curl -s -X GET "$API_URL/api" \
    -H "X-API-Key: $API_KEY")
if echo "$response" | grep -q "endpoints"; then
    echo -e "${GREEN}✅ API文档获取成功${NC}"
    echo "$response" | jq .
else
    echo -e "${RED}❌ API文档获取失败${NC}"
    echo "$response"
fi
echo ""

# 测试检查资源完整性
echo -e "${YELLOW}测试 3: 检查资源完整性${NC}"
response=$(curl -s -X POST "$API_URL/api/check-integrity" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"version\": \"$VERSION\"}")

if echo "$response" | grep -q "success"; then
    success=$(echo "$response" | jq -r '.success')
    if [ "$success" == "true" ]; then
        echo -e "${GREEN}✅ 资源检查成功${NC}"
    else
        echo -e "${RED}❌ 资源检查失败${NC}"
    fi
    echo "$response" | jq .
else
    echo -e "${RED}❌ 请求失败${NC}"
    echo "$response"
fi
echo ""

# 测试401错误（错误的API Key）
echo -e "${YELLOW}测试 4: 错误的API Key（应该返回401）${NC}"
response=$(curl -s -X POST "$API_URL/api/check-integrity" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: wrong-key" \
    -d "{\"version\": \"$VERSION\"}")

if echo "$response" | grep -q "Unauthorized"; then
    echo -e "${GREEN}✅ 安全验证正常工作${NC}"
    echo "$response" | jq .
else
    echo -e "${RED}❌ 安全验证可能有问题${NC}"
    echo "$response"
fi
echo ""

# 测试400错误（缺少参数）
echo -e "${YELLOW}测试 5: 缺少参数（应该返回400）${NC}"
response=$(curl -s -X POST "$API_URL/api/check-integrity" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{}")

if echo "$response" | grep -q "Missing required parameter"; then
    echo -e "${GREEN}✅ 参数验证正常工作${NC}"
    echo "$response" | jq .
else
    echo -e "${RED}❌ 参数验证可能有问题${NC}"
    echo "$response"
fi
echo ""

echo "=================================="
echo "  测试完成"
echo "=================================="
