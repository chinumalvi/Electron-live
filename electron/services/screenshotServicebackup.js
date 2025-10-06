const { desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');

async function takeScreenshot() {
  // Get all sources (screen + windows)
  const sources = await desktopCapturer.getSources({ types: ['screen'] });

  // Take first screen
  const screenSource = sources[0];

  // The thumbnail is a nativeImage
  const image = screenSource.thumbnail;
  if (!image) throw new Error("No image captured");

  // Create screenshots folder if not exist
  const screenshotsDir = path.join(__dirname, '../../screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  // Save PNG file
  const filePath = path.join(screenshotsDir, `${Date.now()}.png`);
  fs.writeFileSync(filePath, image.toPNG());

  return filePath;
}

module.exports = { takeScreenshot };
