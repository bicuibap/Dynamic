class CalendarService {
  constructor() {
    this.initElements();
    this.render();
    
    // Tự động cập nhật qua ngày mới (lúc nửa đêm)
    this.scheduleMidnightUpdate();
  }

  initElements() {
    this.calDayName = document.getElementById('cal-day-name');
    this.calBigDate = document.getElementById('cal-big-date');
    this.calMonthYear = document.getElementById('cal-month-year');
    this.calDaysGrid = document.getElementById('cal-days-grid');
  }

  render() {
    const today = new Date();
    const currentDayName = this.getDayName(today.getDay());
    const currentDate = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Cập nhật thẻ bên trái
    if (this.calDayName) this.calDayName.textContent = currentDayName;
    if (this.calBigDate) this.calBigDate.textContent = currentDate;
    if (this.calMonthYear) this.calMonthYear.textContent = `Tháng ${currentMonth + 1}, ${currentYear}`;

    // Cập nhật lưới lịch bên phải
    if (!this.calDaysGrid) return;
    this.calDaysGrid.innerHTML = '';

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Js: 0 = CN, 1 = T2... Nhưng lịch mình: T2 = cột 0, CN = cột 6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    // Cột trống cho những ngày tháng trước
    for (let i = 0; i < startDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell empty';
      this.calDaysGrid.appendChild(emptyCell);
    }

    // Các ngày trong tháng này
    for (let i = 1; i <= daysInMonth; i++) {
      const dayCell = document.createElement('div');
      dayCell.className = 'cal-day-cell';
      if (i === currentDate) {
        dayCell.classList.add('today');
      }
      dayCell.textContent = i;
      this.calDaysGrid.appendChild(dayCell);
    }
  }

  getDayName(dayIndex) {
    const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return names[dayIndex];
  }

  scheduleMidnightUpdate() {
    const now = new Date();
    // Tính mili giây đến 00:00:01 sáng hôm sau
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const msUntilMidnight = nextMidnight - now;

    setTimeout(() => {
      this.render();
      setInterval(() => this.render(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.calendarService = new CalendarService();
});
