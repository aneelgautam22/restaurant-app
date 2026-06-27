import { NextResponse } from "next/server";

const NOC_URL = "https://noc.org.np/";
const REQUEST_TIMEOUT_MS = 7000;

function normalizeNumber(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractFuelPrices(html: string) {
  const compactText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const kathmanduSection = compactText.match(/\(Kathmandu,\s*Pokhara,\s*Dipayal\)[\s\S]{0,420}?(?=\(Price applicable|Nepal Oil Corporation|$)/i)?.[0] || compactText;
  const petrolMatch = kathmanduSection.match(/Petrol\(MS\)\s*:\s*NRs\s*([0-9.]+)\s*\/\s*L/i);
  const dieselMatch = kathmanduSection.match(/Diesel\(HSD\)\s*:\s*NRs\s*([0-9.]+)\s*\/\s*L/i);
  const petrol = petrolMatch ? normalizeNumber(petrolMatch[1]) : null;
  const diesel = dieselMatch ? normalizeNumber(dieselMatch[1]) : null;

  if (!petrol || !diesel) return null;

  return { petrol, diesel };
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
    const response = await fetch(NOC_URL, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 RestaurantAppUtilities/1.0",
      },
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "NOC fetch failed" }, { status: 502 });
    }

    const html = await response.text();
    const prices = extractFuelPrices(html);

    if (!prices) {
      return NextResponse.json({ error: "Fuel price not found" }, { status: 502 });
    }

    return NextResponse.json({
      petrol: prices.petrol,
      diesel: prices.diesel,
      currency: "NPR",
      unit: "liter",
      source: "Nepal Oil Corporation",
      updatedAt: getKathmanduTimeLabel(),
    });
  } catch (error) {
    console.warn("Fuel price proxy failed", error);
    return NextResponse.json({ error: "Fuel price unavailable" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}