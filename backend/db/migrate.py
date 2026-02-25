"""
Database Migration Script for AI Companion 2.1
执行 Schema 初始化并创建示例数据
"""

import subprocess
import os
import sys

def check_postgres_installed():
    """检查 PostgreSQL 是否已安装"""
    try:
        result = subprocess.run(['which', 'psql'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ PostgreSQL 已安装")
            return True
        else:
            return False
    except Exception:
        return True

def check_postgres_running(service='service postgresql' if os.path.exists('/etc/init.d/postgresql') or os.path.exists('/usr/lib/systemd/system/postgresql.service') else 'docker'):
    """检查 PostgreSQL 是否运行"""
    try:
        import urllib.request
        
        response = urllib.request.urlopen('http://localhost:5432/', timeout=3)
        status = response.getcode()
        
        if status in [200, 404, 403, 401]:
            print("✅ PostgreSQL 服务运行中")
            return True
        else:
            print(f"PostgreSQL 状态: {status}")
            return False
    except Exception as e:
        print(f"⚠️  PostgreSQL 未启动: {str(e)[:50]}")
        return False

def start_postgres_docker():
    """启动 Docker PostgreSQL 容器"""
    docker_compose = """
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: ai-companion-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_companion
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
"""

    compose_file = '/home/node/.openclaw1/projects/ai-companion/docker-compose.db.yml'
    
    with open(compose_file, 'w') as f:
        f.write(docker_compose)
    
    print(f"📝 Docker Compose 文件已创建: {compose_file}")

    try:
        print("🚀 启动 PostgreSQL 容器...")
        subprocess.run(['docker-compose', '-f', compose_file, 'up',
                      '-d'], check=True, capture_output=True)
        
        print("⏳ 等待 PostgreSQL 启动 (5秒)...")
        import time
        time.sleep(5)
        
        if check_postgres_running():
            print("✅ PostgreSQL 容器已启动")
            return True
        else:
            print("⚠️  PostgreSQL 容器启动超时，请手动检查")
            return False
    except Exception as e:
        print(f"❌ 启动 PostgreSQL 失败: {e}")
        return False

def schema2_1() -> bool:
    """执行 Schema 2.1 初始化"""
    schema_file = '/home/node/.openclaw1/projects/ai-companion/backend/db/schema-2-1.sql'
    
    if not os.path.exists(schema_file):
        print(f"❌ Schema 文件不存在: {schema_file}")
        return False

    print(f"\n📜 执行 Schema 初始化: {schema_file}")

    try:
        result = subprocess.run([
            'docker', 'exec', '-i', 'ai-companion-db',
            'psql', '-U', 'postgres', '-d', 'ai_companion'
        ], stdin=open(schema_file, 'r'), capture_output=True, text=True)

        if result.returncode == 0:
            print("✅ Schema 初始化成功！")
            return True
        else:
            print(f"❌ Schema 初始化失败: {result.stderr[:500]}")
            return False

    except Exception as e:
        print(f"❌ 执行 Schema SQL 失败: {e}")
        return False

def verify_tables():
    """验证表是否创建成功"""
    try:
        result = subprocess.run([
            'docker', 'exec', 'ai-companion-db',
            'psql', '-U', 'postgres', '-d', 'ai_companion',
            '-c', "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
        ], capture_output=True, text=True)

        if result.returncode == 0:
            tables = result.stdout
        
            if 'users' in tables and 'companions' in tables:
                print("\n📊 数据库表已创建:")
                print(tables)
                return True
            else:
                print(f"⚠️  表创建不完整")
                print(tables)
                return False

    except Exception as e:
        print(f"❌ 验证数据库表失败: {e}")
        return False

def main():
    print("\n" + "=" * 60)
    print("🚀 AI Companion 2.1 - 数据库初始化")
    print("=" * 60 + "\n")

    # 1. 检查 PostgreSQL
    if not check_postgres_installed():
        print("❌ PostgreSQL 未安装，请先安装")
        return False

    # 2. 检查运行状态
    if not check_postgres_running():
        print("\n⚠️  PostgreSQL 未运行，尝试启动 Docker 容器...\n")
        if not start_postgres_docker():
            print("❌ 启动失败，请手动启动数据库")
            return False

    # 3. 执行 Schema 初始化
    if not schema2_1():
        print("❌ Schema 初始化失败")
        return False

    # 4. 验证表
    if not verify_tables():
        print("❌ 表验证失败")
        return False

    print("\n" + "=" * 60)
    print("✅ 数据库初始化完成！")
    print("=" * 60 + "\n")

    print("📊 已创建的表:")
    print("  • users           - 用户表")
    print("  • companions      - 角色表")
    print("  • stats           - 五维数值表")
    print("  • messages        - 聊天消息表")
    print("  • hidden_events   - 隐藏事件表")
    print("  • items           - 背包道具表")
    print()
    print("🔗 连接信息:")
    print("   Host: localhost")
    print("   Port: 5432")
    print("   Database: ai_companion")
    print("   User: postgres")
    print("   Password: postgres")

    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
