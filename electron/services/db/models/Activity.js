const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  userId: { type: String, required: true },
startTime: { type: Date, default: Date.now },
endTime: Date,
spentTime: Number,
userActivityStatus: { type: String, enum: ["Active","Idle","Away"], default: "Active" },
workingStatus: { type: String, enum: ["Working","Break"], default: "Working" },
reasonStatus: { type: String, default: "" },
screenshotPath: { type: String, default: null },
},{ collection: "activity" });

module.exports = mongoose.model("Activity", activitySchema);
