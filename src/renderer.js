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
          if (hwNetSpeed && metrics.netSpeedMBps !== undefined) {
            hwNetSpeed.textContent = `${metrics.netSpeedMBps} MB/s`;
          }

          // 4. Bảng Battery Dashboard
          const hwBatPercent = document.getElementById('hw-bat-percent');
          const hwBatStatus = document.getElementById('hw-bat-status');
          const hwBatBar = document.getElementById('hw-bat-bar');

          if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
              const level = Math.round(battery.level * 100);
              if (hwBatPercent) hwBatPercent.textContent = `${level}%`;
              if (hwBatBar) hwBatBar.style.width = `${level}%`;
              if (hwBatStatus) {
                hwBatStatus.textContent = battery.charging ? 'CHARGING' : (level <= 20 ? 'LOW BATTERY' : 'ON BATTERY');
              }
              
              // Trigger Alert on Charging state change
              if (window.lastChargingState === undefined) {
                window.lastChargingState = battery.charging;
              } else if (window.lastChargingState !== battery.charging) {
                window.lastChargingState = battery.charging;
                if (window.mediaSyncInstance && window.mediaSyncInstance.showAlert) {
                  const msg = battery.charging ? `Đang sạc (${level}%)` : `Ngừng sạc (${level}%)`;
                  const icon = battery.charging ? '⚡' : '🔋';
                  window.mediaSyncInstance.showAlert(msg, icon);
                }
              }
            });
          } else {
            if (hwBatPercent) hwBatPercent.textContent = `N/A`;
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
