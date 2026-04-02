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

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

function getLatestBinanceDate(records: BinanceDailyHistoryRecord[]): string | null {
  if (records.length === 0) {
    return null;
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1]?.date ?? null;
}

function aggregateLatestBinanceDay(records: BinanceDailyHistoryRecord[]): {
  date: string | null;
  fetchedAt: string | null;
  totalTrackedUsd: number;
  spotValueUsd: number;
  futuresNotionalUsd: number;
  futuresUnrealizedPnl: number;
} {
  const latestDate = getLatestBinanceDate(records);

  if (!latestDate) {
    return {
      date: null,
      fetchedAt: null,
      totalTrackedUsd: 0,
      spotValueUsd: 0,
      futuresNotionalUsd: 0,
      futuresUnrealizedPnl: 0
    };
  }

  const sameDay = records.filter((record) => record.date === latestDate);

  const fetchedAt =
    [...sameDay]
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .at(-1)?.fetchedAt ?? null;

  return {
    date: latestDate,
    fetchedAt,
    totalTrackedUsd: roundNumber(
      sameDay.reduce((sum, record) => sum + record.totalTrackedUsd, 0)
    ),
    spotValueUsd: roundNumber(
      sameDay.reduce((sum, record) => sum + record.spotValueUsd, 0)
    ),
    futuresNotionalUsd: roundNumber(
      sameDay.reduce((sum, record) => sum + record.futuresNotionalUsd, 0)
    ),
    futuresUnrealizedPnl: roundNumber(
      sameDay.reduce((sum, record) => sum + record.futuresUnrealizedPnl, 0)
    )
  };
}

function getLatestMarketRecords(
  records: MarketDailyHistoryRecord[]
): MarketDailyHistoryRecord[] {
  const latestByAsset = new Map<string, MarketDailyHistoryRecord>();

  const sorted = [...records].sort((a, b) => {
    if (a.date === b.date) {
      return a.updatedAt.localeCompare(b.updatedAt);
    }

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

  const latestBinance = aggregateLatestBinanceDay(binanceHistory);
  const latestMarketRecords = getLatestMarketRecords(marketHistory);

  const quantityByAsset = new Map<string, number>();
  for (const link of store.accountAssetLinks ?? []) {
    quantityByAsset.set(link.assetId, link.quantity ?? 1);
  }

  const stockTrackedUsd = roundNumber(
    latestMarketRecords.reduce((sum, record) => {
      const qty = quantityByAsset.get(record.assetId) ?? 1;
      return sum + record.close * qty;
    }, 0)
  );

  const binanceTrackedUsd = latestBinance.totalTrackedUsd;
  const totalTrackedUsd = roundNumber(binanceTrackedUsd + stockTrackedUsd);

  const totalPnl = roundNumber(
    calendarDays.reduce((sum, day) => sum + (day.totalPnl ?? 0), 0)
  );

  const averagePnl =
    calendarDays.length > 0
      ? roundNumber(totalPnl / calendarDays.length)
      : null;

  return {
    asOf:
      latestBinance.fetchedAt ??
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
      spotValueUsd: latestBinance.spotValueUsd,
      futuresNotionalUsd: latestBinance.futuresNotionalUsd,
      futuresUnrealizedPnl: latestBinance.futuresUnrealizedPnl
    },
    calendar: {
      totalPnl,
      averagePnl,
      dayCount: calendarDays.length
    }
  };
}