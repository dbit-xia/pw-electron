/**
 * src/main.js
 * Electron 主进程 — 只负责创建窗口和暴露 IPC
 * Playwright 从外部连接进来控制它
 */

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const os   = require("os");
const fs   = require("fs");
const electron_1 = require("electron");

// ── 让 Playwright 能连接进来的关键参数 ──────────────────
// 必须加这两个 flag，Playwright 才能通过 CDP 协议接管窗口
// app.commandLine.appendSwitch("remote-debugging-port", "9222");
// app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    // width: 1280,
    // height: 800,
    // show: true,   // RPA 时可改 false 实现无头模式
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // contextIsolation: true,
      // nodeIntegration: false,
      // // 注意：sandbox 关闭才能让 CDP 文件注入正常工作
      // sandbox: false,
    },
  });

  // 加载一个演示页面（包含文件上传 input）
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // 开发时打开 DevTools
  // mainWindow.webContents.openDevTools();

  // addRightClickMenu(mainWindow);
}

function addRightClickMenu(pageView) {
  pageView.webContents.on('context-menu', function (event, params) {
    const menu = electron_1.Menu.buildFromTemplate([
      { label: '复制', role: 'copy' },
      { label: '剪切', role: 'cut' },
      { label: '粘贴', role: 'paste' },
      {
        label: '刷新', click: () => {
          this.reload();
        }
      },
      { type: 'separator' },
      {
        label: '调试模式',
        click: function () {
          pageView.webContents.openDevTools();
        }
      },
      {
        label: '检查元素',
        click: function () {
          // 可以在右键点击的确切位置打开检查
          pageView.webContents.inspectElement(params.x, params.y);
        }
      }
    ]);
    menu.popup();
  });
}

app.whenReady().then(createWindow);
// app.on("window-all-closed", () => {
//   if (process.platform !== "darwin") app.quit();
// });
//
// // ── IPC：获取桌面路径 ────────────────────────────────────
// ipcMain.handle("get-paths", () => ({
//   desktop:  getDesktop(),
//   download: path.join(os.homedir(), "Downloads"),
//   home:     os.homedir(),
// }));
//
// // ── IPC：保存文件 ────────────────────────────────────────
// ipcMain.handle("save-file", (_, { filePath, base64Data }) => {
//   const dir = path.dirname(filePath);
//   fs.mkdirSync(dir, { recursive: true });
//   fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
//   return { success: true, filePath };
// });
//
// // ── IPC：用系统默认程序打开文件 ─────────────────────────
// ipcMain.handle("open-file", (_, filePath) => shell.openPath(filePath));
//
// function getDesktop() {
//   const candidates = [
//     path.join(os.homedir(), "Desktop"),
//     path.join(os.homedir(), "桌面"),
//     os.homedir(),
//   ];
//   return candidates.find(fs.existsSync) || os.homedir();
// }
