const { BrowserWindow, screen, Tray, Menu, nativeImage, globalShortcut, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

let mainWindow = null;
let tray = null;

const WINDOW_WIDTH = 580;
const WINDOW_HEIGHT = 380;
const startupFolder = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const startupShortcutPath = path.join(startupFolder, 'DynamicIsland.lnk');
const settingsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'DynamicIsland_settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {}
  return { autoHide: false }; // Mặc định: KHÔNG tự ẩn (Luôn hiển thị trên màn hình)
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {}
}

let currentSettings = loadSettings();

function getSettings() {
  return currentSettings;
}

function updateAutoHide(autoHide) {
  currentSettings.autoHide = autoHide;
  saveSettings(currentSettings);
  updateTrayMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auto-hide-changed', currentSettings.autoHide);
  }
}

let startupScriptPath = '';
let indexHtmlPath = '';
let preloadJsPath = '';
let runVbsPath = '';
let currentDisplayIndex = 0;

function initWindowManager(paths) {
  startupScriptPath = paths.startupScript;
  indexHtmlPath = paths.indexHtml;
  preloadJsPath = paths.preloadJs;
  runVbsPath = paths.runVbs;
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const screenWidth = primaryDisplay.bounds.width;
  const initialX = Math.round((screenWidth - WINDOW_WIDTH) / 2);
  const initialY = 0;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    title: 'Windows Dynamic Island',
    type: 'toolbar',
    webPreferences: {
      preload: preloadJsPath,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      spellcheck: false,
      devTools: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(indexHtmlPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    // Đồng bộ cài đặt autoHide cho renderer
    mainWindow.webContents.send('auto-hide-changed', currentSettings.autoHide);
    setupWakeCheck();
  });

  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.restore();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  });

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  mainWindow.on('closed', () => {
    if (wakeCheckInterval) {
      clearInterval(wakeCheckInterval);
      wakeCheckInterval = null;
    }
    mainWindow = null;
  });
  
  return mainWindow;
}

function isAutoLaunchEnabled() {
  return fs.existsSync(startupShortcutPath);
}

function ensureStartupShortcut() {
  try {
    let target = '';
    let dir = '';

    if (app.isPackaged) {
      target = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
      dir = path.dirname(target);
    } else {
      target = runVbsPath;
      dir = path.dirname(runVbsPath);
    }

    execFile('powershell', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', startupScriptPath,
      target,
      dir
    ], { timeout: 3000 }, () => {});
  } catch (e) {}
}

function setAutoLaunch(enabled) {
  if (enabled) {
    ensureStartupShortcut();
  } else {
    try {
      if (fs.existsSync(startupShortcutPath)) {
        fs.unlinkSync(startupShortcutPath);
      }
    } catch (e) {}
  }
}

let wakeCheckInterval = null;
let topEdgeDwellStart = 0;
let hasFiredWake = false;

function setupWakeCheck() {
  if (wakeCheckInterval) clearInterval(wakeCheckInterval);
  topEdgeDwellStart = 0;
  hasFiredWake = false;

  wakeCheckInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!currentSettings.autoHide) {
      topEdgeDwellStart = 0;
      hasFiredWake = false;
      return;
    }
    try {
      const cursor = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();

      // Chỉ kích hoạt khi chuột di SÁT RẠT lên mép trên cùng (y <= 2px)
      // và nằm trong phạm vi chiều ngang của đảo (thu gọn 80px mỗi bên để tránh nhầm khi click tab ngoài rìa)
      const isAtTopEdge = cursor.y <= 2 &&
                          cursor.x >= (bounds.x + 80) &&
                          cursor.x <= (bounds.x + bounds.width - 80);

      if (isAtTopEdge) {
        if (!topEdgeDwellStart) {
          topEdgeDwellStart = Date.now();
        } else if (!hasFiredWake && (Date.now() - topEdgeDwellStart >= 180)) {
          // Chuột phải dừng lại ở sát mép trên ít nhất 180ms (tránh trường hợp chỉ vung chuột qua bấm tab)
          mainWindow.webContents.send('wake-island');
          hasFiredWake = true;
        }
      } else {
        topEdgeDwellStart = 0;
        hasFiredWake = false;
      }
    } catch (e) {}
  }, 80);
}

function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Ẩn / Hiện Dynamic Island (Ctrl+Shift+Space)',
      click: toggleWindowVisibility
    },
    {
      label: 'Di chuyển sang màn hình tiếp theo',
      click: moveToNextScreen
    },
    { type: 'separator' },
    {
      label: '📌 Luôn hiển thị (Cố định trên màn hình)',
      type: 'radio',
      checked: !currentSettings.autoHide,
      click: () => {
        updateAutoHide(false);
      }
    },
    {
      label: '⏱️ Tự động trượt ẩn sau 8s (Rê chuột mép trên để hiện)',
      type: 'radio',
      checked: !!currentSettings.autoHide,
      click: () => {
        updateAutoHide(true);
      }
    },
    { type: 'separator' },
    {
      label: 'Khởi động cùng Windows',
      type: 'checkbox',
      checked: isAutoLaunchEnabled(),
      click: (menuItem) => {
        setAutoLaunch(menuItem.checked);
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
}

function createTray() {
  try {
    const icon = nativeImage.createFromBuffer(
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVDhPY/wPBAwUACYGKgC6GkZGBgZ0vhqK8UAGmB+QY8F//z+wAQwMEIwsxgeY12AYY2NAgQEGABh7Pwvf5E68AAAAAElFTkSuQmCC', 'base64')
    );
    tray = new Tray(icon);
    tray.setToolTip('Windows Dynamic Island');
    updateTrayMenu();
    tray.on('click', toggleWindowVisibility);
  } catch (e) {
    console.error('Tray creation failed:', e);
  }
}

function toggleWindowVisibility() {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  }
}

function moveToNextScreen() {
  if (!mainWindow) return;
  const displays = screen.getAllDisplays();
  if (displays.length <= 1) return; // Chỉ có 1 màn hình

  currentDisplayIndex = (currentDisplayIndex + 1) % displays.length;
  const targetDisplay = displays[currentDisplayIndex];

  const screenWidth = targetDisplay.bounds.width;
  const initialX = targetDisplay.bounds.x + Math.round((screenWidth - WINDOW_WIDTH) / 2);
  const initialY = targetDisplay.bounds.y;

  mainWindow.setPosition(initialX, initialY);
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
}

function registerGlobalShortcuts() {
  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      toggleWindowVisibility();
    });

    globalShortcut.register('Alt+Space', () => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        mainWindow.webContents.send('toggle-expand-shortcut');
      }
    });
  } catch (e) {
    console.error('Global shortcut registration failed:', e);
  }
}

function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

function getWindow() {
  return mainWindow;
}

module.exports = {
  initWindowManager,
  createWindow,
  createTray,
  registerGlobalShortcuts,
  unregisterShortcuts,
  ensureStartupShortcut,
  getWindow,
  getSettings,
  updateAutoHide
};
