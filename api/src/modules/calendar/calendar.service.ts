import { ValidationError } from "../../shared/errors";
import { readPortfolioCalendar } from "../../storage/history.repository";
import { readStore } from "../../storage/store.repository";
import type { PortfolioCalendarDayRecord } from "../../storage/history.types";
import type { CalendarResponse, CalendarScope, CalendarSummary } from "./calendar.types";
import { convertAmount } from "../../services/fx-rate.service";

const BASE_CURRENCY = "THB";

function round(v: number) {
  return Number(v.toFixed(8));
}

/**
 * 🔥 GROUP REALIZED PNL BY DATE
 */
async function buildRealizedPnlByDate(store: any) {
  const map = new Map<string, number>();

  const txs = (store.transactions ?? []).sort((a: any, b: any) =>
    a.executedAt.localeCompare(b.executedAt)
  );

  let openQtyByAsset = new Map<string, number>();
  let openCostByAsset = new Map<string, number>();

  for (const tx of txs) {
    const assetId = tx.assetId;

    const qty = Number(tx.quantity ?? 0);
    if (!qty) continue;

    const priceBase = await convertAmount(
      tx.price,
      tx.currency,
      BASE_CURRENCY,
      tx.executedAt
    );

    const feeBase = await convertAmount(
      tx.fee ?? 0,
      tx.feeCurrency ?? tx.currency,
      BASE_CURRENCY,
      tx.executedAt
    );

    let openQty = openQtyByAsset.get(assetId) ?? 0;
    let openCost = openCostByAsset.get(assetId) ?? 0;

    if (tx.side === "buy") {
      openQty += qty;
      openCost += (priceBase * qty) + feeBase;
    }

    if (tx.side === "sell") {
      if (openQty <= 0) continue;

      const sellQty = Math.min(qty, openQty);
      const avgCost = openQty > 0 ? openCost / openQty : 0;

      const proceeds = (priceBase * sellQty) - feeBase;
      const costRemoved = avgCost * sellQty;

      const realized = proceeds - costRemoved;

      const date = tx.executedAt.slice(0, 10);

      map.set(date, round((map.get(date) ?? 0) + realized));

      openQty -= sellQty;
      openCost -= costRemoved;

      if (openQty <= 0.0000001) {
        openQty = 0;
        openCost = 0;
      }
    }

    openQtyByAsset.set(assetId, openQty);
    openCostByAsset.set(assetId, openCost);
  }

  return map;
}

function parsePnlValue(day: PortfolioCalendarDayRecord, scope: CalendarScope): number {
  if (scope === "stock") return day.stockPnl ?? 0;
  if (scope === "binance") return day.binancePnl ?? 0;
  return day.totalPnl ?? 0;
}

function filterDaysByScope(
  days: PortfolioCalendarDayRecord[],
  scope: CalendarScope
): PortfolioCalendarDayRecord[] {
  if (scope === "all") return days;
  if (scope === "binance") return days.filter((d) => d.binancePnl !== null);
  if (scope === "stock") return days.filter((d) => d.stockPnl !== null);
  return days;
}

function buildSummary(days: PortfolioCalendarDayRecord[], scope: CalendarScope): CalendarSummary {
  if (days.length === 0) {
    return {
      totalPnl: 0,
      averagePnl: null,
      dayCount: 0,
      bestDay: null,
      worstDay: null
    };
  }

  const totalPnl = round(
    days.reduce((sum, d) => sum + parsePnlValue(d, scope), 0)
  );

  const averagePnl = round(totalPnl / days.length);

  const sorted = [...days].sort(
    (a, b) => parsePnlValue(b, scope) - parsePnlValue(a, scope)
  );

  return {
    totalPnl,
    averagePnl,
    dayCount: days.length,
    bestDay: sorted[0] ?? null,
    worstDay: sorted[sorted.length - 1] ?? null
  };
}

export function parseCalendarScope(value: unknown): CalendarScope {
  if (value === undefined || value === "all") return "all";
  if (value === "binance" || value === "stock") return value;
  throw new ValidationError("Invalid calendar scope");
}

export async function getCalendarData(scope: CalendarScope): Promise<CalendarResponse> {
  const [days, store] = await Promise.all([
    readPortfolioCalendar(),
    readStore()
  ]);

  const realizedMap = await buildRealizedPnlByDate(store);

  /**
   * 🔥 merge realized pnl เข้า calendar
   */
  const enrichedDays = days.map((day) => {
    const realized = realizedMap.get(day.date) ?? 0;

    return {
      ...day,
      totalPnl: round((day.totalPnl ?? 0) + realized)
    };
  });

  const filtered = filterDaysByScope(enrichedDays, scope);

  const sorted: PortfolioCalendarDayRecord[] = [...filtered].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    scope,
    days: sorted,
    summary: buildSummary(sorted, scope)
  };
}