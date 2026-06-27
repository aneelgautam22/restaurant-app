"use client";

import { useEffect, useState } from "react";
import { fetchHolidayUtility } from "@/services/holidays";
import {
  fetchFuelPriceUtility,
  fetchGoldPriceUtility,
  fetchWeatherUtility,
  getCurrentKathmanduHourOption,
  isWeatherHour,
  isWeatherCityName,
  WEATHER_CITY_OPTIONS,
  WEATHER_CITY_STORAGE_KEY,
  WEATHER_HOUR_OPTIONS,
  WEATHER_HOUR_STORAGE_KEY,
  type UtilityCardData,
  type WeatherCityName,
} from "@/lib/manage-utilities";

const loadingLine = "\u0932\u094b\u0921 \u0939\u0941\u0901\u0926\u0948\u091b...";

const initialUtilities: UtilityCardData[] = [
  {
    title: "Weather",
    lines: [loadingLine],
    status: "demo",
  },
  {
    title: "Gold Price",
    lines: [loadingLine],
    status: "demo",
  },
  {
    title: "Fuel Price",
    lines: [loadingLine],
    status: "demo",
  },
  {
    title: "Holidays",
    lines: [loadingLine],
    status: "demo",
  },
];

function getInitialWeatherCity(): WeatherCityName {
  if (typeof window === "undefined") return "Kathmandu";

  try {
    const savedCity = window.localStorage.getItem(WEATHER_CITY_STORAGE_KEY);
    return isWeatherCityName(savedCity) ? savedCity : "Kathmandu";
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Weather city read error", error);
    }
    return "Kathmandu";
  }
}

function saveWeatherCity(cityName: WeatherCityName) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WEATHER_CITY_STORAGE_KEY, cityName);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Weather city write error", error);
    }
  }
}

function getInitialWeatherHour() {
  if (typeof window === "undefined") return getCurrentKathmanduHourOption();

  try {
    const savedHour = window.localStorage.getItem(WEATHER_HOUR_STORAGE_KEY);
    return isWeatherHour(savedHour) ? savedHour : getCurrentKathmanduHourOption();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Weather hour read error", error);
    }
    return getCurrentKathmanduHourOption();
  }
}

function saveWeatherHour(hour: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WEATHER_HOUR_STORAGE_KEY, hour);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Weather hour write error", error);
    }
  }
}

function loadingWeatherCard(): UtilityCardData {
  return {
    title: "Weather",
    lines: [loadingLine],
    status: "demo",
  };
}

function mergeUtilityCards(currentCards: UtilityCardData[], nextCard: UtilityCardData) {
  return currentCards.map((card) => (card.title === nextCard.title ? nextCard : card));
}

function UtilityStatus({ utility }: { utility: UtilityCardData }) {
  const label = utility.statusLabel || (utility.status === "live" && utility.title !== "Weather" ? "Live" : null);

  if (!label && !utility.lastUpdated && !utility.source && !utility.error) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
      {label ? <span>{label}</span> : null}
      {utility.lastUpdated ? <span>Updated: {utility.lastUpdated}</span> : null}
      {utility.source ? <span>Source: {utility.source}</span> : null}
      {utility.error ? <span className="text-amber-600">{utility.error}</span> : null}
    </div>
  );
}

export default function ManageUtilities() {
  const [utilities, setUtilities] = useState<UtilityCardData[]>(initialUtilities);
  const [weatherCity, setWeatherCity] = useState<WeatherCityName>(getInitialWeatherCity);
  const [weatherHour, setWeatherHour] = useState(getInitialWeatherHour);

  function handleWeatherCityChange(value: string) {
    if (!isWeatherCityName(value)) return;
    setWeatherCity(value);
    setUtilities((currentCards) => mergeUtilityCards(currentCards, loadingWeatherCard()));
    saveWeatherCity(value);
  }

  function handleWeatherHourChange(value: string) {
    if (!isWeatherHour(value)) return;
    setWeatherHour(value);
    setUtilities((currentCards) => mergeUtilityCards(currentCards, loadingWeatherCard()));
    saveWeatherHour(value);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadLiveUtilities() {
      const results = await Promise.allSettled([
        fetchWeatherUtility(weatherCity, weatherHour),
        fetchGoldPriceUtility(),
        fetchFuelPriceUtility(),
        fetchHolidayUtility(),
      ]);

      if (cancelled) return;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          setUtilities((currentCards) => mergeUtilityCards(currentCards, result.value));
        }
      });
    }

    loadLiveUtilities();

    return () => {
      cancelled = true;
    };
  }, [weatherCity, weatherHour]);

  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_12px_34px_rgba(15,23,42,0.045)] lg:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          Utilities
        </h3>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-100">
          {utilities.length}
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {utilities.map((utility) => (
          <article
            key={utility.title}
            className="rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.025)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="truncate text-[13px] font-black leading-tight tracking-tight text-slate-950 lg:text-[14px]">
                {utility.title}
              </h4>
              {utility.title === "Weather" ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <select
                    value={weatherCity}
                    onChange={(event) => handleWeatherCityChange(event.target.value)}
                    className="max-w-[112px] rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-700 outline-none focus:border-slate-300"
                    aria-label="Select weather city"
                  >
                    {WEATHER_CITY_OPTIONS.map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={weatherHour}
                    onChange={(event) => handleWeatherHourChange(event.target.value)}
                    className="max-w-[82px] rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-700 outline-none focus:border-slate-300"
                    aria-label="Select weather hour"
                  >
                    {WEATHER_HOUR_OPTIONS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="space-y-1 text-[12px] font-semibold leading-snug text-slate-600">
              {utility.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <UtilityStatus utility={utility} />
          </article>
        ))}
      </div>
    </section>
  );
}
