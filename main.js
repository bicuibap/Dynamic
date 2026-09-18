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

// Tự động kiểm tra và biên dịch MediaCtrl.exe nếu thiếu (Ví dụ: khi vừa clone repo về)
function ensureMediaCtrlBinary() {
  if (!fs.existsSync(mediaCtrlExePath)) {
    const csPath = getAssetPath('src', 'MediaCtrl.cs');
    const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
    if (fs.existsSync(csPath) && fs.existsSync(cscPath)) {
      try {
        const { execFileSync } = require('child_process');
        execFileSync(cscPath, ['/target:exe', '/optimize+', `/out:${mediaCtrlExePath}`, csPath, '/r:System.Management.dll'], { timeout: 10000 });
        console.log('[NATIVE] Auto-compiled MediaCtrl.exe successfully.');
      } catch (e) {
        console.error('[NATIVE] Failed to auto-compile MediaCtrl.exe:', e);
      }
    }
  }
}
ensureMediaCtrlBinary();

initHardwareMetrics(mediaCtrlExePath);
const controlMediaScriptPath = getAssetPath('src', 'control-media.ps1');
const daemonScriptPath = getAssetPath('src', 'media-daemon.ps1');
const createStartupShortcutScript = getAssetPath('src', 'create-startup-shortcut.ps1');
const runVbsPath = path.join(__dirname, 'run-background.vbs');

// Core Action Execution Helpers (Dùng chung cho cả IPC và Action Agent)
function executeMediaControl(action) {
  const allowedActions = ['play', 'pause', 'playpause', 'next', 'prev', 'previous', 'stop'];
  if (!allowedActions.includes(action.toLowerCase())) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', controlMediaScriptPath, action], { timeout: 2000 }, (err, stdout) => {
      if (!err && stdout && stdout.includes('OK_WINRT')) {
        return resolve(true);
      }
      execFile(mediaCtrlExePath, [action], { timeout: 1000 }, () => resolve(true));
    });
  });
}

function executeGetVolume() {
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
}

function executeSetVolume(volumePct) {
  const pct = Math.max(0, Math.min(100, Math.round(volumePct)));
  return new Promise((resolve) => {
    execFile(mediaCtrlExePath, ['set-volume', String(pct)], { timeout: 1000 }, (err) => resolve(!err));
  });
}

function executeToggleMute() {
  return new Promise((resolve) => {
    execFile(mediaCtrlExePath, ['mute'], { timeout: 1000 }, (err) => resolve(!err));
  });
}

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
  return await executeMediaControl(action);
});

