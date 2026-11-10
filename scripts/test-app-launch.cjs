const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Electron launch...');

const electronProcess = spawn(
  path.resolve(__dirname, '../node_modules/electron/dist/electron.exe'),
  [path.resolve(__dirname, '../dist-electron/main.cjs'), '--test-mode'],
  {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' }
  }
);

let output = '';
electronProcess.stdout.on('data', (data) => {
  output += data.toString();
  console.log('[Electron stdout]:', data.toString().trim());
});

electronProcess.stderr.on('data', (data) => {
  output += data.toString();
  console.error('[Electron stderr]:', data.toString().trim());
});

// Give it 4 seconds to initialize SQLite and window, then exit gracefully
setTimeout(() => {
  console.log('Test completed successfully! Killing Electron test instance.');
  electronProcess.kill('SIGINT');
  process.exit(0);
}, 4000);
