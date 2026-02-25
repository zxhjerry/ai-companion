#!/bin/bash

# ===== 立即部署方案：备用端口 + 简化脚本 =====

echo ""
echo "🚨 立即部署方案 - 多端口隧道"
echo ""
echo "============================================================"
echo ""

# ===== 检查可用端口 =====
AVAILABLE_PORTS=(8002 8003 8004 8005 8006)
NGROK_BIN="/home/node/bin/ngrok"

# 检查 ngrok 是否可用
if [ ! -f "$NGROK_BIN" ]; then
    echo "❌ ngrok 路径: $NGROK_BIN 不存在"
    exit 1
fi

echo "✅ ngrok 路径: $NGROK_BIN"
echo ""

# 检查哪个端口可用于隧道
echo "🔍 检查可用端口..."
echo ""

USABLE_PORTS=()

for port in "${AVAILABLE_PORTS[@]}"; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}/ 2>/dev/null | grep -q "200"; then
        echo "   端口 $port: ✅ 服务器运行中"
        echo ""
        # 尝试启动 ngrok
        echo "🌐 启动端口 $port 的 ngrok 隧道..."
        pkill -9 ngrok 2>/dev/null
        sleep 2
        
        # 启动 ngrok
        "$NGROK_BIN" http $port > /tmp/ngrok-$port.log 2>&1 &
        NGROK_PID=$!

        echo "   PID: $NGROK_PID"
        echo ""
        sleep 8

        # 读取日志获取公网地址
        if [ -f "/tmp/ngrok-$port.log" ]; then
            echo "   读取 ngrok 日志..."
            FORWARDING_URL=$(grep -oP 'https://[a-z0-9-]+-[a-z0-9]+\..ngrok(-free)?\.app' /tmp/ngrok-$port.log 2>/dev/null | tail -1)

            if [ -n "$FORWARDING_URL" ]; then
                echo "   ✅ 公网地址: $FORWARDING_URL"
                echo ""
                echo "📱 正在验证连接..."
                if curl -s -o /dev/null -w "%{http_code}" "$FORWARDING_URL" 2>/dev/null | grep -q "200\|307\|308"; then
                    echo "   ✅ 连接验证成功"
                    echo ""
                    echo "📱 访问地址："
                    echo "   $FORWARDING_URL"
                    echo ""
                    echo "✅ 部署完成！"
                    exit 0
                else
                    echo "⚠️  URL 格式：$FORWARDING_URL"
                fi
            else
                echo "   ⚠️  未找到公网地址"
                echo ""
                echo "💡 手动查找 Forwarding 地址："
                echo "   1. 访问: http://127.0.0.1:4040（ngrok 网络界面）"
                echo "   2. 查看 Forwarding 行（复制地址）"
                echo ""

                # 尝试打开网络界面
                if command -v open &>/dev/null; then
                    open http://127.0.0.1:4040 2>/dev/null &
                    echo "   ✅ 已在浏览器中打开 ngrok 网络界面"
                elif command -v xdg-open &>/dev/null; then
                    xdg-open http://127.0.0.1:4040 2>/dev/null &
                    echo "   ✅ 已在浏览器中打开 ngrok 网络界面"
                fi
            fi
        else
            echo "   ⚠️ ngrok 日志未创建"
        fi
        
        # 成功找到一个端口
        echo ""
        echo "✅ 端口 $port: 可用"
        echo ""
        
        exit 0
    else
        echo "   端口 $port: 跳过（服务器未运行）"
    fi
done

# 如果所有端口都没有，启动一个新服务
echo ""
echo "⚠️  所有端口服务器未运行"
echo ""
echo "🚀 启动新服务..."
echo ""

# 检查是否有 dist/index.html
if [ -f "dist/index.html" ]; then
    echo "   找到应用文件: dist/index.html"
    
    # 启动新服务器（端口 8006）
    cd /home/node/.openclaw1/projects/ai-companion
    python3 -m http.server 8006 > /tmp/server-8006.log 2>&1 &
    SERVER_PID=$!
    
    echo "   ✅ 新服务器启动: 端口 8006 (PID: $SERVER_PID)"
    echo ""
    
    sleep 3
    
    # 启动 ngrok
    pkill -9 ngrok 2>/dev/null
    sleep 2
    
    echo "🌐 启动 ngrok 隧道（端口 8006）..."
    "$NGROK_BIN" http 8006 > /tmp/ngrok-8006.log 2>&1 &
    NGROK_PID=$!
    
    echo "   PID: $NGROK_PID"
    echo ""
    sleep 8

    # 读取 Forwarding URL
    FORWARDING_URL=$(grep -oP 'https://[a-z0-9-]+-[a-z0-9]+\..ngrok(-free)?\.app' /tmp/ngrok-8006.log 2>/dev/null | tail -1)

    if [ -n "$FORWARDING_URL" ]; then
        echo "✅ 公网地址: $FORWARDING_URL"
        echo ""
        echo "📱 访问: $FORWARDING_URL"
        echo ""
        echo "✅ 部署完成！"
        exit 0
    else
        echo "⚠️ 未找到 Forwarding URL"
        echo ""
        echo "💡 手动查找地址："
        echo "   访问: http://127.0.0.1:4040"
    fi
else
    echo "❌ 应用文件未找到"
    echo "   请执行: 确认 dist/index.html 是否存在"
fi

echo ""
echo "============================================================"
echo "⚠️  如果所有方法失败："
echo "============================================================"
echo ""
echo "1. 检查 ngrok 网络界面：http://127.0.0.1:4040"
echo "   查找 Forwarding 行（公网 HTTPS 地址）"
echo ""
echo "2. 重新启动 ngrok（命令）："
echo "   /home/node/bin/ngrok http 8005 | tee ngrok-debug.log"
echo ""
echo "3. 检查本地服务器："
echo "   curl -I http://localhost:8006/"
echo ""

exit 1
