const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getIdleTime: () => ipcRenderer.invoke("get-idle-time"),
  saveIdleReason: (reason) => ipcRenderer.invoke("save-idle-reason", reason),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getActivities: () => ipcRenderer.invoke("get-activities"),
  getProductiveTime: () => ipcRenderer.invoke("get-productive-time"),

  // New listeners for modal
  onShowReasonModal: (callback) => ipcRenderer.on("show-reason-modal", callback),
  onUpdateCountdown: (callback) =>
    ipcRenderer.on("update-countdown", (event, countdown) => callback(countdown)),
});
