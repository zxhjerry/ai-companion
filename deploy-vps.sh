#!/bin/bash

# ===== AI Companion 2.1 - VPS 部署脚本 =====

# 使用方法：
# 1. 将本脚本上传到 VPS
# 2. chmod +x deploy.sh && ./deploy.sh
# 3. 访问 https://ggandmm.com

DOMAIN="ggandmm.com"
APP_NAME="ai-companion"
INSTALL_DIR="/var/www/${APP_NAME}"
BACKUP_DIR="/var/backups/${APP_NAME}"

echo "🚀 开始部署 AI Companion 2.1 到 ${DOMAIN}..."
echo ""

# ===== 检查系统环境 =====
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请以 root 权限运行此脚本 (sudo ./deploy.sh)"
    exit 1
fi

echo "📊 系统信息:"
echo "   系统: $(lsb_release -dsi)"
echo "   内核: $(uname -r)"
echo ""

# ===== 更新系统 =====
echo "🎲 更新系统软件包..."
apt update -y
apt upgrade -y

# ===== 安装必要软件 =====
echo "📦 安装 Nginx..."
apt install -y nginx

echo "📦 安装 Python 3..."
apt install -y python3 python3-pip

echo "📦 安装 Git..."
apt install -y git

echo "✅ 软件安装完成"
echo ""

# ===== 配置 Nginx =====
echo "⚙️  配置 Nginx..."

# 移除默认 Nginx 配置
rm -f /etc/nginx/sites-available/*

# 创建 AI Companion Nginx 配置
cat > /etc/nginx/sites-available/${APP_NAME} << 'EOF'
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # HTTPS 重定向（配置 SSL 后取消注释）
    # return 301 https://$server_name$request_uri;

    # 网站根目录
    root ${INSTALL_DIR}/;

    index index.html;

    # 完整功能启用
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 启用 gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml application/javascript application/json;

    # 缓存静态资源
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTPS 配置（需要 SSL 证书）
# 如果已获取 Let's Encrypt 证书，取消以下注释
# server {
#     listen 443 ssl http2;
#     server_name ${DOMAIN} www.${DOMAIN};
#
#     ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
#     ssl_certificate_key /etc/pletaencrypt/live/${DOMAIN}/privkey.pem;
#
#     include /etc/letsencrypt/options-ssl-nginx.conf;
#     ssl_dhparam /etc/ssl/certs/dhparam.pem;
#     add_header Strict-Transport-Security "max-age=31536000";
#     
#     root ${INSTALL_DIR};
#     index index.html;
# 
#     location / {
#         try_files $uri $uri/ /index.html;
#     }
# }
EOF

# 启用站点配置
ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "✅ Nginx 配置完成"
echo ""

# ===== 上传应用文件 =====
echo "📁 创建部署目录..."
mkdir -p ${INSTALL_DIR}

# 如果有源文件路径，复制文件到部署目录
if [ -f "/root/dist/index.html" ]; then
    echo "   检测到源文件: /root/dist/index.html"
    cp /root/dist/index.html ${INSTALL_DIR}/index.html
    echo "   ✅ 应用文件已部署"
elif [ -f "dist/index.html" ]; then
    echo "   检测到本地文件: dist/index.html"
    mkdir -p ${INSTALL_DIR}
    cp dist/index.html ${INSTALL_DIR}/index.html
    echo "   ✅ 应用文件已部署"
else
    echo "❌ 未找到应用文件！"
    echo ""
    echo "📝 上传方法："
    echo "   方法 1: 上传 dist/index.html 到 /root/ 目录"
    echo "   方法 2: 使用 Git 克隆代码仓库"
    echo ""
    echo "请上传应用文件后再次运行此脚本。"
    exit 1
fi; echo ""

# ===== 配置权限 =====
echo "🔐 配置文件权限..."
chown -R root:www-data ${INSTALL_DIR}/

# ===== 测试 Nginx 配置 =====
echo "🧪 测试 Nginx 配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 配置测试通过"
else
    echo "❌ Nginx 配置测试失败，正在修复..."
    exit 1
fi

# ===== 重启 Nginx =====
echo "🔄 重启 Nginx 服务..."
systemctl restart nginx

if [ $? -eq 0 ]; then
    echo "✅ Nginx 服务已重启"
    systemctl enable nginx
    echo "✅ Nginx 已设置为开机自启"
else
    echo "❌ Nginx 重启失败，尝试手动启动..."
    nginx
fi
echo ""

# ===== 防火墙配置 =====
echo "🔒 配置防火墙..."
if command -v ufw &>/dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw reload
    echo "✅ 防火墙配置完成"
elif command -v firewall-cmd &>/dev/null; then
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --reload
    echo "✅ 防火墙配置完成"
else
    echo "⚠️  防火墙未配置，请手动开放端口 80/443"
fi
echo ""

# ===== 测试部署 =====
echo "📡 测试部署..."
sleep 2

if curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200"; then
    echo "✅ 部署成功！"
    echo ""
    echo "🌐 访问地址："
    echo "   HTTP: http://${DOMAIN}"
    echo "   HTTPS: https://${DOMAIN} (需配置 SSL 证书)"
else
    echo "⚠️  部署可能未成功，请检查："
    echo "   1. Nginx 日志: tail -f /var/log/nginx/error.log"
    echo "   2. 端口检查: netstat -tlnp | grep -E ':(80|443) '"
    echo "   3. 服务状态: systemctl status nginx"
fi

echo ""
echo "=" * 60
echo "🎉 部署完成！"
echo "=" * 60
echo ""
echo "📱 访问 ggandmm.com 查看完整功能:"
echo "   • 角色选择（Luna/Max）"
echo "   • 五维数值展示"
echo "   • 实时聊天（模拟 AI 回复）"
echo "   • 部具掉落（10% 概率）"
echo "   • 背包系统（使用/删除）"
echo "   • 订阅系统（3 层）"
echo "   • 管理后台"
echo ""
echo "🔐 SSL/HTTPS 配置（可选）:"
echo "   运行: apt install certbot python3-certbot-nginx"
echo "   配置: certbot --nginx -d ${DOMAIN} -m 'your-email@example.com' --agree-tos"
echo ""

# ===== 完成 =====
echo "✅ 所有任务完成！"
echo ""
echo "📱 现在可以访问: http://${DOMAIN}"
