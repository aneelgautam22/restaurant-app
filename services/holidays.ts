import type { UtilityCardData } from "@/lib/manage-utilities";

type HolidayItem = {
  date: string;
  name: string;
};

type HolidayCache = {
  savedAt: number;
  data: UtilityCardData;
};

const HOLIDAY_CACHE_KEY = "manageUtilities:holidays:nepal:2083:v1";
const HOLIDAY_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

const NEPAL_HOLIDAYS_2083: HolidayItem[] = [
  { date: "2026-04-14", name: "\u0928\u0947\u092a\u093e\u0932\u0940 \u0928\u092f\u093e\u0901 \u0935\u0930\u094d\u0937" },
  { date: "2026-04-22", name: "\u0932\u094b\u0915\u0924\u0928\u094d\u0924\u094d\u0930 \u0926\u093f\u0935\u0938" },
  { date: "2026-05-01", name: "\u092e\u091c\u0926\u0941\u0930 \u0926\u093f\u0935\u0938" },
  { date: "2026-05-01", name: "\u092c\u0941\u0926\u094d\u0927 \u091c\u092f\u0928\u094d\u0924\u0940" },
  { date: "2026-05-27", name: "\u0907\u0926 \u0909\u0932 \u0905\u091c\u0939\u093e" },
  { date: "2026-05-29", name: "\u0917\u0923\u0924\u0928\u094d\u0924\u094d\u0930 \u0926\u093f\u0935\u0938" },
  { date: "2026-08-28", name: "\u0930\u0915\u094d\u0937\u093e \u092c\u0928\u094d\u0927\u0928" },
  { date: "2026-08-29", name: "\u0917\u093e\u0908 \u091c\u093e\u0924\u094d\u0930\u093e" },
  { date: "2026-09-04", name: "\u0917\u094c\u0930\u093e \u092a\u0930\u094d\u0935" },
  { date: "2026-09-04", name: "\u0915\u0943\u0937\u094d\u0923 \u091c\u0928\u094d\u092e\u093e\u0937\u094d\u091f\u092e\u0940" },
  { date: "2026-09-14", name: "\u0924\u0940\u091c" },
  { date: "2026-09-16", name: "\u090b\u0937\u093f \u092a\u091e\u094d\u091a\u092e\u0940" },
  { date: "2026-09-19", name: "\u0938\u0902\u0935\u093f\u0927\u093e\u0928 \u0926\u093f\u0935\u0938" },
  { date: "2026-09-25", name: "\u0907\u0928\u094d\u0926\u094d\u0930 \u091c\u093e\u0924\u094d\u0930\u093e" },
  { date: "2026-10-11", name: "\u0918\u091f\u0938\u094d\u0925\u093e\u092a\u0928\u093e" },
  { date: "2026-10-20", name: "\u0935\u093f\u091c\u092f\u093e\u0926\u0936\u092e\u0940" },
  { date: "2026-10-22", name: "\u090f\u0915\u093e\u0926\u0936\u0940" },
  { date: "2026-10-23", name: "\u0926\u094d\u0935\u093e\u0926\u0936\u0940" },
  { date: "2026-10-24", name: "\u0915\u094b\u091c\u093e\u0917\u094d\u0930\u0924 \u092a\u0942\u0930\u094d\u0923\u093f\u092e\u093e" },
  { date: "2026-11-08", name: "\u0932\u0915\u094d\u0937\u094d\u092e\u0940 \u092a\u0942\u091c\u093e" },
  { date: "2026-11-10", name: "\u0917\u094b\u0935\u0930\u094d\u0927\u0928 \u092a\u0942\u091c\u093e" },
  { date: "2026-11-11", name: "\u092d\u093e\u0908 \u091f\u0940\u0915\u093e" },
  { date: "2026-11-15", name: "\u091b\u0920 \u092a\u0942\u091c\u093e" },
  { date: "2026-11-24", name: "\u0917\u0941\u0930\u0941 \u0928\u093e\u0928\u0915 \u091c\u092f\u0928\u094d\u0924\u0940" },
  { date: "2026-12-24", name: "\u0909\u0927\u094c\u0932\u0940 \u092a\u0930\u094d\u0935" },
  { date: "2026-12-25", name: "\u0915\u094d\u0930\u093f\u0938\u092e\u0938" },
  { date: "2026-12-30", name: "\u0924\u092e\u0941 \u0932\u094d\u0939\u094b\u0938\u093e\u0930" },
  { date: "2027-01-11", name: "\u092a\u0943\u0925\u094d\u0935\u0940 \u091c\u092f\u0928\u094d\u0924\u0940" },
  { date: "2027-01-14", name: "\u092e\u093e\u0918\u0947 \u0938\u0902\u0915\u094d\u0930\u093e\u0928\u094d\u0924\u093f" },
  { date: "2027-01-30", name: "\u0936\u0939\u093f\u0926 \u0926\u093f\u0935\u0938" },
  { date: "2027-02-15", name: "\u092e\u0939\u093e \u0936\u093f\u0935\u0930\u093e\u0924\u094d\u0930\u0940" },
  { date: "2027-02-19", name: "\u092a\u094d\u0930\u091c\u093e\u0924\u0928\u094d\u0924\u094d\u0930 \u0926\u093f\u0935\u0938" },
  { date: "2027-03-08", name: "\u0928\u093e\u0930\u0940 \u0926\u093f\u0935\u0938" },
  { date: "2027-03-18", name: "\u0918\u094b\u0921\u0947 \u091c\u093e\u0924\u094d\u0930\u093e" },
  { date: "2027-03-21", name: "\u0930\u092e\u091c\u093e\u0928 \u0908\u0926" },
  { date: "2027-03-27", name: "\u0930\u093e\u092e \u0928\u0935\u092e\u0940" },
];

