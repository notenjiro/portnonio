import { getTwelveDataQuote } from "../providers/twelvedata.adapter";
import { readFxHistory, writeFxHistory } from "../storage/history.repository";
import type { FxDailyRateRecord } from "../storage/history.types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

/**
 * Core: THB -> USD (existing behavior, preserved)
 */
export async function getFxRateTHBUSD(date?: string): Promise<number> {
  const targetDate = date ?? today();
  const history = await readFxHistory();

  const existing = history.find(
    (r) => r.date === targetDate && r.base === "THB" && r.quote === "USD"
  );

  if (existing) {
    return existing.rate;
  }

  try {
    const quote = await getTwelveDataQuote("USD/THB");
    const close = Number(quote?.close);

    if (!Number.isFinite(close) || close <= 0) {
      throw new Error("Invalid Twelve Data close price for symbol USD/THB");
    }

    // USD/THB = 35 => THB/USD = 1/35
    const rate = roundNumber(1 / close);
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
  } catch {
    const fallback = [...history]
      .filter((r) => r.base === "THB" && r.quote === "USD")
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (fallback) {
      return fallback.rate;
    }

    // hard fallback (last resort)
    return 0.027;
  }
}

/**
 * Generic FX rate (extendable)
 * Currently supports:
 * - THB -> USD
 * - USD -> THB (inverse)
 */
export async function getFxRate(
  from: string,
  to: string,
  date?: string
): Promise<number> {
  const base = from.toUpperCase();
  const quote = to.toUpperCase();

  if (base === quote) return 1;

  // THB -> USD
  if (base === "THB" && quote === "USD") {
    return getFxRateTHBUSD(date);
  }

  // USD -> THB (inverse)
  if (base === "USD" && quote === "THB") {
    const rate = await getFxRateTHBUSD(date);
    return rate > 0 ? roundNumber(1 / rate) : 0;
  }

  throw new Error(`FX pair not supported yet: ${base}/${quote}`);
}

/**
 * Convert amount between currencies
 */
export async function convertAmount(
  amount: number,
  from: string,
  to: string,
  date?: string
): Promise<number> {
  if (!Number.isFinite(amount)) return 0;

  const rate = await getFxRate(from, to, date);
  return roundNumber(amount * rate);
}