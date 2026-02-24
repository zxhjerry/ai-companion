# Firebase 部署配置完成 - AI Companion

## ✅ 已完成配置

1. ✅ 项目结构确认：`/home/node/openclaw1/projects/ai-companion/web/`
2. ✅ Firebase 配置文件已更新：
   - `.firebaserc` - 项目名称：`ai-companion`
   - `firebase.json` - 指向 `vaporwave` 目录
3. ✅ 自动部署脚本已创建：`firebase-auto-deploy.sh`
4. ✅ Vaporwind 文件已准备：`vaporwave/h5.html`, `vaporwave/desktop.html`, `vaporwave/index.html`

---

## 🎯 下一步：一键部署

### 在本机终端执行以下命令：

#### 步骤 1: 登录 Firebase（首次需要）

```bash
firebase login
```

这会自动打开浏览器，使用 Gmail 账号登录并授权。

---

#### 步骤 2: 执行自动部署

```bash
# Windows PowerShell
cd /home/node/openclaw1/projects/ai-companion/web
bash firebase-auto-deploy.sh

# 或使用 git bash
cd /home/node/openclaw1/projects/ai-companion/web
sh firebase-auto-deploy.sh
```

**或者直接使用 Firebase CLI 部署：**

```bash
cd /home/node/openclaw1/projects/ai-companion/web

firebase deploy --only hosting
```

---

## 📱 部署后访问

成功后会显示公网地址：

```
✅ Deploy complete!

Hosting URL: https://ai-companion.web.app

📱 访问地址：
   https://ai-companion.web.app/vaporwave/h5.html
   https://ai-companion.web.app/vaporwave/desktop.html
   https://ai-companion.web.app/vaporwave/index.html
```

---

## 🔍 配置验证

### 部署前验证（可选）

```bash
# 检查 Firebase 项目配置
cd /home/node/openclaw1/projects/ai-companion/web
cat firebase.json
cat .firebaserc

# 验证 vaporwave 文件
ls -lh vaporwave/
```

### 预期输出

**vaporwave/ 目录应该包含**：
- ✅ `h5.html` (10.6KB)
- ✅ `desktop.html` (17.2KB)
- ✅ `index.html` (12.0KB)
- ✅ `style.css` (6.1KB)

---

## ⚡ 快速部署（简化版）

如果遇到 shell 脚本兼容性问题，可以直接使用以下命令：

```bash
cd /home/node/openclaw1/projects/ai-companion/web

firebase login
firebase deploy --only hosting
```

---

## 🆘 故障排查

### 问题 1: firebase login 失败
**解决方案**：
- 确保可以访问互联网
- 使用 Gmail 账号登录
- 授予 Firebase CLI 权限

### 问题 2: 没有创建 Firebase 项目
**解决方案**：
访问 https://console.firebase.google.com/
点击 "添加项目" → 命名 `ai-companion` → 创建

### 问题 3: 找不到 vaporwave 目录
**解决方案**：
检查当前目录是否正确：
```bash
cd /home/node/openclaw1/projects/ai-companion/web
ls -lh vaporwave/
```

### 问题 4: 部署失败
**解决方案**：
- 确认已登录：`firebase use`
- 检查网络连接
- 查看 Firebase 错误信息

---

## ✨ 部署成功后

- ✅ 三星 Android 4G 手机可直接访问公网地址
- ✅ 支持 HTTPS（自动证书）
- ✅ 全球 CDN 加速
- ✅ 永久免费托管

---

_配置完成时间: 2025-02-23 17:30 PM (UTC)_

---

**请在本地执行上述命令，部署完成后告诉我公网 URL！** 🚀
