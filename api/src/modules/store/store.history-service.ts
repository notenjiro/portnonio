import {
  readBinanceHistory,
  readMarketHistory,
  readFundHistory,
  writePortfolioCalendar,
  writePortfolioSnapshots,
} from "../../storage/history.repository";

import { readStore } from "../../storage/store.repository";

import type {
  BinanceDailyHistoryRecord,
  MarketDailyHistoryRecord,
  FundDailyHistoryRecord,
  PortfolioCalendarDayRecord,
  PortfolioSnapshotRecord,
} from "../../storage/history.types";

import type { AccountAssetLinkRecord } from "../../storage/storage.types";

import { getFxRateTHBUSD } from "../../services/fx-rate.service";

function nowIso(): string {
  return new Date().toISOString();
}

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

interface AggregatedBinanceDay {
  date: string;
  futuresUnrealizedPnl: number;
  realizedPnl: number;
  totalTrackedUsd: number;
  hasSnapshotData: boolean;
  createdAt: string;
}

function buildQuantityByAsset(
  links: AccountAssetLinkRecord[],
): Map<string, number> {
  const quantityByAsset = new Map<string, number>();

  for (const link of links) {
    quantityByAsset.set(link.assetId, link.quantity ?? 1);
  }

  return quantityByAsset;
}

function buildStockDailyPnlMap(
  marketHistory: MarketDailyHistoryRecord[],
  quantityByAsset: Map<string, number>,
): Map<string, number> {
  const byAsset = new Map<string, MarketDailyHistoryRecord[]>();

  for (const record of marketHistory) {
    if (!quantityByAsset.has(record.assetId)) {
      continue;
    }

    const list = byAsset.get(record.assetId) ?? [];
    list.push(record);
    byAsset.set(record.assetId, list);
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

      const quantity = quantityByAsset.get(current.assetId);

      if (quantity === undefined) {
        continue;
      }

      const delta = roundNumber((current.close - previous.close) * quantity);

      stockPnlByDate.set(
        current.date,
        roundNumber((stockPnlByDate.get(current.date) ?? 0) + delta),
      );
    }
  }

  return stockPnlByDate;
}

async function buildFundDailyPnlMap(
  fundHistory: FundDailyHistoryRecord[],
  quantityByAsset: Map<string, number>,
): Promise<Map<string, number>> {
  const byAsset = new Map<string, FundDailyHistoryRecord[]>();

  for (const record of fundHistory) {
    if (!quantityByAsset.has(record.assetId)) {
      continue;
    }

    const list = byAsset.get(record.assetId) ?? [];
    list.push(record);
    byAsset.set(record.assetId, list);
  }

  const fxRateCache = new Map<string, number>();
  const fundPnlByDate = new Map<string, number>();

  async function getUsdValue(record: FundDailyHistoryRecord): Promise<number> {
    const quantity = quantityByAsset.get(record.assetId);

    if (quantity === undefined) {
      return 0;
    }

    let unitValueUsd = record.nav;

    if (record.currency === "THB") {
      let rate = fxRateCache.get(record.date);

      if (rate === undefined) {
        rate = await getFxRateTHBUSD(record.date);
        fxRateCache.set(record.date, rate);
      }

      unitValueUsd = record.nav * rate;
    }

    return roundNumber(unitValueUsd * quantity);
  }

  for (const records of byAsset.values()) {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];

      if (!previous || !current) {
        continue;
      }

      const previousUsd = await getUsdValue(previous);
      const currentUsd = await getUsdValue(current);
      const delta = roundNumber(currentUsd - previousUsd);

      fundPnlByDate.set(
        current.date,
        roundNumber((fundPnlByDate.get(current.date) ?? 0) + delta),
      );
    }
  }

  return fundPnlByDate;
}

