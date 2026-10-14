const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netSplitHost', {
  getToken: () => ipcRenderer.invoke('get-token'),
  elevateService: () => ipcRenderer.invoke('elevate-service'),
  installService: () => ipcRenderer.invoke('install-service'),
  onServiceRestarted: (cb) => {
    ipcRenderer.on('service-restarted', (_event, data) => cb(data));
  },
});