// IPC: Seek Media
ipcMain.handle('seek-media', async (event, seconds) => {
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
ipcMain.handle('get-volume', async () => await executeGetVolume());
ipcMain.handle('set-volume', async (event, volumePct) => await executeSetVolume(volumePct));
ipcMain.handle('toggle-mute', async () => await executeToggleMute());

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
    runVbs: runVbsPath,
    mediaCtrlExe: mediaCtrlExePath
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
// THÊM XỬ LÝ GEMINI AI & ACTION AGENT NỘI BỘ
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

let sleepTimerTimeout = null;
let sleepTimerTargetTime = null;

// Trợ lý hành động thông minh cục bộ (Action Agent - 100% Offline không cần API Key)
async function handleLocalSmartQuery(query) {
  const lower = query.toLowerCase().trim();

  // 1. Chào hỏi / Danh tính
  if (/^(chào|hi|hello|hey|alo|xin chào|bạn là ai|mày là ai|giới thiệu|ai đấy)$/i.test(lower)) {
    return "Xin chào! Tôi là Trợ lý Dynamic Island. Tôi có thể điều khiển nhạc, âm lượng, nhiệt độ máy và hỗ trợ bạn mọi lúc 🏝️";
  }

  // 2. Thời gian / Ngày tháng
  if (/(mấy giờ|thời gian|bây giờ là|hôm nay ngày|ngày mấy|tháng mấy|hôm nay thứ)/i.test(lower)) {
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = `${days[now.getDay()]}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    return `Bây giờ là ${timeStr} (${dateStr}) ⏰`;
  }

  // 3. Thông số phần cứng (CPU / RAM / Nhiệt độ)
  if (/(cpu|ram|phần cứng|nhiệt độ|máy nóng|bộ nhớ)/i.test(lower)) {
    try {
      const metrics = await getSystemMetrics(false);
      const temp = await getCpuTemperature();
      return `CPU: ${metrics.cpuPercent || '--'}% (~${temp || '--'}°C) | RAM: ${metrics.ramPercent || '--'}% (${metrics.usedRamGb || '--'}/${metrics.totalRamGb || '--'}GB) ⚡`;
    } catch (e) {
      return "Hệ thống đang hoạt động ổn định và mượt mà ⚡";
    }
  }

  // 4. Nhạc đang phát
  if (/(nhạc gì|bài hát gì|đang phát|bài gì|đang nghe)/i.test(lower)) {
    const media = getLatestMediaData();
    if (media && media.title && media.title.trim()) {
      const artist = media.artist ? ` - ${media.artist}` : '';
      return `Đang phát: "${media.title}"${artist} 🎵`;
    }
    return "Hiện chưa có bài hát nào đang phát trên máy 🎵";
  }

  // 5. ACTION: Hẹn giờ tắt nhạc (Sleep Timer)
  const sleepMatch = lower.match(/(?:hẹn giờ|tự động|hãy)?\s*tắt nhạc\s*(?:sau|trong)?\s*(\d+)\s*(phút|p|giây|s|tiếng|giờ|h)?/i);
  if (sleepMatch) {
    const num = parseInt(sleepMatch[1], 10);
    const unit = (sleepMatch[2] || 'phút').toLowerCase();
    let mins = num;
    if (unit === 'giây' || unit === 's') mins = Math.max(0.1, num / 60);
    else if (unit === 'tiếng' || unit === 'giờ' || unit === 'h') mins = num * 60;

    if (sleepTimerTimeout) clearTimeout(sleepTimerTimeout);
    const ms = mins * 60 * 1000;
    sleepTimerTargetTime = Date.now() + ms;
    sleepTimerTimeout = setTimeout(() => {
      executeMediaControl('pause');
      const win = getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('system-notification', {
          icon: '🌙',
          title: 'Hẹn giờ tắt nhạc',
          message: `Đã dừng nhạc sau ${num} ${unit}. Chúc bạn ngủ ngon!`
        });
      }
      sleepTimerTimeout = null;
      sleepTimerTargetTime = null;
    }, ms);

    return `⏱️ Đã đặt hẹn giờ tắt nhạc sau ${num} ${unit}. Chúc bạn ngủ ngon! 🌙`;
  }

  if (/(?:hủy|xóa|tắt)\s*(?:hẹn giờ tắt nhạc|hẹn giờ)/i.test(lower)) {
    if (sleepTimerTimeout) {
      clearTimeout(sleepTimerTimeout);
      sleepTimerTimeout = null;
      sleepTimerTargetTime = null;
      return "⏰ Đã hủy lịch hẹn giờ tắt nhạc thành công!";
    }
    return "Hiện không có lịch hẹn giờ tắt nhạc nào đang chạy ⏰";
  }

  // 6. ACTION: Hẹn giờ tắt máy (Shutdown Timer)
  const shutdownMatch = lower.match(/(?:hẹn giờ|tự động)?\s*tắt máy\s*(?:sau|trong)?\s*(\d+)\s*(phút|p|giây|s|tiếng|giờ|h)?/i);
  if (shutdownMatch) {
    const num = parseInt(shutdownMatch[1], 10);
    const unit = (shutdownMatch[2] || 'phút').toLowerCase();
    let seconds = num * 60;
    if (unit === 'giây' || unit === 's') seconds = num;
    else if (unit === 'tiếng' || unit === 'giờ' || unit === 'h') seconds = num * 3600;

    execFile('shutdown.exe', ['/s', '/t', String(seconds)], () => {});
    return `🔌 Đã lên lịch tắt máy sau ${num} ${unit} (Gõ "hủy tắt máy" nếu muốn hủy).`;
  }

  if (/(?:hủy tắt máy|cancel shutdown|đừng tắt máy)/i.test(lower)) {
    execFile('shutdown.exe', ['/a'], () => {});
    return "✅ Đã hủy lệnh tự động tắt máy tính thành công.";
  }

  // 7. ACTION: Điều khiển âm lượng (Volume Controls)
  const volSetMatch = lower.match(/(?:âm lượng|volume|tiếng)\s*(?:lên|xuống|thành|về)?\s*(\d{1,3})%?/i);
  if (volSetMatch) {
    const targetVol = Math.max(0, Math.min(100, parseInt(volSetMatch[1], 10)));
    await executeSetVolume(targetVol);
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('volume-notification', { volume: targetVol });
    }
    return `🔊 Đã đặt âm lượng hệ thống thành ${targetVol}%`;
  }

  if (/(?:tăng|bật to|cho to)\s*(?:âm lượng|volume|tiếng)/i.test(lower)) {
    const cur = await executeGetVolume();
    const incMatch = lower.match(/\d+/);
    const delta = incMatch ? parseInt(incMatch[0], 10) : 10;
    const newVol = Math.min(100, cur.volume + delta);
    await executeSetVolume(newVol);
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('volume-notification', { volume: newVol });
    }
    return `🔊 Đã tăng âm lượng lên ${newVol}%`;
  }

  if (/(?:giảm|hạ|bật nhỏ|cho nhỏ)\s*(?:âm lượng|volume|tiếng)/i.test(lower)) {
    const cur = await executeGetVolume();
    const decMatch = lower.match(/\d+/);
    const delta = decMatch ? parseInt(decMatch[0], 10) : 10;
    const newVol = Math.max(0, cur.volume - delta);
    await executeSetVolume(newVol);
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('volume-notification', { volume: newVol });
    }
    return `🔉 Đã giảm âm lượng xuống ${newVol}%`;
  }

  if (/^(tắt tiếng|mute|im lặng|tắt loa)$/i.test(lower)) {
    const cur = await executeGetVolume();
    if (!cur.isMuted) {
      await executeToggleMute();
    }
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('volume-notification', { volume: 0 });
    }
    return "🔇 Đã tắt tiếng hệ thống (Mute).";
  }

  if (/^(bật tiếng|unmute|mở loa|bật loa)$/i.test(lower)) {
    const cur = await executeGetVolume();
    if (cur.isMuted) {
      await executeToggleMute();
    }
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('volume-notification', { volume: cur.volume });
    }
    return `🔊 Đã bật lại âm thanh (${cur.volume}%).`;
  }

  // 8. ACTION: Điều khiển Media (Playback & Track)
  if (/(?:dừng nhạc|tắt nhạc|tạm dừng|pause nhạc|ngừng phát)$/i.test(lower)) {
    await executeMediaControl('pause');
    return "⏸️ Đã tạm dừng phát nhạc.";
  }

  if (/(?:tiếp tục phát|bật nhạc|play nhạc|nghe tiếp|phát nhạc)$/i.test(lower)) {
    await executeMediaControl('play');
    return "▶️ Đang tiếp tục phát nhạc.";
  }

  if (/(?:chuyển bài|qua bài|next bài|bài tiếp|next)$/i.test(lower)) {
    await executeMediaControl('next');
    return "⏭️ Đã chuyển sang bài tiếp theo.";
  }

  if (/(?:bài trước|quay lại bài|prev bài|previous)$/i.test(lower)) {
    await executeMediaControl('prev');
    return "⏮️ Đã quay lại bài hát trước.";
  }

  // 9. ACTION: Mở ứng dụng nhanh (Quick Launch)
  if (/^mở spotify$/i.test(lower)) {
    shell.openExternal('spotify:');
    return "🚀 Đang mở Spotify...";
  }

  if (/^mở youtube$/i.test(lower)) {
    shell.openExternal('https://youtube.com');
    return "🚀 Đang mở YouTube...";
  }

  if (/^mở (chrome|trình duyệt)$/i.test(lower)) {
    execFile('cmd', ['/c', 'start chrome'], () => {});
    return "🚀 Đang mở Google Chrome...";
  }

  if (/^mở (notepad|ghi chú)$/i.test(lower)) {
    execFile('notepad.exe', () => {});
    return "🚀 Đang mở Notepad...";
  }

  if (/^mở (máy tính|calc|calculator)$/i.test(lower)) {
    execFile('calc.exe', () => {});
    return "🚀 Đang mở Máy tính (Calculator)...";
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
  if (!trimmed) return "Vui lòng nhập câu hỏi hoặc lệnh.";

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

  // 2. Thử phản hồi Action Engine và câu hỏi hệ thống / offline trước
  const localReply = await handleLocalSmartQuery(trimmed);
  if (localReply) {
    return localReply;
  }

  // 3. Kiểm tra API Key cho các câu hỏi AI tổng quát
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return "Tôi cần Google Gemini API Key để giải đáp câu hỏi tri thức này. Lấy key miễn phí tại https://aistudio.google.com rồi gõ: `/key <API_KEY>` ngay tại đây nhé!";
  }

  try {
    const prompt = `Bạn là Trợ lý Dynamic Island hoạt động trên một thanh notch nhỏ gọn trên màn hình Windows.
Quy tắc trả lời:
- CỰC KỲ NGẮN GỌN: Tối đa 1 đến 2 câu ngắn (dưới 25 từ).
- Đi thẳng vào đáp án trọng tâm, không chào hỏi dài dòng, không lặp lại câu hỏi.
- Luôn kết thúc bằng 1 emoji phù hợp.
Câu hỏi: ${trimmed}`;

    return await generateGeminiContent(apiKey, prompt);
  } catch (error) {
    console.error('Gemini API Error:', error);
    if (error.message && (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid'))) {
      return "Lỗi: API Key Gemini không hợp lệ hoặc đã hết hạn. Vui lòng nhập `/key <API_KEY_MỚI>` để cập nhật.";
    }
    return "Xin lỗi, đã có lỗi kết nối tới máy chủ Gemini. Vui lòng kiểm tra mạng hoặc nhập `/key <API_KEY_MỚI>` để đổi khóa.";
  }
});
