const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netSplitHost', {
  getToken: () => ipcRenderer.invoke('get-token'),
  elevateService: () => ipcRenderer.invoke('elevate-service'),
  installService: () => ipcRenderer.invoke('install-service'),
  uninstallService: () => ipcRenderer.invoke('uninstall-service'),
  isServiceInstalled: () => ipcRenderer.invoke('is-service-installed'),
  getVisibleWindows: () => ipcRenderer.invoke('get-visible-windows'),
  onServiceRestarted: (cb) => {
    ipcRenderer.on('service-restarted', (_event, data) => cb(data));
  },
  onServiceUninstalled: (cb) => {
    ipcRenderer.on('service-uninstalled', (_event) => cb());
  },
});


