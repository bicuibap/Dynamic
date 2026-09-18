// Windows Real-time System Media Synchronization & Island Controller
class SystemMediaSync {
  constructor() {
    this.isPlaying = false;
    this.currentSec = 0;
    this.totalSec = 0;
    this.hasActiveMedia = false;
    this.lastTitle = '';
    this.isExpanded = false;
    this.hideTimeout = null;
    this.autoHide = false; // Mặc định: KHÔNG tự ẩn (Luôn hiển thị trên màn hình)

    this.initElements();
    this.initVolume();
    this.initMouseManager();
    this.bindEvents();
    this.initDaemonStream();
    this.startLocalTimer();
    
    // Khởi tạo hiển thị ban đầu
    this.showIslandTemporarily(this.autoHide ? 8000 : 0);
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
    this.islandWrapper = document.getElementById('island-wrapper');
    this.islandHeader = document.getElementById('island-header');
    this.notchCpuItem = document.getElementById('notch-cpu-item');
    this.notchWeatherItem = document.getElementById('notch-weather-item');
    this.notchTimeItem = document.getElementById('notch-time-item');
    this.notchBotItem = document.getElementById('notch-bot-item');
    this.hoverTrigger = document.getElementById('hover-trigger');

    // Expanded Elements
    this.albumCoverImg = document.getElementById('album-cover-img');
    this.ambilightGlow = document.getElementById('ambilight-glow');
    this.vinylFallbackIcon = document.getElementById('vinyl-fallback-icon');
    this.vinylDisc = document.getElementById('vinyl-disc');
    this.platformDot = document.getElementById('platform-dot');
    this.platformText = document.getElementById('platform-text');
    this.playbackStateTag = document.getElementById('playback-state-tag');
    this.songTitleElem = document.getElementById('live-song-title');
    this.artistNameElem = document.getElementById('live-artist-name');
    this.dashboardPanel = document.getElementById('dashboard-panel');

    // Scrubber & Seeking
    this.scrubberTrack = document.getElementById('scrubber-track');
    this.scrubberFill = document.getElementById('scrubber-fill');
    this.scrubberThumb = document.getElementById('scrubber-thumb');
    this.scrubberCur = document.getElementById('scrubber-cur');
    this.scrubberTot = document.getElementById('scrubber-tot');
    this.miniPillPanel = document.getElementById('mini-pill-panel');
    this.mediaAlertView = document.getElementById('media-alert-view');
    this.mediaAlertThumb = document.getElementById('media-alert-thumb');
    this.mediaAlertThumbFallback = document.getElementById('media-alert-thumb-fallback');
    this.mediaAlertTitle = document.getElementById('media-alert-title');
    this.mediaAlertArtist = document.getElementById('media-alert-artist');
    
    this.systemAlertView = document.getElementById('system-alert-view');
    this.systemAlertIcon = document.getElementById('system-alert-icon');
    this.systemAlertTitle = document.getElementById('system-alert-title');
    this.systemAlertSubtitle = document.getElementById('system-alert-subtitle');

    this.volumeAlertView = document.getElementById('volume-alert-view');
    this.volumeAlertIcon = document.getElementById('volume-alert-icon');
    this.volumeAlertFill = document.getElementById('volume-alert-fill');
    this.volumeAlertText = document.getElementById('volume-alert-text');
    
    this.alertTimer = null;
    this.volumeTimer = null;
    this.isScrubbing = false;

    // Controls
    this.playBtn = document.getElementById('ctrl-play');
    this.nextBtn = document.getElementById('ctrl-next');
    this.prevBtn = document.getElementById('ctrl-prev');
    this.rewindBtn = document.getElementById('ctrl-rewind');
    this.forwardBtn = document.getElementById('ctrl-forward');
    this.playIcon = document.getElementById('svg-play-icon');
    this.pauseIcon = document.getElementById('svg-pause-icon');
    this.lastScrubTime = 0;

    // Volume Control Elements
    this.volGroup = document.getElementById('volume-group');
    this.volTrack = document.getElementById('vol-track');
    this.volFill = document.getElementById('vol-fill');
    this.volThumb = document.getElementById('vol-thumb');
    this.volText = document.getElementById('vol-text');
    this.volMuteBtn = document.getElementById('vol-mute-btn');
    this.volIconSpeaker = document.getElementById('vol-icon-speaker');
    this.volIconMuted = document.getElementById('vol-icon-muted');
    this.currentVolume = 50;
    this.isMuted = false;
    this.isDraggingVolume = false;

    // Default Idle State: Hide music disc & live pill
    if (this.islandPill) {
      this.islandPill.classList.add('no-media');
    }
    if (this.notchDisc) {
      this.notchDisc.style.display = 'none';
    }
  }

