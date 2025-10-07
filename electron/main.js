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
let currentActivity = null; // tracks current session
let countdown = null;       // countdown for idle reason modal
let isCountdownActive = false;
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
  const idleThresholdSec = 60;  
  const awayThresholdSec = 300; 
  const countdownSec = 15;

  setInterval(async () => {
    const idleTime = powerMonitor.getSystemIdleTime(); 
    let status;
    if (idleTime >= awayThresholdSec) status = "Away";
    else if (idleTime >= idleThresholdSec) status = "Idle";
    else status = "Active";

    const now = new Date();

    if (!currentActivity || currentActivity.status !== status) {
      if (currentActivity) {
        currentActivity.endTime = now;
        const spentTime = currentActivity.endTime - currentActivity.startTime;
        await Activity.create({
          userId: currentActivity.userId || "test-user",
          startTime: currentActivity.startTime,
          endTime: currentActivity.endTime,
          spentTime,
          userActivityStatus: currentActivity.status,
          workingStatus: currentActivity.status === "Active" ? "Working" : "Break",
          reasonStatus: currentActivity.reasonStatus || "",
          screenshotPath: currentActivity.screenshotPath || null,
        });
      }

      currentActivity = {
        userId: "test-user",
        status,
        startTime: now,
        screenshotPath: null,
        reasonStatus: "",
      };

      // Reset countdown flags when starting new session
      countdown = null;
      isCountdownActive = false;
    }

    if (status === "Idle" && !currentActivity.reasonStatus) {
      if (!isCountdownActive) {
        countdown = countdownSec;
        isCountdownActive = true;
      }

      if (countdown > 0) {
        countdown -= 1;
        mainWindow.webContents.send("update-countdown", countdown);
      } else if (countdown === 0) {
        mainWindow.webContents.send("show-reason-modal");
        // Pause idle tracking here by setting countdown to null
        countdown = null;
        isCountdownActive = false;
      }
    } else {
      // reset countdown if user becomes active
      countdown = null;
      isCountdownActive = false;
    }

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
    if (!currentActivity) {
      return { success: false, error: "No current session found" };
    }

    currentActivity.reasonStatus = reason;

    if (currentActivity._id) {
      // Update existing session in DB
      await Activity.findByIdAndUpdate(currentActivity._id, {
        reasonStatus: reason,
      });
    } else {
      // Save new session in DB
      const activity = await Activity.create({
        userId: currentActivity.userId || "test-user",
        startTime: currentActivity.startTime,
        endTime: currentActivity.endTime || null,
        spentTime: currentActivity.endTime
          ? currentActivity.endTime - currentActivity.startTime
          : null,
        userActivityStatus: currentActivity.status,
        workingStatus:
          currentActivity.status === "Active" ? "Working" : "Break",
        reasonStatus: reason,
        screenshotPath: currentActivity.screenshotPath || null,
      });
      currentActivity._id = activity._id;
    }

    // Optional: also save to local JSON
    await saveIdleReason(reason);

    return { success: true };
  } catch (err) {
    console.error("save-idle-reason error:", err);
    return { success: false, error: err.message };
  }
});

// -------------------------- GET PRODUCTIVE TIME --------------------------
ipcMain.handle("get-productive-time", async () => {
  const metrics = await calculateTodayMetrics("test-user");
  return { success: true, ...metrics };
});

// -------------------------- GET IDLE TIME --------------------------
ipcMain.handle("get-idle-time", async () => {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch (err) {
    console.error("get-idle-time error:", err);
    return 0;
  }
});

// -------------------------- GET ALL SESSIONS --------------------------
ipcMain.handle("get-activities", async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  let sessions = await Activity.find({
    userId: "test-user",
    startTime: { $gte: todayStart, $lte: todayEnd },
  }).lean();

  // Include current ongoing session
  if (currentActivity) {
    sessions.push({
      ...currentActivity,
      startTime: currentActivity.startTime.toISOString(),
      endTime: currentActivity.endTime
        ? currentActivity.endTime.toISOString()
        : null,
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

  if (!sessions.length)
    return {
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

  let idleTime = 0;
  let awayTime = 0;

  sessions.forEach((s) => {
    const start = s.startTime ? s.startTime.getTime() : null;
    const end = s.endTime ? s.endTime.getTime() : Date.now();
    if (start !== null) {
      const duration = end - start;
      if (s.userActivityStatus === "Idle") idleTime += duration;
      if (s.userActivityStatus === "Away") awayTime += duration;
    }
  });

  const nonProductiveTime = idleTime + awayTime;
  const totalSpendTime =
    idleTime +
    awayTime +
    sessions.reduce((acc, s) => {
      if (s.userActivityStatus === "Active") {
        const start = s.startTime ? s.startTime.getTime() : 0;
        const end = s.endTime ? s.endTime.getTime() : Date.now();
        return acc + (end - start);
      }
      return acc;
    }, 0);

  const productiveTime = totalSpendTime - nonProductiveTime;

  return {
    startTime: sessions[0].startTime,
    endTime: sessions[sessions.length - 1].endTime || new Date(),
    totalSpendTime,
    idleTime: Math.floor(idleTime / 60000), // minutes
    awayTime: Math.floor(awayTime / 60000),
    nonProductiveTime: Math.floor(nonProductiveTime / 60000),
    productiveTime: Math.floor(productiveTime / 60000),
    productiveHours: (productiveTime / 3600000).toFixed(2),
    productiveMinutes: Math.floor(productiveTime / 60000),
  };
}
