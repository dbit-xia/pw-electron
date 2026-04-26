# Playwright + Electron RPA 示例

## 项目结构

```
pw-electron/
├── package.json
├── src/
│   ├── main.js       # Electron 主进程
│   ├── preload.js    # IPC 安全桥接
│   └── index.html    # 演示页面（含文件上传表单）
├── automation/
│   └── rpa.js        # Playwright 自动化脚本（核心）
└── README.md
```

## 安装 & 运行

```bash
# 1. 安装依赖
npm install

# 2. 下载 Playwright 所需的 Chromium（只需一次）
npx playwright install chromium

# 3a. 直接启动 Electron 应用（手动操作模式）
npm start

# 3b. 运行 RPA 自动化脚本（全自动模式）
npm run rpa
```

## 核心原理

```
┌─────────────────────────────┐
│  node automation/rpa.js     │  ← 你的自动化脚本
│  (Playwright 控制器)         │
└────────────┬────────────────┘
             │ electron.launch() 启动
             │ CDP 协议连接
             ▼
┌─────────────────────────────┐
│  Electron App               │
│  ┌─────────────────────┐   │
│  │ main.js (主进程)     │   │
│  └──────────┬──────────┘   │
│             │ IPC           │
│  ┌──────────▼──────────┐   │
│  │ index.html (渲染进程) │   │  ← Playwright 操控这里
│  └─────────────────────┘   │
└─────────────────────────────┘
```

## 关键代码解析

### 1. 启动 Electron
```javascript
const { _electron: electron } = require("playwright");
const app = await electron.launch({ args: ["src/main.js"] });
const page = await app.firstWindow();
```

### 2. 文件上传拦截（核心）
```javascript
// ✅ 先注册监听，再触发点击（顺序很重要！）
const fileChooserPromise = page.waitForEvent("filechooser");
await page.click("#uploadZone");          // 触发文件选择弹窗
const fileChooser = await fileChooserPromise;
await fileChooser.setFiles("/path/to/file.png");  // 直接注入，不弹系统窗口
```

### 3. 在主进程中执行代码
```javascript
// electronApp.evaluate 可以直接在主进程运行任意代码
const result = await app.evaluate(async ({ app }) => {
  return app.getVersion();
});
```

## 与纯 Electron 对比

| 能力 | 纯 Electron | + Playwright |
|------|------------|--------------|
| 文件上传拦截 | 需要 CDP 黑魔法，容易出错 | `fileChooser.setFiles()` 一行搞定 |
| 等待元素 | 手写 sleep/轮询 | `waitForSelector()` 智能等待 |
| 表单填写 | `executeJavaScript` 字符串 | `page.fill()` 类型安全 |
| 断言验证 | 手动判断 | `expect(locator).toHaveText()` |
| 截图 | 需要额外配置 | `page.screenshot()` 内置 |
| 主进程调用 | 只能通过 IPC | `app.evaluate()` 直接执行 |
