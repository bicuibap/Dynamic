const { spawn } = require('child_process');
const { resolveCoverArt } = require('./artwork-resolver');

let mediaDaemonProcess = null;
let isQuitting = false;
let latestMediaData = null;
let mainWindowRef = null;
let daemonScriptPath = '';

function initMediaDaemon(scriptPath, winRef) {
  daemonScriptPath = scriptPath;
  mainWindowRef = winRef;
}

function startMediaDaemon() {
  if (!daemonScriptPath) return;
  try {
    mediaDaemonProcess = spawn('powershell', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', daemonScriptPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutBuffer = '';
    mediaDaemonProcess.stdout.on('data', async (chunk) => {
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop(); // keep remainder

      for (const line of lines) {
        if (line.startsWith('MEDIA_DATA:')) {
          const jsonStr = line.substring(11).trim();
          handleIncomingMediaData(jsonStr);
        }
      }
    });

    mediaDaemonProcess.stderr.on('data', () => {});

    mediaDaemonProcess.on('exit', () => {
      if (!isQuitting) {
        setTimeout(startMediaDaemon, 2500);
      }
    });
  } catch (e) {
    console.error('Failed to spawn media daemon:', e);
  }
}

async function handleIncomingMediaData(jsonStr) {
  if (!jsonStr || jsonStr === '{}') {
    latestMediaData = null;
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('media-update', null);
    }
    return;
  }

  try {
    const data = JSON.parse(jsonStr);
    if (data && data.title && data.status !== 'Closed' && data.status !== '0') {
      const isPlaying = data.status === 'Playing' || data.status === '4';

      let thumbnail = null;
      if (data.thumbnail && data.thumbnail.length > 50) {
        const isPng = data.thumbnail.startsWith('iVBOR');
        const mime = isPng ? 'image/png' : 'image/jpeg';
        thumbnail = `data:${mime};base64,${data.thumbnail}`;
      } else if (latestMediaData && latestMediaData.title === data.title && latestMediaData.thumbnail) {
        thumbnail = latestMediaData.thumbnail;
      } else {
        thumbnail = await resolveCoverArt(data.title, data.artist);
      }

      const formatted = {
        title: data.title,
        artist: data.artist || 'Nghệ sĩ / Kênh phát',
        album: data.albumTitle || '',
        status: data.status,
        isPlaying: isPlaying,
        sourceApp: data.sourceApp || 'Trình phát',
        thumbnail: thumbnail,
        position: data.position || 0,
        endTime: data.endTime || 0
      };

      latestMediaData = formatted;
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('media-update', formatted);
      }
    } else {
      latestMediaData = null;
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('media-update', null);
      }
    }
  } catch (e) {}
}

function stopMediaDaemon() {
  isQuitting = true;
  if (mediaDaemonProcess) {
    try {
      mediaDaemonProcess.kill();
    } catch (e) {}
  }
}

function getLatestMediaData() {
  return latestMediaData;
}

module.exports = {
  initMediaDaemon,
  startMediaDaemon,
  stopMediaDaemon,
  getLatestMediaData
};
