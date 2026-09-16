// Windows Real-time System Media Synchronization & Island Controller
class SystemMediaSync {
  constructor() {
    this.isPlaying = false;
    this.currentSec = 0;
    this.totalSec = 0;
    this.hasActiveMedia = false;
    this.lastTitle = '';
    this.isExpanded = false;

    this.initElements();
    this.bindEvents();
    this.initPolling();
    this.startLocalTimer();
  }

  initElements() {
    // Notch Compact
    this.notchLiveMusic = document.getElementById('notch-live-music');
    this.notchMusicTitle = document.getElementById('notch-music-title');
    this.notchEqualizer = document.getElementById('notch-equalizer');
    this.notchDisc = document.getElementById('notch-music-btn');
    this.notchDiscImg = document.getElementById('notch-disc-img');
    this.notchDiscNote = document.getElementById('notch-disc-note');
    this.islandPill = document.getElementById('island-pill');
    this.islandHeader = document.getElementById('island-header');

    // Expanded Elements
    this.albumCoverImg = document.getElementById('album-cover-img');
    this.vinylFallbackIcon = document.getElementById('vinyl-fallback-icon');
    this.vinylDisc = document.getElementById('vinyl-disc');
    this.platformDot = document.getElementById('platform-dot');
    this.platformText = document.getElementById('platform-text');
    this.playbackStateTag = document.getElementById('playback-state-tag');
    this.songTitleElem = document.getElementById('live-song-title');
    this.artistNameElem = document.getElementById('live-artist-name');
    this.scrubberTrack = document.getElementById('scrubber-track');
    this.scrubberFill = document.getElementById('scrubber-fill');
    this.scrubberCur = document.getElementById('scrubber-cur');
    this.scrubberTot = document.getElementById('scrubber-tot');

    // Controls
    this.playBtn = document.getElementById('ctrl-play');
    this.nextBtn = document.getElementById('ctrl-next');
    this.prevBtn = document.getElementById('ctrl-prev');
    this.playIcon = document.getElementById('svg-play-icon');
    this.pauseIcon = document.getElementById('svg-pause-icon');

    // Default Idle State: Hide music disc & live pill
    if (this.islandPill) {
      this.islandPill.classList.add('no-media');
    }
    if (this.notchDisc) {
      this.notchDisc.style.display = 'none';
    }
  }

