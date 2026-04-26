/**
 * src/preload.js
 * 安全桥接：把主进程 API 暴露给渲染进程
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getPaths:  ()              => ipcRenderer.invoke("get-paths"),
  saveFile:  (data)          => ipcRenderer.invoke("save-file", data),
  openFile:  (filePath)      => ipcRenderer.invoke("open-file", filePath),
  onMessage: (cb)            => ipcRenderer.on("message", (_, v) => cb(v)),
});
