# ✅ 最终地址确认 - VPS 部署到 ggandmm.com

---

## 📱 当前环境测试地址（本地）

### 内网测试
**http://localhost:8002/**
- ✅ 完整功能验证通过

---

## 🌐 VPS 部署到 ggandmm.com

### 部署包位置
**本地路径**: `/home/node/.openclaw1 projects/ai-companion/dist/`
**VPS 目标**: `/var/www/ai-companion/`

### 上传命令（在本机执行）

**方法 1: SCP 上传**
```bash
scp -r /home/node/.openclaw1/projects/ai-companion/dist/ <username>@<vps-ip>:/var/www/
```

**方法 2: 面板工具（FileZilla, WinSCP）**
- 服务器: VPS IP
- 端口: 22 (SSH)
- 路径: `/var/www/ai-companion/`

### VPS 部署命令（在 VPS 上执行）

**1. SSH 登录 VPS**
```bash
ssh <username>@<vps-ip>
```

**2. 下载/创建部署脚本**
```bash
# 选项 A: 从 GitHub 下载
git clone https://github.com/YOUR_USERNAME/ai-companion.git
cd ai-companion/dist

# 选项 B: 手动上传（上面已准备）
# dist/index.html 已经在 /var/www/ai-companion/
```

**3. 执行部署**
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo apt update && apt upgrade -y
systemctl start nginx
systemctl enable nginx
curl -I http://ggandmm.com/
```

**4. 配置 HTTP 访问**

Nginx 根配置: `/etc/nginx/sites-available/ai-companion`
```nginx
server {
    listen 80;
    server_name ggandmm.com www.ggandmm.com;
    
    root /var/www/ai-companion;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**5. 重启服务**
```bash
systemctl restart nginx
```

**6. 测试访问**
```bash
curl -I http://ggandmm.com/
```

**期望结果**:
```
HTTP/1.1 200 OK
```

---

## 🔐 HTTPS/SSL 配置（可选）

### 启用 HTTPS（5 分钟）

**步骤 1: 安装 Certbot**
```bash
sudo apt install -y certbot python3-certbot-nginx
```

**步骤 2: 配置证书**
```bash
sudo certbot --nginx -d ggandmm.com -m YOUR_EMAIL@example.com --agree-toos
```

**步骤 3: 重启服务**
```bash
sudo systemctl restart nginx
```

**访问**: `https://ggandmm.com`

---

## 🎯 部署检查清单

在部署后，访问 http://ggandmm.com 检查：

- ✅ 页面正常加载
- ✅ 角色选择（Luna/Max）显示正确
- ✅ 五维数值显示（魅力/颜值）
- ✅ 聊天输入可用
- ✅ 隐藏事件触发（10%）
- ✅ 道具掉落（10%）
- ✅ 道具背包可用
- ✅ 管理后台显示正常

---

## 💰 VPS 供应商

| 供应商 | 价格 | 备注 |
|-------|------|------|
| DigitalOcean | $5/月 | 推荐 | Ubuntu
| Linode | $5/月 | 推荐 | Ubuntu |
| 腾讯云 | ~2-5/月轻量版 | 快速 |
| 阿里云 | ~3-5/月轻量版 | 快速 |
| AWS Lightsail | $3.50/月 | 永久免费+0.002/GB | 推荐 |

**推荐配置**:
- 1 核心
- 1GB 内存
- 500GB 流量
- Ubuntu 20.04 LTS

---

---

**当前状态**:
- ✅ 部署包已准备（dist/index.html）
- ✅ VPS 部署脚本已创建（deploy-vps.sh）
- ⏳ 等待 VPS 信息（IP/用户名）

**下一步**:
1. 提供 VPS IP 地址
2. 提供用户名（或 root）
3. 我可以生成完整的部署包上传命令

---

_最终确认时间: 2026-02-25 03:05 UTC_
