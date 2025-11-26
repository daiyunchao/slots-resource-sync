#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 等待用户确认继续
# 参数: $1 - 下一步操作描述（可选）
wait_continue() {
    echo ""
    if [ -n "$1" ]; then
        echo -e "${BLUE}下一步: ${NC}$1"
    fi
    echo -e "${YELLOW}按 Enter 继续, 输入 'q' 退出脚本, 输入 's' 跳过此步骤...${NC}"
    read -r input
    if [[ "$input" == "q" ]] || [[ "$input" == "Q" ]]; then
        print_warning "用户选择退出脚本"
        exit 0
    elif [[ "$input" == "s" ]] || [[ "$input" == "S" ]]; then
        return 1
    fi
    return 0
}

# 显示原始脚本内容
show_script_content() {
    cat << 'EOF'
====================================
原始脚本执行流程:
====================================

1. 验证资源的完整性
   cd /home/ec2-user/match
   match -seed /home/ec2-user/wtc/assets_config/common_ios/project.manifest -root /home/ec2-user/wtc/v${version}/res_oldvegas/
   match -seed /home/ec2-user/wtc/assets_config/common_android/project.manifest -root /home/ec2-user/wtc/v${version}/res_oldvegas/
   match_version.sh wtc v${version}

2. 同步faceBook资源
   cd /export/nginx/https/
   sh pubfbclient.sh wtc v${version}

3. 同步native资源
   cd /export/nginx/https/
   sh pubclient.sh wtc v${version}

4. 设置reuse版本
   cd /home/ec2-user/wtc
   mv v${version} reuse_version
   cd /home/ec2-user/wtc_fb
   mv v${version} reuse_version

5. 设置nginx_reuse版本
   cd /export/nginx/https/wtc
   mv v${reuse_version} reuse_version
   cd /export/nginx/https/wtc_fb
   mv v${reuse_version} reuse_version

====================================
EOF
}

# 参数检查
if [ -z "$1" ]; then
    print_error "缺少必需参数: version"
    echo "用法: $0 <version> [reuse_version]"
    echo "示例: $0 885 883"
    exit 1
fi

VERSION=$1
REUSE_VERSION=${2:-$((VERSION - 2))}

echo ""
print_info "========================================="
print_info "版本同步脚本"
print_info "========================================="
print_info "版本号 (version): ${VERSION}"
print_info "复用版本号 (reuse_version): ${REUSE_VERSION}"
print_info "========================================="
echo ""

# 显示原始脚本内容
show_script_content

echo ""
print_warning "请仔细检查上述脚本内容是否正确"
wait_continue "开始执行步骤1: 验证资源的完整性" || exit 0

# ============================================
# 步骤0: 检查磁盘空间
# ============================================
echo ""
print_info "========================================="
print_info "步骤 0/5: 检查磁盘剩余空间"
print_info "========================================="
print_info "执行: df -h"
echo ""
df -h
echo ""

# 检查各个挂载点的磁盘使用率
print_info "检查磁盘使用率..."
LOW_SPACE_WARNING=false
df -h | grep -v "Filesystem" | grep -v "tmpfs" | grep -v "devtmpfs" | while IFS= read -r line; do
    # 提取使用率百分比(去掉%号)
    usage=$(echo "$line" | awk '{print $5}' | sed 's/%//')
    mount_point=$(echo "$line" | awk '{print $6}')

    # 检查是否为数字且大于90%(即剩余小于10%)
    if [[ "$usage" =~ ^[0-9]+$ ]] && [ "$usage" -gt 90 ]; then
        remaining=$((100 - usage))
        print_error "⚠️  警告: 挂载点 ${mount_point} 磁盘空间不足!"
        print_error "   当前使用率: ${usage}% (剩余仅 ${remaining}%)"
        print_error "   建议: 清理磁盘空间后再继续执行"
        LOW_SPACE_WARNING=true
    fi
done

if [ "$LOW_SPACE_WARNING" = true ]; then
    echo ""
    print_error "========================================="
    print_error "发现磁盘空间不足的挂载点!"
    print_error "========================================="
    print_warning "继续执行可能导致操作失败,请谨慎决定!"
else
    print_success "所有磁盘空间充足 ✅"
fi

echo ""
wait_continue "继续执行步骤1: 验证资源的完整性"
if [ $? -eq 1 ]; then
    print_warning "用户选择跳过,退出脚本"
    exit 0
fi

