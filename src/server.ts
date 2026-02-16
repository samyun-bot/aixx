import express, { Request, Response, Express } from 'express';
import path from 'path';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';
import { CookieJar } from 'tough-cookie';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Enable CORS for development
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
const REQUEST_TIMEOUT = 60000;
const PAGE_DELAY = 500; // Задержка между запросами страниц
const MAX_RETRIES = 3; // Максимальное количество повторных попыток

// Create axios instance with cookie jar
function createAxiosInstance(cookieJar?: InstanceType<typeof CookieJar>): AxiosInstance {
  const jar = cookieJar || new CookieJar();

  return axios.create({
    timeout: REQUEST_TIMEOUT,
    httpAgent: new HttpCookieAgent({ cookies: { jar } }),
    httpsAgent: new HttpsCookieAgent({ cookies: { jar } }),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,hy;q=0.6',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
  });
}

// Fetch CSRF token with retries
async function fetchCsrfToken(retries = MAX_RETRIES): Promise<{ token: string | null; cookieJar: CookieJar | null }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const cookieJar = new CookieJar();
      const client = createAxiosInstance(cookieJar);

      console.log(`📡 Попытка получения CSRF токена #${attempt}...`);

      const response = await client.get(BASE_URL);

      console.log(`📡 CSRF Token fetch - Статус: ${response.status}`);

      if (response.status === 200) {
        const $ = cheerio.load(response.data);
        const token = $('input[name="__RequestVerificationToken"]').val() as string;

        if (token && token.length > 0) {
          console.log('✓ Свежий токен получен успешно');
          console.log(`✓ Токен: ${token.substring(0, 20)}...`);
          return { token, cookieJar };
        } else {
          console.warn('⚠️ Токен не найден на странице');
        }
      }
    } catch (error: any) {
      console.error(`⚠️ Ошибка при получении токена (попытка ${attempt}/${retries}):`, error.message);

      if (attempt < retries) {
        const delay = attempt * 1000; // Увеличиваем задержку с каждой попыткой
        console.log(`⏳ Ожидание ${delay}ms перед повторной попыткой...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('❌ Не удалось получить CSRF токен после всех попыток');
  return { token: null, cookieJar: null };
}

// Convert date format from DD/MM/YYYY to YYYY-MM-DD
function convertDateFormat(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) {
    return '';
  }

  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;

      // Validate date components
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

// Clean and normalize text
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// Get search results with improved error handling
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

  // Get CSRF token and cookie jar
  const { token: csrfToken, cookieJar } = await fetchCsrfToken();

  if (!csrfToken || !cookieJar) {
    throw new Error('Не удалось получить CSRF токен. Сервис может быть недоступен.');
  }

  // Create client with the same cookie jar
  const client = createAxiosInstance(cookieJar);
  client.defaults.headers.common['Referer'] = BASE_URL;
  client.defaults.headers.common['Origin'] = 'https://prelive.elections.am';

  // Prepare form data - only include non-empty values
  const convertedBirthDate = convertDateFormat(birthDate);

  // Build form data object dynamically - only include fields with values
  const baseFormData: Record<string, string> = {
    'ShowCaptcha': 'False',
    'Input.Region': region || 'ԵՐԵՎԱՆ',
    'Current.Region': region || 'ԵՐԵՎԱՆ',
    'RegisterPaging.PageSize': '100',
    '__RequestVerificationToken': csrfToken
  };

  // Add optional fields only if they have values
  if (firstName && firstName.trim()) {
    baseFormData['Current.FirstName'] = firstName;
    baseFormData['Input.FirstName'] = firstName;
  }

  if (lastName && lastName.trim()) {
    baseFormData['Current.LastName'] = lastName;
    baseFormData['Input.LastName'] = lastName;
  }

  if (middleName && middleName.trim()) {
    baseFormData['Current.MiddleName'] = middleName;
    baseFormData['Input.MiddleName'] = middleName;
  }

  if (community && community.trim()) {
    baseFormData['Input.Community'] = community;
    baseFormData['Current.Community'] = community;
  }

  if (convertedBirthDate) {
    baseFormData['Current.BirthDate'] = convertedBirthDate;
    baseFormData['Input.BirthDateUI'] = convertedBirthDate;
  }

  if (street && street.trim()) {
    baseFormData['Current.Street'] = street;
    baseFormData['Input.Street'] = street;
  }

  if (building && building.trim()) {
    baseFormData['Current.Building'] = building;
    baseFormData['Input.Building'] = building;
  }

  if (apartment && apartment.trim()) {
    baseFormData['Current.Apartment'] = apartment;
    baseFormData['Input.Apartment'] = apartment;
  }

  if (district && district.trim()) {
    baseFormData['Current.District'] = district;
    baseFormData['Input.District'] = district;
  }

  const allResults: SearchResult[] = [];

  // Определяем максимальное количество страниц
  // Если указаны детали адреса, ограничиваем одной страницей
  const hasAddressDetails = street || building || apartment;
  const maxPages = hasAddressDetails ? 1 : 5;

  let page = 1;
  let consecutiveEmptyPages = 0;
  const maxConsecutiveEmptyPages = 2; // Прекращаем после 2 пустых страниц подряд

  console.log(`📄 Максимум страниц для обработки: ${maxPages}`);
  console.log('─'.repeat(80));
  console.log('📋 Данные, отправляемые на сервер:');
  Object.entries(baseFormData).forEach(([key, value]) => {
    if (!key.includes('Token')) {
      console.log(`   ${key}: ${value}`);
    }
  });
  console.log('─'.repeat(80));

  while (page <= maxPages && consecutiveEmptyPages < maxConsecutiveEmptyPages) {
    const formData = { ...baseFormData, 'RegisterPaging.PageIndex': String(page) };

    try {
      // Convert to URL-encoded form data
      const params = new URLSearchParams();
      Object.entries(formData).forEach(([key, value]) => {
        params.append(key, String(value));
      });

      console.log(`📡 Запрос страницы ${page}...`);
      console.log(`🔗 Параметры: ${params.toString().substring(0, 150)}...`);

      const response = await client.post(BASE_URL, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      console.log(`📡 Страница ${page} - Статус: ${response.status}`);

      // Debug: Log response size and check for common error patterns
      console.log(`📏 Размер ответа: ${response.data.length} bytes`);

      // Save response to file for debugging first page only
      if (page === 1 && process.env.DEBUG_RESPONSE === 'true') {
        const fs = require('fs');
        fs.writeFileSync(`debug_response_page${page}.html`, response.data);
        console.log(`📝 Ответ сохранён в debug_response_page${page}.html`);
      }

      // Check for common error responses
      if (response.data.includes('Too Many Requests') || response.data.includes('429')) {
        console.error('❌ Ошибка: Слишком много запросов (429). Сервер блокирует запросы.');
        break;
      }

      if (response.status !== 200) {
        console.log(`❌ Ошибка: HTTP статус ${response.status}`);
        break;
      }

      // Parse HTML response
      const $ = cheerio.load(response.data);
      const tbody = $('tbody');

      if (!tbody.length || !tbody.html()?.trim()) {
        consecutiveEmptyPages++;
        console.log(`⚠️ Страница ${page}: Пустая таблица (${consecutiveEmptyPages}/${maxConsecutiveEmptyPages})`);

        // Debug: Check if there's an error message in the response
        const errorMsg = $('div.alert, div.error, .validation-summary').text();
        if (errorMsg) {
          console.log(`⚠️ Сообщение от сервера: ${errorMsg.substring(0, 100)}`);
        }

        // Check for alternative table structures
        const dataTable = $('table.dataTable, table[role="grid"]');
        const divTable = $('div[role="table"]');
        console.log(`ℹ️ dataTable найдено: ${dataTable.length}, divTable: ${divTable.length}`);

        if (consecutiveEmptyPages >= maxConsecutiveEmptyPages) {
          console.log(`✓ Остановка: ${maxConsecutiveEmptyPages} пустых страниц подряд`);
          break;
        }

        page++;
        await new Promise(resolve => setTimeout(resolve, PAGE_DELAY));
        continue;
      }

      const rows = $('tbody tr');
      const pageResults: SearchResult[] = [];

      console.log(`📊 Найдено строк в таблице: ${rows.length}`);

      // If no rows found, save response for debugging
      if (rows.length === 0) {
        const responsePreview = response.data.substring(0, 500);
        console.log('💾 Первые 500 символов ответа:');
        console.log(responsePreview);

        // Try alternative selectors
        const allTables = $('table');
        const allRows = $('tr');
        console.log(`ℹ️ Всего таблиц: ${allTables.length}, Всего строк (tr): ${allRows.length}`);
      }

      rows.each((index, row) => {
        const $row = cheerio.load(row);
        const cells = $row('td');

        // Check if row is visible and has required cells
        const isHidden = $row(row).attr('style')?.includes('display:none') ||
                        $row(row).attr('style')?.includes('display: none');

        if (cells.length >= 5 && !isHidden) {
          const result = {
            name: cleanText(cells.eq(0).text()),
            birth_date: cleanText(cells.eq(1).text()),
            region_community: cleanText(cells.eq(2).text()),
            address: cleanText(cells.eq(3).text()),
            district: cleanText(cells.eq(4).text())
          };

          // Only add if has meaningful data
          if (result.name && result.name.length > 0) {
            pageResults.push(result);

            // Debug first row
            if (index === 0) {
              console.log(`   📌 Пример первой строки - ячеек найдено: ${cells.length}`);
              console.log(`      Имя: ${result.name}`);
              console.log(`      Дата: ${result.birth_date}`);
            }
          }
        } else if (cells.length < 5 && index === 0) {
          console.log(`⚠️ Первая строка имеет только ${cells.length} ячеек (нужно 5+)`);
        }
      });

      if (pageResults.length > 0) {
        consecutiveEmptyPages = 0; // Сбрасываем счетчик пустых страниц
        console.log(`✓ Страница ${page}: Найдено ${pageResults.length} результатов`);
        allResults.push(...pageResults);

        // Show first result as example
        if (pageResults.length > 0) {
          const first = pageResults[0];
          console.log(`   Пример: ${first.name} | ${first.birth_date} | ${first.address}`);
        }

        page++;
      } else {
        consecutiveEmptyPages++;
        console.log(`⚠️ Страница ${page}: Нет результатов (${consecutiveEmptyPages}/${maxConsecutiveEmptyPages})`);

        if (consecutiveEmptyPages >= maxConsecutiveEmptyPages) {
          console.log(`✓ Остановка: ${maxConsecutiveEmptyPages} пустых страниц подряд`);
          break;
        }

        page++;
      }
    } catch (error: any) {
      console.error(`❌ Ошибка запроса на странице ${page}:`, error.message);

      // Пробуем продолжить со следующей страницей
      if (page < maxPages) {
        console.log('⏭️ Пропускаем эту страницу и продолжаем...');
        page++;
        consecutiveEmptyPages++;
        await new Promise(resolve => setTimeout(resolve, PAGE_DELAY * 2));
        continue;
      } else {
        break;
      }
    }

    // Задержка между запросами для избежания блокировки
    if (page <= maxPages) {
      await new Promise(resolve => setTimeout(resolve, PAGE_DELAY));
    }
  }

  console.log('─'.repeat(80));
  console.log(`✅ ПОИСК ЗАВЕРШЕН`);
  console.log(`📊 Всего найдено: ${allResults.length} результатов`);
  console.log(`📄 Обработано страниц: ${page - 1}`);
  console.log('='.repeat(80) + '\n');

  return allResults;
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Armenian Election Registry Search API'
  });
});

// Main page
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Search endpoint
app.post('/api/search', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const data = req.body as SearchParams;

    // Normalize Armenian text (convert "և" to "եւ")
    const firstName = normalizeArmenianText((data.first_name || '').trim());
    const lastName = normalizeArmenianText((data.last_name || '').trim());

    // Get other parameters
    const street = normalizeArmenianText((data.street || '').trim());
    const building = normalizeArmenianText((data.building || '').trim());
    const apartment = normalizeArmenianText((data.apartment || '').trim());
    const district = normalizeArmenianText((data.district || '').trim());
    const community = normalizeArmenianText((data.community || '').trim());
    const birthDate = (data.birth_date || '').trim();

    // ⚠️ CRITICAL: elections.am API requires BOTH first and last name
    // Testing showed that date-only searches return empty results
    if (!firstName || !lastName) {
      console.warn('⚠️ Запрос отклонен: имя и фамилия обязательны (API elections.am не поддерживает поиск только по дате)');
      return res.status(400).json({
        success: false,
        error: 'Name and surname are required (elections.am does not support search by date only) / Անունը և ազգանունը պարտադիր են'
      } as CombinedResponse);
    }

    // Validate name lengths
    if (firstName.length < 2) {
      console.warn('⚠️ Запрос отклонен: имя слишком короткое');
      return res.status(400).json({
        success: false,
        error: 'First name must be at least 2 characters / Անունը պետք է լինել առնվազն 2 սիմվոլ'
      } as CombinedResponse);
    }

    if (lastName.length < 2) {
      console.warn('⚠️ Запрос отклонен: фамилия слишком короткая');
      return res.status(400).json({
        success: false,
        error: 'Last name must be at least 2 characters / Ազգանունը պետք է լինել առնվազն 2 սիմվոլ'
      } as CombinedResponse);
    }

    console.log(`\n${'*'.repeat(80)}`);
    console.log(`📥 НОВЫЙ ЗАПРОС API`);
    console.log(`${'*'.repeat(80)}`);
    console.log(`🕐 Время: ${new Date().toLocaleString('ru-RU')}`);
    console.log(`🌐 IP: ${req.ip || req.socket.remoteAddress}`);

    // Perform search
    const results = await getSearchResults({
      firstName,
      lastName,
      region: normalizeArmenianText((data.region || 'ԵՐԵՎԱՆ').trim()),
      community,
      middleName: normalizeArmenianText((data.middle_name || '').trim()),
      birthDate,
      street,
      building,
      apartment,
      district
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
      results,
      duration: duration + 's'
    } as CombinedResponse & { duration: string });

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error(`\n${'*'.repeat(80)}`);
    console.error('❌ ОШИБКА API');
    console.error(`${'*'.repeat(80)}`);
    console.error('📋 Детали ошибки:', error.message);
    console.error('📚 Stack trace:', error.stack);
    console.error(`⏱️ Время до ошибки: ${duration}s`);
    console.error(`${'*'.repeat(80)}\n`);

    return res.status(500).json({
      success: false,
      error: 'Произошла ошибка при поиске. Попробуйте позже. / An error occurred during search. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// Error handler
app.use((error: Error, req: Request, res: Response, next: any) => {
  console.error('💥 Необработанная ошибка:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
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
