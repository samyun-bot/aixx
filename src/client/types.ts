// Interface for search form data
export interface SearchFormData {
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

// Interface for search result
export interface SearchResult {
  name: string;
  birth_date: string;
  region_community: string;
  address: string;
  district: string;
}

// Interface for API response
export interface ApiResponse {
  success: boolean;
  count?: number;
  results?: SearchResult[];
  error?: string;
}

// Interface for user data (for Telegram)
export interface UserData {
  timestamp: string;
  timezone: string;
  language: string;
  languages: string[];
  platform: string;
  userAgent: string;
  vendor: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints: number;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
    orientation?: string;
  };
  window: {
    innerWidth: number;
    innerHeight: number;
    outerWidth: number;
    outerHeight: number;
  };
  connection: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  ip?: string;
  geolocation?: {
    ip?: string;
    city?: string;
    region?: string;
    country?: string;
    country_code?: string;
    postal?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    asn?: string;
    org?: string;
    isp?: string;
    error?: string;
  };
  battery?: {
    level?: string;
    charging?: boolean;
    chargingTime?: number;
    dischargingTime?: number;
    error?: string;
  };
}
// Utility function to normalize Armenian text
// Converts Armenian ligature "և" to two separate characters "եւ"
export function normalizeArmenianText(text: string): string {
  if (!text) return text;
  return text.replace(/և/g, 'եւ');
}

// Normalize all string fields in SearchFormData
export function normalizeSearchFormData(formData: SearchFormData): SearchFormData {
  return {
    first_name: normalizeArmenianText(formData.first_name),
    last_name: normalizeArmenianText(formData.last_name),
    middle_name: formData.middle_name ? normalizeArmenianText(formData.middle_name) : undefined,
    birth_date: formData.birth_date,
    street: formData.street ? normalizeArmenianText(formData.street) : undefined,
    building: formData.building ? normalizeArmenianText(formData.building) : undefined,
    apartment: formData.apartment ? normalizeArmenianText(formData.apartment) : undefined,
    district: formData.district ? normalizeArmenianText(formData.district) : undefined,
    region: formData.region,
    community: formData.community ? normalizeArmenianText(formData.community) : undefined
  };
}
