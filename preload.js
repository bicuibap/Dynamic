const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  mediaControl: (action) => ipcRenderer.invoke('media-control', action),
  getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
  getCpuTemperature: () => ipcRenderer.invoke('get-cpu-temperature'),
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  getWindowsMediaInfo: () => ipcRenderer.invoke('get-windows-media-info'),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.invoke('set-ignore-mouse-events', ignore, options)
});
