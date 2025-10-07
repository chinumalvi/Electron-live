// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getIdleTime: () => ipcRenderer.invoke("get-idle-time"),
  getActivities: () => ipcRenderer.invoke("get-activities"),
  getProductiveTime: () => ipcRenderer.invoke("get-productive-time"),
  saveIdleReason: (reason) => ipcRenderer.invoke("save-idle-reason", reason),

  // Event listeners from main
  onUpdateCountdown: (callback) => ipcRenderer.on("update-countdown", (event, count) => callback(count)),
  onShowReasonModal: (callback) => ipcRenderer.on("show-reason-modal", () => callback()),

  // optional: listen to live metric updates sent by main
  onUpdateTimes: (callback) => ipcRenderer.on("update-times", (event, metrics) => callback(metrics)),
});