const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netSplitHost', {
  getToken: () => ipcRenderer.invoke('get-token'),
});
