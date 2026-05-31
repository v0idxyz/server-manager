const { contextBridge, ipcRenderer } = require('electron');

// Safe, minimal bridge exposed to the renderer as window.api
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  dataPath: () => ipcRenderer.invoke('data:path'),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  vscodeConnect: (info) => ipcRenderer.invoke('vscode:connect', info),
});
