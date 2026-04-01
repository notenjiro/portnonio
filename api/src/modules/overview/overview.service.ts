import {
  readBinanceHistory,
  readMarketHistory,
  readPortfolioCalendar
} from "../../storage/history.repository";

import { readStore } from "../../storage/store.repository";

import type {
  BinanceDailyHistoryRecord,
  MarketDailyHistoryRecord
} from "../../storage/history.types";

import type { OverviewResponse } from "./overview.types";

function getLatestBinanceRecord(
  records: BinanceDailyHistoryRecord[]
): BinanceDailyHistoryRecord | null {
  if (records.length === 0) return null;

  const sorted = [...records].sort((a, b) => {
    if (a.date === b.date) return a.updatedAt.localeCompare(b.updatedAt);
    return a.date.localeCompare(b.date);
  });

  return sorted[sorted.length - 1] ?? null;
}

function getLatestMarketRecords(
  records: MarketDailyHistoryRecord[]
): MarketDailyHistoryRecord[] {
  const latestByAsset = new Map<string, MarketDailyHistoryRecord>();

  const sorted = [...records].sort((a, b) => {
    if (a.date === b.date) return a.updatedAt.localeCompare(b.updatedAt);
    return a.date.localeCompare(b.date);
  });

  for (const record of sorted) {
    latestByAsset.set(record.assetId, record);
  }

  return [...latestByAsset.values()];
}

export async function getOverviewData(): Promise<OverviewResponse> {
  const [binanceHistory, marketHistory, calendarDays, store] = await Promise.all([
    readBinanceHistory(),
    readMarketHistory(),
    readPortfolioCalendar(),
    readStore()
  ]);

  const latestBinance = getLatestBinanceRecord(binanceHistory);
  const latestMarketRecords = getLatestMarketRecords(marketHistory);

  // 🔥 quantity map
  const quantityByAsset = new Map<string, number>();
  for (const link of store.accountAssetLinks ?? []) {
    quantityByAsset.set(link.assetId, link.quantity ?? 1);
  }

  // 🔥 FIX: quantity-aware stock value
  const stockTrackedUsd = Number(
    latestMarketRecords
      .reduce((sum, record) => {
        const qty = quantityByAsset.get(record.assetId) ?? 1;
        return sum + record.close * qty;
      }, 0)
      .toFixed(8)
  );

  const binanceTrackedUsd = latestBinance?.totalTrackedUsd ?? 0;

  const totalTrackedUsd = Number(
    (binanceTrackedUsd + stockTrackedUsd).toFixed(8)
  );

  const totalPnl = Number(
    calendarDays.reduce((sum, day) => sum + (day.totalPnl ?? 0), 0).toFixed(8)
  );

  const averagePnl =
    calendarDays.length > 0
      ? Number((totalPnl / calendarDays.length).toFixed(8))
      : null;

  return {
    asOf:
      latestBinance?.fetchedAt ??
      latestMarketRecords[latestMarketRecords.length - 1]?.updatedAt ??
      null,

    totals: {
      totalTrackedUsd,
      binanceTrackedUsd,
      stockTrackedUsd,
      fundTrackedUsd: 0,
      cashTrackedUsd: 0
    },

    binance: {
      spotValueUsd: latestBinance?.spotValueUsd ?? 0,
      futuresNotionalUsd: latestBinance?.futuresNotionalUsd ?? 0,
      futuresUnrealizedPnl: latestBinance?.futuresUnrealizedPnl ?? 0
    },

    calendar: {
      totalPnl,
      averagePnl,
      dayCount: calendarDays.length
    }
  };
}