import express, { Request, Response, Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Normalize Armenian text: convert "և" to "եւ"
function normalizeArmenianText(text: string): string {
  if (!text) return text;
  return text.replace(/և/g, 'եւ');
}

// Types
interface SearchParams {
  first_name: string;
  last_name: string;
  middle_name?: string;
  birth_date?: string;
  street?: string;
  building?: string;
  apartment?: string;
  district?: string;
  region?: string;
  community?: string;
}

interface SearchResult {
  name: string;
  birth_date: string;
  region_community: string;
  address: string;
  district: string;
}

interface CombinedResponse {
  success: boolean;
  count?: number;
  results?: SearchResult[];
  error?: string;
}

// Constants
const BASE_URL = 'https://prelive.elections.am/Register';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // Cache token for 5 minutes

// Token cache
let cachedToken: { token: string; cookies: string; timestamp: number } | null = null;
let tokenFetchInProgress = false;
let tokenFetchWaiters: Array<(result: { token: string | null; cookies: string | null }) => void> = [];

// Convert date format
function convertDateFormat(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return '';

  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (dayNum >= 1 && dayNum <= 31 &&
          monthNum >= 1 && monthNum <= 12 &&
          yearNum >= 1900 && yearNum <= 2100) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка преобразования даты:', dateStr);
  }

  return '';
}

