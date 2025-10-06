// -------------------------- MAIN.JS --------------------------

// --- Load environment variables ---
require("dotenv").config();

// --- DB imports ---
const connectDB = require("./services/db/connect");
const Activity = require("./services/db/models/Activity");

// --- Electron imports ---
const { app, BrowserWindow, ipcMain, powerMonitor } = require("electron");
const path = require("path");

// --- Services imports ---
const { takeScreenshot } = require("./services/screenshotService");
const { saveIdleReason } = require("./services/reasonService");

// -------------------------- GLOBAL VARIABLES --------------------------
let mainWindow;
let currentActivity = null; // current session (Active / Idle / Away)
let countdown = null;       // countdown for idle reason modal

// -------------------------- CONNECT TO MONGODB --------------------------
connectDB(process.env.MONGO_URI);

// -------------------------- CREATE ELECTRON WINDOW --------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    focusable: true,
  });

  mainWindow.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  createWindow();
  startIdleTracking();
  startAutoScreenshot();
});

// -------------------------- IDLE / ACTIVE / AWAY TRACKING --------------------------
function startIdleTracking() {
  const idleThresholdSec = 60;  // 1 min idle = Idle
  const awayThresholdSec = 300; // 5 min idle = Away
  const countdownSec = 15;      // countdown before showing idle reason modal

  setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime(); // seconds

    // Determine session status
    let status;
    if (idleTime >= awayThresholdSec) status = "Away";
    else if (idleTime >= idleThresholdSec) status = "Idle";
    else status = "Active";

    const now = new Date();

    // ----- Handle session change -----
    if (!currentActivity || currentActivity.status !== status) {
      // Close previous session
      if (currentActivity) {
        currentActivity.endTime = now;
        const spentTime = currentActivity.endTime - currentActivity.startTime;

        await Activity.create({
          userId: "test-user",
          startTime: currentActivity.startTime,
          endTime: currentActivity.endTime,
          spentTime,
          userActivityStatus: currentActivity.status,
          workingStatus: currentActivity.status === "Active" ? "Working" : "Break",
          reasonStatus: currentActivity.reasonStatus || "",
          screenshotPath: currentActivity.screenshotPath || null,
        });
      }

      // Start new session
      currentActivity = {
        status,
        startTime: now,
        screenshotPath: null,
        reasonStatus: "",
      };
    }

    // ----- Countdown logic for Idle Reason -----
    if (status === "Idle") {
      if (countdown === null) countdown = countdownSec;
      countdown -= 1;
      mainWindow.webContents.send("update-countdown", countdown);

      if (countdown <= 0) {
        mainWindow.webContents.send("show-reason-modal");
        countdown = null;
      }
    } else {
      countdown = null;
    }

    // ----- Send live metrics to UI -----
    const metrics = await calculateTodayMetrics("test-user");
    mainWindow.webContents.send("update-times", metrics);

  }, 1000);
}

// -------------------------- AUTO SCREENSHOT --------------------------
function startAutoScreenshot() {
  setInterval(async () => {
    try {
      if (currentActivity && currentActivity.status === "Active") {
        const screenshotPath = await takeScreenshot();
        currentActivity.screenshotPath = screenshotPath;
        console.log("Screenshot saved:", screenshotPath);
      }
    } catch (err) {
      console.error("Screenshot error:", err);
    }
  }, 60 * 1000);
}

// -------------------------- SAVE IDLE REASON --------------------------
ipcMain.handle("save-idle-reason", async (event, reason) => {
  try {
    if (currentActivity && currentActivity.status === "Idle") {
      currentActivity.reasonStatus = reason;

      // Save to MongoDB immediately
      await Activity.create({
        userId: "test-user",                     // replace with actual user id
        startTime: currentActivity.startTime,    // session start
        endTime: new Date(),                     // end now
        spentTime: 0,                            // optional, can calculate later
        userActivityStatus: currentActivity.status,
        workingStatus: "Break",                  // because Idle
        reasonStatus: reason,
        screenshotPath: currentActivity.screenshotPath || null,
      });

      // Optional: still save to JSON if your service uses it
      await saveIdleReason(reason);
    }
    return { success: true };
  } catch (err) {
    console.error("save-idle-reason error:", err);
    return { success: false, error: err.message };
  }
});

// -------------------------- GET PRODUCTIVE / IDLE / AWAY METRICS --------------------------
ipcMain.handle("get-productive-time", async () => {
  const metrics = await calculateTodayMetrics("test-user");
  return { success: true, ...metrics };
});

// -------------------------- GET IDLE TIME --------------------------
ipcMain.handle("get-idle-time", async () => {
  try {
    return powerMonitor.getSystemIdleTime(); // seconds
  } catch (err) {
    console.error("get-idle-time error:", err);
    return 0;
  }
});

// -------------------------- GET ALL SESSIONS FOR TODAY --------------------------
ipcMain.handle("get-activities", async () => {
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayEnd = new Date();
  todayEnd.setHours(23,59,59,999);

  let sessions = await Activity.find({
    userId: "test-user",
    startTime: { $gte: todayStart, $lte: todayEnd },
  }).lean();

  // add current ongoing session if exists
  if (currentActivity) {
    sessions.push({
      ...currentActivity,
      startTime: currentActivity.startTime.toISOString(),
      endTime: currentActivity.endTime ? currentActivity.endTime.toISOString() : null,
      userActivityStatus: currentActivity.status,
      reasonStatus: currentActivity.reasonStatus || "",
      screenshotPath: currentActivity.screenshotPath || null,
      userId: "test-user",
    });
  }

  return { success: true, data: sessions };
});

// -------------------------- CALCULATE TODAY METRICS --------------------------
async function calculateTodayMetrics(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const sessions = await Activity.find({
    userId,
    startTime: { $gte: todayStart, $lte: todayEnd },
  });

  if (!sessions.length) return {
    startTime: null,
    endTime: null,
    totalSpendTime: 0,
    idleTime: 0,
    awayTime: 0,
    nonProductiveTime: 0,
    productiveTime: 0,
    productiveHours: "0.00",
    productiveMinutes: 0,
  };

  const startTimeArr = sessions.map(s => s.startTime).filter(Boolean).map(d => d.getTime());
  const endTimeArr = sessions.map(s => s.endTime ? s.endTime.getTime() : Date.now());

  const startTime = startTimeArr.length ? Math.min(...startTimeArr) : null;
  const endTime = endTimeArr.length ? Math.max(...endTimeArr) : null;
  const totalSpendTime = startTime && endTime ? endTime - startTime : 0;

  let idleTime = 0;
  let awayTime = 0;

  sessions.forEach(s => {
    const start = s.startTime ? s.startTime.getTime() : null;
    const end = s.endTime ? s.endTime.getTime() : Date.now();

    if (start !== null) {
      const duration = end - start;
      if (s.userActivityStatus === "Idle") idleTime += duration;
      if (s.userActivityStatus === "Away") awayTime += duration;
    }
  });

  const nonProductiveTime = idleTime + awayTime;
  const productiveTime = totalSpendTime - nonProductiveTime;

  return {
    startTime: startTime ? new Date(startTime).toISOString() : null,
    endTime: endTime ? new Date(endTime).toISOString() : null,
    totalSpendTime,
    idleTime,
    awayTime,
    nonProductiveTime,
    productiveTime,
    productiveHours: (productiveTime / 3600000).toFixed(2),
    productiveMinutes: Math.floor(productiveTime / 60000),
  };
}
