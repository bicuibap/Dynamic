const { app, ipcMain, shell, clipboard, BrowserWindow } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Import new modules
const {
  initWindowManager,
  createWindow,
  createTray,
  registerGlobalShortcuts,
  unregisterShortcuts,
  ensureStartupShortcut,
  getWindow
} = require('./src/main/window-manager');
const {
  initMediaDaemon,
  startMediaDaemon,
  stopMediaDaemon,
  getLatestMediaData
} = require('./src/main/media-daemon');
const {
  initHardwareMetrics,
  getCpuTemperature,
  getSystemMetrics
} = require('./src/main/hardware-metrics');

let isQuitting = false;

function getAssetPath(...parts) {
  const p = path.join(__dirname, ...parts);
  return p.replace('app.asar', 'app.asar.unpacked');
}

const mediaCtrlExePath = getAssetPath('src', 'MediaCtrl.exe');
const controlMediaScriptPath = getAssetPath('src', 'control-media.ps1');
const daemonScriptPath = getAssetPath('src', 'media-daemon.ps1');
const createStartupShortcutScript = getAssetPath('src', 'create-startup-shortcut.ps1');
const runVbsPath = path.join(__dirname, 'run-background.vbs');

// IPC: Ignore Mouse Events
ipcMain.handle('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options || { forward: true });
  }
  return true;
});

// IPC: Media Control
ipcMain.handle('media-control', async (event, action) => {
  // BẢO MẬT: Whitelist các lệnh hợp lệ để chống Command Injection
  const allowedActions = ['play', 'pause', 'playpause', 'next', 'prev', 'previous', 'stop'];
  if (!allowedActions.includes(action.toLowerCase())) {
    console.error('[SECURITY] Blocked malicious media control action:', action);
    return false;
  }
  
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', controlMediaScriptPath, action], { timeout: 2000 }, (err, stdout) => {
      if (!err && stdout && stdout.includes('OK_WINRT')) {
        return resolve(true);
      }
      execFile(mediaCtrlExePath, [action], { timeout: 1000 }, () => resolve(true));
    });
  });
});

// IPC: Seek Media
ipcMain.handle('seek-media', async (event, seconds) => {
  // BẢO MẬT: Ép kiểu nguyên ngặt để chống Injection
  const parsedSeconds = parseInt(seconds, 10);
  if (isNaN(parsedSeconds)) {
    console.error('[SECURITY] Blocked malicious seek time:', seconds);
    return false;
  }
  
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', controlMediaScriptPath, 'seek', String(parsedSeconds)], { timeout: 2000 }, (err) => resolve(!err));
  });
});

// IPC: System Master Volume Controls
ipcMain.handle('get-volume', async () => {
  return new Promise((resolve) => {
    execFile(mediaCtrlExePath, ['get-volume'], { timeout: 1000 }, (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        const parts = stdout.trim().split(':');
        const vol = parseInt(parts[0], 10);
        const mute = parts[1] === 'True';
        return resolve({ volume: isNaN(vol) ? 50 : vol, isMuted: mute });
      }
      resolve({ volume: 50, isMuted: false });
    });
  });
});

ipcMain.handle('set-volume', async (event, volumePct) => {
  return new Promise((resolve) => {
    execFile(mediaCtrlExePath, ['set-volume', String(Math.round(volumePct))], { timeout: 1000 }, (err) => resolve(!err));
  });
});

ipcMain.handle('toggle-mute', async () => {
  return new Promise((resolve) => {
    execFile(mediaCtrlExePath, ['mute'], { timeout: 1000 }, (err) => resolve(!err));
  });
});

// IPC: Hardware Metrics
ipcMain.handle('get-cpu-temperature', async () => await getCpuTemperature());
ipcMain.handle('get-system-metrics', async () => await getSystemMetrics());

// IPC: Utilities
ipcMain.handle('open-file-location', async (event, filePath) => {
  if (!filePath) return false;
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('copy-to-clipboard', async (event, text) => {
  if (text) {
    clipboard.writeText(text);
    return true;
  }
  return false;
});

ipcMain.handle('open-external-url', async (event, url) => {
  if (url) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('get-windows-media-info', async () => getLatestMediaData());

// Application Lifecycle
app.whenReady().then(() => {
  initHardwareMetrics(mediaCtrlExePath);
  
  initWindowManager({
    startupScript: createStartupShortcutScript,
    indexHtml: path.join(__dirname, 'index.html'),
    preloadJs: path.join(__dirname, 'preload.js'),
    runVbs: runVbsPath
  });

  const win = createWindow();
  
  initMediaDaemon(daemonScriptPath, win);

  createTray();
  registerGlobalShortcuts();
  startMediaDaemon();
  ensureStartupShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow();
      initMediaDaemon(daemonScriptPath, newWin);
    }
  });
});

app.on('will-quit', () => {
  isQuitting = true;
  unregisterShortcuts();
  stopMediaDaemon();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// THÊM XỬ LÝ GEMINI AI
// ==========================================
ipcMain.handle('ask-gemini', async (event, query) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    return "Tôi chưa được kết nối với API Key của Gemini. Vui lòng thêm `GEMINI_API_KEY` vào file `.env` tại thư mục gốc của dự án.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const prompt = `Bạn là một trợ lý ảo siêu thông minh tên là "Dynamic Island Bot", hoạt động trên màn hình desktop của Windows.
Hãy trả lời ngắn gọn, thân thiện và xúc tích, tối đa 2-3 câu, vì bạn đang hiển thị trên một thanh thông báo nhỏ (như Siri).
Câu hỏi của người dùng: ${query}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    return "Xin lỗi, đã có lỗi xảy ra khi kết nối tới máy chủ AI. Vui lòng kiểm tra kết nối mạng hoặc API Key.";
  }
});