# ============================================
# 步骤1: 验证资源的完整性
# ============================================
step1() {
    echo ""
    print_info "========================================="
    print_info "步骤 1/5: 验证资源的完整性"
    print_info "========================================="
    print_info "当前版本: v${VERSION}"

    wait_continue "验证iOS配置 (match -seed common_ios)"
    if [ $? -eq 1 ]; then
        print_warning "跳过步骤1"
        return
    fi

    print_info "切换到目录: /home/ec2-user/match"
    cd /home/ec2-user/match || {
        print_error "无法切换到 /home/ec2-user/match 目录"
        return 1
    }

    print_info "执行: ./match -seed (iOS配置)..."
    print_warning "等待命令输出完成后3秒无新输出将自动终止..."

    # 使用后台进程+监控输出的方式，3秒无输出自动终止
    (
        ./match -seed /home/ec2-user/wtc/assets_config/common_ios/project.manifest \
            -root /home/ec2-user/wtc/v${VERSION}/res_oldvegas/ &
        MATCH_PID=$!

        # 监控进程，3秒无输出则终止
        ( sleep 3 && kill $MATCH_PID 2>/dev/null ) &
        TIMER_PID=$!

        wait $MATCH_PID 2>/dev/null
        kill $TIMER_PID 2>/dev/null
    )

    print_success "iOS配置验证完成"
    wait_continue "验证Android配置 (match -seed common_android)"
    if [ $? -eq 1 ]; then
        print_warning "跳过剩余验证步骤"
        return
    fi

    print_info "执行: ./match -seed (Android配置)..."
    print_warning "等待命令输出完成后3秒无新输出将自动终止..."

    (
        ./match -seed /home/ec2-user/wtc/assets_config/common_android/project.manifest \
            -root /home/ec2-user/wtc/v${VERSION}/res_oldvegas/ &
        MATCH_PID=$!

        ( sleep 3 && kill $MATCH_PID 2>/dev/null ) &
        TIMER_PID=$!

        wait $MATCH_PID 2>/dev/null
        kill $TIMER_PID 2>/dev/null
    )

    print_success "Android配置验证完成"
    wait_continue "执行版本验证 (match_version.sh)"
    if [ $? -eq 1 ]; then
        print_warning "跳过版本验证步骤"
        return
    fi

    print_info "执行: sh match_version.sh..."
    print_warning "等待命令输出完成后3秒无新输出将自动终止..."

    (
        sh match_version.sh wtc v${VERSION} &
        MATCH_PID=$!

        ( sleep 3 && kill $MATCH_PID 2>/dev/null ) &
        TIMER_PID=$!

        wait $MATCH_PID 2>/dev/null
        kill $TIMER_PID 2>/dev/null
    )

    print_success "版本: v${VERSION} ✅ 资源检查完成"
}

# ============================================
# 步骤2: 同步faceBook资源
# ============================================
step2() {
    echo ""
    print_info "========================================="
    print_info "步骤 2/5: 同步faceBook资源"
    print_info "========================================="
    print_info "当前版本: v${VERSION}"

    wait_continue "执行 pubfbclient.sh 同步Facebook资源"
    if [ $? -eq 1 ]; then
        print_warning "跳过步骤2"
        return
    fi

    print_info "切换到目录: /export/nginx/https/"
    cd /export/nginx/https/ || {
        print_error "无法切换到 /export/nginx/https/ 目录"
        return 1
    }

    print_info "执行: sh pubfbclient.sh wtc v${VERSION}"
    sh pubfbclient.sh wtc v${VERSION}

    if [ $? -eq 0 ]; then
        print_success "版本: v${VERSION} ✅ faceBook资源同步成功"
    else
        print_error "版本: v${VERSION} ❌ faceBook资源同步失败"
        return 1
    fi
}

# ============================================
# 步骤3: 同步native资源
# ============================================
step3() {
    echo ""
    print_info "========================================="
    print_info "步骤 3/5: 同步native资源"
    print_info "========================================="
    print_info "当前版本: v${VERSION}"

    wait_continue "执行 pubclient.sh 同步Native资源"
    if [ $? -eq 1 ]; then
        print_warning "跳过步骤3"
        return
    fi

    print_info "切换到目录: /export/nginx/https/"
    cd /export/nginx/https/ || {
        print_error "无法切换到 /export/nginx/https/ 目录"
        return 1
    }

    print_info "执行: sh pubclient.sh wtc v${VERSION}"
    sh pubclient.sh wtc v${VERSION}

    if [ $? -eq 0 ]; then
        print_success "版本: v${VERSION} ✅ native资源同步成功"
    else
        print_error "版本: v${VERSION} ❌ native资源同步失败"
        return 1
    fi
}