function aggregateBinanceHistoryByDate(
  records: BinanceDailyHistoryRecord[],
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

    const recordHasSnapshotData =
      (record.spotValueUsd ?? 0) !== 0 ||
      (record.futuresNotionalUsd ?? 0) !== 0 ||
      (record.totalTrackedUsd ?? 0) !== 0 ||
      (record.futuresUnrealizedPnl ?? 0) !== 0;

    if (!existing) {
      byDate.set(record.date, {
        date: record.date,
        futuresUnrealizedPnl: roundNumber(record.futuresUnrealizedPnl ?? 0),
        realizedPnl: roundNumber(record.netRealizedPnl ?? 0),
        totalTrackedUsd: roundNumber(record.totalTrackedUsd ?? 0),
        hasSnapshotData: recordHasSnapshotData,
        createdAt: record.createdAt,
      });
      continue;
    }

    byDate.set(record.date, {
      date: record.date,
      futuresUnrealizedPnl: roundNumber(
        existing.futuresUnrealizedPnl + (record.futuresUnrealizedPnl ?? 0),
      ),
      realizedPnl: roundNumber(
        existing.realizedPnl + (record.netRealizedPnl ?? 0),
      ),
      totalTrackedUsd: roundNumber(
        existing.totalTrackedUsd + (record.totalTrackedUsd ?? 0),
      ),
      hasSnapshotData: existing.hasSnapshotData || recordHasSnapshotData,
      createdAt:
        existing.createdAt <= record.createdAt
          ? existing.createdAt
          : record.createdAt,
    });
  }

  return byDate;
}

function getAllCalendarDates(
  aggregatedBinanceByDate: Map<string, AggregatedBinanceDay>,
  stockPnlByDate: Map<string, number>,
  fundPnlByDate: Map<string, number>,
): string[] {
  const allDates = new Set<string>();

  for (const date of aggregatedBinanceByDate.keys()) {
    allDates.add(date);
  }

  for (const date of stockPnlByDate.keys()) {
    allDates.add(date);
  }

  for (const date of fundPnlByDate.keys()) {
    allDates.add(date);
  }

  return [...allDates].sort((a, b) => a.localeCompare(b));
}

function buildStockDailyValueMap(
  marketHistory: MarketDailyHistoryRecord[],
  quantityByAsset: Map<string, number>,
  calendarDates: string[],
): Map<string, number> {
  const byAsset = new Map<string, MarketDailyHistoryRecord[]>();

  for (const record of marketHistory) {
    if (!quantityByAsset.has(record.assetId)) {
      continue;
    }

    const list = byAsset.get(record.assetId) ?? [];
    list.push(record);
    byAsset.set(record.assetId, list);
  }

  const stockValueByDate = new Map<string, number>();

  for (const records of byAsset.values()) {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    let pointer = 0;
    let latestValue = 0;

    for (const date of calendarDates) {
      while (pointer < sorted.length) {
        const record = sorted[pointer];

        if (!record || record.date > date) {
          break;
        }

        const quantity = quantityByAsset.get(record.assetId);

        if (quantity !== undefined) {
          latestValue = roundNumber(record.close * quantity);
        }

        pointer += 1;
      }

      stockValueByDate.set(
        date,
        roundNumber((stockValueByDate.get(date) ?? 0) + latestValue),
      );
    }
  }

  return stockValueByDate;
}

async function buildFundDailyValueMap(
  fundHistory: FundDailyHistoryRecord[],
  quantityByAsset: Map<string, number>,
  calendarDates: string[],
): Promise<Map<string, number>> {
  const byAsset = new Map<string, FundDailyHistoryRecord[]>();

  for (const record of fundHistory) {
    if (!quantityByAsset.has(record.assetId)) {
      continue;
    }

    const list = byAsset.get(record.assetId) ?? [];
    list.push(record);
    byAsset.set(record.assetId, list);
  }

  const fxRateCache = new Map<string, number>();
  const fundValueByDate = new Map<string, number>();

  async function getUsdValue(record: FundDailyHistoryRecord): Promise<number> {
    const quantity = quantityByAsset.get(record.assetId);

    if (quantity === undefined) {
      return 0;
    }

    let unitValueUsd = record.nav;

    if (record.currency === "THB") {
      let rate = fxRateCache.get(record.date);

      if (rate === undefined) {
        rate = await getFxRateTHBUSD(record.date);
        fxRateCache.set(record.date, rate);
      }

      unitValueUsd = record.nav * rate;
    }

    return roundNumber(unitValueUsd * quantity);
  }

  for (const records of byAsset.values()) {
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    let pointer = 0;
    let latestValue = 0;

    for (const date of calendarDates) {
      while (pointer < sorted.length) {
        const rec = sorted[pointer];

        if (!rec || rec.date > date) {
          break;
        }

        latestValue = await getUsdValue(rec);
        pointer += 1;
      }

      fundValueByDate.set(
        date,
        roundNumber((fundValueByDate.get(date) ?? 0) + latestValue),
      );
    }
  }

  return fundValueByDate;
}

