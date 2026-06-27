const BS_MONTH_NAMES_NP = [
  "बैशाख",
  "जेठ",
  "असार",
  "श्रावण",
  "भदौ",
  "आश्विन",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फाल्गुन",
  "चैत्र",
];

const WEEKDAY_NAMES_NP = [
  "आइतबार",
  "सोमबार",
  "मंगलबार",
  "बुधबार",
  "बिहीबार",
  "शुक्रबार",
  "शनिबार",
];

const NEPALI_DIGITS: Record<string, string> = {
  "0": "०",
  "1": "१",
  "2": "२",
  "3": "३",
  "4": "४",
  "5": "५",
  "6": "६",
  "7": "७",
  "8": "८",
  "9": "९",
};

function toNepaliDigits(value: number | string) {
  return String(value).replace(/[0-9]/g, (digit) => NEPALI_DIGITS[digit] || digit);
}

function getNepalDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value || date.getFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value || date.getMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || date.getDate());

  return new Date(year, month - 1, day);
}

function getBsApproxParts(dateInput: Date) {
  const date = getNepalDate(dateInput);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const starts = [
    { month: 3, day: 14 },
    { month: 4, day: 15 },
    { month: 5, day: 15 },
    { month: 6, day: 17 },
    { month: 7, day: 17 },
    { month: 8, day: 17 },
    { month: 9, day: 18 },
    { month: 10, day: 17 },
    { month: 11, day: 16 },
    { month: 0, day: 15 },
    { month: 1, day: 13 },
    { month: 2, day: 15 },
  ];

  let bsYear = year + 57;
  if (month < 3 || (month === 3 && day < 14)) {
    bsYear = year + 56;
  }

  const candidates = starts.map((start, index) => {
    let startYear = year;
    if (index >= 9) {
      startYear = month <= 2 ? year : year + 1;
    }
    if (index === 0) {
      startYear = month < 3 || (month === 3 && day < 14) ? year - 1 : year;
    }

    return {
      index,
      date: new Date(startYear, start.month, start.day),
    };
  });

  let active = candidates[0];
  for (const candidate of candidates) {
    if (date >= candidate.date && candidate.date >= active.date) {
      active = candidate;
    }
  }

  const bsMonthIndex = active.index;
  if (bsMonthIndex >= 9 && !(month < 3 || (month === 3 && day < 14))) {
    bsYear += 1;
  }

  const diffMs = date.getTime() - active.date.getTime();
  const bsDay = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return {
    year: bsYear,
    monthName: BS_MONTH_NAMES_NP[bsMonthIndex],
    day: Math.max(bsDay, 1),
  };
}

function getAdLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getHeaderDateLabels(date = new Date()) {
  const nepalDate = getNepalDate(date);
  const bs = getBsApproxParts(nepalDate);
  const weekday = WEEKDAY_NAMES_NP[nepalDate.getDay()];
  const bsLabel = `${weekday}, ${toNepaliDigits(bs.day)} ${bs.monthName} ${toNepaliDigits(bs.year)}`;

  return {
    mainLabel: `${bsLabel} · ${getAdLabel(date)}`,
    note: "",
  };
}
