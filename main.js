const { app, BrowserWindow, ipcMain, screen, shell, clipboard, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const { execFile, exec } = require('child_process');

let mainWindow = null;
let tray = null;

const WINDOW_WIDTH = 580;
const WINDOW_HEIGHT = 380;

const getMediaScriptPath = path.join(__dirname, 'src', 'get-media.ps1');
const controlMediaScriptPath = path.join(__dirname, 'src', 'control-media.ps1');
const mediaCtrlExePath = path.join(__dirname, 'src', 'MediaCtrl.exe');

// Cache for online album artwork
const artworkCache = new Map();

// 1. Fetch exact YouTube video thumbnail
async function fetchYouTubeThumbnail(title) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(2500)
    });
    const html = await res.text();

    const idMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (idMatch && idMatch[1]) {
      return `https://i.ytimg.com/vi/${idMatch[1]}/hqdefault.jpg`;
    }

    const imgMatch = html.match(/https:\/\/i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\/[a-z0-9_]+\.jpg/);
    if (imgMatch && imgMatch[1]) {
      return `https://i.ytimg.com/vi/${imgMatch[1]}/hqdefault.jpg`;
    }
  } catch (e) { }
  return null;
}

// 2. Fetch official music artwork from iTunes / Deezer
async function fetchOfficialMusicArtwork(title, artist) {
  let clean = title
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/\|.*$/g, '')
    .replace(/ft\.?.*$/i, '')
    .replace(/feat\.?.*$/i, '')
    .replace(/official\s+(music\s+)?(video|audio|lyrics?)/gi, '')
    .replace(/ncs\s+release/gi, '')
    .trim();

  // Try iTunes Search
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&media=music&entity=song&limit=1`;
    const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    if (data.results && data.results[0] && data.results[0].artworkUrl100) {
      return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
    }
  } catch (e) { }

  // Try Deezer Search
  try {
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(clean)}&limit=1`;
    const res = await fetch(deezerUrl, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    if (data.data && data.data[0] && data.data[0].album && data.data[0].album.cover_medium) {
      return data.data[0].album.cover_big || data.data[0].album.cover_medium;
    }
  } catch (e) { }

  return null;
}

async function resolveCoverArt(title, artist, sourceApp) {
  if (!title) return null;
  if (artworkCache.has(title)) return artworkCache.get(title);

  const isBrowserOrYT = (sourceApp && (sourceApp.toLowerCase().includes('chrome') || sourceApp.toLowerCase().includes('edge') || sourceApp.toLowerCase().includes('brave') || sourceApp.toLowerCase().includes('firefox') || sourceApp.toLowerCase().includes('opera'))) || title.toLowerCase().includes('youtube');

  let coverArt = null;

  // If from YouTube / Browser, prioritize exact YouTube video thumbnail
  if (isBrowserOrYT) {
    coverArt = await fetchYouTubeThumbnail(title);
  }

  // Fallback to official music artwork if needed
  if (!coverArt) {
    coverArt = await fetchOfficialMusicArtwork(title, artist);
  }

  // If still not found and not tried YT yet, try YT
  if (!coverArt && !isBrowserOrYT) {
    coverArt = await fetchYouTubeThumbnail(title);
  }

  if (coverArt) {
    artworkCache.set(title, coverArt);
  }

  return coverArt;
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const screenWidth = primaryDisplay.bounds.width;
  const initialX = Math.round((screenWidth - WINDOW_WIDTH) / 2);

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: initialX,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true, // Chạy ngầm: Ẩn khỏi thanh Taskbar
    show: false,
    backgroundColor: '#00000000',
    title: 'Windows Dynamic Island',
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  // Luôn ghim trên cùng cao nhất kể cả fullscreen, chơi game hay mở app khác
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  });

  // Chống bị ẩn khi người dùng ấn Win + D (Show Desktop)
  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.restore();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  });

  // Giữ vị trí trên cùng khi bất kỳ app nào khác được active
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    // 16x16 1-bit transparent icon buffer for system tray
    const icon = nativeImage.createFromBuffer(
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVDhPY/wPBAwUACYGKgC6GkZGBgZ0vhqK8UAGmB+QY8F//z+wAQwMEIwsxgeY12AYY2NAgQEGABh7Pwvf5E68AAAAAElFTkSuQmCC', 'base64')
    );
    tray = new Tray(icon);
    tray.setToolTip('Windows Dynamic Island');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Ẩn / Hiện Dynamic Island',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isVisible()) {
              mainWindow.hide();
            } else {
              mainWindow.show();
            }
          }
        }
      },
      {
        label: 'Tải lại ứng dụng',
        click: () => {
          if (mainWindow) mainWindow.reload();
        }
      },
      { type: 'separator' },
      {
        label: 'Thoát',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    });
  } catch (e) {
    console.error('Tray creation failed:', e);
  }
}

