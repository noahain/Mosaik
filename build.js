const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building Mosaik...');

// Ensure assets are properly set up for build
const assetsDir = path.join(__dirname, 'assets', 'icons');
const buildResourcesDir = path.join(__dirname, 'build');

// Create build resources directory if it doesn't exist
if (!fs.existsSync(buildResourcesDir)) {
  fs.mkdirSync(buildResourcesDir, { recursive: true });
}

// Copy icons to build resources
const iconFiles = ['icon.ico', 'tray.ico', 'icon.png', 'tray.png'];
iconFiles.forEach(file => {
  const srcPath = path.join(assetsDir, file);
  const destPath = path.join(buildResourcesDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} to build resources`);
  }
});

console.log('Running electron-builder...');
try {
  execSync('npx electron-builder --win', { stdio: 'inherit' });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
