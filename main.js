const { app, ipcMain, shell, clipboard, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
// Tìm và nạp .env từ nhiều vị trí (thư mục app, thư mục thực thi, AppData)
const envLocations = [
  path.join(__dirname, '.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.resourcesPath || '', '.env'),
  path.join(process.resourcesPath || '', 'app.asar.unpacked', '.env')
];
for (const envLoc of envLocations) {
  if (fs.existsSync(envLoc)) {
    require('dotenv').config({ path: envLoc });
    break;
  }
}
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// Tối ưu hóa hiệu năng & bộ nhớ Chromium và V8 Engine
app.commandLine.appendSwitch('js-flags', '--expose-gc --max-old-space-size=96 --optimize-for-size');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-features', 'WidgetLayering,CalculateNativeWinOcclusion,TranslateUI,OptimizationHints,MediaRouter');

// Import new modules
const {
  initWindowManager,
  createWindow,
  createTray,
  registerGlobalShortcuts,
  unregisterShortcuts,
  ensureStartupShortcut,
  getWindow,
  getSettings,
  saveSettings,
  updateAutoHide
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
  const unpacked = path.join(__dirname, ...parts).replace('app.asar', 'app.asar.unpacked');
  if (fs.existsSync(unpacked)) return unpacked;
  if (app.isPackaged && process.resourcesPath) {
    const resUnpacked = path.join(process.resourcesPath, 'app.asar.unpacked', ...parts);
    if (fs.existsSync(resUnpacked)) return resUnpacked;
  }
  return path.join(__dirname, ...parts);
}

const mediaCtrlExePath = getAssetPath('src', 'MediaCtrl.exe');
initHardwareMetrics(mediaCtrlExePath);
const controlMediaScriptPath = getAssetPath('src', 'control-media.ps1');
const daemonScriptPath = getAssetPath('src', 'media-daemon.ps1');
const createStartupShortcutScript = getAssetPath('src', 'create-startup-shortcut.ps1');
const runVbsPath = path.join(__dirname, 'run-background.vbs');

// IPC: Ignore Mouse Events
ipcMain.handle('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    if (ignore) {
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      win.setIgnoreMouseEvents(false);
    }
  }
  return true;
});

// IPC: Focus Window
ipcMain.handle('focus-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.focus();
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
ipcMain.handle('get-system-metrics', async (event, includeGpu) => await getSystemMetrics(includeGpu));

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

// IPC: Auto-Hide Settings
ipcMain.handle('get-auto-hide-setting', () => getSettings().autoHide);
ipcMain.handle('set-auto-hide-setting', (event, autoHide) => updateAutoHide(autoHide));

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

function trimMemory() {
  if (global.gc) {
    try { global.gc(); } catch (e) { }
  }
  execFile(mediaCtrlExePath, ['trim-memory'], { timeout: 1500 }, () => { });
}

// Giải phóng RAM 6 giây sau khi khởi động
setTimeout(trimMemory, 6000);

// Tự động giải phóng RAM định kỳ mỗi 3 phút
setInterval(trimMemory, 3 * 60 * 1000);

// ==========================================
// THÊM XỬ LÝ GEMINI AI & TRỢ LÝ THÔNG MINH OFFLINE
// ==========================================
function getGeminiApiKey() {
  // 1. Kiểm tra cài đặt người dùng đã lưu trong AppData
  const settings = getSettings();
  if (settings && settings.geminiApiKey && typeof settings.geminiApiKey === 'string' && settings.geminiApiKey.trim()) {
    return settings.geminiApiKey.trim();
  }
  // 2. Kiểm tra biến môi trường (.env hoặc hệ thống)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() && process.env.GEMINI_API_KEY !== 'your_api_key_here') {
    return process.env.GEMINI_API_KEY.trim();
  }
  // 3. Nếu chưa cấu hình, trả về null
  return null;
}

