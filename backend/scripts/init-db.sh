#!/bin/bash
#
# AI Companion 2.1 - 数据库初始化脚本
# PostgreSQL 14+
#
# 功能：
# 1. 初始化数据库连接
# 2. 执行所有schema文件
# 3. 验证表创建
#

set -e  # 遇到错误立即退出

# ==========================================
# 配置
# ==========================================

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-ai_companion}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

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
    echo "🗄️  AI Companion 2.1 - 数据库初始化"
    echo "========================================"
    echo ""

    # 显示配置
    echo_info "数据库配置:"
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
    echo ""

    # 检查 psql 是否可用
    if ! command -v psql &> /dev/null; then
        echo_error "psql 未安装，请先安装 PostgreSQL 客户端"
        exit 1
    fi

    # 设置 PGPASSWORD 环境变量
    export PGPASSWORD=$DB_PASSWORD

    # 测试连接
    echo_info "测试数据库连接..."
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT NOW();" &> /dev/null; then
        echo_success "数据库连接成功"
    else
        echo_error "数据库连接失败"
        echo "请检查配置并确保 PostgreSQL 服务器正在运行"
        exit 1
    fi

    echo ""

    # 创建扩展（如果需要）
    echo_info "创建 PostgreSQL 扩展..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- 启用 gen_random_uuid 扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 启用 UUID 数据类型（PostgreSQL 13+ 已内置）
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF

    echo_success "扩展创建完成"
    echo ""

    # ==========================================
    # 执行 Schema 文件
    # ==========================================

    # 定义 schema 文件列表（按顺序执行）
    SCHEMA_FILES=(
        "$BACKEND_DIR/common/database/schema-gacha.sql"        # 装备与抽卡系统
        "$BACKEND_DIR/common/database/schema-affinity.sql"    # 好感度系统
    )

    for schema_file in "${SCHEMA_FILES[@]}"; do
        if [ ! -f "$schema_file" ]; then
            echo_warning "Schema 文件不存在，跳过: $schema_file"
            continue
        fi

        echo_info "执行 Schema: $(basename "$schema_file")"

        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$schema_file"; then
            echo_success "Schema 执行成功"
        else
            echo_error "Schema 执行失败: $schema_file"
            exit 1
        fi

        echo ""
    done

    # ==========================================
    # 验证表创建
    # ==========================================

    echo_info "验证表创建..."
    echo ""

    # 检查关键表是否存在
    TABLES=(
        "users"
        "item_templates"
        "item_instances"
        "gacha_pools"
        "gacha_pity_status"
        "gacha_records"
        "affinity_records"
        "gift_history"
        "battle_records"
        "lineups"
    )

    for table in "${TABLES[@]}"; do
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM $table LIMIT 1;" &> /dev/null; then
            echo_success "✓ $table"
        else
            echo_error "✗ $table (表不存在或访问失败)"
            exit 1
        fi
    done

    echo ""

    # 显示所有表
    echo_info "数据库表列表:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt"
    echo ""

    # ==========================================
    # 完成
    # ==========================================

    echo ""
    echo "========================================"
    echo "✅ 数据库初始化完成"
    echo "========================================"
    echo ""
    echo_info "下一步:"
    echo "   1. 启动后端服务: npm run start:dev"
    echo "   2. 启动 Worker: npm run worker:gacha"
    echo "   3. 测试 API: curl http://localhost:3000/api/health"
    echo ""
}

# ==========================================
# 执行主函数
# ==========================================

main "$@"
