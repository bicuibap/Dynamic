// 3D Orbital Spatial Engine & Droplet Retraction Coordinator
class Orbital3DEngine {
  constructor() {
    this.stage = document.getElementById('orbital-stage');
    this.world = document.querySelector('.orbital-3d-world');
    this.islandPill = document.getElementById('island-pill');
    this.homeCore = document.getElementById('home-core-btn');
    
    this.isOpen = false;
    this.radius = 110; // orbit radius in px

    this.initSatellites();
    this.initEvents();
  }

  initSatellites() {
    const satellites = document.querySelectorAll('.satellite-orb-3d');
    const total = satellites.length;

    satellites.forEach((sat, index) => {
      // Position around circle: theta = (index / total) * 2 * PI - PI/2
      const theta = (index / total) * 2 * Math.PI - Math.PI / 2;
      const x = Math.round(this.radius * Math.cos(theta));
      const y = Math.round(this.radius * Math.sin(theta));
      const z = Math.round(20 * Math.sin(theta));

      sat.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
      sat.dataset.baseX = x;
      sat.dataset.baseY = y;
      sat.dataset.baseZ = z;

      // Click on satellite
      sat.addEventListener('click', (e) => {
        e.stopPropagation();
        const appType = sat.dataset.app;
        this.onSelectApp(appType);
      });
    });
  }

  initEvents() {
    // Top bar click or drag to trigger droplet drop
    const header = document.getElementById('island-header');
    if (header) {
      header.addEventListener('click', (e) => {
        if (this.islandPill.classList.contains('mini-music-mode')) {
          this.islandPill.classList.remove('mini-music-mode');
        } else {
          this.toggle();
        }
      });
    }

    // Click Home Core to retract
    if (this.homeCore) {
      this.homeCore.addEventListener('click', (e) => {
        e.stopPropagation();
        this.retractDroplet();
      });
    }

    // 3D Parallax Mouse Tracking
    window.addEventListener('mousemove', (e) => {
      if (!this.isOpen || !this.world) return;
      const rect = this.stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) / (rect.width / 2);
      const deltaY = (e.clientY - centerY) / (rect.height / 2);

      const rotY = Math.max(-25, Math.min(25, deltaX * 22));
      const rotX = Math.max(-25, Math.min(25, -deltaY * 22));

      this.world.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });

    // Escape to close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.retractDroplet();
      }
    });
  }

  openDroplet() {
    this.isOpen = true;
    this.stage.classList.remove('retracting');
    this.stage.classList.add('active');
  }

  retractDroplet(callback) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stage.classList.add('retracting');

    setTimeout(() => {
      this.stage.classList.remove('active');
      this.stage.classList.remove('retracting');
      if (callback) callback();
    }, 380);
  }

  toggle() {
    if (this.isOpen) {
      this.retractDroplet();
    } else {
      this.openDroplet();
    }
  }

  onSelectApp(appType) {
    // Retract droplet back up into notch and activate Mini Card UI
    this.retractDroplet(() => {
      if (appType === 'music') {
        this.islandPill.classList.add('mini-music-mode');
      }
    });
  }
}

window.Orbital3DEngine = Orbital3DEngine;
