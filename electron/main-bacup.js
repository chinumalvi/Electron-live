const { app, BrowserWindow, ipcMain, powerMonitor } = require("electron");
const path = require("path");
const { takeScreenshot } = require("./services/screenshotService");

let mainWindow;
let currentActivity = null;
let activities = [];
let countdown = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  createWindow();
  startIdleTracking();
  startAutoScreenshot();
});

// ----------------- Idle Tracking -----------------
function startIdleTracking() {
  const idleThresholdSec = 60; // 1 min
  const countdownSec = 15;

  setInterval(() => {
    const idleTimeSec = powerMonitor.getSystemIdleTime();

    if (!currentActivity) {
      currentActivity = {
        id: Date.now(),
        status: idleTimeSec >= idleThresholdSec ? "Idle" : "Active",
        startTime: new Date(),
      };
      activities.push(currentActivity);
    } else {
      if (idleTimeSec >= idleThresholdSec && countdown === null) {
        countdown = countdownSec;
        console.log("Idle threshold crossed. Countdown started:", countdown);
      }
      if (idleTimeSec < idleThresholdSec) {
        countdown = null;
      }

      currentActivity.status =
        idleTimeSec >= idleThresholdSec ? "Idle" : "Active";
    }

    if (countdown !== null) {
      countdown -= 1;
      console.log("Countdown:", countdown);
      mainWindow.webContents.send("update-countdown", countdown);

      if (countdown <= 0) {
        if (currentActivity.status !== "Idle") {
          currentActivity.status = "Idle";
          mainWindow.webContents.send("show-reason-modal");
        }
        countdown = null;
      }
    }
  }, 1000);
}

// ----------------- Auto Screenshot -----------------
function startAutoScreenshot() {
  setInterval(async () => {
    try {
      if (currentActivity && currentActivity.status === "Active") {
        const path = await takeScreenshot();
        currentActivity.screenshotPath = path;
        console.log("Screenshot:", path);
      }
    } catch (err) {
      console.error("Screenshot error:", err);
    }
  }, 60 * 1000);
}

// ----------------- IPC -----------------
ipcMain.handle("get-activities", () => ({
  success: true,
  data: activities,
}));
