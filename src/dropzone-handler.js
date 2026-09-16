// Dropzone & Smart File Card Handler
class DropzoneHandler {
  constructor() {
    this.dropBox = document.getElementById('drop-area-box');
    this.previewContainer = document.getElementById('file-preview-card-container');
    this.currentFile = null;

    this.init();
  }

  init() {
    // Prevent default drag behaviors for entire window
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.body.addEventListener(eventName, (e) => e.preventDefault());
      document.body.addEventListener(eventName, (e) => e.stopPropagation());
    });

    // Handle drag over styling
    ['dragenter', 'dragover'].forEach(eventName => {
      document.body.addEventListener(eventName, () => {
        this.dropBox.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      document.body.addEventListener(eventName, () => {
        this.dropBox.classList.remove('drag-over');
      });
    });

    // Handle dropped files
    document.body.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFile(files[0]);
      }
    });

    // Handle click to browse files
    const fileInput = document.getElementById('dropzone-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFile(e.target.files[0]);
        }
      });
    }

    if (this.dropBox) {
      this.dropBox.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    // Set initial sample file matching user's photo
    this.setSampleFile();
  }

  formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  getFileIcon(ext) {
    switch (ext.toLowerCase()) {
      case 'zip':
      case 'rar':
      case '7z':
        return '📦';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
        return '🖼️';
      case 'mp3':
      case 'wav':
      case 'flac':
        return '🎵';
      case 'mp4':
      case 'mkv':
        return '🎬';
      case 'pdf':
        return '📄';
      case 'js':
      case 'ts':
      case 'json':
      case 'html':
      case 'css':
        return '💻';
      default:
        return '📁';
    }
  }

  handleFile(file) {
    const ext = file.name.split('.').pop() || 'file';
    this.currentFile = {
      name: file.name,
      path: file.path || `C:/Users/Bi/Downloads/${file.name}`,
      size: this.formatBytes(file.size || 3800000),
      created: 'Just now',
      ext: ext.toUpperCase(),
      icon: this.getFileIcon(ext)
    };

    this.renderPreview();
  }

  setSampleFile() {
    this.currentFile = {
      name: 'project-spec.zip',
      path: 'd:/Dynamic/project-spec.zip',
      size: '3.8 MB',
      created: 'in ~/Downloads',
      ext: 'ZIP',
      icon: '📦'
    };
    this.renderPreview();
  }

  renderPreview() {
    if (!this.previewContainer || !this.currentFile) return;

    this.previewContainer.innerHTML = `
      <div class="file-preview-card stagger-item">
        <div class="file-header-row">
          <div class="file-format-icon">
            <span>${this.currentFile.icon}</span>
          </div>
          <div class="file-details-col">
            <span class="file-name-lbl" title="${this.currentFile.name}">${this.currentFile.name}</span>
            <span class="file-meta-lbl">${this.currentFile.size} • Created ${this.currentFile.created}</span>
          </div>
        </div>

        <div class="file-actions-row">
          <button class="action-chip" id="chip-open-folder">
            <span>📁</span> Open Folder
          </button>
          <button class="action-chip" id="chip-copy-path">
            <span>📋</span> Copy Path
          </button>
          <button class="action-chip ai-chip" id="chip-ask-ai">
            <span>✨</span> Ask AI
          </button>
        </div>
      </div>
    `;

    // Attach Action Chip Events
    document.getElementById('chip-open-folder').addEventListener('click', () => {
      if (window.electronAPI && this.currentFile.path) {
        window.electronAPI.openFileLocation(this.currentFile.path);
      }
    });

    document.getElementById('chip-copy-path').addEventListener('click', async () => {
      if (window.electronAPI && this.currentFile.path) {
        await window.electronAPI.copyToClipboard(this.currentFile.path);
        const btn = document.getElementById('chip-copy-path');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> Copied!';
        setTimeout(() => { btn.innerHTML = oldText; }, 1800);
      }
    });

    document.getElementById('chip-ask-ai').addEventListener('click', () => {
      if (window.electronAPI) {
        const query = encodeURIComponent(`Summarize and explain the file: ${this.currentFile.name}`);
        window.electronAPI.openExternalUrl(`https://www.google.com/search?q=${query}`);
      }
    });
  }
}

window.DropzoneHandler = DropzoneHandler;
