// Pomodoro Focus Timer
class PomodoroTimer {
  constructor() {
    this.totalSeconds = 25 * 60;
    this.remainingSeconds = this.totalSeconds;
    this.isRunning = false;
    this.timerInterval = null;

    this.init();
  }

  init() {
    this.display = document.getElementById('pomodoro-time');
    this.startBtn = document.getElementById('pomodoro-start-btn');
    this.resetBtn = document.getElementById('pomodoro-reset-btn');

    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => this.toggle());
    }
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this.reset());
    }

    // Mode buttons
    const modeBtns = document.querySelectorAll('.pomo-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        modeBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const mins = parseInt(e.target.dataset.mins || '25', 10);
        this.setMode(mins);
      });
    });

    this.updateDisplay();
  }

  setMode(mins) {
    this.pause();
    this.totalSeconds = mins * 60;
    this.remainingSeconds = this.totalSeconds;
    this.updateDisplay();
  }

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  start() {
    this.isRunning = true;
    if (this.startBtn) this.startBtn.textContent = 'Pause';
    this.timerInterval = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.updateDisplay();
      } else {
        this.pause();
        alert('🎉 Pomodoro Session Completed!');
      }
    }, 1000);
  }

  pause() {
    this.isRunning = false;
    if (this.startBtn) this.startBtn.textContent = 'Start';
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  reset() {
    this.pause();
    this.remainingSeconds = this.totalSeconds;
    this.updateDisplay();
  }

  updateDisplay() {
    if (!this.display) return;
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    this.display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

window.PomodoroTimer = PomodoroTimer;
