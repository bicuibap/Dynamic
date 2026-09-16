// Full Interactive Music Player Engine
class MusicPlayer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.visualizer = null;
    this.audioElement = new Audio();

    this.isPlaying = false;
    this.currentTrackIndex = 0;

    this.tracks = [
      {
        title: "Midnight City Lights",
        artist: "Chillhop Lo-Fi",
        duration: "03:24",
        source: "Built-in Radio",
        isSynth: true
      },
      {
        title: "Neon Dreams & Rain",
        artist: "Synthwave Vibes",
        duration: "02:45",
        source: "Built-in Radio",
        isSynth: true
      },
      {
        title: "Coffee & Study Beats",
        artist: "Acoustic Piano Lofi",
        duration: "04:10",
        source: "Built-in Radio",
        isSynth: true
      }
    ];

    this.synthInterval = null;
    this.initAudioContext();
    this.initUI();
  }

  initAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;

      this.visualizer = new window.AudioVisualizer(this.analyser);
      this.visualizer.drawIdle();
    } catch (e) {
      console.warn("AudioContext init error:", e);
      this.visualizer = new window.AudioVisualizer(null);
    }
  }

  initUI() {
    this.playBtn = document.getElementById('play-btn');
    this.prevBtn = document.getElementById('prev-btn');
    this.nextBtn = document.getElementById('next-btn');
    this.seekBar = document.getElementById('seek-bar');
    this.topBarTitle = document.getElementById('mini-music-title');
    this.expandedTitle = document.getElementById('track-title-text');
    this.expandedArtist = document.getElementById('track-artist-text');
    this.sourceTag = document.getElementById('media-source-tag');
    this.vinylDisc = document.getElementById('vinyl-disc');
    this.miniDisc = document.getElementById('mini-disc-icon');

    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.prevTrack());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.nextTrack());
    }

    // Local file picker
    const fileInput = document.getElementById('music-file-input');
    const importBtn = document.getElementById('btn-import-music');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.loadLocalAudioFile(e.target.files[0]);
        }
      });
    }

    this.updateTrackInfo();
  }

  loadLocalAudioFile(file) {
    const objectUrl = URL.createObjectURL(file);
    const track = {
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Local Audio File",
      duration: "03:30",
      source: "Local Disk",
      isSynth: false,
      url: objectUrl
    };

    this.tracks.unshift(track);
    this.currentTrackIndex = 0;
    this.playTrack(0);
  }

  updateTrackInfo() {
    const track = this.tracks[this.currentTrackIndex];
    if (!track) return;

    if (this.topBarTitle) this.topBarTitle.textContent = `${track.title} - ${track.artist}`;
    if (this.expandedTitle) this.expandedTitle.textContent = track.title;
    if (this.expandedArtist) this.expandedArtist.textContent = track.artist;
    if (this.sourceTag) this.sourceTag.textContent = track.source;
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isPlaying = true;
    if (this.playBtn) this.playBtn.innerHTML = '⏸';
    if (this.vinylDisc) this.vinylDisc.classList.add('playing');
    if (this.miniDisc) this.miniDisc.classList.add('playing');

    const track = this.tracks[this.currentTrackIndex];
    if (track && track.isSynth) {
      this.startSynthLofi();
    } else if (track && track.url) {
      this.audioElement.src = track.url;
      this.audioElement.play();
    }

    if (this.visualizer) {
      this.visualizer.start();
    }
  }

  pause() {
    this.isPlaying = false;
    if (this.playBtn) this.playBtn.innerHTML = '▶';
    if (this.vinylDisc) this.vinylDisc.classList.remove('playing');
    if (this.miniDisc) this.miniDisc.classList.remove('playing');

    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.audioElement.pause();

    if (this.visualizer) {
      this.visualizer.stop();
    }
  }

  nextTrack() {
    this.pause();
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.updateTrackInfo();
    this.play();
  }

  prevTrack() {
    this.pause();
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.updateTrackInfo();
    this.play();
  }

  playTrack(index) {
    this.pause();
    this.currentTrackIndex = index;
    this.updateTrackInfo();
    this.play();
  }

  // Beautiful Ambient Synthesizer for out-of-the-box chill music
  startSynthLofi() {
    if (!this.audioContext) return;
    if (this.synthInterval) clearInterval(this.synthInterval);

    // Warm Lofi Chord Frequencies (Fmaj7, Em7, Dm7, Cmaj7)
    const chordSets = [
      [349.23, 440.0, 523.25, 659.25], // Fmaj7
      [329.63, 392.0, 493.88, 587.33], // Em7
      [293.66, 349.23, 440.0, 523.25], // Dm7
      [261.63, 329.63, 392.0, 493.88]  // Cmaj7
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!this.isPlaying) return;
      const notes = chordSets[chordIdx % chordSets.length];
      chordIdx++;

      notes.forEach((freq, idx) => {
        try {
          const osc = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();
          const filter = this.audioContext.createBiquadFilter();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, this.audioContext.currentTime);

          gain.gain.setValueAtTime(0.001, this.audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.04, this.audioContext.currentTime + 0.3 + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 2.8);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.analyser);
          this.analyser.connect(this.audioContext.destination);

          osc.start();
          osc.stop(this.audioContext.currentTime + 3.0);
        } catch (e) {}
      });
    };

    playChord();
    this.synthInterval = setInterval(playChord, 2600);
  }
}

window.MusicPlayer = MusicPlayer;
