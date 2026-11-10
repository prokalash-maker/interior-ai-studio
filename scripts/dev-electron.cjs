const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Ensure dist-electron exists
require('./build-electron.cjs');

console.log('Starting Vite dev server...');
const vite = spawn('npx.cmd', ['vite'], {
  stdio: 'inherit',
  shell: true,
});

function checkViteReady() {
  const req = http.get('http://localhost:5173', (res) => {
    console.log('Vite server is ready! Launching Electron...');
    const electron = spawn('npx.cmd', ['electron', 'dist-electron/main.cjs'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VITE_DEV: 'true',
      },
    });

    electron.on('close', () => {
      vite.kill();
      process.exit();
    });
  });

  req.on('error', () => {
    setTimeout(checkViteReady, 300);
  });
}

setTimeout(checkViteReady, 1000);