  initMouseManager() {
    this.mouseIgnored = true;
    this.lastMouseX = -1;
    this.lastMouseY = -1;

    // Khởi tạo mặc định: xuyên thấu chuột để không chặn bất kỳ click nào
    this.setMouseIgnored(true);

    // Bắt sự kiện chuột di chuyển trên toàn bộ cửa sổ (được Electron forward)
    window.addEventListener('mousemove', (e) => {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.checkMouseHit(e.clientX, e.clientY);
    });

    // Khi chuột rời khỏi cửa sổ
    window.addEventListener('mouseleave', () => {
      this.lastMouseX = -1;
      this.lastMouseY = -1;
      if (!this.isScrubbing && !this.isDraggingVolume) {
        this.setMouseIgnored(true);
      }
    });

    // Khi cửa sổ mất tiêu điểm (người dùng click ra ngoài vào ứng dụng khác hoặc desktop)
    window.addEventListener('blur', () => {
      this.handleOutsideClick();
    });

    if (window.electronAPI && window.electronAPI.onWindowBlur) {
      window.electronAPI.onWindowBlur(() => {
        this.handleOutsideClick();
      });
    }
  }

  handleOutsideClick() {
    // Nếu đang trong quá trình kéo tua bài hát hoặc kéo thanh âm lượng -> không thu lại
    if (this.isScrubbing || this.isDraggingVolume) {
      return;
    }
    this.setMouseIgnored(true);

    // Nếu đảo đang ở trạng thái mở rộng (Expanded UI), tự động thu gọn lại thanh Compact Notch
    if (this.isExpanded) {
      this.toggleExpand(false);
    }
  }

