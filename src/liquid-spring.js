// Apple iOS Dynamic Island Spring Physics Coordinator
class LiquidSpringEngine {
  constructor() {
    this.islandPill = document.getElementById('island-pill');
    this.notchWrapper = document.getElementById('notch-wrapper');
    this.isExpanded = false;

    this.init();
  }

  init() {
    if (!this.islandPill) return;

    // Click on header or toggle button to morph
    const header = document.getElementById('island-header');
    if (header) {
      header.addEventListener('click', (e) => {
        // Only toggle if not clicking interactive buttons
        if (e.target.closest('#notch-music-btn')) return;
        this.toggle();
      });
    }

    const toggleBtn = document.getElementById('notch-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }

    const closeBtn = document.getElementById('btn-close-island');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.collapse();
      });
    }

    // Escape key to close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isExpanded) {
        this.collapse();
      }
    });
  }

  expand() {
    this.isExpanded = true;
    this.islandPill.classList.add('expanded');
    if (this.notchWrapper) this.notchWrapper.classList.add('expanded-mode');
  }

  collapse() {
    this.isExpanded = false;
    this.islandPill.classList.remove('expanded');
    if (this.notchWrapper) this.notchWrapper.classList.remove('expanded-mode');
  }

  toggle() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }
}

window.LiquidSpringEngine = LiquidSpringEngine;
