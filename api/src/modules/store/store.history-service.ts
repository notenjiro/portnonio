import {
  readBinanceHistory,
  readMarketHistory,
  writePortfolioCalendar,
  writePortfolioSnapshots
} from "../../storage/history.repository";
import { readStore } from "../../storage/store.repository";

import type {
  BinanceDailyHistoryRecord,
  MarketDailyHistoryRecord,
  PortfolioCalendarDayRecord,
  PortfolioSnapshotRecord
} from "../../storage/history.types";

import type { AccountAssetLinkRecord } from "../../storage/storage.types";

function nowIso(): string {
  return new Date().toISOString();
}

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

interface AggregatedBinanceDay {
  date: string;
  futuresUnrealizedPnl: number;
  totalTrackedUsd: number;
  createdAt: string;
}

function buildStockDailyPnlMap(
  marketHistory: MarketDailyHistoryRecord[],
  links: AccountAssetLinkRecord[]
): Map<string, number> {
  const byAsset = new Map<string, MarketDailyHistoryRecord[]>();

  for (const record of marketHistory) {
    const list = byAsset.get(record.assetId) ?? [];
    list.push(record);
    byAsset.set(record.assetId, list);
  }

  const quantityByAsset = new Map<string, number>();
  for (const link of links) {
    quantityByAsset.set(link.assetId, link.quantity ?? 1);
  }

  const stockPnlByDate = new Map<string, number>();

  for (const records of byAsset.values()) {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];

      if (!previous || !current) {
        continue;
      }

      const quantity = quantityByAsset.get(current.assetId) ?? 1;
      const delta = roundNumber((current.close - previous.close) * quantity);

      stockPnlByDate.set(
        current.date,
        roundNumber((stockPnlByDate.get(current.date) ?? 0) + delta)
      );
    }
  }

  return stockPnlByDate;
}

function aggregateBinanceHistoryByDate(
  records: BinanceDailyHistoryRecord[]
): Map<string, AggregatedBinanceDay> {
  const byDate = new Map<string, AggregatedBinanceDay>();

  const sorted = [...records].sort((a, b) => {
    if (a.date === b.date) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return a.date.localeCompare(b.date);
  });

  for (const record of sorted) {
    const existing = byDate.get(record.date);

    if (!existing) {
      byDate.set(record.date, {
        date: record.date,
        futuresUnrealizedPnl: roundNumber(record.futuresUnrealizedPnl),
        totalTrackedUsd: roundNumber(record.totalTrackedUsd),
        createdAt: record.createdAt
      });
      continue;
    }

    byDate.set(record.date, {
      date: record.date,
      futuresUnrealizedPnl: roundNumber(
        existing.futuresUnrealizedPnl + record.futuresUnrealizedPnl
      ),
      totalTrackedUsd: roundNumber(existing.totalTrackedUsd + record.totalTrackedUsd),
      createdAt: existing.createdAt <= record.createdAt ? existing.createdAt : record.createdAt
    });
  }

  return byDate;
}

export async function rebuildDerivedPortfolioViewsFromHistory(): Promise<{
  calendar: PortfolioCalendarDayRecord[];
  snapshots: PortfolioSnapshotRecord[];
}> {
  const [binanceHistory, marketHistory, store] = await Promise.all([
    readBinanceHistory(),
    readMarketHistory(),
    readStore()
  ]);

  const now = nowIso();
  const links = store.accountAssetLinks ?? [];

  const stockPnlByDate = buildStockDailyPnlMap(marketHistory, links);
  const aggregatedBinanceByDate = aggregateBinanceHistoryByDate(binanceHistory);

  const calendarByDate = new Map<string, PortfolioCalendarDayRecord>();

  // 1) วันที่มีข้อมูล Binance
  for (const binanceDay of aggregatedBinanceByDate.values()) {
    const stockPnl = stockPnlByDate.get(binanceDay.date) ?? null;

    const totalPnl = roundNumber(
      binanceDay.futuresUnrealizedPnl + (stockPnl ?? 0)
    );

    calendarByDate.set(binanceDay.date, {
      date: binanceDay.date,
      totalPnl,
      realizedPnl: null,
      unrealizedPnl: binanceDay.futuresUnrealizedPnl,
      binancePnl: binanceDay.futuresUnrealizedPnl,
      stockPnl,
      endValueUsd: binanceDay.totalTrackedUsd,
      hasData: true,
      createdAt: binanceDay.createdAt ?? now,
      updatedAt: now
    });
  }

  // 2) วันที่มีเฉพาะ stock
  for (const [date, stockPnl] of stockPnlByDate.entries()) {
    if (calendarByDate.has(date)) {
      continue;
    }

    calendarByDate.set(date, {
      date,
      totalPnl: stockPnl,
      realizedPnl: null,
      unrealizedPnl: null,
      binancePnl: null,
      stockPnl,
      endValueUsd: null,
      hasData: true,
      createdAt: now,
      updatedAt: now
    });
  }

  const calendar: PortfolioCalendarDayRecord[] = [...calendarByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // latest market per asset
  const latestMarketByAsset = new Map<string, MarketDailyHistoryRecord>();
  const sortedMarket = [...marketHistory].sort((a, b) => {
    if (a.date === b.date) {
      return a.updatedAt.localeCompare(b.updatedAt);
    }
    return a.date.localeCompare(b.date);
  });

  for (const record of sortedMarket) {
    latestMarketByAsset.set(record.assetId, record);
  }

  const quantityByAsset = new Map<string, number>();
  for (const link of links) {
    quantityByAsset.set(link.assetId, link.quantity ?? 1);
  }

  const stockValueUsd = roundNumber(
    [...latestMarketByAsset.values()].reduce((sum, record) => {
      const qty = quantityByAsset.get(record.assetId) ?? 1;
      return sum + record.close * qty;
    }, 0)
  );

  const snapshots: PortfolioSnapshotRecord[] = calendar.map((day) => {
    const aggregatedBinanceDay = aggregatedBinanceByDate.get(day.date) ?? null;
    const binanceValueUsd = aggregatedBinanceDay?.totalTrackedUsd ?? 0;
    const totalValueUsd = roundNumber(binanceValueUsd + stockValueUsd);

    return {
      date: day.date,
      totalValueUsd,
      binanceValueUsd,
      stockValueUsd,
      fundValueUsd: 0,
      cashValueUsd: 0,
      totalPnlUsd: day.totalPnl,
      createdAt: day.createdAt ?? now,
      updatedAt: now
    };
  });

  await writePortfolioCalendar(calendar);
  await writePortfolioSnapshots(snapshots);

  return {
    calendar,
    snapshots
  };
}