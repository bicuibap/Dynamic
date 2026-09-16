// Hardware Metrics Tracker (Apple Battery Style Horizontal Bars)
class HardwareTracker {
  constructor() {
    this.init();
  }

  init() {
    this.updateMetrics();
    setInterval(() => this.updateMetrics(), 2000);
  }

  async updateMetrics() {
    if (!window.electronAPI) return;

    try {
      const data = await window.electronAPI.getSystemMetrics();
      if (!data) return;

      const cpuPercent = data.cpuPercent || 18;
      const ramPercent = data.ramPercent || 45;

      const cpuVal = document.getElementById('sys-cpu-val');
      const cpuFill = document.getElementById('sys-cpu-fill');
      const ramVal = document.getElementById('sys-ram-val');
      const ramFill = document.getElementById('sys-ram-fill');

      if (cpuVal) cpuVal.textContent = `${cpuPercent}%`;
      if (cpuFill) cpuFill.style.width = `${cpuPercent}%`;

      if (ramVal) ramVal.textContent = `${ramPercent}% (${data.usedRamGb || 7.2}GB / ${data.totalRamGb || 16}GB)`;
      if (ramFill) ramFill.style.width = `${ramPercent}%`;

      const uptimeElem = document.getElementById('uptime-val');
      if (uptimeElem && data.uptime) {
        const hours = Math.floor(data.uptime / 3600);
        const mins = Math.floor((data.uptime % 3600) / 60);
        uptimeElem.textContent = `${hours}h ${mins}m`;
      }
    } catch (e) {}
  }
}

window.HardwareTracker = HardwareTracker;
