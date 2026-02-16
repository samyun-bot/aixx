import { SearchResult } from './types';

declare global {
  interface Window {
    ymaps: any;
  }
}

// Dictionary to translate Armenian to Russian
const armenianToRussian: Record<string, string> = {
  'ԱՐԱԲԿԻՐ': 'Арабкир',
  'ԱՎԱՆ': 'Аван',
  'ԱՋԱՓՆՅԱԿ': 'Аджапняк',
  'ԴԱՎԹԱՇԵՆ': 'Давташен',
  'ԷՐԵԲՈՒՆԻ': 'Эребуни',
  'ԿԵՆՏՐՈՆ': 'Центр',
  'ՄԱԼԱԹԻԱ-ՍԵԲԱՍՏԻԱ': 'Малатия-Себастия',
  'ՆՈՐ ՆՈՐՔ': 'Нор-Норк',
  'ՆՈՐՔ-ՄԱՐԱՇ': 'Норк-Мараш',
  'ՆՈՒԲԱՐԱՇԵՆ': 'Нубарашен',
  'ՇԵՆԳԱՎԻԹ': 'Шенгавит',
  'ՔԱՆԱՔԵՌ-ԶԵՅԹՈՒՆ': 'Канакер-Зейтун',
  'ԱՐԱԳԱԾՈՏՆ': 'Арагацотн',
  'ԱՐԱՐԱՏ': 'Арарат',
  'ԱՐՄԱՎԻՐ': 'Армавир',
  'ԳԵՂԱՐՔՈՒՆԻՔ': 'Гегаркуник',
  'ԵՐԵՎԱՆ': 'Ереван',
  'ԼՈՌԻ': 'Лори',
  'ԿՈՏԱՅՔ': 'Котайк',
  'ՇԻՐԱԿ': 'Ширак',
  'ՍՅՈՒՆԻՔ': 'Сюник',
  'ՎԱՅՈՑ ՁՈՐ': 'Ваёц-Дзор',
  'ՏԱՎՈՒՇ': 'Тавуш',
  'ՊԱՓ': 'ул.',
  'ՓՈՂՈՑ': 'ул.',
  'ԹՂՄ': 'кв.',
  'ՀՄ': 'мкр.',
  'ՄԻՋ': 'мкр.',
  'ՄԵԿ': 'мкр.',
  'ՊԵՏՐՈՍՅԱՆ': 'Петросяна',
  'ՄՈՎՍԵՍ': 'Мовсеса',
  'ԿՈՄԻՏԱՍ': 'Комитаса',
  'ԱՖՐԻԿԱ': 'Африка',
  'ԼԵՒՈՆ': 'Левона',
  'ՄԱՇՏՈՑ': 'Маштоца',
  'ՍՄԲԱՏ': 'Смбата',
  'ՀԱՅTODAY': 'Айтудей',
  'ՄԵՀՅԱՆ': 'Мехяна',
  'ԿԵՂՈՐ': 'Кехора',
  'ՄԽԻԹԱՐ': 'Мхитара',
  'ՊԱՂԵՍՏ': 'Палест',
  'ՀԱՄԲԵԼ': 'Хамбела',
  'ԹԱԿ': 'Так'
};

export class MapManager {
  private yandexReady: Promise<void>;

  constructor() {
    this.yandexReady = this.ensureYandex();
  }

  private ensureYandex(): Promise<void> {
    // Yandex Maps API is now loaded in the separate map.html page
    return Promise.resolve();
  }

  private setupEventListeners(): void {
    // Event listeners removed - map now opens in new tab
  }

  private translateToRussian(text: string): string {
    if (!text) return text;

    let result = text;
    for (const [armenian, russian] of Object.entries(armenianToRussian)) {
      const regex = new RegExp(`\\b${armenian}\\b`, 'gi');
      result = result.replace(regex, russian);
    }
    return result;
  }

