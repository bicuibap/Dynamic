class BotService {
  constructor() {
    this.initElements();
    this.bindEvents();
    this.isTyping = false;

    // Mẫu câu trả lời giả lập (Sẽ thay bằng API thật sau này)
    this.responses = [
      "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?",
      "Dynamic Island của bạn trông thật tuyệt vời!",
      "Tôi là trợ lý ảo AI. Bạn cần tra cứu thông tin gì không?",
      "Thời tiết hôm nay rất đẹp để đi dạo đấy.",
      "Bạn có muốn nghe một bản nhạc thư giãn không?",
      "Hệ thống đang hoạt động ổn định. CPU đang ở mức bình thường."
    ];
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
  }

  async handleQuery(query) {
    if (this.isTyping) return;
    
    // 1. Trạng thái Đang suy nghĩ (Thinking)
    this.botInput.value = '';
    this.botInput.disabled = true;
    
    // CHỈ HIỂN THỊ ĐANG SUY NGHĨ VỚI CHỮ TO CĂN GIỮA
    this.botText.innerHTML = `<div style="text-align: center; font-size: 20px; font-weight: 600; font-style: italic; opacity: 0.8; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">Đang suy nghĩ...</div>`;
    
    if (this.botOrb) {
      this.botOrb.classList.add('thinking');
    }

    let botReply = '';
    try {
      // Gọi API lên backend (Google Gemini)
      if (window.electronAPI && window.electronAPI.askGemini) {
        botReply = await window.electronAPI.askGemini(query);
      } else {
        botReply = "Lỗi: Không tìm thấy electronAPI. Bạn đang chạy trên trình duyệt web thay vì Electron?";
      }
    } catch (err) {
      botReply = "Lỗi hệ thống: Cầu nối IPC bị đứt hoặc backend không phản hồi.";
      console.error(err);
    }

    if (this.botOrb) {
      this.botOrb.classList.remove('thinking');
    }
    
    this.typeWriterEffect(botReply);
  }

  typeWriterEffect(text) {
    this.isTyping = true;
    let i = 0;
    this.botText.textContent = '';
    const responseArea = document.querySelector('.bot-response-area');
    
    const interval = setInterval(() => {
      if (i < text.length) {
        this.botText.textContent += text.charAt(i);
        i++;
        if (responseArea) responseArea.scrollTop = responseArea.scrollHeight;
      } else {
        clearInterval(interval);
        this.isTyping = false;
        this.botInput.disabled = false;
        this.botInput.focus();
      }
    }, 30); // Tốc độ gõ 30ms/ký tự (khá nhanh)
  }
}

// Khởi tạo
document.addEventListener('DOMContentLoaded', () => {
  window.botService = new BotService();
});