function getKathmanduDateIso() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00+05:45`).toLocaleDateString("ne-NP", {
    month: "short",
    day: "numeric",
  });
}

function readHolidayCache() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(HOLIDAY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HolidayCache;
    if (!parsed || typeof parsed.savedAt !== "number" || !parsed.data) return null;
    if (Date.now() - parsed.savedAt > HOLIDAY_CACHE_MS) return null;
    return parsed.data;
  } catch (error) {
    console.warn("Failed to read holiday cache", error);
    return null;
  }
}

function writeHolidayCache(data: UtilityCardData) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (error) {
    console.warn("Failed to write holiday cache", error);
  }
}

function buildHolidayCard(todayIso: string): UtilityCardData {
  const todayHolidays = NEPAL_HOLIDAYS_2083.filter((holiday) => holiday.date === todayIso);
  const nextHoliday = NEPAL_HOLIDAYS_2083.find((holiday) => holiday.date > todayIso);

  if (!todayHolidays.length && !nextHoliday) {
    return {
      title: "Holidays",
      lines: ["\u092c\u093f\u0926\u093e\u0915\u094b \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u0909\u092a\u0932\u092c\u094d\u0927 \u091b\u0948\u0928\u0964"],
      status: "error",
    };
  }

  if (todayHolidays.length) {
    const nextAfterToday = NEPAL_HOLIDAYS_2083.find((holiday) => holiday.date > todayIso);
    return {
      title: "Holidays",
      lines: [
        "\u0906\u091c \u0938\u093e\u0930\u094d\u0935\u091c\u0928\u093f\u0915 \u092c\u093f\u0926\u093e \u091b\u0964",
        todayHolidays.map((holiday) => holiday.name).join(", "),
        ...(nextAfterToday ? [`Next: ${nextAfterToday.name} \u2014 ${formatDisplayDate(nextAfterToday.date)}`] : []),
      ],
      status: "cached",
      statusLabel: "Static Data",
    };
  }

  if (!nextHoliday) {
    return {
      title: "Holidays",
      lines: ["\u092c\u093f\u0926\u093e\u0915\u094b \u091c\u093e\u0928\u0915\u093e\u0930\u0940 \u0909\u092a\u0932\u092c\u094d\u0927 \u091b\u0948\u0928\u0964"],
      status: "error",
    };
  }

  return {
    title: "Holidays",
    lines: [
      "\u0906\u091c \u0915\u0941\u0928\u0948 \u0938\u093e\u0930\u094d\u0935\u091c\u0928\u093f\u0915 \u092c\u093f\u0926\u093e \u091b\u0948\u0928\u0964",
      `Next: ${nextHoliday.name} \u2014 ${formatDisplayDate(nextHoliday.date)}`,
    ],
    status: "cached",
    statusLabel: "Static Data",
  };
}

export async function fetchHolidayUtility(): Promise<UtilityCardData> {
  const cached = readHolidayCache();
  if (cached) return cached;

  const card = buildHolidayCard(getKathmanduDateIso());
  writeHolidayCache(card);
  return card;
}