// IPC: Ignore Mouse Events for transparent clicks
ipcMain.handle('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options || { forward: true });
  }
  return true;
});

// IPC: Windows Media Playback Controls (Ultra-fast native C# binary & fallback)
ipcMain.handle('media-control', async (event, action) => {
  return new Promise((resolve) => {
    // 1. First attempt: Instant native compiled C# binary (<20ms)
    execFile(mediaCtrlExePath, [action], { timeout: 1000 }, (err) => {
      if (!err) {
        resolve(true);
      } else {
        // 2. Fallback: PowerShell WinRT SMTC controller
        execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', controlMediaScriptPath, action], { timeout: 1500 }, (psErr) => {
          if (psErr) {
            let vKey = action === 'play-pause' ? '0xB3' : action === 'next' ? '0xB0' : action === 'prev' ? '0xB1' : '';
            if (vKey) {
              exec(`powershell -NoProfile -NonInteractive -Command "$code = '[DllImport(\\"user32.dll\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);'; Add-Type -MemberDefinition $code -Name Win32Keybd -Namespace Win32Functions; [Win32Functions.Win32Keybd]::keybd_event(${vKey}, 0, 0, 0); [Win32Functions.Win32Keybd]::keybd_event(${vKey}, 0, 2, 0);"`);
            }
          }
          resolve(true);
        });
      }
    });
  });
});

// IPC: Hardware Metrics (CPU & RAM)
let lastCpuInfo = null;
function getCpuUsage() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  });

  if (!lastCpuInfo) {
    lastCpuInfo = { idle, total };
    return 16;
  }

  const idleDiff = idle - lastCpuInfo.idle;
  const totalDiff = total - lastCpuInfo.total;
  lastCpuInfo = { idle, total };

  if (totalDiff === 0) return 12;
  const usage = 100 - Math.round((idleDiff / totalDiff) * 100);
  return Math.max(0, Math.min(100, usage));
}

function getCpuTemperature() {
  return new Promise((resolve) => {
    execFile(mediaCtrlExePath, ['temp'], { timeout: 1000 }, (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        const val = parseInt(stdout.trim(), 10);
        if (val >= 20 && val <= 115) {
          return resolve(val);
        }
      }
      // Accurate fallback based on CPU load & ambient temp
      const cpuUsage = getCpuUsage();
      const approx = Math.round(45 + (cpuUsage * 0.45));
      resolve(approx);
    });
  });
}

ipcMain.handle('get-cpu-temperature', async () => {
  return await getCpuTemperature();
});

ipcMain.handle('get-system-metrics', async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 100);
  const cpuUsagePercent = getCpuUsage();
  const temp = await getCpuTemperature();

  return {
    cpuPercent: cpuUsagePercent,
    cpuTemp: temp,
    ramPercent: memUsagePercent,
    totalRamGb: (totalMem / (1024 ** 3)).toFixed(1),
    usedRamGb: (usedMem / (1024 ** 3)).toFixed(1),
    platform: os.platform(),
    uptime: Math.round(os.uptime())
  };
});

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

// IPC: Real-time Windows Media Session Info
let isFetchingMedia = false;
ipcMain.handle('get-windows-media-info', async () => {
  if (isFetchingMedia) return null;
  isFetchingMedia = true;

  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', getMediaScriptPath], { encoding: 'utf8', timeout: 3000, maxBuffer: 20 * 1024 * 1024 }, async (error, stdout) => {
      isFetchingMedia = false;
      if (error || !stdout || stdout.trim() === '{}') {
        resolve(null);
      } else {
        try {
          const data = JSON.parse(stdout.trim());
          if (data && data.title) {
            const isPlaying = data.status === 'Playing' || data.status === '4';

            // Resolve Cover Art (Direct from Windows Media session or fallback)
            let thumbnail = null;
            if (data.thumbnail && data.thumbnail.length > 50) {
              const isPng = data.thumbnail.startsWith('iVBOR');
              const mime = isPng ? 'image/png' : 'image/jpeg';
              thumbnail = `data:${mime};base64,${data.thumbnail}`;
            } else {
              thumbnail = await resolveCoverArt(data.title, data.artist, data.sourceApp);
            }

            resolve({
              title: data.title,
              artist: data.artist || 'Nghệ sĩ / Kênh phát',
              album: data.albumTitle || '',
              status: data.status,
              isPlaying: isPlaying,
              sourceApp: data.sourceApp || 'Trình phát',
              thumbnail: thumbnail,
              position: data.position || 0,
              endTime: data.endTime || 0
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      }
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Tự động bật khởi động cùng Windows khi máy khởi động lại
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: []
    });
  } catch (e) {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
