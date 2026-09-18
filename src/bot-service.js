class BotService {
  constructor() {
    this.initElements();
    this.bindEvents();
    this.isTyping = false;
  }

  initElements() {
    this.botInput = document.getElementById('bot-input');
    this.botText = document.getElementById('bot-text');
    this.botOrb = document.getElementById('bot-orb');
    this.botSendBtn = document.getElementById('bot-send-btn');
  }

  bindEvents() {
    if (this.botInput) {
      this.botInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.botInput.value.trim() !== '') {
          e.preventDefault();
          this.handleQuery(this.botInput.value.trim());
        }
      });
    }

    if (this.botSendBtn) {
      this.botSendBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.botInput && this.botInput.value.trim() !== '') {
          this.handleQuery(this.botInput.value.trim());
        }
      });
    }

    // Quick Action Chips
    const chips = document.querySelectorAll('.bot-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const cmd = chip.getAttribute('data-cmd');
        if (cmd) {
          this.handleQuery(cmd);
        }
      });
    });
  }

  async handleQuery(query) {
    if (this.isTyping) return;
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return;
    
    // 1. Trạng thái Đang suy nghĩ (Thinking)
    this.isTyping = true;
    this.botInput.value = '';
    this.botInput.disabled = true;
    
    // Hiển thị trạng thái đang suy nghĩ
    if (this.botText) {
      this.botText.innerHTML = `<div style="text-align: center; font-size: 18px; font-weight: 600; font-style: italic; opacity: 0.8; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">Đang suy nghĩ...</div>`;
    }
    
    if (this.botOrb) {
      this.botOrb.classList.add('thinking');
    }

    let botReply = '';
    try {
      if (window.electronAPI && window.electronAPI.askGemini) {
        botReply = await window.electronAPI.askGemini(cleanQuery);
      } else {
        botReply = "Lỗi: Không tìm thấy electronAPI trên ứng dụng.";
      }
    } catch (err) {
      console.error('Ask Bot Error:', err);
      botReply = "Đã có lỗi xảy ra khi kết nối tới trợ lý ảo. Vui lòng thử lại.";
    } finally {
      if (this.botOrb) {
        this.botOrb.classList.remove('thinking');
      }
    }

    this.typeWriterEffect(botReply || "Tôi chưa có câu trả lời cho câu hỏi này.");
  }

  typeWriterEffect(text) {
    this.isTyping = true;
    const str = typeof text === 'string' ? text : String(text || '');
    let i = 0;
    if (this.botText) this.botText.textContent = '';
    const responseArea = document.querySelector('.bot-response-area');
    
    if (!str.length) {
      this.isTyping = false;
      if (this.botInput) {
        this.botInput.disabled = false;
        this.botInput.focus();
      }
      return;
    }

    const interval = setInterval(() => {
      if (i < str.length) {
        if (this.botText) this.botText.textContent += str.charAt(i);
        i++;
        if (responseArea) responseArea.scrollTop = responseArea.scrollHeight;
      } else {
        clearInterval(interval);
        this.isTyping = false;
        if (this.botInput) {
          this.botInput.disabled = false;
          this.botInput.focus();
        }
      }
    }, 22);
  }
}

// Khởi tạo an toàn (xử lý cả khi DOMContentLoaded đã chạy hoặc chưa)
function initBotService() {
  if (!window.botService) {
    window.botService = new BotService();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBotService);
} else {
  initBotService();
}
