// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ---------------------------
  // Activity tracking functions
  // ---------------------------
  getIdleTime: () => ipcRenderer.invoke("get-idle-time"),
  getActivities: () => ipcRenderer.invoke("get-activities"),
  getProductiveTime: () => ipcRenderer.invoke("get-productive-time"),
  saveIdleReason: (reason) => ipcRenderer.invoke("save-idle-reason", reason),

  // Events from main process
  onUpdateCountdown: (callback) =>
    ipcRenderer.on("update-countdown", (event, count) => callback(count)),
  onShowReasonModal: (callback) =>
    ipcRenderer.on("show-reason-modal", () => callback()),
  onUpdateTimes: (callback) =>
    ipcRenderer.on("update-times", (event, metrics) => callback(metrics)),

  // ---------------------------
  // Authentication functions
  // ---------------------------
  // registerUser: (userData) => ipcRenderer.invoke("register-user", userData),
  // loginUser: (credentials) => ipcRenderer.invoke("login-user", credentials),
  // logoutUser: () => ipcRenderer.invoke("logout-user"),
  // getCurrentUser: () => ipcRenderer.invoke("get-current-user"),

  getCurrentUser: () => ipcRenderer.invoke("getCurrentUser"),
  loginUser: (data) => ipcRenderer.invoke("loginUser", data),
  registerUser: (data) => ipcRenderer.invoke("registerUser", data),
  logoutUser: () => ipcRenderer.invoke("logoutUser"),

  // ---------------------------
  // Admin functions
  // ---------------------------
  getAllUsers: () => ipcRenderer.invoke("admin-get-users"),
  createUser: (userData) => ipcRenderer.invoke("admin-create-user", userData),
  deleteUser: (userId) => ipcRenderer.invoke("admin-delete-user", userId),
  updateUser: (userId, updates) =>
    ipcRenderer.invoke("admin-update-user", { userId, updates }),
  
});