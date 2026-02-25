#!/bin/bash

#
# AI Companion 2.1 - 前端依赖安装脚本
#

set -e  # 遇到错误立即退出

# ==========================================
# 颜色输出
# ==========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ==========================================
# 主函数
# ==========================================

main() {
    echo ""
    echo "========================================"
    echo "📦 AI Companion 2.1 - 前端依赖安装"
    echo "========================================"
    echo ""

    # 检测包管理器（npm vs pnpm）
    if command -v pnpm &> /dev/null; then
        PACKAGER=pnpm
        echo_info "检测到 pnpm，将使用 pnpm 安装依赖"
    elif command -v npm &> /dev/null; then
        PACKAGER=npm
        echo_info "检测到 npm，将使用 npm 安装依赖"
    else
        echo_error "未检测到任何包管理器（npm 或 pnpm），请先安装"
        exit 1
    fi

    echo ""

    # 检查 Node.js 版本（要求 >= 18.0.0）
    NODE_VERSION=$(node -v)
    NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'v' -f2 | cut -d'.' -f1)

    echo_info "当前 Node.js 版本: $NODE_VERSION"

    if [ "$NODE_MAJOR_VERSION" -lt 18 ]; then
        echo_error "Node.js 版本过低，要求 >= 18.0.0"
        exit 1
    fi

    echo_success "Node.js 版本检查通过"
    echo ""

    # 清理旧依赖（可选）
    if [ "$1" == "--clean" ]; then
        echo_info "清理旧依赖..."
        rm -rf node_modules package-lock.json pnpm-lock.yaml .yarn/cache
        echo_success "清理完成"
        echo ""
    fi

    # 安装依赖
    echo_info "正在安装依赖...（这可能需要几分钟）"
    echo ""

    if [ "$PACKAGER" == "pnpm" ]; then
        pnpm install --frozen-lockfile
    else
        npm install
    fi

    echo ""
    echo_success "依赖安装完成"
    echo ""

    # 显示已安装的依赖
    echo_info "已安装的依赖:"
    echo "   - react: $(node -p "require('./package.json').dependencies.react")"
    echo "   - react-dom: $(node -p "require('./package.json').dependencies['react-dom']")"
    echo "   - zustand: $(node -p "require('./package.json').dependencies.zustand")"
    echo "   - @tanstack/react-virtual: $(node -p "require('./package.json').dependencies['@tanstack/react-virtual']")"
    echo ""

    # 验证 TypeScript 配置
    echo_info "验证 TypeScript 配置..."
    if npm run type-check &> /dev/null; then
        echo_success "TypeScript 配置正确"
    else
        echo_warning "TypeScript 配置有问题，但依赖安装成功"
    fi

    echo ""

    # 完成
    echo "========================================"
    echo "✅ 安装完成"
    echo "========================================"
    echo ""
    echo_info "下一步:"
    echo "   npm run dev     # 启动开发服务器"
    echo "   npm run build   # 构建生产版本"
    echo "   npm run lint    # 检查代码风格"
    echo ""
    echo_info "文档:"
    echo "   frontend/REFACTORING_GUIDE.md  # 重构指南"
    echo ""

}

# ==========================================
# 执行主函数
# ==========================================

main "$@"
