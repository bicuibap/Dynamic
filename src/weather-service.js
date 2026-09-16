// Real-time Geolocation and Weather Service (True Machine Location)
class WeatherService {
  constructor() {
    this.city = 'TP. Hồ Chí Minh';
    this.cityShort = 'TP.HCM';
    this.temp = '--°C';
    this.weatherCode = 1;
    this.weatherDesc = 'Đang tải...';
    this.lat = 10.822;
    this.lon = 106.6257;

    this.init();
  }

  async init() {
    await this.detectLocation();
    await this.fetchWeather();
    this.updateUI();

    // Refresh weather every 10 minutes
    setInterval(() => {
      this.fetchWeather().then(() => this.updateUI());
    }, 10 * 60 * 1000);
  }

  async detectLocation() {
    // 1. Try ip-api.com
    try {
      const res = await fetch('http://ip-api.com/json', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'success') {
          this.lat = data.lat;
          this.lon = data.lon;
          this.formatCityName(data.city, data.regionName);
          return;
        }
      }
    } catch (e) {}

    // 2. Fallback to ipwho.is
    try {
      const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          this.lat = data.latitude;
          this.lon = data.longitude;
          this.formatCityName(data.city, data.region);
          return;
        }
      }
    } catch (e) {}

    // 3. Fallback to ipapi.co
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.city) {
          this.lat = data.latitude;
          this.lon = data.longitude;
          this.formatCityName(data.city, data.region);
          return;
        }
      }
    } catch (e) {}
  }

  formatCityName(rawCity, rawRegion) {
    const raw = ((rawCity || '') + ' ' + (rawRegion || '')).toLowerCase();
    if (raw.includes('ho chi minh') || raw.includes('hcm') || raw.includes('saigon')) {
      this.city = 'TP. Hồ Chí Minh';
      this.cityShort = 'TP.HCM';
    } else if (raw.includes('ha noi') || raw.includes('hanoi')) {
      this.city = 'Hà Nội';
      this.cityShort = 'Hà Nội';
    } else if (raw.includes('da nang')) {
      this.city = 'Đà Nẵng';
      this.cityShort = 'Đà Nẵng';
    } else if (raw.includes('hai phong')) {
      this.city = 'Hải Phòng';
      this.cityShort = 'Hải Phòng';
    } else if (raw.includes('can tho')) {
      this.city = 'Cần Thơ';
      this.cityShort = 'Cần Thơ';
    } else if (raw.includes('bien hoa') || raw.includes('dong nai')) {
      this.city = 'Biên Hòa';
      this.cityShort = 'Biên Hòa';
    } else if (raw.includes('nha trang') || raw.includes('khanh hoa')) {
      this.city = 'Nha Trang';
      this.cityShort = 'Nha Trang';
    } else if (raw.includes('vung tau')) {
      this.city = 'Vũng Tàu';
      this.cityShort = 'Vũng Tàu';
    } else if (raw.includes('hue') || raw.includes('thua thien')) {
      this.city = 'Huế';
      this.cityShort = 'Huế';
    } else if (rawCity) {
      this.city = rawCity;
      this.cityShort = rawCity.length > 8 ? rawCity.substring(0, 8) + '..' : rawCity;
    }
  }

  async fetchWeather() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.lat}&longitude=${this.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.current) {
          const tempVal = Math.round(data.current.temperature_2m);
          this.temp = `${tempVal}°C`;
          this.weatherCode = data.current.weather_code;
          this.weatherDesc = this.getWeatherDescription(this.weatherCode);
          return;
        }
      }
    } catch (e) {}

    // Fallback: wttr.in
    try {
      const res = await fetch(`https://wttr.in/${this.lat},${this.lon}?format=j1`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.current_condition && data.current_condition[0]) {
          this.temp = `${data.current_condition[0].temp_C}°C`;
          this.weatherDesc = data.current_condition[0].weatherDesc[0]?.value || 'Trời có mây';
        }
      }
    } catch (e) {}
  }

  getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code === 1 || code === 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '🌤️';
  }

  getWeatherDescription(code) {
    if (code === 0) return 'Trời quang đãng';
    if (code === 1 || code === 2) return 'Có mây ít';
    if (code === 3) return 'Nhiều mây';
    if (code >= 45 && code <= 48) return 'Sương mù';
    if (code >= 51 && code <= 55) return 'Mưa phùn nhẹ';
    if (code >= 61 && code <= 65) return 'Mưa rào';
    if (code >= 71 && code <= 77) return 'Có tuyết rơi';
    if (code >= 80 && code <= 82) return 'Mưa dông thoáng qua';
    if (code >= 95) return 'Dông bão sét';
    return 'Thời tiết ôn hòa';
  }

  updateUI() {
    // Compact Notch Elements
    const notchVal = document.getElementById('notch-weather-val');
    const notchIcon = document.getElementById('notch-weather-icon');
    const notchCity = document.getElementById('notch-weather-city');
    const notchItem = document.getElementById('notch-weather-item');

    if (notchVal) notchVal.textContent = this.temp;
    if (notchIcon) notchIcon.textContent = this.getWeatherIcon(this.weatherCode);
    if (notchCity) notchCity.textContent = this.cityShort;
    if (notchItem) {
      notchItem.title = `Thời tiết ${this.city}: ${this.temp} - ${this.weatherDesc}`;
    }

    // Expanded Elements
    const expVal = document.getElementById('expanded-weather-temp');
    const expIcon = document.getElementById('expanded-weather-icon');
    const expCity = document.getElementById('expanded-weather-city');
    const expBadge = document.getElementById('expanded-weather-badge');

    if (expVal) expVal.textContent = this.temp;
    if (expIcon) expIcon.textContent = this.getWeatherIcon(this.weatherCode);
    if (expCity) expCity.textContent = this.city;
    if (expBadge) {
      expBadge.title = `Thời tiết ${this.city}: ${this.temp} - ${this.weatherDesc}`;
    }
  }
}

window.WeatherService = WeatherService;
