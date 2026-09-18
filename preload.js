const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Media Daemon stream & Controls
  onMediaUpdate: (callback) => {
    ipcRenderer.on('media-update', (event, data) => callback(data));
  },
  onToggleExpand: (callback) => {
    ipcRenderer.on('toggle-expand-shortcut', () => callback());
  },
  mediaControl: (action) => ipcRenderer.invoke('media-control', action),
  seekMedia: (seconds) => ipcRenderer.invoke('seek-media', seconds),
  
  // Volume Controls (Native C#)
  getLiveMusicInfo: () => ipcRenderer.invoke('get-live-music-info'),
  openFileAndReturn: (scriptPath, functionName, ...args) => 
    ipcRenderer.invoke('execute-python', scriptPath, functionName, ...args),
  askGemini: (query) => ipcRenderer.invoke('ask-gemini', query),
  getVolume: () => ipcRenderer.invoke('get-volume'),
  setVolume: (volumePct) => ipcRenderer.invoke('set-volume', volumePct),
  toggleMute: () => ipcRenderer.invoke('toggle-mute'),
  
  // System Metrics
  getSystemMetrics: (includeGpu) => ipcRenderer.invoke('get-system-metrics', includeGpu),
  getCpuTemperature: () => ipcRenderer.invoke('get-cpu-temperature'),
  
  // Window interactions
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.invoke('set-ignore-mouse-events', ignore, options),
  onAutoHideChanged: (callback) => {
    ipcRenderer.on('auto-hide-changed', (event, autoHide) => callback(autoHide));
  },
  getAutoHideSetting: () => ipcRenderer.invoke('get-auto-hide-setting'),
  setAutoHideSetting: (autoHide) => ipcRenderer.invoke('set-auto-hide-setting', autoHide),
  onWakeIsland: (callback) => {
    ipcRenderer.on('wake-island', () => callback());
  },
  
  // Utilities
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  getWindowsMediaInfo: () => ipcRenderer.invoke('get-windows-media-info')
});
