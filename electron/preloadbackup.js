const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getActivities: () => ipcRenderer.invoke("get-activities"),
  onShowReasonModal: (callback) => ipcRenderer.on("show-reason-modal", callback),
  onCountdownUpdate: (callback) =>
    ipcRenderer.on("update-countdown", (event, value) => callback(value)),
});
