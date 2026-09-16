// Audio Visualizer Canvas Renderer
class AudioVisualizer {
  constructor(analyser) {
    this.analyser = analyser;
    this.miniCanvas = document.getElementById('mini-waveform-canvas');
    this.expandedCanvas = document.getElementById('expanded-waveform-canvas');

    this.isPlaying = false;
    this.animationId = null;

    this.initCanvases();
  }

  initCanvases() {
    if (this.miniCanvas) {
      this.miniCtx = this.miniCanvas.getContext('2d');
      this.miniCanvas.width = 64;
      this.miniCanvas.height = 28;
    }

    if (this.expandedCanvas) {
      this.expandedCtx = this.expandedCanvas.getContext('2d');
      this.expandedCanvas.width = 500;
      this.expandedCanvas.height = 120;
    }
  }

  start() {
    this.isPlaying = true;
    this.loop();
  }

  stop() {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.drawIdle();
  }

  loop() {
    if (!this.isPlaying) return;

    this.render();
    this.animationId = requestAnimationFrame(() => this.loop());
  }

  render() {
    // Generate synthetic smooth frequencies if analyser is not connected to a live stream
    let freqData = new Uint8Array(32);
    if (this.analyser) {
      this.analyser.getByteFrequencyData(freqData);
    } else {
      const time = Date.now() * 0.005;
      for (let i = 0; i < 32; i++) {
        freqData[i] = Math.abs(Math.sin(time + i * 0.4)) * 180 + Math.random() * 50;
      }
    }

    // 1. Draw Mini Waveform (4 bars)
    if (this.miniCtx) {
      const ctx = this.miniCtx;
      const w = this.miniCanvas.width;
      const h = this.miniCanvas.height;
      ctx.clearRect(0, 0, w, h);

      const numBars = 4;
      const barWidth = 4;
      const gap = 3;
      const startX = (w - (numBars * barWidth + (numBars - 1) * gap)) / 2;

      for (let i = 0; i < numBars; i++) {
        const val = (freqData[i * 4] || 100) / 255;
        const barHeight = Math.max(3, val * (h - 4));
        const x = startX + i * (barWidth + gap);
        const y = h - barHeight;

        ctx.fillStyle = '#00f2fe';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    }

    // 2. Draw Expanded Waveform (32 bars)
    if (this.expandedCtx) {
      const ctx = this.expandedCtx;
      const w = this.expandedCanvas.width;
      const h = this.expandedCanvas.height;
      ctx.clearRect(0, 0, w, h);

      const numBars = 28;
      const barWidth = 10;
      const gap = 6;
      const totalWidth = numBars * barWidth + (numBars - 1) * gap;
      const startX = (w - totalWidth) / 2;

      for (let i = 0; i < numBars; i++) {
        const val = (freqData[i] || 100) / 255;
        const barHeight = Math.max(4, val * (h - 10));
        const x = startX + i * (barWidth + gap);
        const y = (h - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#00f2fe');
        grad.addColorStop(0.5, '#4facfe');
        grad.addColorStop(1, '#9d4edd');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 5);
        ctx.fill();
      }
    }
  }

  drawIdle() {
    if (this.miniCtx) {
      const ctx = this.miniCtx;
      const w = this.miniCanvas.width;
      const h = this.miniCanvas.height;
      ctx.clearRect(0, 0, w, h);
      const numBars = 4;
      const barWidth = 4;
      const gap = 3;
      const startX = (w - (numBars * barWidth + (numBars - 1) * gap)) / 2;

      for (let i = 0; i < numBars; i++) {
        const x = startX + i * (barWidth + gap);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.roundRect(x, h - 4, barWidth, 4, 2);
        ctx.fill();
      }
    }

    if (this.expandedCtx) {
      const ctx = this.expandedCtx;
      ctx.clearRect(0, 0, this.expandedCanvas.width, this.expandedCanvas.height);
    }
  }
}

window.AudioVisualizer = AudioVisualizer;
