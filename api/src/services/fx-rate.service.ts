import { getTwelveDataQuote } from "../providers/twelvedata.adapter";
import { readFxHistory, writeFxHistory } from "../storage/history.repository";
import type { FxDailyRateRecord } from "../storage/history.types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

// 🔥 THB -> USD
export async function getFxRateTHBUSD(date?: string): Promise<number> {
  const targetDate = date ?? today();

  const history = await readFxHistory();

  const existing = history.find(
    (r) => r.date === targetDate && r.base === "THB" && r.quote === "USD"
  );

  if (existing) {
    return existing.rate;
  }

  // fallback: fetch live
  const quote = await getTwelveDataQuote("USD/THB");

  // USD/THB = 36.5 → THB/USD = 1 / 36.5
  const rate = roundNumber(1 / quote.close);

  const nowIso = new Date().toISOString();

  const record: FxDailyRateRecord = {
    date: targetDate,
    base: "THB",
    quote: "USD",
    rate,
    source: "twelvedata",
    createdAt: nowIso,
    updatedAt: nowIso
  };

  history.push(record);

  history.sort((a, b) => a.date.localeCompare(b.date));

  await writeFxHistory(history);

  return rate;
}