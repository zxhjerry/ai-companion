#!/bin/bash

# AI Companion 2.1 - ngrok 查找和部署脚本

echo ""
echo "============================================================"
echo "🌐 AI Companion 2.1 - ngrok 查找和公网访问部署"
echo "============================================================"
echo ""

# ===== 查找 ngrok =====
echo "🔍 查找系统中 ngrok 安装位置..."
echo ""

# 搜索范围
SEARCH_PATHS=(
    "/usr/local/bin"
    "/usr/bin"
    "/opt"
    "/usr/local"
    sbin
    bin
    "$HOME"
    "$HOME/bin"
    "$HOME/.local/bin"
)

FOUND_LOCATIONS=()

for path in "${SEARCH_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "   搜索路径: $path"
        found=$(find "$path" -name "ngrok" -type f 2>/dev/null)
        for item in $found; do
            FOUND_LOCATIONS+=("$item")
            echo "     ✅ 找到: $item"
        done
    fi
done

if [ ${#FOUND_LOCATIONS[@]} -eq 0 ]; then
    echo ""
    echo "❌ 未找到 ngrok in standard locations"
    echo ""
    echo "📘 ngrok 安装指南:"
    echo ""
    echo "macOS:"
    echo '   brew install ngrok'
    ""
    echo "Linux:"
    echo "   # 方法 1: via official installer"
    echo "   curl -s https://bin.equinox.io/c/b4nFH/bin/ngrok-v3-stable-linux-amd64.zip | unzip -d"
    echo "   chmod +x ngrok'
    echo "   sudo mv ngrok /usr/local/bin/"
    echo ""
    echo "   # 方法 2: via package manager"
    echo "   snap install ngrok"
    echo ""
    echo "   # 方法 3: via package manager"
    echo "   wget https://bin.equinox.io/c/b4nFH/bin/ngrok-v3-stable-linux-amd64.zip"
    echo "   unzip ngrok-v3-stable-linux-amd64.zip"
    echo "   chmod +x ngrok"
    echo "   sudo mv ngrok /usr/local/bin/"
    echo ""
    echo "Windows:"
    echo "   https://ngrok.com/download"
    echo ""
    echo "安装完成后:"
    echo "   • 1. 复制 Authtoken（注册 ngrok.com 后）"
    echo "   2. 执行: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
else
    echo ""
    echo "✅ 找到 ${#FOUND_LOCATIONS[@]} 个 ngrok 位置:"
    echo ""
    
    for loc in "${FOUND_LOCATIONS[@]}"; do
        # 读取文件信息
        FILE_TYPE=$(file "$loc" 2>/dev/null || echo "unknown")
        
        echo "📁 位置: $loc"
        echo "📄 类型: $FILE_TYPE"
        echo ""
    done

    # 尝试在找到的位置中选择第一个有效的 ngrok
    for loc in "${FOUND_LOCATIONS[@]:1}"; do
        if [ -f "$loc" ]; then
            NGROK_BIN="$loc"
            break
        fi
    done

    if [ -n "$NGROK_BIN" ]; then
        echo "✅ 选择第一个: $NGROK_BIN"
        echo ""

        # 检查可执行权限
        if [ -x "$NGROK_BIN" ]; then
            echo "✅ 可执行权限: 是"
        else
            echo "⚠️  需要手动授权:"
            echo "   chmod +x $NGROK_BIN"
            echo ""
            read -p "是否添加到 PATH？(y/n) [y]: " ADD_TO_PATH
            
            if [[ "$ADD_to_PATH" =~ ^[Yy] ]]; then
                echo "sudo ln -s $NGROK_BIN /usr/local/bin/ngrok && echo '✅ 已添加到 PATH'"
            fi
        fi
    fi
fi

# ===== 检查 8002 端口是否可用 =====
echo ""
echo "🔍 检查 8002 端口服务..."
echo ""

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/ | grep -q "200"; then
    echo "✅ 端口 8002 服务器运行中"
else
    echo "⚠️ 端口 8002 无服务"
    echo ""
    echo "启动服务命令："
    echo "   python3 -m http.server 8002 &"
    echo ""
fi
echo ""

# ===== 启动 ngrok =====
if [ -n "$NGROK_BIN" ]; then
    echo "🌐 启动 ngrok 隧道..."
    echo ""
    
    # 清理旧进程
    pkill -9 ngrok 2>/dev/null
    sleep 2
    
    # 启动 ngrok（前台运行）
    echo "请查看屏幕，注意 'Forwarding' 行，复制 https://xxxxxxx.ngrok-free.app 地址"
    echo ""
    echo "示例:"
    echo "   Forwarding: https://abc123-8002-xxxx.ngrok-free.app -> http://localhost:8002"
    echo "   "
    echo "这就是公网访问地址！"
    echo ""
    echo "按 Ctrl+C 终止"
    echo ""
    
    exec "$NGROK_BIN" http 8002 --log=stdout
else
    echo ""
    echo "❌ ngrok 未找到"
    echo "   请按照上面的安装指南安装 ngrok 后再运行此脚本"
    exit 1
fi
