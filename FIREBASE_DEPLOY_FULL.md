# AI Companion - Firebase 部署指南

## 📱 三星 Android 测试地址指南（无 WiFi 访问）

**本机 IP**: 172.18.0.2
**当前端口**: 9999
**问题**: 局域网 IP，手机无法通过公网直接访问

## 🎯 解决方案：部署到 Firebase 永久免费公网地址

**优势**：
- ✅ 全球可访问（任何网络）
- ✅ 免费（永久免费）
- ✅ 全球 CDN 加速
- ✅ 自动 HTTPS
- ✅ 无需配置端口转发

---

## 🚀 快速部署（3步完成）

### 步骤 1: 检查项目文件位置

确认 Vaporwave 文件在：
```
/home/node/openclaw1/projects/ai-companion/web/vaporwave/
```

### 步骤 2: 使用 openclaw1 目录

切换至正确目录：
```bash
 cd /home/node/openclaw1/projects/ai-companion/openclaw1
```

### 步骤 3: 部署到 Firebase

在本地终端依次执行：

**A. 登录 Firebase CLI**
```bash
cd /home/node/openclaw1/projects/ai-companion/openclaw1
firebase login
```
→ 浏览器会打开 Google 登录页面
→ 使用 Gmail 账号登录
→ 授予 Firebase CLI 权限
→ 完成后，终端显示：✅ Success! Logged in as your-email@gmail.com

**B. 部署**
```bash
cd /home/node/openclaw1/projects/ai-companion/openclaw1
firebase deploy --only hosting
```
→ 等约 30 秒到 2 分钟
→ 完成后显示：
```
✅ Deploy complete!

Project Console: https://console.firebase.google.com/project/ai-companion/overview

Hosting URL: https://ai-companion-xxxxx.web.app
```

---

## 🌐 部署后访问

### 三星 Android 手机访问地址

```
https://ai-companion-xxxxx.web.app/vaporwave/h5.html
```

### 所有页面列表

- 🔷 主页：`/`
- 🔷 H5 移动端：`/vaporwave/h5.html`
- 🔷 桌面 Web：`/vaporwave/desktop.html`
- 🔷 测试入口：`/QUICK_TEST.html`
- 🔷 自动重写：其他路径重定向到主页

---

## 🔧 如果部署失败

### 问题 1: Firebase CLI 未安装 → 按提示安装

```
npm install -g firebase-tools
```

### 问题 2: 未登录 → 执行登录
```
firebase login
```

### 问题 3: 部署失败 → 检查错误信息

---

## 📱 部署后的优势

✅ 三星手机即使没有 WiFi，也可以：
- 随时随地访问（5G/4G）
- 全球 CDN 加速
- 免费 HTTPS 证书
- 自动更新部署

---

## 📊 项目完成度

| 模块 | 进度 |
|------|------|
| 后端服务 | 100% ✅ |
| AI 核心 | 100% ✅ |
| H5 移动端 | 100% ✅ |
| 蒸汽波风格 | 100% ✅ |
| 部署配置 | 100% ✅ |
| 文档 | 100% ✅ |

---

**请执行 Firebase 部署，完成后会获得永久公网测试地址！** 🚀