# ============================================
# 步骤4: 设置reuse版本
# ============================================
step4() {
    echo ""
    print_info "========================================="
    print_info "步骤 4/5: 设置reuse版本"
    print_info "========================================="
    print_info "当前版本: v${VERSION}"
    print_warning "将 v${VERSION} 重命名为 reuse_version"

    wait_continue "重命名 wtc 和 wtc_fb 目录中的 v${VERSION}"
    if [ $? -eq 1 ]; then
        print_warning "跳过步骤4"
        return
    fi

    # wtc目录
    print_info "切换到目录: /home/ec2-user/wtc"
    cd /home/ec2-user/wtc || {
        print_error "无法切换到 /home/ec2-user/wtc 目录"
        return 1
    }

    if [ -d "reuse_version" ]; then
        print_warning "reuse_version 目录已存在,将直接覆盖"
        rm -rf reuse_version
    fi

    print_info "执行: mv v${VERSION} reuse_version"
    mv v${VERSION} reuse_version

    if [ $? -ne 0 ]; then
        print_error "/home/ec2-user/wtc: v${VERSION} 重命名失败"
        return 1
    fi

    # wtc_fb目录
    print_info "切换到目录: /home/ec2-user/wtc_fb"
    cd /home/ec2-user/wtc_fb || {
        print_error "无法切换到 /home/ec2-user/wtc_fb 目录"
        return 1
    }

    if [ -d "reuse_version" ]; then
        print_warning "reuse_version 目录已存在,将直接覆盖"
        rm -rf reuse_version
    fi

    print_info "执行: mv v${VERSION} reuse_version"
    mv v${VERSION} reuse_version

    if [ $? -eq 0 ]; then
        print_success "版本: v${VERSION} ✅ reuse版本设置成功"
    else
        print_error "版本: v${VERSION} ❌ reuse版本设置失败"
        return 1
    fi
}

# ============================================
# 步骤5: 设置nginx_reuse版本
# ============================================
step5() {
    echo ""
    print_info "========================================="
    print_info "步骤 5/5: 设置nginx_reuse版本"
    print_info "========================================="
    print_info "复用版本: v${REUSE_VERSION}"
    print_warning "将 v${REUSE_VERSION} 重命名为 reuse_version"

    wait_continue "重命名 nginx/wtc 和 nginx/wtc_fb 目录中的 v${REUSE_VERSION}"
    if [ $? -eq 1 ]; then
        print_warning "跳过步骤5"
        return
    fi

    # wtc目录
    print_info "切换到目录: /export/nginx/https/wtc"
    cd /export/nginx/https/wtc || {
        print_error "无法切换到 /export/nginx/https/wtc 目录"
        return 1
    }

    if [ -d "reuse_version" ]; then
        print_warning "reuse_version 目录已存在,将直接覆盖"
        rm -rf reuse_version
    fi

    print_info "执行: mv v${REUSE_VERSION} reuse_version"
    mv v${REUSE_VERSION} reuse_version

    if [ $? -ne 0 ]; then
        print_error "/export/nginx/https/wtc: v${REUSE_VERSION} 重命名失败"
        return 1
    fi

    # wtc_fb目录
    print_info "切换到目录: /export/nginx/https/wtc_fb"
    cd /export/nginx/https/wtc_fb || {
        print_error "无法切换到 /export/nginx/https/wtc_fb 目录"
        return 1
    }

    if [ -d "reuse_version" ]; then
        print_warning "reuse_version 目录已存在,将直接覆盖"
        rm -rf reuse_version
    fi

    print_info "执行: mv v${REUSE_VERSION} reuse_version"
    mv v${REUSE_VERSION} reuse_version

    if [ $? -eq 0 ]; then
        print_success "版本: v${REUSE_VERSION} ✅ nginx_reuse版本设置成功"
    else
        print_error "版本: v${REUSE_VERSION} ❌ nginx_reuse版本设置失败"
        return 1
    fi
}

# ============================================
# 主执行流程
# ============================================
main() {
    step1
    step2
    step3
    step4
    step5

    echo ""
    print_success "========================================="
    print_success "所有步骤执行完成!"
    print_success "版本: v${VERSION}"
    print_success "复用版本: v${REUSE_VERSION}"
    print_success "========================================="
}

# 执行主函数
main