  bindEvents() {
    // Play/Pause Button
    if (this.playBtn) {
      this.playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlayPause();
      });
    }

    // Mini Notch Disc Button
    if (this.notchDisc) {
      this.notchDisc.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlayPause();
      });
    }

    // Next Track Button
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextBtn.classList.add('ctrl-active-tap');
        setTimeout(() => this.nextBtn.classList.remove('ctrl-active-tap'), 180);

        if (window.electronAPI) {
          window.electronAPI.mediaControl('next');
          // High-frequency burst polling to catch the next track as soon as player changes (100ms, 300ms, 600ms, 1000ms)
          setTimeout(() => this.fetchMedia(), 100);
          setTimeout(() => this.fetchMedia(), 300);
          setTimeout(() => this.fetchMedia(), 600);
          setTimeout(() => this.fetchMedia(), 1000);
        }
      });
    }

    // Previous Track Button
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prevBtn.classList.add('ctrl-active-tap');
        setTimeout(() => this.prevBtn.classList.remove('ctrl-active-tap'), 180);

        if (window.electronAPI) {
          window.electronAPI.mediaControl('prev');
          // High-frequency burst polling
          setTimeout(() => this.fetchMedia(), 100);
          setTimeout(() => this.fetchMedia(), 300);
          setTimeout(() => this.fetchMedia(), 600);
          setTimeout(() => this.fetchMedia(), 1000);
        }
      });
    }

    // Toggle Expand / Collapse when clicking Notch header
    if (this.islandHeader) {
      this.islandHeader.addEventListener('click', (e) => {
        // Prevent click when clicking buttons inside header
        if (e.target.closest('#notch-music-btn') || e.target.closest('button')) return;

        // Khi YouTube / nhạc không bật gì thì không mở UI rỗng
        if (!this.hasActiveMedia) {
          this.islandPill.classList.add('notch-idle-tap');
          setTimeout(() => {
            if (this.islandPill) this.islandPill.classList.remove('notch-idle-tap');
          }, 250);
          return;
        }

        this.toggleExpand();
      });
    }

    // Mini Live Music Pill Click -> Mở / Thu gọn nhanh
    if (this.notchLiveMusic) {
      this.notchLiveMusic.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.hasActiveMedia) {
          this.toggleExpand();
        }
      });
    }

    // Mouse hover mouse passthrough management
    if (this.islandPill && window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      this.islandPill.addEventListener('mouseenter', () => {
        window.electronAPI.setIgnoreMouseEvents(false);
      });
      this.islandPill.addEventListener('mouseleave', () => {
        if (!this.isExpanded) {
          window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        }
      });
    }
  }

  toggleExpand(forceState) {
    // Không cho phép mở rộng nếu không có nhạc đang phát
    if (!this.hasActiveMedia && forceState !== false) {
      return;
    }

    if (typeof forceState === 'boolean') {
      this.isExpanded = forceState;
    } else {
      this.isExpanded = !this.isExpanded;
    }

    if (this.islandPill) {
      if (this.isExpanded) {
        this.islandPill.classList.remove('island-collapsed');
        this.islandPill.classList.add('island-expanded');
        if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
          window.electronAPI.setIgnoreMouseEvents(false);
        }
      } else {
        this.islandPill.classList.remove('island-expanded');
        this.islandPill.classList.add('island-collapsed');
      }
    }
  }

  async togglePlayPause() {
    // 0ms Optimistic UI feedback
    this.setPlayState(!this.isPlaying);
    if (window.electronAPI) {
      await window.electronAPI.mediaControl('play-pause');
      setTimeout(() => this.fetchMedia(), 150);
      setTimeout(() => this.fetchMedia(), 500);
    }
  }

  setPlayState(playing) {
    this.isPlaying = playing;

    if (this.playIcon && this.pauseIcon) {
      this.playIcon.style.display = this.isPlaying ? 'none' : 'block';
      this.pauseIcon.style.display = this.isPlaying ? 'block' : 'none';
    }

    if (this.vinylDisc) {
      if (this.isPlaying) {
        this.vinylDisc.classList.add('spinning');
      } else {
        this.vinylDisc.classList.remove('spinning');
      }
    }

    if (this.notchDisc) {
      if (this.isPlaying) {
        this.notchDisc.classList.add('playing');
      } else {
        this.notchDisc.classList.remove('playing');
      }
    }

    if (this.notchEqualizer) {
      if (this.isPlaying) {
        this.notchEqualizer.classList.add('active');
      } else {
        this.notchEqualizer.classList.remove('active');
      }
    }

    if (this.playbackStateTag) {
      this.playbackStateTag.textContent = this.isPlaying ? 'Đang phát' : 'Tạm dừng';
      this.playbackStateTag.className = 'playback-state-tag ' + (this.isPlaying ? 'playing' : 'paused');
    }
  }

  initPolling() {
    this.fetchMedia();
    setInterval(() => this.fetchMedia(), 1200);
  }

  async fetchMedia() {
    if (!window.electronAPI || !window.electronAPI.getWindowsMediaInfo) return;

    try {
      const media = await window.electronAPI.getWindowsMediaInfo();
      if (media && media.title && media.title.trim() !== '' && media.status !== 'Closed' && media.status !== '0') {
        this.hasActiveMedia = true;
        this.updateMediaUI(media);
      } else {
        this.hasActiveMedia = false;
        this.resetMediaUI();
      }
    } catch (e) {
      // ignore
    }
  }

  updateMediaUI(media) {
    const isNewTrack = (this.lastTitle !== media.title);
    this.lastTitle = media.title;

    // Khi có nhạc -> gỡ bỏ no-media và hiển thị disc
    if (this.islandPill) {
      this.islandPill.classList.remove('no-media');
    }
    if (this.notchDisc) {
      this.notchDisc.style.display = 'flex';
    }

    // 1. Song Title & Artist
    if (this.songTitleElem) this.songTitleElem.textContent = media.title;
    if (this.artistNameElem) this.artistNameElem.textContent = media.artist || 'Nghệ sĩ / Kênh phát';

    // 2. Compact Notch Mini Title
    if (this.notchMusicTitle) {
      const displayTitle = media.title.length > 25 ? media.title.substring(0, 22) + '...' : media.title;
      this.notchMusicTitle.textContent = displayTitle;
    }
    if (this.notchLiveMusic) {
      this.notchLiveMusic.classList.add('visible');
    }

    // 3. Platform Badge
    const platform = this.detectPlatform(media.sourceApp, media.title);
    if (this.platformText) this.platformText.textContent = platform.name;
    if (this.platformDot) {
      this.platformDot.className = 'platform-dot ' + platform.type;
    }

    // 4. Album Cover Art
    if (media.thumbnail && media.thumbnail.length > 10) {
      if (this.albumCoverImg) {
        this.albumCoverImg.src = media.thumbnail;
        this.albumCoverImg.style.display = 'block';
      }
      if (this.vinylFallbackIcon) {
        this.vinylFallbackIcon.style.display = 'none';
      }
      if (this.notchDiscImg) {
        this.notchDiscImg.src = media.thumbnail;
        this.notchDiscImg.style.display = 'block';
      }
      if (this.notchDiscNote) {
        this.notchDiscNote.style.display = 'none';
      }
    } else {
      if (this.albumCoverImg) this.albumCoverImg.style.display = 'none';
      if (this.vinylFallbackIcon) this.vinylFallbackIcon.style.display = 'flex';
      if (this.notchDiscImg) this.notchDiscImg.style.display = 'none';
      if (this.notchDiscNote) this.notchDiscNote.style.display = 'block';
    }

    // 5. Timeline / Progress
    if (media.endTime && media.endTime > 0) {
      this.totalSec = Math.round(media.endTime);
      if (isNewTrack || !media.isPlaying || Math.abs(this.currentSec - media.position) >= 2) {
        this.currentSec = Math.round(media.position || 0);
      }
    } else if (isNewTrack) {
      this.currentSec = Math.round(media.position || 0);
      this.totalSec = 0;
    }

    this.updateTimelineUI();
    this.setPlayState(media.isPlaying);
  }

  resetMediaUI() {
    this.hasActiveMedia = false;
    this.lastTitle = '';

    // Tự động thu gọn nếu đang mở bento card
    if (this.isExpanded) {
      this.toggleExpand(false);
    }

    // Bật no-media để thu nhỏ thanh notch pill về kích thước gọn gàng 330px
    if (this.islandPill) {
      this.islandPill.classList.add('no-media');
    }

    // Ẩn hoàn toàn đĩa nhạc và thanh live music khi YT không bật gì
    if (this.notchDisc) {
      this.notchDisc.style.display = 'none';
    }
    if (this.notchLiveMusic) {
      this.notchLiveMusic.classList.remove('visible');
    }
    if (this.notchMusicTitle) {
      this.notchMusicTitle.textContent = '';
    }

    if (this.songTitleElem) this.songTitleElem.textContent = 'Chưa phát nhạc';
    if (this.artistNameElem) this.artistNameElem.textContent = 'Hãy mở Spotify, YouTube hoặc trình duyệt';
    if (this.platformText) this.platformText.textContent = 'Chưa phát nhạc';
    if (this.albumCoverImg) this.albumCoverImg.style.display = 'none';
    if (this.vinylFallbackIcon) this.vinylFallbackIcon.style.display = 'flex';
    if (this.notchDiscImg) this.notchDiscImg.style.display = 'none';
    if (this.notchDiscNote) this.notchDiscNote.style.display = 'block';
    this.setPlayState(false);
  }

  detectPlatform(sourceApp, title) {
    const raw = (sourceApp + ' ' + title).toLowerCase();
    if (raw.includes('spotify')) {
      return { name: 'Spotify', type: 'spotify' };
    }
    if (raw.includes('youtube') || raw.includes('chrome') || raw.includes('brave') || raw.includes('firefox')) {
      return { name: 'YouTube / Trình duyệt', type: 'youtube' };
    }
    if (raw.includes('edge') || raw.includes('msedge')) {
      return { name: 'Microsoft Edge', type: 'edge' };
    }
    if (raw.includes('apple') || raw.includes('itunes')) {
      return { name: 'Apple Music', type: 'apple' };
    }
    if (raw.includes('zing') || raw.includes('nhaccuatui')) {
      return { name: 'Zing MP3 / NhacCuaTui', type: 'zing' };
    }
    return { name: sourceApp || 'Trình phát nhạc', type: 'default' };
  }

  startLocalTimer() {
    setInterval(() => {
      if (this.isPlaying && this.hasActiveMedia) {
        this.currentSec++;
        if (this.totalSec > 0 && this.currentSec > this.totalSec) {
          this.currentSec = this.totalSec;
        }
        this.updateTimelineUI();
      }
    }, 1000);
  }

  updateTimelineUI() {
    if (this.scrubberCur) this.scrubberCur.textContent = this.formatTime(this.currentSec);
    if (this.scrubberTot) this.scrubberTot.textContent = this.formatTime(this.totalSec);

    if (this.scrubberFill && this.totalSec > 0) {
      const pct = Math.min(100, Math.max(0, (this.currentSec / this.totalSec) * 100));
      this.scrubberFill.style.width = `${pct}%`;
    }
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

window.SystemMediaSync = SystemMediaSync;
