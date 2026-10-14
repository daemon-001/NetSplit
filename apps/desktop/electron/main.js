const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let serviceProcess = null;

function getServicePath() {
  const devPath = path.resolve(__dirname, '../../../native/windows-service/NetSplitService.exe');
  if (fs.existsSync(devPath)) return devPath;
  const prodPath = path.resolve(process.resourcesPath || '', 'native/NetSplitService.exe');
  if (fs.existsSync(prodPath)) return prodPath;
  return devPath;
}

function getToken() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  
  const localTokenPath = path.join(localAppData, 'NetSplit', 'ipc_auth.token');
  const progTokenPath = path.join(programData, 'NetSplit', 'ipc_auth.token');

  const candidates = [];
  if (fs.existsSync(localTokenPath)) {
    try {
      const stat = fs.statSync(localTokenPath);
      const token = fs.readFileSync(localTokenPath, 'utf8').trim();
      if (token && token.length === 64) {
        candidates.push({ token, mtime: stat.mtimeMs });
      }
    } catch {}
  }

  if (fs.existsSync(progTokenPath)) {
    try {
      const stat = fs.statSync(progTokenPath);
      const token = fs.readFileSync(progTokenPath, 'utf8').trim();
      if (token && token.length === 64) {
        candidates.push({ token, mtime: stat.mtimeMs });
      }
    } catch {}
  }

  if (candidates.length === 0) return null;
  // Sort descending by mtime so the most freshly generated token is always preferred
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].token;
}

function checkServiceHealth() {
  const http = require('http');
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 48192,
        method: 'OPTIONS',
        timeout: 500,
      },
      () => resolve(true)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function checkProcessRunning(exeName) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, (err, stdout) => {
      if (!err && stdout && stdout.toLowerCase().includes(exeName.toLowerCase())) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function ensureServiceRunning() {
  // If the service is already running and responding, NEVER prompt for UAC!
  const isHealthy = await checkServiceHealth();
  if (isHealthy) {
    console.log('[Electron] NetSplitService is already running and healthy. Skipping elevation prompt.');
    return;
  }

  // If the process is running but still initializing, give it a moment
  const isProcActive = await checkProcessRunning('NetSplitService.exe');
  if (isProcActive) {
    console.log('[Electron] NetSplitService process is already running. Waiting for startup.');
    return;
  }

  const serviceExe = getServicePath();
  if (!fs.existsSync(serviceExe)) return;

  console.log('[Electron] NetSplitService not running, launching elevated...');
  try {
    const psCmd = `Start-Process -FilePath '${serviceExe.replace(/'/g, "''")}' -ArgumentList '--background' -Verb RunAs`;
    const { exec } = require('child_process');
    exec(`powershell -NoProfile -Command "${psCmd}"`, (err) => {
      if (err) {
        console.warn('[Electron] Could not launch elevated service, falling back to standard spawn:', err.message);
        serviceProcess = spawn(serviceExe, ['--background'], {
          detached: true,
          windowsHide: true,
          stdio: 'ignore',
        });
        serviceProcess.unref();
      }
    });
  } catch (err) {
    console.warn('[Electron] Could not launch background service:', err.message);
  }
}

function createWindow() {
  ensureServiceRunning();

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0f172a',
    title: 'NetSplit — Per-Application Network Routing',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(indexPath) && !process.env.VITE_DEV_SERVER) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('get-token', async () => {
  for (let i = 0; i < 8; i++) {
    const token = getToken();
    if (token) return token;
    await new Promise((r) => setTimeout(r, 600));
  }
  return null;
});

ipcMain.handle('elevate-service', async () => {
  const scriptPath = path.resolve(__dirname, '../../../scripts/elevate-service.ps1');
  const { exec } = require('child_process');
  
  console.log('[Electron] Requesting elevated service restart via helper script...');

  // 1. Try to request clean shutdown of running daemon first if we have a token
  const currentToken = getToken();
  if (currentToken) {
    try {
      const http = require('http');
      await new Promise((resolve) => {
        const payload = JSON.stringify({ jsonrpc: '2.0', id: 'shutdown', method: 'system.shutdown' });
        const req = http.request({
          host: '127.0.0.1',
          port: 48192,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`,
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 1000,
        }, () => resolve());
        req.on('error', () => resolve());
        req.on('timeout', () => { req.destroy(); resolve(); });
        req.write(payload);
        req.end();
      });
      await new Promise((r) => setTimeout(r, 400));
    } catch {}
  }

  // 2. Run elevate-service.ps1 elevated via UAC RunAs
  const psCmd = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"${scriptPath}\"' -Verb RunAs -Wait`;
  await new Promise((resolve) => {
    exec(`powershell -NoProfile -WindowStyle Hidden -Command "${psCmd}"`, () => {
      resolve();
    });
  });

  // 3. Poll for service health and fresh token
  let freshToken = null;
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const healthy = await checkServiceHealth();
    if (healthy) {
      freshToken = getToken();
      if (freshToken) break;
    }
  }

  console.log('[Electron] Service restart complete. Healthy token:', !!freshToken);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service-restarted', { token: freshToken });
  }

  return { success: !!freshToken, token: freshToken };
});

ipcMain.handle('install-service', async () => {
  const scriptPath = path.resolve(__dirname, '../../../scripts/install-service.ps1');
  const { exec } = require('child_process');
  const psCmd = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"${scriptPath}\"' -Verb RunAs`;
  exec(`powershell -NoProfile -WindowStyle Hidden -Command "${psCmd}"`);
  return true;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
