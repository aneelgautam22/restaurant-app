import { NextResponse } from "next/server";

const FENEGOSIDA_URL = "https://www.fenegosida.org/";
const REQUEST_TIMEOUT_MS = 7000;
const NEPALI_DIGITS = "\u0966\u0967\u0968\u0969\u096a\u096b\u096c\u096d\u096e\u096f";

function normalizeNumber(value: string) {
  const normalizedDigits = value.replace(/[\u0966-\u096f]/g, (digit) => String(NEPALI_DIGITS.indexOf(digit)));
  const parsed = Number(normalizedDigits.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getCompactText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type MetalPriceMatch = {
  rawText: string | null;
  value: number | null;
};

function extractMetalTolaPrice(compactText: string, metalPattern: string): MetalPriceMatch {
  const numberPattern = "([0-9.,\\u0966-\\u096f]+)";
  const metalBoundaryPattern = /(FINE\s+GOLD\s*\(9999\)|TEJABI\s+GOLD|SILVER)/gi;
  const metalMatches = Array.from(compactText.matchAll(new RegExp(metalPattern, "gi")));

  for (const metalMatch of metalMatches) {
    const startIndex = metalMatch.index ?? -1;
    if (startIndex < 0) continue;

    metalBoundaryPattern.lastIndex = startIndex + metalMatch[0].length;
    const nextMetalMatch = metalBoundaryPattern.exec(compactText);
    const endIndex = nextMetalMatch?.index ?? compactText.length;
    const segment = compactText.slice(startIndex, endIndex);
    const tolaPatterns = [
      new RegExp(`per\\s+(?:1\\s+)?tola[\\s\\S]{0,100}?${numberPattern}`, "i"),
      new RegExp(`\\btola\\b[\\s\\S]{0,80}?${numberPattern}`, "i"),
    ];

    for (const pattern of tolaPatterns) {
      const match = segment.match(pattern);
      if (!match) continue;

      return {
        rawText: segment.trim(),
        value: normalizeNumber(match[1]),
      };
    }
  }

  return { rawText: null, value: null };
}

function extractFineGoldTolaPrice(compactText: string) {
  return extractMetalTolaPrice(compactText, "FINE\\s+GOLD\\s*\\(9999\\)");
}

function extractSilverTolaPrice(compactText: string) {
  return extractMetalTolaPrice(compactText, "SILVER");
}

function extractPrices(html: string) {
  const compactText = html
    ? getCompactText(html)
    : "";
  const gold = extractFineGoldTolaPrice(compactText);
  const silver = extractSilverTolaPrice(compactText);

  console.info("Gold price parser match", {
    rawGoldText: gold.rawText,
    rawSilverText: silver.rawText,
    parsedGoldValue: gold.value,
    parsedSilverValue: silver.value,
  });

  return {
    goldRawText: gold.rawText,
    silverRawText: silver.rawText,
    goldPricePerTola: gold.value,
    silverPricePerTola: silver.value,
  };
}

function getKathmanduTimeLabel() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kathmandu",
  });
}

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FENEGOSIDA_URL, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 RestaurantAppUtilities/1.0",
      },
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "FENEGOSIDA fetch failed" }, { status: 502 });
    }

    const html = await response.text();
    const { goldRawText, silverRawText, goldPricePerTola, silverPricePerTola } = extractPrices(html);

    if (!goldPricePerTola) {
      return NextResponse.json({ error: "Gold price not found" }, { status: 502 });
    }

    return NextResponse.json({
      goldPricePerTola,
      silverPricePerTola,
      currency: "NPR",
      unit: "tola",
      source: "FENEGOSIDA",
      updatedAt: getKathmanduTimeLabel(),
    });
  } catch (error) {
    console.warn("Gold price proxy failed", error);
    return NextResponse.json({ error: "Gold price unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
