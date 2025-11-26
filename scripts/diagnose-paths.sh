#!/bin/bash

###############################################################################
# 路径诊断脚本
# 在远程服务器上运行此脚本，检查所有路径配置是否正确
###############################################################################

echo "🔍 开始诊断路径配置..."
echo ""

# 读取配置文件
CONFIG_FILE="config/default.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

# 提取路径（使用简单的grep和cut，避免依赖jq）
HOME_PATH=$(grep '"home"' $CONFIG_FILE | cut -d'"' -f4)
MATCH_PATH=$(grep '"match"' $CONFIG_FILE | cut -d'"' -f4)
WTC_PATH=$(grep '"wtc"' $CONFIG_FILE | cut -d'"' -f4)
WTC_FB_PATH=$(grep '"wtc_fb"' $CONFIG_FILE | cut -d'"' -f4)
NGINX_PATH=$(grep '"nginx"' $CONFIG_FILE | cut -d'"' -f4)
ASSETS_CONFIG_PATH=$(grep '"assets_config"' $CONFIG_FILE | cut -d'"' -f4)

echo "📋 配置文件中的路径："
echo "  home: $HOME_PATH"
echo "  match: $MATCH_PATH"
echo "  wtc: $WTC_PATH"
echo "  wtc_fb: $WTC_FB_PATH"
echo "  nginx: $NGINX_PATH"
echo "  assets_config: $ASSETS_CONFIG_PATH"
echo ""

# 检查函数
check_file() {
    local desc="$1"
    local path="$2"
    if [[ -f "$path" ]]; then
        if [[ -x "$path" ]]; then
            echo "✅ $desc: $path (可执行)"
        else
            echo "⚠️  $desc: $path (存在但不可执行)"
        fi
    else
        echo "❌ $desc: $path (不存在)"
    fi
}

check_dir() {
    local desc="$1"
    local path="$2"
    if [[ -d "$path" ]]; then
        echo "✅ $desc: $path"
    else
        echo "❌ $desc: $path (不存在)"
    fi
}

echo "🔎 检查关键文件和目录："
echo ""

# 检查 match 可执行文件
check_file "match 可执行文件" "$MATCH_PATH/match"

# 检查 match_version.sh
check_file "match_version.sh 脚本" "$MATCH_PATH/match_version.sh"

# 检查目录
check_dir "home 目录" "$HOME_PATH"
check_dir "match 目录" "$MATCH_PATH"
check_dir "wtc 目录" "$WTC_PATH"
check_dir "wtc_fb 目录" "$WTC_FB_PATH"
check_dir "nginx 目录" "$NGINX_PATH"
check_dir "assets_config 目录" "$ASSETS_CONFIG_PATH"

echo ""
echo "🔍 搜索可能的正确路径..."
echo ""

# 搜索 match 文件
echo "📁 搜索 match 可执行文件:"
find /home -name "match" -type f -executable 2>/dev/null | head -5
find /export -name "match" -type f -executable 2>/dev/null | head -5

echo ""
echo "📁 搜索 match_version.sh:"
find /home -name "match_version.sh" 2>/dev/null | head -5
find /export -name "match_version.sh" 2>/dev/null | head -5

echo ""
echo "📁 搜索 wtc 目录:"
find /home -maxdepth 3 -name "wtc" -type d 2>/dev/null | head -5
find /export -maxdepth 3 -name "wtc" -type d 2>/dev/null | head -5

echo ""
echo "📁 搜索 pubfbclient.sh:"
find /home -name "pubfbclient.sh" 2>/dev/null | head -5
find /export -name "pubfbclient.sh" 2>/dev/null | head -5

echo ""
echo "📁 搜索 pubclient.sh:"
find /home -name "pubclient.sh" 2>/dev/null | head -5
find /export -name "pubclient.sh" 2>/dev/null | head -5

echo ""
echo "✅ 诊断完成！"
echo ""
echo "💡 根据上面的搜索结果，修改 config/default.json 中的路径配置。"
