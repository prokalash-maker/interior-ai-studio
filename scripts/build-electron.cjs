const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '../dist-electron');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.copyFileSync(
  path.resolve(__dirname, '../electron/main.cjs'),
  path.resolve(outDir, 'main.cjs')
);

fs.copyFileSync(
  path.resolve(__dirname, '../electron/preload.cjs'),
  path.resolve(outDir, 'preload.cjs')
);

console.log('Electron scripts prepared successfully in dist-electron/');
