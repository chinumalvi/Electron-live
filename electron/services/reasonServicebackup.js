// electron/services/reasonService.js
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const reasonsFile = path.join(dataDir, 'reasons.json');

// ensure data folder exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Save reason with timestamp
async function saveIdleReason(reason) {
  const rec = { reason, timestamp: new Date().toISOString() };
  let arr = [];
  if (fs.existsSync(reasonsFile)) {
    try {
      arr = JSON.parse(fs.readFileSync(reasonsFile, 'utf8') || '[]');
    } catch (e) {
      arr = [];
    }
  }
  arr.push(rec);
  fs.writeFileSync(reasonsFile, JSON.stringify(arr, null, 2), 'utf8');
  console.log('Idle reason saved:', rec);
}

module.exports = { saveIdleReason };
