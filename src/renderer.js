// Windows Dynamic Island Renderer
document.addEventListener('DOMContentLoaded', () => {
  // 1. Clock with Cyan Seconds & Date
  const notchClock = document.getElementById('notch-clock');
  const notchDate = document.getElementById('notch-date');

  function updateDateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    if (notchClock) notchClock.textContent = `${hours}:${minutes}:${seconds}`;

    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayName = days[now.getDay()];
    const date = String(now.getDate());
    const month = String(now.getMonth() + 1);
    if (notchDate) notchDate.textContent = `${dayName}, ${date}/${month}`;
  }

  updateDateTime();
  setInterval(updateDateTime, 1000);

  // 2. Real-time CPU Temperature Monitor
  const notchCpuVal = document.getElementById('notch-cpu-val');
  const notchCpuItem = document.getElementById('notch-cpu-item');

  async function updateHardwareStats() {
    if (window.electronAPI && window.electronAPI.getSystemMetrics) {
      try {
        const metrics = await window.electronAPI.getSystemMetrics();
        if (metrics) {
          // 1. Cập nhật Mini Notch (Nhiệt độ)
          if (metrics.cpuTemp) {
            if (notchCpuVal) notchCpuVal.textContent = `${metrics.cpuTemp}°C`;
            if (notchCpuItem) {
              notchCpuItem.title = `Nhiệt độ CPU máy: ${metrics.cpuTemp}°C`;
              if (metrics.cpuTemp >= 80) notchCpuItem.classList.add('hot');
              else notchCpuItem.classList.remove('hot');
            }
          }

          // 2. Cập nhật Bảng Hardware Dashboard (Nếu đang mở)
          const hwCpuPercent = document.getElementById('hw-cpu-percent');
          const hwCpuTemp = document.getElementById('hw-cpu-temp');
          const hwCpuBar = document.getElementById('hw-cpu-bar');
          const hwCpuStatus = document.getElementById('hw-cpu-status');
          if (hwCpuPercent) hwCpuPercent.textContent = `${metrics.cpuPercent}%`;
          if (hwCpuTemp && metrics.cpuTemp) hwCpuTemp.textContent = `${metrics.cpuTemp}°C`;
          if (hwCpuBar) hwCpuBar.style.width = `${metrics.cpuPercent}%`;
          if (hwCpuStatus) {
            hwCpuStatus.className = 'hw-tag';
            if (metrics.cpuPercent > 80) {
              hwCpuStatus.textContent = 'HEAVY';
            } else if (metrics.cpuPercent > 40) {
              hwCpuStatus.textContent = 'NORMAL';
            } else {
              hwCpuStatus.textContent = 'IDLE';
            }
          }

          const hwGpuPercent = document.getElementById('hw-gpu-percent');
          const hwGpuTemp = document.getElementById('hw-gpu-temp');
          const hwGpuBar = document.getElementById('hw-gpu-bar');
          const hwGpuStatus = document.getElementById('hw-gpu-status');
          if (metrics.gpuPercent !== null) {
            if (hwGpuPercent) hwGpuPercent.textContent = `${metrics.gpuPercent}%`;
            if (hwGpuTemp && metrics.gpuTemp) hwGpuTemp.textContent = `${metrics.gpuTemp}°C`;
            if (hwGpuBar) hwGpuBar.style.width = `${metrics.gpuPercent}%`;
            if (hwGpuStatus) {
              hwGpuStatus.className = 'hw-tag';
              if (metrics.gpuPercent > 80) {
                hwGpuStatus.textContent = 'HEAVY';
              } else if (metrics.gpuPercent > 40) {
                hwGpuStatus.textContent = 'NORMAL';
              } else {
                hwGpuStatus.textContent = 'IDLE';
              }
            }
          } else {
            if (hwGpuPercent) hwGpuPercent.textContent = `N/A`;
          }

          const hwRamPercent = document.getElementById('hw-ram-percent');
          const hwRamGb = document.getElementById('hw-ram-gb');
          const hwRamBar = document.getElementById('hw-ram-bar');
          if (hwRamPercent) hwRamPercent.textContent = `${metrics.ramPercent}%`;
          if (hwRamGb) hwRamGb.textContent = `${metrics.usedRamGb} / ${metrics.totalRamGb} GB`;
          if (hwRamBar) hwRamBar.style.width = `${metrics.ramPercent}%`;

          // 3. Network Speed
          const hwNetSpeed = document.getElementById('notch-network-speed');
          if (hwNetSpeed && metrics.netSpeedText !== undefined) {
            hwNetSpeed.textContent = metrics.netSpeedText;
          }

          // 4. Bảng Uptime Dashboard (Replaced Battery)
          const hwUptimeVal = document.getElementById('hw-uptime-val');
          const hwUptimeDays = document.getElementById('hw-uptime-days');
          
          if (metrics.uptime !== undefined) {
            const totalSeconds = metrics.uptime;
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            
            if (hwUptimeVal) {
              const hStr = hours.toString().padStart(2, '0');
              const mStr = minutes.toString().padStart(2, '0');
              hwUptimeVal.textContent = `${hStr}:${mStr}`;
            }
            if (hwUptimeDays) {
              if (days > 0) {
                hwUptimeDays.textContent = `${days} DAY${days > 1 ? 'S' : ''}`;
              } else {
                hwUptimeDays.textContent = 'TODAY';
              }
            }
          }
        }
      } catch (e) {}
    }
  }

  updateHardwareStats();
  setInterval(updateHardwareStats, 2000);

  // 3. Real Weather & Location Service
  if (window.WeatherService) {
    window.weatherServiceInstance = new window.WeatherService();
  }

  // 4. Real-time Media System Sync
  if (window.SystemMediaSync) {
    window.mediaSyncInstance = new window.SystemMediaSync();
  }
});
