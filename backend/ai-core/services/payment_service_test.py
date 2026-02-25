"""
Simple deployment test page for Phase 9
"""

html_content = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>AI Companion 2.1 - 测试地址</title>
</head>
<body>
    <h1>✅ 测试地址确认</h1>
    
    <h2>📱 主要测试地址（推荐）:</h2>
    <a href="http://localhost:8001/demo.html" target="_blank" style="font-size: 24px; color: #6c5ce7;">
        http://localhost:8001/demo.html
    </a>
    
    <h3>功能验证:</h3>
    <ul>
        <li>✅ 角色展示 (Luna/Max)</li>
        <li>✅ 角色选择</li>
        <li>✅ 五维数值显示</li>
        <li>✅ 模拟聊天（打字效果）</li>
        <li>✅ 隐藏事件触发（10%）</li>
        <li>✅ 道具掉落（10%）</li>
        <li>✅ 道具背包（使用/删除）</li>
    </ul>
    
    <h3>技术栈:</h3>
    <ul>
        <li>Python 3.11</li>
        <li>HTTP Server</li>
        <li>Vanilla JS（ES6）</li>
    </ul>
    
    <script>
        // 定期检查服务器状态
        setInterval(() => {
            fetch('/health')
                .then(r => r.json())
                .then(data => {
                    console.log('Health check:', data);
                });
        }, 30000);  // 每 30 秒检查一次
    </script>
</body>
</html>
"""

with open('/home/node/.openclaw1/projects/ai-companion/backend/ai-core/test-verification.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print("✅ Test verification page created")
print("📱 Address: http://localhost:8001/test-verification.html")
