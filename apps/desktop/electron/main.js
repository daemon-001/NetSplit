const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let serviceProcess = null;

function getServicePath() {
  const candidates = [
    path.resolve(__dirname, '../../../native/windows-service/NetSplitService.exe'),
    path.resolve(process.resourcesPath || '', '../../native/windows-service/NetSplitService.exe'),
    path.resolve(process.resourcesPath || '', '../native/windows-service/NetSplitService.exe'),
    path.resolve(process.resourcesPath || '', 'native/windows-service/NetSplitService.exe'),
    path.resolve(process.resourcesPath || '', 'native/NetSplitService.exe'),
    path.resolve(process.cwd(), 'native/windows-service/NetSplitService.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function getScriptPath(scriptName) {
  const candidates = [
    path.resolve(__dirname, `../../../scripts/${scriptName}`),
    path.resolve(process.resourcesPath || '', `../../scripts/${scriptName}`),
    path.resolve(process.resourcesPath || '', `../scripts/${scriptName}`),
    path.resolve(process.resourcesPath || '', `scripts/${scriptName}`),
    path.resolve(process.cwd(), `scripts/${scriptName}`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
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
  if (await checkServiceHealth()) {
    console.log('[Electron] NetSplitService is healthy and responding on port 48192.');
    return;
  }

  // If process is already running (e.g. Windows Service started on boot), wait briefly for initialization
  if (await checkProcessRunning('NetSplitService.exe')) {
    console.log('[Electron] NetSplitService process detected. Waiting for port 48192...');
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkServiceHealth()) {
        console.log('[Electron] NetSplitService is now healthy.');
        return;
      }
    }
  }

  console.log('[Electron] NetSplitService is not running. Awaiting user installation or start from UI.');
}

function createWindow() {
  const iconPath = path.resolve(__dirname, 'icon.png');
  console.log('[Electron] Creating BrowserWindow...');

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0f172a',
    title: 'NetSplit',
    icon: iconPath,
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  console.log('[Electron] __dirname:', __dirname);
  console.log('[Electron] indexPath:', indexPath, 'exists:', fs.existsSync(indexPath));

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] webContents did-finish-load successfully');
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[Electron] did-fail-load:', code, desc, url);
  });

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [level ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('close', () => {
    console.log('[Electron] mainWindow close event received');
  });

  mainWindow.on('closed', () => {
    console.log('[Electron] mainWindow closed event received');
    mainWindow = null;
  });

  if (fs.existsSync(indexPath) && !process.env.VITE_DEV_SERVER) {
    console.log('[Electron] Loading local file:', indexPath);
    mainWindow.loadFile(indexPath).then(() => {
      console.log('[Electron] loadFile promise resolved');
    }).catch((err) => {
      console.error('[Electron] loadFile promise rejected:', err);
    });
  } else {
    console.log('[Electron] Loading dev URL: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      }
    });
  }

  mainWindow.show();
  mainWindow.focus();

  // Check service asynchronously without delaying window appearance
  ensureServiceRunning().catch((err) => {
    console.warn('[Electron] Service check error:', err ? err.message : err);
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
  const scriptPath = getScriptPath('elevate-service.ps1');
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
  const scriptPath = getScriptPath('install-service.ps1');
  const { exec } = require('child_process');
  
  console.log('[Electron] Requesting service installation via helper script...');
  const psCmd = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"${scriptPath}\"' -Verb RunAs -Wait`;
  await new Promise((resolve) => {
    exec(`powershell -NoProfile -WindowStyle Hidden -Command "${psCmd}"`, () => resolve());
  });

  // Poll for service health and fresh token
  let freshToken = null;
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const healthy = await checkServiceHealth();
    if (healthy) {
      freshToken = getToken();
      if (freshToken) break;
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service-restarted', { token: freshToken });
  }

  return { success: !!freshToken, token: freshToken };
});

ipcMain.handle('uninstall-service', async () => {
  const scriptPath = getScriptPath('uninstall-service.ps1');
  const { exec } = require('child_process');
  
  console.log('[Electron] Requesting clean service uninstallation via helper script...');

  // 1. Request graceful daemon shutdown via HTTP if token is available
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

  // 2. Run uninstall-service.ps1 elevated via UAC RunAs to delete Windows Service and tokens
  const psCmd = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"${scriptPath}\"' -Verb RunAs -Wait`;
  await new Promise((resolve) => {
    exec(`powershell -NoProfile -WindowStyle Hidden -Command "${psCmd}"`, () => resolve());
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service-uninstalled');
  }

  return { success: true };
});

function getWindowHelperPath() {
  const candidates = [
    path.resolve(__dirname, '../../../native/window_helper.exe'),
    path.resolve(process.resourcesPath || '', '../../native/window_helper.exe'),
    path.resolve(process.resourcesPath || '', '../native/window_helper.exe'),
    path.resolve(process.resourcesPath || '', 'native/window_helper.exe'),
    path.resolve(process.cwd(), 'native/window_helper.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

let cachedWindows = [];
let lastWindowFetchTime = 0;

ipcMain.handle('get-visible-windows', async () => {
  const now = Date.now();
  if (cachedWindows.length > 0 && now - lastWindowFetchTime < 3000) {
    return cachedWindows;
  }

  const helperPath = getWindowHelperPath();
  if (fs.existsSync(helperPath)) {
    try {
      const { execFile } = require('child_process');
      const stdout = await new Promise((resolve) => {
        execFile(helperPath, { timeout: 2000, windowsHide: true }, (err, out) => {
          if (err) return resolve('[]');
          resolve(out || '[]');
        });
      });
      const parsed = JSON.parse(stdout.trim() || '[]');
      if (Array.isArray(parsed)) {
        cachedWindows = parsed;
        lastWindowFetchTime = now;
        return cachedWindows;
      }
    } catch (err) {
      console.warn('[Electron] Failed to enumerate windows with window_helper:', err ? err.message : err);
    }
  }

  return cachedWindows;
});


if (process.platform === 'win32') {
  app.setAppUserModelId('com.netsplit.app');
}
app.setName('NetSplit');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

