#!/bin/bash

# AI Companion 2.1 - ngrok 公网访问启动脚本

APP_NAME="ai-companion"
LOCAL_PORT=8002

echo "🚀 启动 AI Companion 2.1 公网访问..."
echo ""

# 检查是否安装了 ngrok
if ! command -v ngrok &>/dev/null && ! [ -f "${HOME}/ngrok" ] && ! [ -f "/usr/local/bin/ngrok" ] && ! [ -f "/opt/ngrok/ngrok" ]; then
    echo "⚠️  ngrok 未找到"
    echo ""
    echo "📝 请检查 ngrok 安装位置："
    echo "   • /usr/local/bin/ngrok"
    echo "   • ~/ngrok"
    echo "   • /opt/ngrok/ngrok"
    echo ""
    echo "或手动指定 ngrok 路径"
    read -p "📂 输入 ngrok 路径: " NGROK_PATH
    
    if [ -n "$NGROK_PATH" ] && [ -f "$NGROK_PATH" ]; then
        echo "✅ 使用 ngrok: $NGROK_PATH"
        NGROK_BIN="$NGROK_PATH"
    else
        echo "❌ 路径无效，请重新输入"
        exit 1
    fi
else
    # 尝试多个位置
    if command -v ngrok &>/dev/null; then
        NGROK_BIN="ngrok"
    elif [ -f "${HOME}/ngrok" ]; then
        NGROK_BIN="${HOME}/ngrok"
        chmod +x "${HOME}/ngrok"
    elif [ -f "/usr/local/bin/ngrok" ]; then
        NGROK_BIN="/usr/local/bin/ngrok"
    elif [ -f "/opt/ngrok/ngrok" ]; then
        NGROK_BIN="/opt/ngrok/ngrok"
        chmod +x "${HOME}/opt/ngrok/ngrok"
    else
        echo "✅ ngrok 已在 PATH 中: $(which ngrok)"
        NGROK_BIN="ngrok"
    fi
fi

echo ""
echo "✅ 找到 ngrok: $NGROK_BIN"
echo ""

# 检查本地服务器
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${LOCAL_PORT} | grep -q "200"; then
    echo "✅ 本地服务器运行在端口 ${LOCAL_PORT}"
else
    echo "⚠️  本地服务器未运行"
    echo "   请确保应用已部署在 /var/www/ai-companion/"
    echo ""
    echo "启动命令："
    echo "   cd /var/www/ai-companion"
    echo "   python3 -m http.server ${LOCAL_PORT}"
    echo ""
fi
echo ""

# 杀死旧的 ngrok 进程
echo "🧹 清理旧 ngrok 隧道..."
pkill -9 ngrok 2>/dev/null || echo "无旧进程"
sleep 1
echo ""

# 启动 ngrok 隧道
echo "🌐 启动 ngrok 隧道（端口 ${LOCAL_PORT} → 公网）..."
echo ""

$NGROK_BIN http ${LOCAL_PORT} --log=stdout &
NGROK_PID=$!

echo "📡 正在初始化隧道，请等待 5-10 秒..."
sleep 8

# 获取公网 URL
echo ""
echo "=" * 60
echo "🎉 公网访问地址 🎉"
echo "=" * 60
sleep 3

# 尝试从标准输出或网页界面获取 URL
echo ""
echo "💡 查看方法："
echo "   1. 下方终端窗口中显示的公网 URL"
echo "   2. 访问: http://127.0.0.1:4040"
echo "   3. 查看 Forwarding 页面中的 Forwarding URL"
echo ""
echo "📝 输入 Ctrl+C 终止隧道"
echo ""

# 记录 PID，稍后可关闭
echo "📋 进程 PID: ${NGROK_PID}"
echo "隧道配置: ${LOCAL_PORT} → https"
echo ""
