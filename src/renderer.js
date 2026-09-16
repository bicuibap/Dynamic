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

    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const date = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    if (notchDate) notchDate.textContent = `${dayName}, ${date}/${month}`;
  }

  updateDateTime();
  setInterval(updateDateTime, 1000);

  // 2. Real-time CPU Temperature Monitor
  const notchCpuVal = document.getElementById('notch-cpu-val');
  const notchCpuItem = document.getElementById('notch-cpu-item');

  async function updateCpuTemp() {
    if (window.electronAPI && window.electronAPI.getCpuTemperature) {
      try {
        const temp = await window.electronAPI.getCpuTemperature();
        if (notchCpuVal && temp) {
          notchCpuVal.textContent = `${temp}°C`;
          if (notchCpuItem) {
            notchCpuItem.title = `Nhiệt độ CPU máy: ${temp}°C`;
            if (temp >= 80) {
              notchCpuItem.classList.add('hot');
            } else {
              notchCpuItem.classList.remove('hot');
            }
          }
        }
      } catch (e) {}
    }
  }

  updateCpuTemp();
  setInterval(updateCpuTemp, 2500);

  // 3. Real Weather & Location Service
  if (window.WeatherService) {
    window.weatherServiceInstance = new window.WeatherService();
  }

  // 4. Real-time Media System Sync
  if (window.SystemMediaSync) {
    window.mediaSyncInstance = new window.SystemMediaSync();
  }
});
