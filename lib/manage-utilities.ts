export type UtilitySourceStatus = "live" | "cached" | "demo" | "error";
export type WeatherCityName =
  | "Kathmandu"
  | "Pokhara"
  | "Chitwan"
  | "Butwal"
  | "Biratnagar"
  | "Dharan"
  | "Nepalgunj"
  | "Dhangadhi"
  | "Janakpur"
  | "Hetauda";

export const WEATHER_CITY_STORAGE_KEY = "servex:utilities:weatherCity";
export const WEATHER_HOUR_STORAGE_KEY = "servex:utilities:weatherHour";

export const WEATHER_CITY_OPTIONS: Array<{ name: WeatherCityName; latitude: number; longitude: number }> = [
  { name: "Kathmandu", latitude: 27.7172, longitude: 85.3240 },
  { name: "Pokhara", latitude: 28.2096, longitude: 83.9856 },
  { name: "Chitwan", latitude: 27.5291, longitude: 84.3542 },
  { name: "Butwal", latitude: 27.7006, longitude: 83.4484 },
  { name: "Biratnagar", latitude: 26.4525, longitude: 87.2718 },
  { name: "Dharan", latitude: 26.8125, longitude: 87.2836 },
  { name: "Nepalgunj", latitude: 28.0500, longitude: 81.6167 },
  { name: "Dhangadhi", latitude: 28.6833, longitude: 80.6000 },
  { name: "Janakpur", latitude: 26.7288, longitude: 85.9263 },
  { name: "Hetauda", latitude: 27.4284, longitude: 85.0322 },
];

export const WEATHER_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);

function getWeatherCityConfig(cityName: WeatherCityName) {
  return WEATHER_CITY_OPTIONS.find((city) => city.name === cityName) || WEATHER_CITY_OPTIONS[0];
}

export function isWeatherCityName(value: unknown): value is WeatherCityName {
  return typeof value === "string" && WEATHER_CITY_OPTIONS.some((city) => city.name === value);
}

export function isWeatherHour(value: unknown): value is string {
  return typeof value === "string" && WEATHER_HOUR_OPTIONS.includes(value);
}

function getWeatherCacheKey(cityName: WeatherCityName) {
  return `servex:utilities:weather:${cityName}`;
}

export type UtilityCardData = {
  title: "Weather" | "Gold Price" | "Fuel Price" | "Holidays";
  lines: string[];
  status: UtilitySourceStatus;
  statusLabel?: string;
  lastUpdated?: string | null;
  source?: string | null;
  error?: string | null;
};

type CachedPayload<T> = {
  savedAt: number;
  data: T;
};

const GOLD_CACHE_KEY = "manageUtilities:gold:fenegosida:v1";
const FUEL_CACHE_KEY = "manageUtilities:fuel:noc:v1";
const WEATHER_CACHE_MS = 60 * 60 * 1000;
const GOLD_CACHE_MS = 12 * 60 * 60 * 1000;
const FUEL_CACHE_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7000;

const NEPALI_DIGITS: Record<string, string> = {
  "0": "\u0966",
  "1": "\u0967",
  "2": "\u0968",
  "3": "\u0969",
  "4": "\u096a",
  "5": "\u096b",
  "6": "\u096c",
  "7": "\u096d",
  "8": "\u096e",
  "9": "\u096f",
};

function toNepaliNumber(value: number | string) {
  return String(value).replace(/[0-9]/g, (digit) => NEPALI_DIGITS[digit] || digit);
}

function formatNepaliMoney(value: number, fractionDigits = 2) {
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return toNepaliNumber(formatted);
}

function logUtilityError(message: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(message, error);
  }
}

function getNowLabel() {
  return new Date().toLocaleString("ne-NP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readCache<T>(key: string, maxAgeMs: number): CachedPayload<T> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || parsed.data == null) return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;

    return parsed;
  } catch (error) {
    logUtilityError("Utilities cache read error", error);
    return null;
  }
}

function writeCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;

  try {
    const payload: CachedPayload<T> = { savedAt: Date.now(), data };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    logUtilityError("Utilities cache write error", error);
  }
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

type WeatherData = {
  rainChance: number;
  temperature: number;
  lastUpdated: string;
  dataMode: "selected_hour";
  cityName: WeatherCityName;
  targetTime: string;
  selectedHour: string;
  matchedHourlyTime: string;
};

type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
  };
};

function buildWeatherCard(data: WeatherData, status: UtilitySourceStatus, cityName: WeatherCityName): UtilityCardData {
  const lines = [
    `\u0906\u091c ${cityName} \u092e\u093e ${data.selectedHour} \u092c\u091c\u0947 \u092a\u093e\u0928\u0940 \u092a\u0930\u094d\u0928\u0947 \u0938\u092e\u094d\u092d\u093e\u0935\u0928\u093e ${toNepaliNumber(Math.round(data.rainChance))}% \u091b\u0964`,
    `\u0924\u093e\u092a\u0915\u094d\u0930\u092e: ${toNepaliNumber(Math.round(data.temperature))}\u00b0C`,
  ];

  return {
    title: "Weather",
    lines,
    status,
    lastUpdated: data.lastUpdated,
    source: "Open-Meteo",
  };
}

function getNepalDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getNepalHourString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return parts.find((part) => part.type === "hour")?.value || "00";
}

export function getCurrentKathmanduHourOption() {
  return `${getNepalHourString()}:00`;
}

function buildTargetTime(selectedHour: number) {
  const date = getNepalDateString();
  return `${date}T${String(selectedHour).padStart(2, "0")}:00`;
}

function buildOpenMeteoUrl(city: { latitude: number; longitude: number }) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&hourly=temperature_2m,precipitation_probability&timezone=Asia%2FKathmandu&forecast_days=1`;
}

function getSelectedHourWeather(data: OpenMeteoResponse, targetTime: string) {
  const index = data.hourly?.time?.findIndex((time) => time === targetTime) ?? -1;

  if (index === -1) return null;

  const rainChance = Number(data.hourly?.precipitation_probability?.[index]);
  const temperature = Number(data.hourly?.temperature_2m?.[index]);

  if (!Number.isFinite(rainChance) || !Number.isFinite(temperature)) return null;

  return {
    matchedHourlyTime: data.hourly?.time?.[index] || targetTime,
    rainChance,
    temperature,
  };
}

function isSelectedHourWeatherCache(data: WeatherData, cityName: WeatherCityName, targetTime: string, selectedHour: string) {
  return data.dataMode === "selected_hour" &&
    data.cityName === cityName &&
    data.targetTime === targetTime &&
    data.selectedHour === selectedHour &&
    data.matchedHourlyTime === targetTime &&
    Number.isFinite(Number(data.rainChance)) &&
    Number.isFinite(Number(data.temperature));
}
function buildWeatherUnavailableCard(): UtilityCardData {
  return {
    title: "Weather",
    lines: ["\u092e\u094c\u0938\u092e\u0915\u094b \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u0909\u092a\u0932\u092c\u094d\u0927 \u091b\u0948\u0928\u0964"],
    status: "error",
  };
}

export async function fetchWeatherUtility(cityName: WeatherCityName = "Kathmandu", selectedHour = getCurrentKathmanduHourOption()): Promise<UtilityCardData> {
  const city = getWeatherCityConfig(cityName);
  const safeSelectedHour = isWeatherHour(selectedHour) ? selectedHour : getCurrentKathmanduHourOption();
  const url = buildOpenMeteoUrl(city);
  const selectedHourNumber = Number(safeSelectedHour.slice(0, 2));
  const targetTime = buildTargetTime(selectedHourNumber);
  const cacheKey = getWeatherCacheKey(city.name);
  const rawCached = readCache<WeatherData>(cacheKey, WEATHER_CACHE_MS);
  const cached = rawCached && isSelectedHourWeatherCache(rawCached.data, city.name, targetTime, safeSelectedHour) ? rawCached : null;

  try {
    const json = await fetchJsonWithTimeout<OpenMeteoResponse>(url);
    const currentHourWeather = getSelectedHourWeather(json, targetTime);

    if (!currentHourWeather) {
      throw new Error("Selected hourly weather data missing");
    }

    const data: WeatherData = {
      temperature: currentHourWeather.temperature,
      rainChance: currentHourWeather.rainChance,
      lastUpdated: getNowLabel(),
      dataMode: "selected_hour",
      cityName: city.name,
      targetTime,
      selectedHour: safeSelectedHour,
      matchedHourlyTime: currentHourWeather.matchedHourlyTime,
    };

    writeCache(getWeatherCacheKey(city.name), data);
    return buildWeatherCard(data, "live", city.name);
  } catch (error) {
    logUtilityError("Weather utility fetch error", error);
    if (cached) {
      return buildWeatherCard(cached.data, "cached", city.name);
    }
    return buildWeatherUnavailableCard();
  }
}
type GoldPriceData = {
  goldPricePerTola: number;
  silverPricePerTola: number | null;
  updatedAt: string;
  source: string;
};

type GoldPriceResponse = {
  goldPricePerTola?: number;
  silverPricePerTola?: number | null;
  currency?: string;
  unit?: string;
  source?: string;
  updatedAt?: string;
};

function isGoldPriceData(data: GoldPriceData | undefined | null) {
  return !!data &&
    Number.isFinite(Number(data.goldPricePerTola)) &&
    Number(data.goldPricePerTola) > 0 &&
    (data.silverPricePerTola == null ||
      (Number.isFinite(Number(data.silverPricePerTola)) && Number(data.silverPricePerTola) > 0));
}

function buildGoldPriceCard(data: GoldPriceData | null, status: UtilitySourceStatus, error?: string | null): UtilityCardData {
  if (!data) {
    return {
      title: "Gold Price",
      lines: ["\u0906\u091c \u0938\u0941\u0928\u0915\u094b \u092d\u093e\u0909 \u0909\u092a\u0932\u092c\u094d\u0927 \u091b\u0948\u0928\u0964"],
      status: "error",
      error,
    };
  }

  return {
    title: "Gold Price",
    lines: [
      `\u0938\u0941\u0928: \u0930\u0941. ${formatNepaliMoney(data.goldPricePerTola, 0)} \u092a\u094d\u0930\u0924\u093f \u0924\u094b\u0932\u093e`,
      data.silverPricePerTola
        ? `\u091a\u093e\u0901\u0926\u0940: \u0930\u0941. ${formatNepaliMoney(data.silverPricePerTola, 0)} \u092a\u094d\u0930\u0924\u093f \u0924\u094b\u0932\u093e`
        : "\u091a\u093e\u0901\u0926\u0940\u0915\u094b \u092d\u093e\u0909 \u0909\u092a\u0932\u092c\u094d\u0927 \u091b\u0948\u0928\u0964",
    ],
    status,
    statusLabel: status === "cached" ? "Cached" : undefined,
    lastUpdated: data.updatedAt,
    source: data.source,
    error,
  };
}

export async function fetchGoldPriceUtility(): Promise<UtilityCardData> {
  const cached = readCache<GoldPriceData>(GOLD_CACHE_KEY, GOLD_CACHE_MS);

  try {
    const json = await fetchJsonWithTimeout<GoldPriceResponse>("/api/utilities/gold-price");
    const goldPricePerTola = Number(json.goldPricePerTola);
    const rawSilverPricePerTola = json.silverPricePerTola == null ? null : Number(json.silverPricePerTola);
    const silverPricePerTola =
      rawSilverPricePerTola != null && Number.isFinite(rawSilverPricePerTola) && rawSilverPricePerTola > 0
        ? rawSilverPricePerTola
        : null;

    if (
      !Number.isFinite(goldPricePerTola) ||
      goldPricePerTola <= 0 ||
      json.currency !== "NPR" ||
      json.unit !== "tola"
    ) {
      throw new Error("Gold price data missing");
    }

    const data: GoldPriceData = {
      goldPricePerTola,
      silverPricePerTola,
      updatedAt: json.updatedAt || getNowLabel(),
      source: json.source || "FENEGOSIDA",
    };

    writeCache(GOLD_CACHE_KEY, data);
    return buildGoldPriceCard(data, "live");
  } catch (error) {
    logUtilityError("Gold price utility fetch error", error);
    if (cached && isGoldPriceData(cached.data)) {
      return buildGoldPriceCard(cached.data, "cached", "Live update unavailable");
    }

    return buildGoldPriceCard(null, "error", "Live update unavailable");
  }
}
type FuelPriceData = {
  petrol: number;
  diesel: number;
  updatedAt: string;
  source: string;
};

type FuelPriceResponse = {
  petrol?: number;
  diesel?: number;
  currency?: string;
  unit?: string;
  source?: string;
  updatedAt?: string;
};

function buildFuelPriceCard(data: FuelPriceData | null, status: UtilitySourceStatus, error?: string | null): UtilityCardData {
  if (!data) {
    return {
      title: "Fuel Price",
      lines: ["\u0907\u0928\u094d\u0927\u0928 \u092e\u0942\u0932\u094d\u092f \u0909\u092a\u0932\u092c\u094d\u0927 \u091b\u0948\u0928\u0964"],
      status: "error",
      error,
    };
  }

  return {
    title: "Fuel Price",
    lines: [
      `\u092a\u0947\u091f\u094d\u0930\u094b\u0932: \u0930\u0941. ${formatNepaliMoney(data.petrol, data.petrol % 1 === 0 ? 0 : 1)} \u092a\u094d\u0930\u0924\u093f \u0932\u093f\u091f\u0930`,
      `\u0921\u093f\u091c\u0947\u0932: \u0930\u0941. ${formatNepaliMoney(data.diesel, data.diesel % 1 === 0 ? 0 : 1)} \u092a\u094d\u0930\u0924\u093f \u0932\u093f\u091f\u0930`,
    ],
    status,
    statusLabel: status === "cached" ? "Cached" : undefined,
    lastUpdated: data.updatedAt,
    source: data.source,
    error,
  };
}

export async function fetchFuelPriceUtility(): Promise<UtilityCardData> {
  const cached = readCache<FuelPriceData>(FUEL_CACHE_KEY, FUEL_CACHE_MS);

  try {
    const json = await fetchJsonWithTimeout<FuelPriceResponse>("/api/utilities/fuel-price");
    const petrol = Number(json.petrol);
    const diesel = Number(json.diesel);

    if (!Number.isFinite(petrol) || petrol <= 0 || !Number.isFinite(diesel) || diesel <= 0 || json.currency !== "NPR" || json.unit !== "liter") {
      throw new Error("Fuel price data missing");
    }

    const data: FuelPriceData = {
      petrol,
      diesel,
      updatedAt: json.updatedAt || getNowLabel(),
      source: json.source || "Nepal Oil Corporation",
    };

    writeCache(FUEL_CACHE_KEY, data);
    return buildFuelPriceCard(data, "live");
  } catch (error) {
    logUtilityError("Fuel price utility fetch error", error);
    if (cached) {
      return buildFuelPriceCard(cached.data, "cached", "Live update unavailable");
    }

    return buildFuelPriceCard(null, "error", "Live update unavailable");
  }
}
