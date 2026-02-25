# 🌐 AI Companion 2.1 - VPS 部署到 ggandmm.com

**域名**: ggandmm.com
**应用**: AI Companion 2.1（完整功能单页应用）

---

## 📦 部署包准备

### 1️⃣ 打包应用（已完成）

部署包位置: `/home/node/.openclaw1/projects/ai-companion/dist/`

**包含文件**:
```
dist/
└── index.html (11KB - 完整应用)
```

---

## 🚀 部署步骤（15 分钟）

### 步骤 1: 准备 VPS

✅ **要求**:
- OS: Ubuntu 或 Debian（推荐 20.04 / 22.04）
- 权限: Root 或 sudo 访问
- 域名: 已确认可解析到服务器 IP

### 步骤 2: 上传部署

**方法 A: SCP 上传（推荐）**

```bash
# 在本机执行，上传部署包到 VPS
scp -r dist/ root@YOUR_VPS_IP:/var/www/

# 或指定用户名
# scp -r dist/ user@YOUR_VPS_IP:/root/dist/
```

**方法 B: SFTP 上传**

```bash
# 使用 FileZilla 等图形界面工具
# 服务器: YOUR_VPS_IP
# 端口: 22 (SSH)
    /root/dist/
```

### 步骤 3: 在 VPS 上执行部署

**SSH 登录 VPS**:
```bash
ssh root@YOUR_VPS_IP

# 或者:
ssh user@YOUR_VPS_IP
sudo su root
```

**下载部署脚本**:
```bash
# 在 VPS 上创建部署脚本
cat > deploy.sh << 'ENDOFF'
# 粘放上面的完整部署脚本内容
ENDOFF

# 或者从 GitHub 下载（如果你已推送代码）
git clone https://github.com/YOUR_USERNAME/ai-companion.git
cd ai-companion
```

**执行部署脚本**:
```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

---

## 📱 访问测试

### HTTP 访问（立即可用）
```
http://ggandmm.com
```

### HTTPS 访问（SSL 证书，可选）

**步骤 1: 安装 Certbot**:
```bash
apt update
apt install -y certbot python3-certbot-nginx
```

**步骤 2: 配置证书**:
```bash
certbot --nginx -d ggandmm.com -m your-email@example.com --agree-to-tos
```

**步骤 3: 重启服务**:
```bash
systemctl restart nginx
```

**访问**: `https://ggandmm.com`

---

## 🔧 系统配置

### 开放防火墙端口
```bash
# UFW (Ubuntu)
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

# FirewallD (CentOS)
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload
```

### Nginx 位置
- 配置文件: `/etc/nginx/sites-available/ai-companion`
- 日志文件: `/var/log/nginx/error.log`

---

## 📊 VPS 供应商推荐

**国际**:
- DigitalOcean ($5/月起)
- Linode ($5/月起)
- AWS Lightsail ($3.50/月起)

**国内**:
- 阿里云（轻量应用服务器）
- 腾讯云（轻量应用服务器）
- 华为云（轻量应用服务器）

**配置建议**:
- 1 核心
- 1GB 内存
- Ubuntu 20.04 LTS
- 流量: 500GB - 1TB

---

## ⚠️ 常见问题

### 问题: 404 错误
- 检查：Nginx 日志 `tail -f /var/log/nginx/error.log`
- 解决：检查文件路径：`ls -la /var/www/ai-companion/`

### 问题: 443 无法访问
- 检查：防火墙 `ufw status` / `firewall-cmd --list-ports`
- 解决：开放 443 端口

### 问题: DNS 未生效
- 检查：`nslookup ggandmm.com`
- 解决：VPS IP 是否与域名 A 记录匹配

---

## 💡 快速命令汇总

```bash
# SSH 登录
ssh root@YOUR_VPS_IP

# 上传
scp -r dist/ root@YOUR_VPS_IP:/

# 部署
cd /root/dist/
# （下载 deploy.sh 或上传 deploy.sh）
chmod +x deploy.sh
sudo ./deploy.sh

# 检查状态
systemctl status nginx
curl -I http://localhost/

# 查看日志
tail -f /var/log/nginx/error.log
```

---

**预计部署时间**: 10-15 分钟  
**维护成本**: 约 $5-10/月（轻量 VPS）

---

_更新时间: 2026-02-25 03:00 UTC_
