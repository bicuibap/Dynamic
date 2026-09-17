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

function getCpuTemperature() {
  return new Promise((resolve) => {
    if (!mediaCtrlExePath) return resolve(null);
    execFile(mediaCtrlExePath, ['temp'], { timeout: 1000 }, (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        const val = parseInt(stdout.trim(), 10);
        if (val >= 20 && val <= 115) {
          return resolve(val);
        }
      }
      // TRUNG THỰC: Không fake nhiệt độ nếu không lấy được (trả về null)
      resolve(null);
    });
  });
}

let lastNetBytes = 0;
let lastNetTime = 0;

function getNetworkSpeed() {
  return new Promise((resolve) => {
    execFile('netstat', ['-e'], { timeout: 1000 }, (err, stdout) => {
      let speedMBps = 0;
      if (!err && stdout) {
        // Output format: Bytes    1081060686   2380759800
        const match = stdout.match(/Bytes\s+(\d+)\s+(\d+)/i);
        if (match) {
          const rxBytes = parseInt(match[1], 10);
          // Only track Received bytes for Download Speed
          const now = Date.now();
          if (lastNetBytes > 0 && lastNetTime > 0) {
            const timeDiff = (now - lastNetTime) / 1000;
            if (timeDiff > 0) {
              const byteDiff = rxBytes - lastNetBytes;
              if (byteDiff > 0) {
                speedMBps = (byteDiff / timeDiff) / (1024 * 1024);
              }
            }
          }
          lastNetBytes = rxBytes;
          lastNetTime = now;
        }
      }
      resolve(speedMBps.toFixed(1));
    });
  });
}

function getGpuMetrics() {
  return new Promise((resolve) => {
    execFile('nvidia-smi', ['--query-gpu=utilization.gpu,temperature.gpu,name', '--format=csv,noheader,nounits'], { timeout: 1000 }, (err, stdout) => {
      if (!err && stdout && stdout.trim()) {
        const parts = stdout.trim().split(', ');
        if (parts.length >= 3) {
          return resolve({
            percent: parseInt(parts[0], 10) || 0,
            temp: parseInt(parts[1], 10) || 0,
            name: parts[2]
          });
        }
      }
      resolve(null);
    });
  });
}

async function getSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 100);
  const cpuUsagePercent = getCpuUsage();
  
  // Parallel fetch for temps and network
  const [cpuTemp, gpuMetrics, netSpeed] = await Promise.all([
    getCpuTemperature(),
    getGpuMetrics(),
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
    netSpeedMBps: netSpeed
  };
}

module.exports = {
  initHardwareMetrics,
  getCpuTemperature,
  getSystemMetrics
};
