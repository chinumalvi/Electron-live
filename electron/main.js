// -------------------------- MAIN.JS --------------------------

// --- Load environment variables ---
require("dotenv").config();
const connectDB = require("./services/db/connect");
const Activity = require("./services/db/models/Activity");

const { app, BrowserWindow, ipcMain, powerMonitor } = require("electron");
const path = require("path");

const { takeScreenshot } = require("./services/screenshotService");
const { saveIdleReason } = require("./services/reasonService");

const bcrypt = require("bcryptjs");
const User = require("./services/db/models/User");

let mainWindow;
let currentActivity = null;
let countdown = null;
let isCountdownActive = false;
global.currentUser = null; // <— store logged-in user globally

connectDB(process.env.MONGO_URI);

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

// -------------------------- AUTH IPC HANDLERS --------------------------

// ----- REGISTER USER -----
ipcMain.handle("registerUser", async (event, { username, password, role = "user" }) => {
  try {
    if (!username || !password)
      return { success: false, error: "Missing username or password" };

    const existing = await User.findOne({ username });
    if (existing) return { success: false, error: "User already exists" };

    const adminExists = await User.exists({ role: "admin" });
    if (adminExists && (!global.currentUser || global.currentUser.role !== "admin")) {
      return { success: false, error: "Only admin can create new users" };
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, passwordHash: hash, role });

    return { success: true, user: { id: newUser._id.toString(), username, role } };
  } catch (err) {
    console.error("registerUser error:", err);
    return { success: false, error: err.message };
  }
});

// ----- LOGIN USER -----
ipcMain.handle("loginUser", async (event, { username, password }) => {
  try {
    const user = await User.findOne({ username });
    if (!user) return { success: false, error: "User not found" };

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return { success: false, error: "Invalid password" };

    global.currentUser = { _id: user._id, username: user.username, role: user.role };
    console.log("User logged in:", global.currentUser);

    currentActivity = null;
    countdown = null;
    isCountdownActive = false;

    return { success: true, user: global.currentUser };
  } catch (err) {
    console.error("loginUser error:", err);
    return { success: false, error: err.message };
  }
});

// ----- LOGOUT USER -----
ipcMain.handle("logoutUser", async () => {
  try {
    if (currentActivity) {
      currentActivity.endTime = new Date();
      const spentTime = currentActivity.endTime - currentActivity.startTime;
      await Activity.create({
        userId: currentActivity.userId,
        startTime: currentActivity.startTime,
        endTime: currentActivity.endTime,
        spentTime,
        userActivityStatus: currentActivity.status,
        workingStatus: currentActivity.status === "Active" ? "Working" : "Break",
        reasonStatus: currentActivity.reasonStatus || "",
        screenshotPath: currentActivity.screenshotPath || null,
      });
    }
    global.currentUser = null;
    currentActivity = null;
    countdown = null;
    isCountdownActive = false;

    return { success: true };
  } catch (err) {
    console.error("logoutUser error:", err);
    return { success: false, error: err.message };
  }
});

// ----- GET CURRENT USER -----
ipcMain.handle("getCurrentUser", async () => {
  return global.currentUser
    ? { success: true, user: global.currentUser }
    : { success: true, user: null };
});

// -------------------------- ADMIN USER MANAGEMENT --------------------------

// ----- admin-get-users -----
ipcMain.handle("admin-get-users", async () => {
  try {
    if (!global.currentUser || global.currentUser.role !== "admin")
      return { success: false, error: "Unauthorized" };

    const users = await User.find().select("-passwordHash").lean();
    return { success: true, users };
  } catch (err) {
    console.error("admin-get-users error:", err);
    return { success: false, error: err.message };
  }
});

// ----- admin-create-user -----
ipcMain.handle("admin-create-user", async (event, { username, password, role }) => {
  try {
    if (!global.currentUser || global.currentUser.role !== "admin")
      return { success: false, error: "Unauthorized" };

    const exists = await User.findOne({ username });
    if (exists) return { success: false, error: "User already exists" };

    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, passwordHash: hash, role });

    return { success: true, user: { id: newUser._id.toString(), username, role } };
  } catch (err) {
    console.error("admin-create-user error:", err);
    return { success: false, error: err.message };
  }
});

// ----- admin-update-user -----
ipcMain.handle("admin-update-user", async (event, { id, username, password, role }) => {
  try {
    if (!global.currentUser || global.currentUser.role !== "admin")
      return { success: false, error: "Unauthorized" };

    const updates = {};
    if (username) updates.username = username;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);
    if (role) updates.role = role;

    const updated = await User.findByIdAndUpdate(id, updates, { new: true }).select(
      "-passwordHash"
    );

    return { success: true, user: updated };
  } catch (err) {
    console.error("admin-update-user error:", err);
    return { success: false, error: err.message };
  }
});

// ----- admin-delete-user -----
ipcMain.handle("admin-delete-user", async (event, id) => {
  try {
    if (!global.currentUser || global.currentUser.role !== "admin")
      return { success: false, error: "Unauthorized" };

    await User.findByIdAndDelete(id);
    return { success: true };
  } catch (err) {
    console.error("admin-delete-user error:", err);
    return { success: false, error: err.message };
  }
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