  setMouseIgnored(ignore) {
    if (this.mouseIgnored === ignore) return;
    this.mouseIgnored = ignore;
    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(ignore, { forward: true });
    }
  }

  checkMouseHit(clientX, clientY) {
    // Nếu đang giữ kéo tua hoặc kéo âm lượng, không bật xuyên thấu để không đứt tương tác
    if (this.isScrubbing || this.isDraggingVolume) {
      this.setMouseIgnored(false);
      return;
    }

    // Nếu toạ độ chuột không hợp lệ hoặc ngoài khung hình
    if (clientX < 0 || clientY < 0 || clientX === undefined) {
      this.setMouseIgnored(true);
      return;
    }

    const isHidden = !this.islandPill ||
        this.islandPill.classList.contains('island-hidden') ||
        (this.islandWrapper && this.islandWrapper.classList.contains('island-hidden'));

    // Nếu đảo đang ở trạng thái ẩn (trượt lên trên mép màn hình)
    if (isHidden) {
      // VÙNG ĐÁNH THỨC: Khi đảo đang ẩn, CHỈ khi chuột di SÁT LÊN ĐỈNH MÀN HÌNH (y <= 2px)
      const winWidth = window.innerWidth || 580;
      const wakeLeft = (winWidth - 420) / 2;
      const wakeRight = wakeLeft + 420;

      if (clientY <= 2 && clientX >= wakeLeft && clientX <= wakeRight) {
        this.showIslandTemporarily(8000);
        this.setMouseIgnored(false);
        return;
      }

      this.setMouseIgnored(true);
      return;
    }

    // Bounding Box Fast-Check
    const rect = this.islandPill.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0) {
      this.setMouseIgnored(true);
      return;
    }

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      this.setMouseIgnored(true);
      if (this.autoHide && !this.hideTimeout && !this.isExpanded) {
        this.showIslandTemporarily(8000);
      }
      return;
    }

    // Hit-testing chi tiết với DOM element để đảm bảo con trỏ thực sự nằm trên đảo
    const elem = document.elementFromPoint(clientX, clientY);
    const isOverPill = !!(elem && (this.islandPill.contains(elem) || elem === this.islandPill));

    if (isOverPill) {
      this.setMouseIgnored(false);
      // Khi đang rê chuột trên đảo: giữ nguyên, hủy timer tự ẩn
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
    } else {
      this.setMouseIgnored(true);
      if (this.autoHide && !this.hideTimeout && !this.isExpanded) {
        this.showIslandTemporarily(8000);
      }
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
        }
      });
    }

    // Rewind -10s Button (Tua lùi 10 giây)
    if (this.rewindBtn) {
      this.rewindBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.rewindBtn.classList.add('ctrl-active-tap');
        setTimeout(() => this.rewindBtn.classList.remove('ctrl-active-tap'), 180);
        this.seekRelative(-10);
      });
    }

    // Forward +10s Button (Tua tới 10 giây)
    if (this.forwardBtn) {
      this.forwardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.forwardBtn.classList.add('ctrl-active-tap');
        setTimeout(() => this.forwardBtn.classList.remove('ctrl-active-tap'), 180);
        this.seekRelative(10);
      });
    }

    // Notch Header Click -> Toggle Expand / Collapse
    if (this.islandHeader) {
      this.islandHeader.addEventListener('click', (e) => {
        if (e.target.closest('#notch-music-btn') || e.target.closest('button')) return;
        if (e.target.closest('#notch-cpu-item')) return;
        if (e.target.closest('#notch-weather-item')) return;
        if (e.target.closest('#notch-time-item')) return;
        if (e.target.closest('#notch-bot-item')) return;

        // Bấm vào Header khi đang ở các chế độ khác -> Đóng hoặc về Media Mode
        if (this.isExpanded && (this.islandPill.classList.contains('mode-hardware') || this.islandPill.classList.contains('mode-weather') || this.islandPill.classList.contains('mode-calendar') || this.islandPill.classList.contains('mode-bot'))) {
          if (this.hasActiveMedia) {
            this.toggleExpand(true, 'media');
          } else {
            this.toggleExpand(false);
          }
          return;
        }

        // Khi YouTube / nhạc không bật gì thì không mở UI rỗng
        if (!this.hasActiveMedia) {
          this.islandPill.classList.add('notch-idle-tap');
          setTimeout(() => {
            if (this.islandPill) this.islandPill.classList.remove('notch-idle-tap');
          }, 250);
          return;
        }

        this.toggleExpand(undefined, 'media');
      });
    }

    // Click vào Cục CPU -> Mở bảng Hardware
    if (this.notchCpuItem) {
      this.notchCpuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isExpanded && this.islandPill.classList.contains('mode-hardware')) {
          this.toggleExpand(false);
        } else {
          this.toggleExpand(true, 'hardware');
        }
      });
    }

    // Click vào Cục Thời Tiết -> Mở bảng Thời Tiết
    if (this.notchWeatherItem) {
      this.notchWeatherItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isExpanded && this.islandPill.classList.contains('mode-weather')) {
          this.toggleExpand(false);
        } else {
          this.toggleExpand(true, 'weather');
        }
      });
    }

    // Click vào Cụm Thời Gian -> Mở bảng Lịch
    if (this.notchTimeItem) {
      this.notchTimeItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isExpanded && this.islandPill.classList.contains('mode-calendar')) {
          this.toggleExpand(false);
        } else {
          this.toggleExpand(true, 'calendar');
        }
      });
    }

    // Mở rộng bảng Trợ lý AI (Bot)
    if (this.notchBotItem) {
      this.notchBotItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isExpanded && this.islandPill.classList.contains('mode-bot')) {
          this.toggleExpand(false);
        } else {
          this.toggleExpand(true, 'bot');
        }
      });
    }

    // Mini Live Music Pill Click -> Mở / Thu gọn nhanh
    if (this.notchLiveMusic) {
      this.notchLiveMusic.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.hasActiveMedia) {
          // Nếu đang mở ở chế độ phần cứng, thời tiết, lịch -> Chuyển sang bảng Nhạc
          if (this.isExpanded && (this.islandPill.classList.contains('mode-hardware') || this.islandPill.classList.contains('mode-weather') || this.islandPill.classList.contains('mode-calendar'))) {
            this.toggleExpand(true, 'media');
          } else {
            // Ngược lại thì Mở/Đóng bình thường
            this.toggleExpand(undefined, 'media');
          }
        }
      });
    }

    // Chuột phải vào Dynamic Island -> Chuyển đổi nhanh chế độ Luôn hiển thị / Tự ẩn sau 8s
    if (this.islandPill) {
      this.islandPill.addEventListener('contextmenu', (e) => {
        // Nếu chuột phải vào ô input bot hoặc textarea thì để người dùng paste/copy
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        e.stopPropagation();
        const nextAutoHide = !this.autoHide;
        if (window.electronAPI && window.electronAPI.setAutoHideSetting) {
          window.electronAPI.setAutoHideSetting(nextAutoHide);
        }
      });
    }


    // Scrubber Interaction (Tua video / nhạc trực tiếp)
    if (this.scrubberTrack) {
      this.scrubberTrack.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (!this.hasActiveMedia || this.totalSec <= 0) return;
        this.isScrubbing = true;
        this.scrubberTrack.classList.add('scrubbing');
        this.handleScrub(e);
      });
    }

    // Volume Track Interaction (Kéo thả chỉnh âm lượng Windows)
    if (this.volTrack) {
      this.volTrack.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.isDraggingVolume = true;
        this.volTrack.classList.add('dragging');
        this.handleVolumeDrag(e);
      });
    }

    // Global Mousemove & Mouseup
    window.addEventListener('mousemove', (e) => {
      if (this.isScrubbing) {
        this.handleScrub(e);
      }
      if (this.isDraggingVolume) {
        this.handleVolumeDrag(e);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isScrubbing) {
        this.finishScrub(e);
      }
      if (this.isDraggingVolume) {
        this.finishVolumeDrag(e);
      }
      this.checkMouseHit(e.clientX, e.clientY);
    });

    // Volume Mute Button
    if (this.volMuteBtn) {
      this.volMuteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMute();
      });
    }

    // Cuộn chuột trên thanh âm lượng để tăng / giảm âm lượng mượt mà
    if (this.volGroup) {
      this.volGroup.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 3 : -3;
        this.adjustVolumeBy(delta);
      }, { passive: false });
    }
  }

  toggleExpand(forceState, mode = 'media') {
    // Không cho phép mở rộng nếu không có nhạc đang phát (áp dụng cho media)
    if (!this.hasActiveMedia && mode === 'media' && forceState !== false) {
      return;
    }

    if (typeof forceState === 'boolean') {
      this.isExpanded = forceState;
    } else {
      this.isExpanded = !this.isExpanded;
    }

    if (this.islandPill) {
      if (this.isExpanded) {
        // Yêu cầu cửa sổ nhận tiêu điểm (focus) để khi click ra ngoài vào ứng dụng khác sẽ lập tức kích hoạt sự kiện blur
        if (mode !== 'media-alert' && mode !== 'system-alert' && mode !== 'volume') {
          if (window.electronAPI && window.electronAPI.focusWindow) {
            window.electronAPI.focusWindow();
          }
        }
        this.islandPill.classList.remove('mode-hardware', 'mode-weather', 'mode-calendar', 'mode-bot', 'mode-mini', 'mode-alert', 'mode-media-alert', 'mode-system-alert', 'mode-volume');
        this.dashboardPanel.style.display = '';
        if (this.miniPillPanel) this.miniPillPanel.style.display = 'none';
        
        if (mode === 'hardware') {
          this.islandPill.classList.add('mode-hardware');
        } else if (mode === 'weather') {
          this.islandPill.classList.add('mode-weather');
        } else if (mode === 'calendar') {
          this.islandPill.classList.add('mode-calendar');
        } else if (mode === 'bot') {
          this.islandPill.classList.add('mode-bot');
          // Focus vào ô input ngay sau khi mở
          setTimeout(() => {
            const botInput = document.getElementById('bot-input');
            if (botInput) botInput.focus({ preventScroll: true });
          }, 300);
        } else if (mode === 'media-alert') {
          this.islandPill.classList.add('mode-mini', 'mode-media-alert');
          this.dashboardPanel.style.display = 'none';
          if (this.miniPillPanel) this.miniPillPanel.style.display = 'flex';
          if (this.mediaAlertView) this.mediaAlertView.style.display = 'flex';
          if (this.systemAlertView) this.systemAlertView.style.display = 'none';
          if (this.volumeAlertView) this.volumeAlertView.style.display = 'none';
        } else if (mode === 'system-alert' || mode === 'alert') {
          this.islandPill.classList.add('mode-mini', 'mode-system-alert');
          this.dashboardPanel.style.display = 'none';
          if (this.miniPillPanel) this.miniPillPanel.style.display = 'flex';
          if (this.mediaAlertView) this.mediaAlertView.style.display = 'none';
          if (this.systemAlertView) this.systemAlertView.style.display = 'flex';
          if (this.volumeAlertView) this.volumeAlertView.style.display = 'none';
        } else if (mode === 'volume') {
          this.islandPill.classList.add('mode-mini', 'mode-volume');
          this.dashboardPanel.style.display = 'none';
          if (this.miniPillPanel) this.miniPillPanel.style.display = 'flex';
          if (this.mediaAlertView) this.mediaAlertView.style.display = 'none';
          if (this.systemAlertView) this.systemAlertView.style.display = 'none';
          if (this.volumeAlertView) this.volumeAlertView.style.display = 'flex';
        }
        
        this.showIslandTemporarily(0);
        this.islandPill.classList.remove('island-collapsed');
        this.islandPill.classList.add('island-expanded');
        this.checkMouseHit(this.lastMouseX, this.lastMouseY);
      } else {
        this.showIslandTemporarily(8000);
        this.islandPill.classList.remove('island-expanded', 'mode-hardware', 'mode-weather', 'mode-calendar', 'mode-bot', 'mode-mini', 'mode-alert', 'mode-media-alert', 'mode-system-alert', 'mode-volume');
        this.islandPill.classList.add('island-collapsed');
        this.checkMouseHit(this.lastMouseX, this.lastMouseY);
        
        setTimeout(() => {
          this.dashboardPanel.style.removeProperty('opacity');
          if (this.miniPillPanel) this.miniPillPanel.style.removeProperty('opacity');
          if (this.mediaAlertView) this.mediaAlertView.style.display = 'none';
          if (this.systemAlertView) this.systemAlertView.style.display = 'none';
          if (this.volumeAlertView) this.volumeAlertView.style.display = 'none';
        }, 100);
      }
    }
  }

  showMediaAlert(media) {
    if (!media || !media.title) return;

    // 1. Cập nhật ảnh bìa hoặc fallback đĩa than
    if (this.mediaAlertThumb && this.mediaAlertThumbFallback) {
      if (media.thumbnail && typeof media.thumbnail === 'string' && media.thumbnail.trim().length > 10) {
        this.mediaAlertThumb.src = media.thumbnail;
        this.mediaAlertThumb.style.display = 'block';
        this.mediaAlertThumbFallback.style.display = 'none';
      } else {
        this.mediaAlertThumb.style.display = 'none';
        this.mediaAlertThumbFallback.style.display = 'flex';
      }
    }

    // 2. Cập nhật tiêu đề bài hát và nghệ sĩ
    if (this.mediaAlertTitle) {
      this.mediaAlertTitle.textContent = media.title;
      this.mediaAlertTitle.title = media.title;
    }
    if (this.mediaAlertArtist) {
      const artist = media.artist && media.artist.trim() !== '' ? media.artist : 'Đang phát trực tiếp';
      this.mediaAlertArtist.textContent = artist;
      this.mediaAlertArtist.title = artist;
    }

    // 3. Mở rộng đảo ở chế độ Capsule Media Alert
    this.toggleExpand(true, 'media-alert');

    // 4. Đặt thời gian đóng sau 3.6 giây
    if (this.alertTimer) clearTimeout(this.alertTimer);
    this.alertTimer = setTimeout(() => {
      if (this.isExpanded && this.islandPill && this.islandPill.classList.contains('mode-media-alert')) {
        this.toggleExpand(false);
        // Sau khi alert đóng, giữ đảo ở compact notch 8s nếu bật auto-hide
        if (this.autoHide) {
          this.showIslandTemporarily(8000);
        }
      }
    }, 3600);
  }

  showAlert(text, icon = '📌', subtitle = 'Dynamic Island') {
    if (this.systemAlertIcon) this.systemAlertIcon.textContent = icon;
    if (this.systemAlertTitle) {
      this.systemAlertTitle.textContent = text;
      this.systemAlertTitle.title = text;
    }
    if (this.systemAlertSubtitle) {
      this.systemAlertSubtitle.textContent = subtitle;
    }
    
    this.toggleExpand(true, 'system-alert');
    
    if (this.alertTimer) clearTimeout(this.alertTimer);
    this.alertTimer = setTimeout(() => {
      if (this.isExpanded && this.islandPill && (this.islandPill.classList.contains('mode-system-alert') || this.islandPill.classList.contains('mode-alert'))) {
        this.toggleExpand(false);
        // Sau khi alert đóng lại, cho phép đảo hiển thị ở dạng Compact Notch 8 giây rồi mới trượt ẩn
        if (this.autoHide) {
          this.showIslandTemporarily(8000);
        }
      }
    }, 3200);
  }

  showVolumeMini(volumePct) {
    const pct = Math.max(0, Math.min(100, Math.round(volumePct)));
    if (this.volumeAlertFill) {
      this.volumeAlertFill.style.width = `${pct}%`;
    }
    if (this.volumeAlertText) {
      this.volumeAlertText.textContent = `${pct}%`;
    }
    if (this.volumeAlertIcon) {
      this.volumeAlertIcon.textContent = pct === 0 ? '🔇' : (pct < 50 ? '🔉' : '🔊');
    }
    
    this.toggleExpand(true, 'volume');
    
    if (this.volumeTimer) clearTimeout(this.volumeTimer);
    this.volumeTimer = setTimeout(() => {
      if (this.isExpanded && this.islandPill && this.islandPill.classList.contains('mode-volume')) {
        this.toggleExpand(false);
        if (this.autoHide) {
          this.showIslandTemporarily(8000);
        }
      }
    }, 2200);
  }

  async togglePlayPause() {
    const action = this.isPlaying ? 'pause' : 'play';
    this.setPlayState(!this.isPlaying);
    if (window.electronAPI) {
      await window.electronAPI.mediaControl(action);
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

  initDaemonStream() {
    // Bắt sự kiện lăn chuột trên Header để chỉnh âm lượng
    if (this.islandHeader) {
      this.islandHeader.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = Math.sign(e.deltaY) * -2; // Scroll up = increase volume
        if (window.electronAPI && window.electronAPI.getVolume && window.electronAPI.setVolume) {
           window.electronAPI.getVolume().then(res => {
             let newVol = res.volume + delta;
             newVol = Math.max(0, Math.min(100, newVol));
             window.electronAPI.setVolume(newVol);
             this.showVolumeMini(newVol);
           });
        }
      });
    }

    // 1. Listen for real-time media updates from persistent background daemon
    if (window.electronAPI && window.electronAPI.onMediaUpdate) {
      window.electronAPI.onMediaUpdate((media) => {
        if (media && media.title && media.title.trim() !== '' && media.status !== 'Closed' && media.status !== '0') {
          const oldTitle = this.lastTitle;
          this.hasActiveMedia = true;
          
          const titleChanged = (!oldTitle || oldTitle !== media.title);

          // Cập nhật giao diện nhạc và tự động trượt đảo xuống khi mở bài hoặc đổi bài
          this.updateMediaUI(media, false);
          
          // Khi mở bài mới hoặc chuyển bài -> Hiển thị Capsule Alert sang trọng (Ảnh bìa + Tên bài + Sóng nhạc)
          if (titleChanged && (!this.isExpanded || (this.islandPill && this.islandPill.classList.contains('mode-media-alert')))) {
            this.showMediaAlert(media);
          }
        } else {
          this.hasActiveMedia = false;
          this.resetMediaUI();
        }
      });
    }

    // 2. Global Hotkey Alt+Space to toggle expand/collapse
    if (window.electronAPI && window.electronAPI.onToggleExpand) {
      window.electronAPI.onToggleExpand(() => {
        if (this.hasActiveMedia) {
          this.toggleExpand();
        }
      });
    }

    // Nhận cập nhật trạng thái tự động ẩn (Auto-Hide) từ Tray/Main
    if (window.electronAPI) {
      if (window.electronAPI.onAutoHideChanged) {
        window.electronAPI.onAutoHideChanged((autoHide) => {
          this.autoHide = autoHide;
          if (!this.autoHide) {
            if (this.islandPill) this.islandPill.classList.remove('island-hidden');
            if (this.islandWrapper) this.islandWrapper.classList.remove('island-hidden');
            if (this.hideTimeout) {
              clearTimeout(this.hideTimeout);
              this.hideTimeout = null;
            }
            this.showAlert('Đã ghim: Luôn hiển thị', '📌');
          } else {
            this.showAlert('Đã bật: Tự ẩn sau 8s', '⏱️');
            this.showIslandTemporarily(8000);
          }
        });
      }
      if (window.electronAPI.getAutoHideSetting) {
        window.electronAPI.getAutoHideSetting().then((autoHide) => {
          if (typeof autoHide === 'boolean') {
            this.autoHide = autoHide;
            if (!this.autoHide) {
              if (this.islandPill) this.islandPill.classList.remove('island-hidden');
              if (this.islandWrapper) this.islandWrapper.classList.remove('island-hidden');
              if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
              }
            } else {
              this.showIslandTemporarily(8000);
            }
          }
        });
      }
      if (window.electronAPI.onWakeIsland) {
        window.electronAPI.onWakeIsland(() => {
          if (this.islandPill && this.islandPill.classList.contains('island-hidden')) {
            this.showIslandTemporarily(8000);
            this.setMouseIgnored(false);
          }
        });
      }
      if (window.electronAPI.onSystemNotification) {
        window.electronAPI.onSystemNotification((data) => {
          if (data) this.showAlert(data.message || data.title, data.icon || '📌', data.title || 'Dynamic Island');
        });
      }
      if (window.electronAPI.onVolumeNotification) {
        window.electronAPI.onVolumeNotification((data) => {
          if (data && data.volume !== undefined) {
            this.currentVolume = data.volume;
            this.isMuted = data.volume === 0;
            if (this.volFill) this.volFill.style.width = `${data.volume}%`;
            if (this.volText) this.volText.textContent = `${data.volume}%`;
            this.showVolumeMini(data.volume);
          }
        });
      }
    }
  }

  updateMediaUI(media, skipAutoShow = false) {
    if (this.lastTitle !== media.title && !skipAutoShow) {
      this.showIslandTemporarily(this.autoHide ? 8000 : 0);
    }
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
      if (this.ambilightGlow) {
        this.ambilightGlow.src = media.thumbnail;
        this.ambilightGlow.style.display = 'block';
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
      if (this.mediaAlertThumb && this.islandPill && this.islandPill.classList.contains('mode-media-alert')) {
        this.mediaAlertThumb.src = media.thumbnail;
        this.mediaAlertThumb.style.display = 'block';
        if (this.mediaAlertThumbFallback) this.mediaAlertThumbFallback.style.display = 'none';
      }
    } else {
      if (this.albumCoverImg) {
        this.albumCoverImg.src = '';
        this.albumCoverImg.style.display = 'none';
      }
      if (this.ambilightGlow) {
        this.ambilightGlow.src = '';
        this.ambilightGlow.style.display = 'none';
      }
      if (this.vinylFallbackIcon) {
        this.vinylFallbackIcon.style.display = 'block';
      }
      if (this.notchDiscImg) {
        this.notchDiscImg.src = '';
        this.notchDiscImg.style.display = 'none';
      }
      if (this.notchDiscNote) {
        this.notchDiscNote.style.display = 'block';
      }
    }

    // 5. Playback State
    this.setPlayState(media.isPlaying);

    // 6. Timeline & Scrubber (Anti-snapback delay 1.8s khi người dùng vừa tua)
    const now = Date.now();
    if (!this.isScrubbing && (now - this.lastScrubTime > 1800)) {
      this.currentSec = Math.round(media.position || 0);
      this.totalSec = Math.round(media.endTime || 0);
      this.updateTimelineUI();
    }
  }

  resetMediaUI() {
    this.lastTitle = '';
    this.hasActiveMedia = false;
    this.setPlayState(false);

    // Tự động thu nhỏ Island nếu đang mở mà media bị tắt hoàn toàn
    if (this.isExpanded) {
      this.toggleExpand(false);
    }

    // Ẩn hoàn toàn phần Live Music trên Notch
    if (this.notchLiveMusic) {
      this.notchLiveMusic.classList.remove('visible');
    }
    if (this.notchMusicTitle) {
      this.notchMusicTitle.textContent = '';
    }

    // Ẩn nút đĩa than tròn trên Notch
    if (this.notchDisc) {
      this.notchDisc.style.display = 'none';
    }

    // Đổi pill về trạng thái idle
    if (this.islandPill) {
      this.islandPill.classList.add('no-media');
    }

    if (this.songTitleElem) this.songTitleElem.textContent = 'Chưa có bài hát nào';
    if (this.artistNameElem) this.artistNameElem.textContent = 'Hãy bật nhạc trên Spotify, YouTube hoặc Chrome';
    if (this.platformText) this.platformText.textContent = 'Chưa phát nhạc';
    if (this.platformDot) this.platformDot.className = 'platform-dot';

    if (this.albumCoverImg) {
      this.albumCoverImg.src = '';
      this.albumCoverImg.style.display = 'none';
    }
    if (this.ambilightGlow) {
      this.ambilightGlow.src = '';
      this.ambilightGlow.style.display = 'none';
    }
    if (this.vinylFallbackIcon) {
      this.vinylFallbackIcon.style.display = 'block';
    }
    if (this.notchDiscImg) {
      this.notchDiscImg.src = '';
      this.notchDiscImg.style.display = 'none';
    }
    if (this.notchDiscNote) {
      this.notchDiscNote.style.display = 'block';
    }

    this.currentSec = 0;
    this.totalSec = 0;
    this.updateTimelineUI();
  }

  detectPlatform(sourceApp, title) {
    const s = (sourceApp || '').toLowerCase();
    const t = (title || '').toLowerCase();

    if (s.includes('spotify')) return { name: 'Spotify', type: 'spotify' };
    if (s.includes('chrome') || t.includes('youtube') || s.includes('brave') || s.includes('edge') || s.includes('firefox')) {
      if (t.includes('youtube') || s.includes('chrome') || s.includes('edge')) {
        return { name: 'YouTube / Browser', type: 'youtube' };
      }
      return { name: 'Web Browser', type: 'browser' };
    }
    if (s.includes('apple') || s.includes('itunes')) return { name: 'Apple Music', type: 'applemusic' };
    if (s.includes('vlc') || s.includes('wmplayer') || s.includes('foobar')) return { name: 'Windows Media', type: 'local' };

    return { name: sourceApp || 'Windows Media', type: 'default' };
  }

  // Scrubber Seeking
  handleScrub(e) {
    if (!this.scrubberTrack || this.totalSec <= 0) return;
    const rect = this.scrubberTrack.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    this.currentSec = Math.round(ratio * this.totalSec);

    const pct = ratio * 100;
    if (this.scrubberFill) this.scrubberFill.style.width = `${pct}%`;
    if (this.scrubberThumb) this.scrubberThumb.style.left = `${pct}%`;
    if (this.scrubberCur) this.scrubberCur.textContent = this.formatTime(this.currentSec);
  }

  finishScrub(e) {
    if (!this.isScrubbing) return;
    this.isScrubbing = false;
    if (this.scrubberTrack) this.scrubberTrack.classList.remove('scrubbing');
    this.handleScrub(e);
    this.lastScrubTime = Date.now();

    if (window.electronAPI && window.electronAPI.seekMedia) {
      window.electronAPI.seekMedia(this.currentSec);
    }
  }

  seekRelative(delta) {
    if (!this.hasActiveMedia) return;
    let target = Math.max(0, this.currentSec + delta);
    if (this.totalSec > 0) {
      target = Math.min(this.totalSec, target);
    }
    this.currentSec = target;
    this.lastScrubTime = Date.now();
    this.updateTimelineUI();

    if (window.electronAPI && window.electronAPI.seekMedia) {
      window.electronAPI.seekMedia(this.currentSec);
    }
  }

  // Volume Controls (Native C#)
  async initVolume() {
    if (window.electronAPI && window.electronAPI.getVolume) {
      try {
        const info = await window.electronAPI.getVolume();
        if (info) {
          this.updateVolumeUI(info.volume, info.isMuted);
        }
      } catch (e) {}
    }
  }

  handleVolumeDrag(e) {
    if (!this.volTrack) return;
    const rect = this.volTrack.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = clickX / rect.width;
    const newVol = Math.round(ratio * 100);
    this.updateVolumeUI(newVol, false);

    if (window.electronAPI && window.electronAPI.setVolume) {
      window.electronAPI.setVolume(newVol);
    }
  }

  finishVolumeDrag(e) {
    if (!this.isDraggingVolume) return;
    this.isDraggingVolume = false;
    if (this.volTrack) this.volTrack.classList.remove('dragging');
    this.handleVolumeDrag(e);
  }

  adjustVolumeBy(delta) {
    let newVol = Math.max(0, Math.min(100, this.currentVolume + delta));
    this.updateVolumeUI(newVol, false);
    if (window.electronAPI && window.electronAPI.setVolume) {
      window.electronAPI.setVolume(newVol);
    }
  }

  async toggleMute() {
    this.isMuted = !this.isMuted;
    this.updateVolumeUI(this.currentVolume, this.isMuted);
    if (window.electronAPI && window.electronAPI.toggleMute) {
      await window.electronAPI.toggleMute();
    }
  }

  updateVolumeUI(vol, isMuted) {
    this.currentVolume = vol;
    this.isMuted = !!isMuted;
    const displayPct = this.isMuted ? 0 : this.currentVolume;
    if (this.volFill) {
      this.volFill.style.width = `${displayPct}%`;
    }
    if (this.volThumb) {
      this.volThumb.style.left = `${displayPct}%`;
    }
    if (this.volText) {
      this.volText.textContent = this.isMuted ? 'MUTE' : `${this.currentVolume}%`;
    }
    if (this.volIconSpeaker && this.volIconMuted) {
      this.volIconSpeaker.style.display = this.isMuted ? 'none' : 'block';
      this.volIconMuted.style.display = this.isMuted ? 'block' : 'none';
    }
  }

  startLocalTimer() {
    setInterval(() => {
      if (this.isPlaying && this.hasActiveMedia && !this.isScrubbing) {
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
      if (this.scrubberThumb) {
        this.scrubberThumb.style.left = `${pct}%`;
      }
    }
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  showIslandTemporarily(durationMs = 8000) {
    if (this.islandPill) {
      this.islandPill.classList.remove('island-hidden');
      if (this.islandWrapper) this.islandWrapper.classList.remove('island-hidden');
    }
    
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Nếu chế độ tự ẩn (autoHide) đang TẮT và đảo không ở trạng thái mở rộng Dashboard:
    // Tuyệt đối không hẹn giờ ẩn, giữ đảo luôn luôn hiển thị cố định trên màn hình!
    if (!this.autoHide && !this.isExpanded) {
      return;
    }

    if (durationMs > 0) {
      this.hideTimeout = setTimeout(() => {
        if (this.isExpanded) {
          // Tự động thu gọn nếu đang mở rộng UI sau 8s không làm gì
          this.toggleExpand(false);
          if (this.autoHide) {
            this.showIslandTemporarily(8000);
          }
        } else if (this.islandPill && this.autoHide) {
          // Chỉ trượt lên ẩn đi nếu chế độ tự ẩn (autoHide) đang được BẬT
          this.islandPill.classList.add('island-hidden');
          if (this.islandWrapper) this.islandWrapper.classList.add('island-hidden');
          this.setMouseIgnored(true);
        }
      }, durationMs);
    }
  }
}

window.SystemMediaSync = SystemMediaSync;
