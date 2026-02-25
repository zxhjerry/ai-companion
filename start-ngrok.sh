#!/bin/bash

# 快速 ngrok 启动脚本

# 尝试常见 ngrok 位置
echo "🔍 查找 ngrok 位置..."

# 常见位置
locations=(
    "ngrok"
    "~/ngrok"
    "/usr/local/bin/ngrok"
    "/opt/ngrok/ngrok"
    "/usr/bin/ngrok"
)

NGROK_BIN=""

for loc in "${locations[@]}"; do
    if [ -f "$loc" ]; then
        NGROK_BIN="$loc"
        echo "✅ 找到: $loc"
        break 2
    fi
done

# 如果找到，启动
if [ -n "$NGROK_BIN" ]; then
    echo ""
    echo "🌐 启动 ngrok 隧道（端口 8002 → 公网）..."
    echo ""
    
    # 清理旧进程
    pkill -9 ngrok 2>/dev/null
    
    # 启动 ngrok（前台运行）
    "$NGROK_BIN" http 8002 --log=stdout

elif [ "$(uname -s)" = "Darwin" ]; then
    echo " MacOS 系统。尝试通过 /Applications 启动..."
    open -a "ngrok" 2>/dev/null || open / Applications/ngrok.app 2>/dev/null || echo "请在 macOS 中搜索 ngrok 应用"
else
    echo ""
    echo "❌ ngrok 未在标准位置找到"
    echo ""
    echo "📝 请手动查找 ngrok 安装位置，然后执行："
    echo ""
    echo "命令："
    echo "   $ ngrok http 8002"
    echo ""
    echo "然后查看 Forwarding URL"
fi