export async function rebuildDerivedPortfolioViewsFromHistory(): Promise<{
  calendar: PortfolioCalendarDayRecord[];
  snapshots: PortfolioSnapshotRecord[];
}> {
  const [binanceHistory, marketHistory, fundHistory, store] = await Promise.all([
    readBinanceHistory(),
    readMarketHistory(),
    readFundHistory(),
    readStore(),
  ]);

  const now = nowIso();
  const links = store.accountAssetLinks ?? [];
  const quantityByAsset = buildQuantityByAsset(links);

  const stockPnlByDate = buildStockDailyPnlMap(marketHistory, quantityByAsset);
  const fundPnlByDate = await buildFundDailyPnlMap(fundHistory, quantityByAsset);
  const aggregatedBinanceByDate = aggregateBinanceHistoryByDate(binanceHistory);

  const calendarDates = getAllCalendarDates(
    aggregatedBinanceByDate,
    stockPnlByDate,
    fundPnlByDate,
  );

  const stockValueByDate = buildStockDailyValueMap(
    marketHistory,
    quantityByAsset,
    calendarDates,
  );

  const fundValueByDate = await buildFundDailyValueMap(
    fundHistory,
    quantityByAsset,
    calendarDates,
  );

  const calendarByDate = new Map<string, PortfolioCalendarDayRecord>();
  let latestBinanceTrackedValue = 0;

  for (const date of calendarDates) {
    const binanceDay = aggregatedBinanceByDate.get(date) ?? null;
    const stockPnl = stockPnlByDate.get(date) ?? null;
    const fundPnl = fundPnlByDate.get(date) ?? null;

    const realizedPnl = binanceDay ? roundNumber(binanceDay.realizedPnl) : null;

    if (binanceDay?.hasSnapshotData) {
      latestBinanceTrackedValue = roundNumber(binanceDay.totalTrackedUsd);
    }

    const binancePnl = realizedPnl;
    const unrealizedPnl = null;

    const totalPnl = roundNumber(
      (binancePnl ?? 0) +
        (stockPnl ?? 0) +
        (fundPnl ?? 0),
    );

    const stockValueUsd = stockValueByDate.get(date) ?? 0;
    const fundValueUsd = fundValueByDate.get(date) ?? 0;

    calendarByDate.set(date, {
      date,
      totalPnl,
      realizedPnl,
      unrealizedPnl,
      binancePnl,
      stockPnl,
      fundPnl,
      endValueUsd: roundNumber(latestBinanceTrackedValue + stockValueUsd + fundValueUsd),
      hasData: true,
      createdAt: binanceDay?.createdAt ?? now,
      updatedAt: now,
    });
  }

  const calendar: PortfolioCalendarDayRecord[] = [...calendarByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const snapshots: PortfolioSnapshotRecord[] = calendar.map((day) => {
    const stockValueUsd = stockValueByDate.get(day.date) ?? 0;
    const fundValueUsd = fundValueByDate.get(day.date) ?? 0;
    const binanceValueUsd = roundNumber(
      (day.endValueUsd ?? 0) - stockValueUsd - fundValueUsd,
    );

    return {
      date: day.date,
      totalValueUsd: roundNumber(day.endValueUsd ?? 0),
      binanceValueUsd,
      stockValueUsd,
      fundValueUsd,
      cashValueUsd: 0,
      totalPnlUsd: day.totalPnl,
      createdAt: day.createdAt ?? now,
      updatedAt: now,
    };
  });

  await writePortfolioCalendar(calendar);
  await writePortfolioSnapshots(snapshots);

  return {
    calendar,
    snapshots,
  };
}