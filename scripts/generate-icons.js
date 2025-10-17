/**
 * Simple icon generation script.
 * Takes base logo at assets/logo-source.png (1024x1024) and generates Android mipmaps & iOS icons.
 * Requires: sharp (installed as devDependency) and a square PNG source.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.resolve(__dirname, '../assets/logo-source.png');

if (!fs.existsSync(SOURCE)) {
  console.error('Missing source file: assets/logo-source.png');
  console.error('Please add a 1024x1024 PNG named logo-source.png to assets folder.');
  process.exit(1);
}

// Android mipmap targets
const androidTargets = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 }
];

const androidResPath = path.resolve(__dirname, '../android/app/src/main/res');

async function generateAndroid() {
  for (const target of androidTargets) {
    const outDir = path.join(androidResPath, target.dir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    await sharp(SOURCE)
      .resize(target.size, target.size)
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'));
    await sharp(SOURCE)
      .resize(target.size, target.size)
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'));
    console.log('Generated', target.dir);
  }
}

// Basic iOS icon sizes (add more as needed)
const iosIconSizes = [20, 29, 40, 60, 76, 83.5, 1024];
const iosPath = path.resolve(__dirname, '../ios/Jorvea/Images.xcassets/AppIcon.appiconset');

async function generateIOS() {
  for (const size of iosIconSizes) {
    const base = size;
    const filename = `icon-${size}.png`;
    await sharp(SOURCE)
      .resize(Math.round(base), Math.round(base))
      .png()
      .toFile(path.join(iosPath, filename));
    // Generate @2x and @3x where appropriate (exclude marketing 1024)
    if (size < 512) {
      await sharp(SOURCE).resize(base * 2, base * 2).png().toFile(path.join(iosPath, `icon-${size}@2x.png`));
    }
    if (size <= 60) {
      await sharp(SOURCE).resize(base * 3, base * 3).png().toFile(path.join(iosPath, `icon-${size}@3x.png`));
    }
    console.log('Generated iOS size', size);
  }
  console.log('Remember to update Contents.json if adding new files.');
}

(async () => {
  try {
    await generateAndroid();
    await generateIOS();
    console.log('Icon generation complete.');
  } catch (e) {
    console.error('Icon generation failed:', e);
    process.exit(1);
  }
})();