// Clean text
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// Fetch CSRF token with got-scraping (with caching)
async function fetchCsrfToken(retries = MAX_RETRIES): Promise<{ token: string | null; cookies: string | null }> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() - cachedToken.timestamp < TOKEN_CACHE_DURATION) {
    console.log('✓ Использование кэшированного CSRF токена');
    return { token: cachedToken.token, cookies: cachedToken.cookies };
  }

  // If token fetch is already in progress, wait for it
  if (tokenFetchInProgress) {
    console.log('⏳ Ожидание текущей загрузки токена...');
    return new Promise((resolve) => {
      tokenFetchWaiters.push(resolve);
    });
  }

  tokenFetchInProgress = true;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 Попытка получения CSRF токена #${attempt}...`);

      const response = await gotScraping({
        url: BASE_URL,
        method: 'GET',
        timeout: 15000,
        headerGeneratorOptions: {
          browsers: [
            {
              name: 'firefox',
              minVersion: 145,
              maxVersion: 150
            }
          ],
          devices: ['desktop'],
          locales: ['ru-RU', 'en-US'],
          operatingSystems: ['windows']
        },
        proxyUrl: process.env.PROXY_URL,
        retry: {
          limit: 1
        }
      });

      console.log(`📡 CSRF Token fetch - Статус: ${response.statusCode}`);
      console.log(`📡 Response size: ${response.body.length} bytes`);
      console.log(`📡 Content-Type: ${response.headers['content-type']}`);

      if (response.statusCode === 200) {
        const $ = cheerio.load(response.body);
        const token = $('input[name="__RequestVerificationToken"]').val() as string;

        if (token && token.length > 0) {
          console.log('✓ Свежий токен получен успешно');
          console.log(`✓ Токен длина: ${token.length}`);

          // Получаем cookies из ответа
          const cookies = response.headers['set-cookie'];
          const cookieString = cookies ? cookies.join('; ') : '';

          // Cache the token
          cachedToken = {
            token,
            cookies: cookieString,
            timestamp: Date.now()
          };

          // Notify all waiters
          const result = { token, cookies: cookieString };
          tokenFetchInProgress = false;
          tokenFetchWaiters.forEach(waiter => waiter(result));
          tokenFetchWaiters = [];

          return result;
        } else {
          console.warn('⚠️ Токен не найден на странице');
          console.warn(`📋 HTML preview: ${response.body.substring(0, 500)}`);
        }
      } else {
        console.warn(`⚠️ Неожиданный статус: ${response.statusCode}`);
        console.warn(`📋 Response: ${response.body.substring(0, 200)}`);
      }
    } catch (error: any) {
      console.error(`⚠️ Ошибка при получении токена (попытка ${attempt}/${retries}):`, error.message);
      console.error(`   Code: ${error.code}`);

      if (attempt < retries) {
        // Exponential backoff
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`⏳ Ожидание ${delay}ms перед повторной попыткой...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('❌ Не удалось получить CSRF токен после всех попыток');
  
  // Notify all waiters with failure
  tokenFetchInProgress = false;
  const result = { token: null, cookies: null };
  tokenFetchWaiters.forEach(waiter => waiter(result));
  tokenFetchWaiters = [];

  // If we have a stale cached token, use it as fallback
  if (cachedToken) {
    console.log('⚠️ Используется устаревший кэшированный токен в качестве fallback');
    return { token: cachedToken.token, cookies: cachedToken.cookies };
  }

  throw new Error('CSRF token fetch failed: Remote service unavailable or blocked');
}

// Get search results
async function getSearchResults(params: {
  firstName: string;
  lastName: string;
  region?: string;
  community?: string;
  middleName?: string;
  birthDate?: string;
  street?: string;
  building?: string;
  apartment?: string;
  district?: string;
}): Promise<SearchResult[]> {
  const {
    firstName,
    lastName,
    region = 'ԵՐԵՎԱՆ',
    community = '',
    middleName = '',
    birthDate = '',
    street = '',
    building = '',
    apartment = '',
    district = ''
  } = params;

  console.log('\n' + '='.repeat(80));
  console.log(`🔍 НОВЫЙ ПОИСК`);
  console.log('='.repeat(80));
  console.log(`👤 Имя: ${firstName} ${lastName}`);
  console.log(`📍 Регион: ${region}`);
  if (community) console.log(`🏘 Община: ${community}`);
  if (middleName) console.log(`👨‍👦 Отчество: ${middleName}`);
  if (birthDate) console.log(`📅 Дата рождения: ${birthDate}`);
  if (street) console.log(`🛣 Улица: ${street}`);
  if (building) console.log(`🏠 Дом: ${building}`);
  if (apartment) console.log(`🚪 Квартира: ${apartment}`);
  if (district) console.log(`📌 Район: ${district}`);
  console.log('='.repeat(80));

  // Get CSRF token
  const { token: csrfToken, cookies: cookieString } = await fetchCsrfToken();

  // csrfToken is guaranteed to be non-null here since fetchCsrfToken throws on failure
  if (!csrfToken) {
    throw new Error('CSRF token is unexpectedly null');
  }

  // Prepare form data
  const convertedBirthDate = convertDateFormat(birthDate);

  const formData: Record<string, string> = {
    'ShowCaptcha': 'False',
    'Input.Region': region || 'ԵՐԵՎԱՆ',
    'Current.Region': region || 'ԵՐԵՎԱՆ',
    'RegisterPaging.PageSize': '100',
    '__RequestVerificationToken': csrfToken!
  };

  // Add fields conditionally
  if (firstName) {
    formData['Current.FirstName'] = firstName;
    formData['Input.FirstName'] = firstName;
  }

  if (lastName) {
    formData['Current.LastName'] = lastName;
    formData['Input.LastName'] = lastName;
  }

  if (middleName) {
    formData['Current.MiddleName'] = middleName;
    formData['Input.MiddleName'] = middleName;
  }

  if (convertedBirthDate) {
    formData['Current.BirthDate'] = convertedBirthDate;
    formData['Input.BirthDateUI'] = convertedBirthDate;
  }

  if (community) {
    formData['Input.Community'] = community;
    formData['Current.Community'] = community;
  }

  if (street) {
    formData['Current.Street'] = street;
    formData['Input.Street'] = street;
  }

  if (building) {
    formData['Current.Building'] = building;
    formData['Input.Building'] = building;
  }

  if (apartment) {
    formData['Current.Apartment'] = apartment;
    formData['Input.Apartment'] = apartment;
  }

  if (district) {
    formData['Current.District'] = district;
    formData['Input.District'] = district;
  }

  const allResults: SearchResult[] = [];
  let page = 1;
  const maxPages = (street || building || apartment) ? 1 : 3;

  console.log('─'.repeat(80));

  while (page <= maxPages) {
    formData['RegisterPaging.PageIndex'] = String(page);

    // Convert to URL-encoded format
    const formBody = Object.keys(formData)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(formData[key]))
      .join('&');

    try {
      console.log(`📡 Запрос страницы ${page}...`);

      const response = await gotScraping({
        url: BASE_URL,
        method: 'POST',
        body: formBody,
        timeout: 20000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString || '',
          'Referer': BASE_URL,
          'Origin': 'https://prelive.elections.am',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        headerGeneratorOptions: {
          browsers: [
            {
              name: 'firefox',
              minVersion: 145,
              maxVersion: 150
            }
          ],
          devices: ['desktop'],
          locales: ['ru-RU', 'en-US'],
          operatingSystems: ['windows']
        },
        proxyUrl: process.env.PROXY_URL,
        retry: {
          limit: 1
        }
      });

      console.log(`📡 Страница ${page} - Статус: ${response.statusCode}`);

      if (response.statusCode !== 200) {
        console.log(`❌ Ошибка: Status Code ${response.statusCode}`);
        break;
      }

      const $ = cheerio.load(response.body);
      const tableBody = $('tbody');

      if (tableBody.length === 0) {
        console.log(`✓ Страница ${page}: Нет таблицы результатов`);
        break;
      }

      const pageResults: SearchResult[] = [];

      tableBody.find('tr').each((index, row) => {
        const $row = $(row);
        const cells = $row.find('td');

        const isHidden = $row.attr('style')?.includes('display:none') ||
                        $row.attr('style')?.includes('display: none');

        if (cells.length >= 5 && !isHidden) {
          const result = {
            name: cleanText($(cells[0]).text()),
            birth_date: cleanText($(cells[1]).text()),
            region_community: cleanText($(cells[2]).text()),
            address: cleanText($(cells[3]).text()),
            district: cleanText($(cells[4]).text())
          };

          if (result.name && result.name.length > 0) {
            pageResults.push(result);
          }
        }
      });

      if (pageResults.length > 0) {
        console.log(`✓ Страница ${page}: Найдено ${pageResults.length} результатов`);
        allResults.push(...pageResults);

        if (pageResults.length > 0) {
          const first = pageResults[0];
          console.log(`   Пример: ${first.name} | ${first.birth_date}`);
        }

        page++;
      } else {
        console.log(`✓ Страница ${page}: Нет результатов`);
        break;
      }

      // Delay between pages
      if (page <= maxPages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error: any) {
      console.error(`❌ Ошибка запроса на странице ${page}:`, error.message);
      break;
    }
  }

  console.log('─'.repeat(80));
  console.log(`✅ ПОИСК ЗАВЕРШЕН`);
  console.log(`📊 Всего найдено: ${allResults.length} результатов`);
  console.log(`📄 Обработано страниц: ${page - 1}`);
  console.log('='.repeat(80) + '\n');

  return allResults;
}

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Armenian Election Registry Search API'
  });
});

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/api/search', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const data = req.body as SearchParams;

    // Normalize Armenian text
    const firstName = normalizeArmenianText((data.first_name || '').trim());
    const lastName = normalizeArmenianText((data.last_name || '').trim());

    // Validate
    if (!firstName || !lastName) {
      console.warn('⚠️ Запрос отклонен: имя и фамилия обязательны');
      return res.status(400).json({
        success: false,
        error: 'Name and surname are required / Անունը և ազգանունը պարտադիր են'
      } as CombinedResponse);
    }

    if (firstName.length < 2 || lastName.length < 2) {
      console.warn('⚠️ Запрос отклонен: имя/фамилия слишком короткие');
      return res.status(400).json({
        success: false,
        error: 'Name must be at least 2 characters / Անունը պետք է լինել առնվազն 2 սիմվոլ'
      } as CombinedResponse);
    }

    console.log(`\n${'*'.repeat(80)}`);
    console.log(`📥 НОВЫЙ ЗАПРОС API`);
    console.log(`${'*'.repeat(80)}`);
    console.log(`🕐 Время: ${new Date().toLocaleString('ru-RU')}`);
    console.log(`🌐 IP: ${req.ip || req.socket.remoteAddress}`);
    console.log(`📝 Данные: ${firstName} ${lastName}`);

    // Perform search
    const results = await getSearchResults({
      firstName,
      lastName,
      region: normalizeArmenianText((data.region || 'ԵՐԵՎԱՆ').trim()),
      community: normalizeArmenianText((data.community || '').trim()),
      middleName: normalizeArmenianText((data.middle_name || '').trim()),
      birthDate: (data.birth_date || '').trim(),
      street: normalizeArmenianText((data.street || '').trim()),
      building: normalizeArmenianText((data.building || '').trim()),
      apartment: normalizeArmenianText((data.apartment || '').trim()),
      district: normalizeArmenianText((data.district || '').trim())
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`${'*'.repeat(80)}`);
    console.log(`✅ ЗАПРОС ВЫПОЛНЕН УСПЕШНО`);
    console.log(`⏱️ Время выполнения: ${duration}s`);
    console.log(`📊 Найдено результатов: ${results.length}`);
    console.log(`${'*'.repeat(80)}\n`);

    return res.json({
      success: true,
      count: results.length,
      results
    } as CombinedResponse);

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error(`\n${'*'.repeat(80)}`);
    console.error('❌ ОШИБКА API');
    console.error(`${'*'.repeat(80)}`);
    console.error('📋 Детали ошибки:', error.message);
    console.error('📚 Stack trace:', error.stack);
    console.error(`⏱️ Время до ошибки: ${duration}s`);
    console.error(`${'*'.repeat(80)}\n`);

    // Return user-friendly error
    const errorMessage = error.message || 'An error occurred during search';

    return res.status(500).json({
      success: false,
      error: 'Service unavailable. Please try again later. / Ծառայությունն անհասանելի է։',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    } as CombinedResponse & { details?: string });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM получен. Завершение работы...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT получен. Завершение работы...');
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 СЕРВЕР ЗАПУЩЕН');
  console.log('='.repeat(80));
  console.log(`📡 Порт: ${PORT}`);
  console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
  console.log(`⏰ Время запуска: ${new Date().toLocaleString('ru-RU')}`);
  console.log(`🔧 Окружение: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(80) + '\n');
});