  private formatAddressForMap(result: SearchResult): string {
    const regionText = (result.region_community || '').replace(/,\s*$/, '').trim();
    const rawAddress = (result.address || '').trim();

    if (!rawAddress) {
      return regionText;
    }

    const cleaned = rawAddress.replace(/\(\s*\d+\s*\)$/, '').trim();

    // Davtashen microdistrict: "ԴԱՎԹԱՇԵՆ 2 ԹՂՄ. 47 4" -> "2-й квартал Давташен, 47"
    const davQuarter = cleaned.match(/^ԴԱՎԹԱՇԵՆ\s+(\d+)\s+ԹՂՄ\.?\s+(\d+)(?:\s+\d+)?$/i);
    if (davQuarter) {
      const quarter = davQuarter[1];
      const building = davQuarter[2];
      return `${quarter}-й квартал Давташен, ${building}`;
    }

    // Davtashen street number: "ԴԱՎԹԱՇԵՆ 4 Փ. 18" -> "4-я улица Давташена, 18"
    const davStreetNum = cleaned.match(/^ԴԱՎԹԱՇԵՆ\s+(\d+)\s+Փ\.?\s+(\d+)(?:\s+\d+)?$/i);
    if (davStreetNum) {
      const streetNo = davStreetNum[1];
      const building = davStreetNum[2];
      return `${streetNo}-я улица Давташена, ${building}`;
    }

    // Davtashen generic microdistrict (ordinal first): "ԴԱՎԹԱՇԵՆ\s+(\d+)\s+ԹՂՄ\.?\s+(\d+)"
    const davQuarterShort = cleaned.match(/^ԴԱՎԹԱՇԵՆ\s+(\d+)\s+ԹՂՄ\.?\s+(\d+)(?:\s+\d+)?$/i);
    if (davQuarterShort) {
      const quarter = davQuarterShort[1];
      const building = davQuarterShort[2];
      return `${quarter}-й квартал Давташен, ${building}`;
    }

    // Huyis Avan: "ՀՈՒՅՍԻ ԱՎԱՆ 1 ԹՂՄ. 5 Փ. 63" -> "5-я улица квартала Уйси Аван, 63"
    const huyisAvan = cleaned.match(/^ՀՈՒՅՍԻ\s+ԱՎԱՆ\s+\d+\s+ԹՂՄ\.?\s+(\d+)\s+Փ\.?\s+(\d+)(?:\s+\d+)?$/i);
    if (huyisAvan) {
      const streetNo = huyisAvan[1];
      const building = huyisAvan[2];
      return `${streetNo}-я улица квартала Уйси Аван, ${building}`;
    }

    // Azat Sherents street: "ԱԶԱՏ ՇԵՐԵՆՑԻ Փ. 20"
    const azatSherents = cleaned.match(/^(ԱԶԱՏ\s+ՇԵՐԵՆՑԻ)\s+Փ\.?\s+(\d+)(?:\s+\d+)?$/i);
    if (azatSherents) {
      const building = azatSherents[2];
      return `улица Азата Шеренца, ${building}`;
    }

    // T. Petrosyan: "Տ. ՊԵՏՐՈՍՅԱՆ Փ. 2 68"
    const tPetrosyan = cleaned.match(/^Տ\.\s*ՊԵՏՐՈՍՅԱՆ\s+Փ\.?\s+(\d+)(?:\s+(\d+))?$/i);
    if (tPetrosyan) {
      const building = tPetrosyan[1];
      const apt = tPetrosyan[2];
      return `улица Тиграна Петросяна, ${apt ? `${building} ${apt}` : building}`;
    }

    // Generic: remove trailing apartment (two last numeric tokens)
    let address = cleaned;
    const tokens = address.split(/\s+/);
    if (
      tokens.length >= 2 &&
      /^\d+$/.test(tokens[tokens.length - 1]) &&
      /^\d+$/.test(tokens[tokens.length - 2])
    ) {
      tokens.pop(); // drop apartment number
      address = tokens.join(' ');
    }

    let mapAddress = regionText;

    // Remove duplicate from address start
    const regionParts = mapAddress.split(',').map(p => p.trim()).filter(Boolean);
    const lastRegionPart = regionParts[regionParts.length - 1];
    if (lastRegionPart && address.startsWith(lastRegionPart)) {
      address = address.substring(lastRegionPart.length).trim();
      address = address.replace(/^,\s*/, '').trim();
    }

    if (address) {
      mapAddress += mapAddress ? ', ' + address : address;
    }

    mapAddress = mapAddress.replace(/,\s*,/g, ',');
    mapAddress = mapAddress.replace(/,\s*$/, '').trim();
    mapAddress = mapAddress.replace(/\s*\.\s*$/, '').trim();
    mapAddress = mapAddress.replace(/\s+/g, ' ');
    mapAddress = mapAddress.replace(/,\s+/g, ', '); // Normalize comma spacing

    return mapAddress;
  }

  private async geocodeAddress(formattedAddress: string): Promise<{ lat: number; lng: number }> {
    // Geocoding now done in map.html
    throw new Error('Geocoding not available in main client');
  }

  private showYmapsDebug(mapContainer: HTMLElement): void {
    // Debug functionality moved to map.html
  }

  private closeMap(): void {
    // Map now opens in new tab - no modal to close
  }

  public openMapWithAddress(result: SearchResult): void {
    console.log('🗺️ Opening Yandex Maps for:', result.name);
    const formattedAddress = this.formatAddressForMap(result);

    // Create Yandex Maps URL with the address as search parameter
    const searchQuery = encodeURIComponent(formattedAddress);
    const yandexMapsUrl = `https://yandex.com/maps/10262/yerevan/?text=${searchQuery}`;

    console.log('📍 Formatted address:', formattedAddress);
    console.log('🌐 Opening Yandex Maps:', yandexMapsUrl);

    // Open Yandex Maps in a new tab
    const newWindow = window.open(yandexMapsUrl, 'YandexMaps');
    if (!newWindow) {
      console.error('❌ Failed to open Yandex Maps - popup might be blocked');
      alert('⚠️ Не удалось открыть Яндекс.Карты.\nПроверьте, что всплывающие окна разрешены в браузере.\n\nFailed to open Yandex Maps.\nPlease allow popups in your browser.');
    } else {
      console.log('✅ Yandex Maps opened successfully');
    }
  }

  private showFallbackMessage(mapContainer: HTMLElement, address: string): void {
    // Fallback message functionality moved to map.html
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