// Trợ lý thông minh cục bộ (Hoạt động offline 100% không cần API Key)
async function handleLocalSmartQuery(query) {
  const lower = query.toLowerCase().trim();

  // 1. Chào hỏi / Danh tính
  if (/^(chào|hi|hello|hey|alo|xin chào|bạn là ai|mày là ai|giới thiệu|ai đấy)/i.test(lower)) {
    return "Xin chào! Tôi là Dynamic Island AI Assistant trên Windows. Tôi có thể theo dõi nhiệt độ CPU/RAM, thời tiết, điều khiển nhạc và giải đáp thắc mắc của bạn!";
  }

  // 2. Thời gian / Ngày tháng
  if (/(mấy giờ|thời gian|bây giờ là|hôm nay ngày|ngày mấy|tháng mấy|hôm nay thứ)/i.test(lower)) {
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const dateStr = `${days[now.getDay()]}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
    return `Bây giờ là ${timeStr} (${dateStr}).`;
  }

  // 3. Thông số phần cứng (CPU / RAM / Nhiệt độ)
  if (/(cpu|ram|phần cứng|nhiệt độ|máy nóng|bộ nhớ)/i.test(lower)) {
    try {
      const metrics = await getSystemMetrics(false);
      const temp = await getCpuTemperature();
      return `Thông số hiện tại: CPU ${metrics.cpuPercent || '--'}% (Nhiệt độ ~${temp || '--'}°C), RAM ${metrics.ramPercent || '--'}% (${metrics.ramUsed || '--'}/${metrics.ramTotal || '--'} GB).`;
    } catch (e) {
      return "Hệ thống đang hoạt động ổn định và mượt mà.";
    }
  }

  // 4. Nhạc đang phát
  if (/(nhạc|bài hát|đang phát|bài gì|đang nghe)/i.test(lower)) {
    const media = getLatestMediaData();
    if (media && media.title && media.title.trim()) {
      const artist = media.artist ? ` của ${media.artist}` : '';
      return `Bạn đang nghe bài: "${media.title}"${artist}.`;
    }
    return "Hiện chưa có bài hát nào đang phát trên Spotify, YouTube hoặc Chrome.";
  }

  return null;
}

async function generateGeminiContent(apiKey, prompt) {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  const modelsToTry = [
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-3.8-flash'
  ];

  let lastError = null;
  for (const modelName of modelsToTry) {
    try {
      const res = await ai.models.generateContent({
        model: modelName,
        contents: prompt
      });
      if (res && res.text) {
        return res.text;
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError;
}

ipcMain.handle('ask-gemini', async (event, query) => {
  const trimmed = (query || '').trim();
  if (!trimmed) return "Vui lòng nhập câu hỏi.";

  // 1. Hỗ trợ lệnh đổi/lưu API Key trực tiếp trong khung chat: /key <your_api_key>
  if (trimmed.startsWith('/key ') || trimmed.startsWith('/setkey ')) {
    const newKey = trimmed.replace(/^\/(key|setkey)\s+/, '').trim();
    if (newKey) {
      const settings = getSettings();
      settings.geminiApiKey = newKey;
      saveSettings(settings);
      return `✅ Đã lưu Gemini API Key mới thành công! Bạn có thể bắt đầu đặt câu hỏi ngay.`;
    }
  }

  // 2. Thử phản hồi câu hỏi hệ thống / offline trước
  const localReply = await handleLocalSmartQuery(trimmed);
  if (localReply) {
    return localReply;
  }

  // 3. Kiểm tra API Key cho các câu hỏi AI tổng quát
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return "Tôi cần Google Gemini API Key để trả lời câu hỏi này. Bạn hãy lấy key miễn phí tại https://aistudio.google.com rồi gõ: `/key <API_KEY>` ngay tại đây nhé!";
  }

  try {
    const prompt = `Bạn là một trợ lý ảo siêu thông minh tên là "Dynamic Island Bot", hoạt động trên màn hình desktop của Windows.
Hãy trả lời ngắn gọn, thân thiện và súc tích bằng tiếng Việt, tối đa 2-3 câu, vì bạn đang hiển thị trên một thanh thông báo nhỏ (như Siri).
Câu hỏi của người dùng: ${trimmed}`;

    return await generateGeminiContent(apiKey, prompt);
  } catch (error) {
    console.error('Gemini API Error:', error);
    if (error.message && (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid'))) {
      return "Lỗi: API Key Gemini không hợp lệ hoặc đã hết hạn. Vui lòng nhập `/key <API_KEY_MỚI>` để cập nhật.";
    }
    return "Xin lỗi, đã có lỗi kết nối tới máy chủ Gemini. Vui lòng kiểm tra mạng hoặc nhập `/key <API_KEY_MỚI>` để đổi khóa.";
  }
});
