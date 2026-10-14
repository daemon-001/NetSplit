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
  if (fs.existsSync(localTokenPath)) {
    try {
      return fs.readFileSync(localTokenPath, 'utf8').trim();
    } catch {}
  }

  const progTokenPath = path.join(programData, 'NetSplit', 'ipc_auth.token');
  if (fs.existsSync(progTokenPath)) {
    try {
      return fs.readFileSync(progTokenPath, 'utf8').trim();
    } catch {}
  }

  return null;
}

function ensureServiceRunning() {
  const serviceExe = getServicePath();
  if (fs.existsSync(serviceExe)) {
    console.log('[Electron] Ensuring NetSplitService is running in background:', serviceExe);
    try {
      const psCmd = `Start-Process -FilePath '${serviceExe.replace(/'/g, "''")}' -ArgumentList '--background' -Verb RunAs`;
      const { exec } = require('child_process');
      exec(`powershell -NoProfile -WindowStyle Hidden -Command "${psCmd}"`, (err) => {
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
  const serviceExe = getServicePath();
  const { exec } = require('child_process');
  
  // Cleanly terminate any running instance via WMI and taskkill
  const killCmd = `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"Name = 'NetSplitService.exe'\\") | Invoke-CimMethod -MethodName Terminate; taskkill /F /IM NetSplitService.exe"`;
  exec(killCmd, () => {
    setTimeout(() => {
      const psCmd = `Start-Process -FilePath '${serviceExe.replace(/'/g, "''")}' -ArgumentList '--background' -Verb RunAs`;
      exec(`powershell -NoProfile -WindowStyle Hidden -Command "${psCmd}"`);
    }, 300);
  });
  return true;
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
