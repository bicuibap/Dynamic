const os = require('os');
const { execFile } = require('child_process');

let mediaCtrlExePath = '';
let lastCpuInfo = null;

function initHardwareMetrics(exePath) {
  mediaCtrlExePath = exePath;
}

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

let lastCpuTemp = null;
let lastCpuTempTime = 0;
let isFetchingCpuTemp = false;

function getCpuTemperature() {
  const now = Date.now();
  if (lastCpuTemp !== null && (now - lastCpuTempTime < 2200)) {
    return Promise.resolve(lastCpuTemp);
  }
  if (isFetchingCpuTemp) {
    return Promise.resolve(lastCpuTemp);
  }

  isFetchingCpuTemp = true;
  return new Promise((resolve) => {
    if (!mediaCtrlExePath) {
      isFetchingCpuTemp = false;
      return resolve(null);
    }
    execFile(mediaCtrlExePath, ['temp'], { timeout: 1000 }, (err, stdout) => {
      isFetchingCpuTemp = false;
      lastCpuTempTime = Date.now();
      if (!err && stdout && stdout.trim()) {
        const val = parseInt(stdout.trim(), 10);
        if (val >= 20 && val <= 115) {
          lastCpuTemp = val;
          return resolve(val);
        }
      }
      resolve(lastCpuTemp);
    });
  });
}

let lastNetBytes = 0;
let lastNetTime = 0;
let lastSpeedText = "0.00 MB/s";
let lastSpeedCheckTime = 0;
let isFetchingNet = false;

function getNetworkSpeed() {
  const now = Date.now();
  // Giãn cách đo mạng tối thiểu 2.5s và tránh chạy song song nhiều tiến trình netstat
  if (now - lastSpeedCheckTime < 2400) {
    return Promise.resolve(lastSpeedText);
  }
  if (isFetchingNet) {
    return Promise.resolve(lastSpeedText);
  }

  isFetchingNet = true;
  return new Promise((resolve) => {
    execFile('netstat', ['-e'], { timeout: 1200 }, (err, stdout) => {
      isFetchingNet = false;
      lastSpeedCheckTime = Date.now();
      if (!err && stdout) {
        const match = stdout.match(/Bytes\s+(\d+)\s+(\d+)/i);
        if (match) {
          const rxBytes = parseInt(match[1], 10);
          const currentTime = Date.now();
          if (lastNetBytes > 0 && lastNetTime > 0) {
            const timeDiff = (currentTime - lastNetTime) / 1000;
            if (timeDiff > 0) {
              const byteDiff = rxBytes - lastNetBytes;
              if (byteDiff > 0) {
                const bytesPerSec = byteDiff / timeDiff;
                lastSpeedText = (bytesPerSec / (1024 * 1024)).toFixed(2) + " MB/s";
              }
            }
          }
          lastNetBytes = rxBytes;
          lastNetTime = currentTime;
        }
      }
      resolve(lastSpeedText);
    });
  });
}

let lastGpuResult = null;
let lastGpuTime = 0;
let isFetchingGpu = false;

function getGpuMetrics(force = false) {
  const now = Date.now();
  // Cache GPU trong 8 giây để không gọi nvidia-smi dồn dập
  if (!force && lastGpuResult && (now - lastGpuTime < 8000)) {
    return Promise.resolve(lastGpuResult);
  }
  if (isFetchingGpu) {
    return Promise.resolve(lastGpuResult);
  }

  isFetchingGpu = true;
  return new Promise((resolve) => {
    execFile('nvidia-smi', ['--query-gpu=utilization.gpu,temperature.gpu,name', '--format=csv,noheader,nounits'], { timeout: 1500 }, (err, stdout) => {
      isFetchingGpu = false;
      if (!err && stdout && stdout.trim()) {
        const parts = stdout.trim().split(', ');
        if (parts.length >= 3) {
          lastGpuResult = {
            percent: parseInt(parts[0], 10) || 0,
            temp: parseInt(parts[1], 10) || 0,
            name: parts[2]
          };
          lastGpuTime = Date.now();
          return resolve(lastGpuResult);
        }
      }
      resolve(lastGpuResult);
    });
  });
}

async function getSystemMetrics(includeGpu = false) {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 100);
  const cpuUsagePercent = getCpuUsage();
  
  // CHỈ quét GPU khi người dùng đang mở Dashboard phần cứng (includeGpu = true)
  const [cpuTemp, gpuMetrics, netSpeed] = await Promise.all([
    getCpuTemperature(),
    includeGpu ? getGpuMetrics() : Promise.resolve(lastGpuResult),
    getNetworkSpeed()
  ]);

  return {
    cpuPercent: cpuUsagePercent,
    cpuTemp: cpuTemp,
    gpuPercent: gpuMetrics ? gpuMetrics.percent : null,
    gpuTemp: gpuMetrics ? gpuMetrics.temp : null,
    gpuName: gpuMetrics ? gpuMetrics.name : null,
    ramPercent: memUsagePercent,
    totalRamGb: (totalMem / (1024 ** 3)).toFixed(1),
    usedRamGb: (usedMem / (1024 ** 3)).toFixed(1),
    platform: os.platform(),
    uptime: Math.round(os.uptime()),
    netSpeedText: netSpeed
  };
}

module.exports = {
  initHardwareMetrics,
  getCpuTemperature,
  getSystemMetrics
};
