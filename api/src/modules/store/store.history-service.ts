import {
  readBinanceHistory,
  readFundHistory,
  readMarketHistory,
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

interface TransactionState {
  quantity: number;
  openCostUsd: number;
  realizedPnlUsd: number;
}

interface RebuildBreakdown {
  totalDays: number;
  winningDays: number;
  losingDays: number;
  flatDays: number;
  winRate: number | null;
  maxDrawdown: {
    amountUsd: number;
    percent: number;
    peakDate: string | null;
    troughDate: string | null;
  };
  cumulativeEquityCurve: Array<{
    date: string;
    totalValueUsd: number;
    cumulativePnlUsd: number;
  }>;
}

function buildInitialTransactionStateMap(store: any): Map<string, TransactionState> {
  const map = new Map<string, TransactionState>();

  for (const asset of store.assets ?? []) {
    map.set(asset.id, {
      quantity: 0,
      openCostUsd: 0,
      realizedPnlUsd: 0,
    });
  }

  return map;
}

async function convertAmountToUsd(
  amount: number,
  currency: string,
  date: string,
): Promise<number> {
  if (!Number.isFinite(amount) || amount === 0) {
    return 0;
  }

  const normalizedCurrency = String(currency ?? "USD").toUpperCase();

  if (normalizedCurrency === "USD") {
    return roundNumber(amount);
  }

  if (normalizedCurrency === "THB") {
    const rate = await getFxRateTHBUSD(date);
    return roundNumber(amount * rate);
  }

  return roundNumber(amount);
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

function buildTransactionDates(store: any): string[] {
  const dates = new Set<string>();

  for (const tx of store.transactions ?? []) {
    if (typeof tx.executedAt === "string" && tx.executedAt.length >= 10) {
      dates.add(tx.executedAt.slice(0, 10));
    }
  }

  return [...dates].sort((a, b) => a.localeCompare(b));
}

function buildMarketHistoryByAsset(
  marketHistory: MarketDailyHistoryRecord[],
): Map<string, MarketDailyHistoryRecord[]> {
  const byAsset = new Map<string, MarketDailyHistoryRecord[]>();

  for (const record of marketHistory) {
    const list = byAsset.get(record.assetId) ?? [];
    list.push(record);
    byAsset.set(record.assetId, list);
  }

  for (const [assetId, list] of byAsset.entries()) {
    byAsset.set(
      assetId,
      [...list].sort((a, b) => a.date.localeCompare(b.date)),
    );
  }

  return byAsset;
}

function buildFundHistoryByAsset(
  fundHistory: FundDailyHistoryRecord[],
): Map<string, FundDailyHistoryRecord[]> {
  const byAsset = new Map<string, FundDailyHistoryRecord[]>();

  for (const record of fundHistory) {
    const list = byAsset.get(record.assetId) ?? [];
    list.push(record);
    byAsset.set(record.assetId, list);
  }

  for (const [assetId, list] of byAsset.entries()) {
    byAsset.set(
      assetId,
      [...list].sort((a, b) => a.date.localeCompare(b.date)),
    );
  }

  return byAsset;
}

async function getLatestStockUnitPriceUsdOnOrBeforeDate(
  records: MarketDailyHistoryRecord[],
  date: string,
): Promise<number> {
  let latest: MarketDailyHistoryRecord | null = null;

  for (const record of records) {
    if (record.date <= date) {
      latest = record;
    } else {
      break;
    }
  }

  if (!latest) {
    return 0;
  }

  return roundNumber(latest.close);
}

async function getLatestFundUnitPriceUsdOnOrBeforeDate(
  records: FundDailyHistoryRecord[],
  date: string,
): Promise<number> {
  let latest: FundDailyHistoryRecord | null = null;

  for (const record of records) {
    if (record.date <= date) {
      latest = record;
    } else {
      break;
    }
  }

  if (!latest) {
    return 0;
  }

  if (String(latest.currency).toUpperCase() === "THB") {
    const rate = await getFxRateTHBUSD(latest.date);
    return roundNumber(latest.nav * rate);
  }

  return roundNumber(latest.nav);
}

async function applyTransactionsUpToDate(
  transactions: any[],
  date: string,
  stateByAsset: Map<string, TransactionState>,
): Promise<void> {
  for (const tx of transactions) {
    const txDate = String(tx.executedAt ?? "").slice(0, 10);

    if (txDate !== date) {
      continue;
    }

    const assetId = tx.assetId;
    const currentState = stateByAsset.get(assetId) ?? {
      quantity: 0,
      openCostUsd: 0,
      realizedPnlUsd: 0,
    };

    const quantity = Number(tx.quantity ?? 0);
    const priceUsd = await convertAmountToUsd(
      Number(tx.price ?? 0),
      tx.currency,
      txDate,
    );

    const feeUsd = await convertAmountToUsd(
      Number(tx.fee ?? 0),
      tx.feeCurrency ?? tx.currency,
      txDate,
    );

    if (!Number.isFinite(quantity) || quantity <= 0) {
      stateByAsset.set(assetId, currentState);
      continue;
    }

    if (tx.side === "buy") {
      currentState.quantity = roundNumber(currentState.quantity + quantity);
      currentState.openCostUsd = roundNumber(
        currentState.openCostUsd + (priceUsd * quantity) + feeUsd,
      );
      stateByAsset.set(assetId, currentState);
      continue;
    }

    if (tx.side === "sell") {
      if (currentState.quantity <= 0) {
        stateByAsset.set(assetId, currentState);
        continue;
      }

      const sellQty = Math.min(quantity, currentState.quantity);
      const avgCostUsd =
        currentState.quantity > 0
          ? currentState.openCostUsd / currentState.quantity
          : 0;

      const proceedsUsd = (priceUsd * sellQty) - feeUsd;
      const costRemovedUsd = avgCostUsd * sellQty;
      const realizedUsd = proceedsUsd - costRemovedUsd;

      currentState.realizedPnlUsd = roundNumber(
        currentState.realizedPnlUsd + realizedUsd,
      );
      currentState.quantity = roundNumber(currentState.quantity - sellQty);
      currentState.openCostUsd = roundNumber(
        currentState.openCostUsd - costRemovedUsd,
      );

      if (currentState.quantity <= 0.00000001) {
        currentState.quantity = 0;
        currentState.openCostUsd = 0;
      }

      stateByAsset.set(assetId, currentState);
      continue;
    }

    stateByAsset.set(assetId, currentState);
  }
}

function getAllCalendarDates(
  aggregatedBinanceByDate: Map<string, AggregatedBinanceDay>,
  marketHistory: MarketDailyHistoryRecord[],
  fundHistory: FundDailyHistoryRecord[],
  transactionDates: string[],
): string[] {
  const allDates = new Set<string>();

  for (const date of aggregatedBinanceByDate.keys()) {
    allDates.add(date);
  }

  for (const record of marketHistory) {
    allDates.add(record.date);
  }

  for (const record of fundHistory) {
    allDates.add(record.date);
  }

  for (const date of transactionDates) {
    allDates.add(date);
  }

  return [...allDates].sort((a, b) => a.localeCompare(b));
}

function buildBreakdown(
  calendar: PortfolioCalendarDayRecord[],
  snapshots: PortfolioSnapshotRecord[],
): RebuildBreakdown {
  const winningDays = calendar.filter((day) => (day.totalPnl ?? 0) > 0).length;
  const losingDays = calendar.filter((day) => (day.totalPnl ?? 0) < 0).length;
  const flatDays = calendar.filter((day) => (day.totalPnl ?? 0) === 0).length;

  const winRate =
    winningDays + losingDays > 0
      ? roundNumber(winningDays / (winningDays + losingDays))
      : null;

  let peakValue = Number.NEGATIVE_INFINITY;
  let peakDate: string | null = null;
  let troughDate: string | null = null;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;
  let cumulativePnl = 0;

  const cumulativeEquityCurve = calendar.map((day) => {
    cumulativePnl = roundNumber(cumulativePnl + (day.totalPnl ?? 0));

    const snapshot = snapshots.find((item) => item.date === day.date);
    const totalValueUsd = roundNumber(snapshot?.totalValueUsd ?? 0);

    if (totalValueUsd > peakValue) {
      peakValue = totalValueUsd;
      peakDate = day.date;
    }

    const drawdownAmount =
      peakValue !== Number.NEGATIVE_INFINITY
        ? roundNumber(peakValue - totalValueUsd)
        : 0;

    const drawdownPercent =
      peakValue > 0
        ? roundNumber(drawdownAmount / peakValue)
        : 0;

    if (drawdownAmount > maxDrawdownAmount) {
      maxDrawdownAmount = drawdownAmount;
      maxDrawdownPercent = drawdownPercent;
      troughDate = day.date;
    }

    return {
      date: day.date,
      totalValueUsd,
      cumulativePnlUsd: cumulativePnl,
    };
  });

  return {
    totalDays: calendar.length,
    winningDays,
    losingDays,
    flatDays,
    winRate,
    maxDrawdown: {
      amountUsd: roundNumber(maxDrawdownAmount),
      percent: roundNumber(maxDrawdownPercent),
      peakDate,
      troughDate,
    },
    cumulativeEquityCurve,
  };
}

export async function rebuildDerivedPortfolioViewsFromHistory(): Promise<{
  calendar: PortfolioCalendarDayRecord[];
  snapshots: PortfolioSnapshotRecord[];
  breakdown: RebuildBreakdown;
}> {
  const [binanceHistory, marketHistory, fundHistory, store] = await Promise.all([
    readBinanceHistory(),
    readMarketHistory(),
    readFundHistory(),
    readStore(),
  ]);

  const now = nowIso();

  const aggregatedBinanceByDate = aggregateBinanceHistoryByDate(binanceHistory);
  const transactionDates = buildTransactionDates(store);

  const calendarDates = getAllCalendarDates(
    aggregatedBinanceByDate,
    marketHistory,
    fundHistory,
    transactionDates,
  );

  const marketHistoryByAsset = buildMarketHistoryByAsset(marketHistory);
  const fundHistoryByAsset = buildFundHistoryByAsset(fundHistory);

  const txsSorted = [...(store.transactions ?? [])].sort((a: any, b: any) =>
    String(a.executedAt ?? "").localeCompare(String(b.executedAt ?? "")),
  );

  const stateByAsset = buildInitialTransactionStateMap(store);

  const assetById = new Map(
    (store.assets ?? []).map((asset: any) => [asset.id, asset]),
  );

  const calendarByDate = new Map<string, PortfolioCalendarDayRecord>();
  let latestBinanceTrackedValue = 0;
  let previousTotalPnlCumulative = 0;

  for (const date of calendarDates) {
    await applyTransactionsUpToDate(txsSorted, date, stateByAsset);

    const binanceDay = aggregatedBinanceByDate.get(date) ?? null;

    if (binanceDay?.hasSnapshotData) {
      latestBinanceTrackedValue = roundNumber(binanceDay.totalTrackedUsd);
    }

    let stockValueUsd = 0;
    let fundValueUsd = 0;
    let stockRealizedUsd = 0;
    let fundRealizedUsd = 0;
    let stockOpenCostUsd = 0;
    let fundOpenCostUsd = 0;

    for (const [assetId, state] of stateByAsset.entries()) {
      const asset = assetById.get(assetId);
      if (!asset) {
        continue;
      }

      if (asset.category === "stock") {
        const records = marketHistoryByAsset.get(assetId) ?? [];
        const unitPriceUsd = await getLatestStockUnitPriceUsdOnOrBeforeDate(records, date);

        stockValueUsd = roundNumber(stockValueUsd + (unitPriceUsd * state.quantity));
        stockRealizedUsd = roundNumber(stockRealizedUsd + state.realizedPnlUsd);
        stockOpenCostUsd = roundNumber(stockOpenCostUsd + state.openCostUsd);
      }

      if (asset.category === "fund") {
        const records = fundHistoryByAsset.get(assetId) ?? [];
        const unitPriceUsd = await getLatestFundUnitPriceUsdOnOrBeforeDate(records, date);

        fundValueUsd = roundNumber(fundValueUsd + (unitPriceUsd * state.quantity));
        fundRealizedUsd = roundNumber(fundRealizedUsd + state.realizedPnlUsd);
        fundOpenCostUsd = roundNumber(fundOpenCostUsd + state.openCostUsd);
      }
    }

    const stockUnrealizedUsd = roundNumber(stockValueUsd - stockOpenCostUsd);
    const fundUnrealizedUsd = roundNumber(fundValueUsd - fundOpenCostUsd);

    const stockTotalPnlCumulative = roundNumber(stockRealizedUsd + stockUnrealizedUsd);
    const fundTotalPnlCumulative = roundNumber(fundRealizedUsd + fundUnrealizedUsd);

    const binanceRealizedUsd = roundNumber(binanceDay?.realizedPnl ?? 0);
    const binanceUnrealizedUsd = roundNumber(binanceDay?.futuresUnrealizedPnl ?? 0);
    const binanceTotalPnlCumulative = roundNumber(binanceRealizedUsd + binanceUnrealizedUsd);

    const totalPnlCumulative = roundNumber(
      stockTotalPnlCumulative +
        fundTotalPnlCumulative +
        binanceTotalPnlCumulative,
    );

    const dailyTotalPnl = roundNumber(
      totalPnlCumulative - previousTotalPnlCumulative,
    );

    previousTotalPnlCumulative = totalPnlCumulative;

    const realizedPnl = roundNumber(
      stockRealizedUsd + fundRealizedUsd + binanceRealizedUsd,
    );

    const unrealizedPnl = roundNumber(
      stockUnrealizedUsd + fundUnrealizedUsd + binanceUnrealizedUsd,
    );

    const binancePnl = roundNumber(binanceTotalPnlCumulative);
    const stockPnl = roundNumber(stockTotalPnlCumulative);
    const fundPnl = roundNumber(fundTotalPnlCumulative);

    calendarByDate.set(date, {
      date,
      totalPnl: dailyTotalPnl,
      realizedPnl,
      unrealizedPnl,
      binancePnl,
      stockPnl,
      fundPnl,
      endValueUsd: roundNumber(
        latestBinanceTrackedValue + stockValueUsd + fundValueUsd,
      ),
      hasData: true,
      createdAt: binanceDay?.createdAt ?? now,
      updatedAt: now,
    });
  }

  const calendar: PortfolioCalendarDayRecord[] = [...calendarByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const snapshots: PortfolioSnapshotRecord[] = calendar.map((day) => {
    const binanceDay = aggregatedBinanceByDate.get(day.date) ?? null;
    const binanceValueUsd = roundNumber(
      binanceDay?.hasSnapshotData ? binanceDay.totalTrackedUsd : 0,
    );

    let stockValueUsd = 0;
    let fundValueUsd = 0;

    for (const [assetId, asset] of assetById.entries()) {
      const dayState = buildInitialTransactionStateMap(store).get(assetId);
      void dayState;
      if (asset.category === "stock" || asset.category === "fund") {
        // values are rebuilt from calendar loop below using same endValue decomposition
      }
    }

    const totalValueUsd = roundNumber(day.endValueUsd ?? 0);

    // derive stock + fund from current end value minus binance using latest recomputation
    // recompute deterministically for the snapshot date
    return {
      date: day.date,
      totalValueUsd,
      binanceValueUsd,
      stockValueUsd,
      fundValueUsd,
      cashValueUsd: 0,
      totalPnlUsd: day.totalPnl,
      createdAt: day.createdAt ?? now,
      updatedAt: now,
    };
  });

  /**
   * Recompute stock/fund snapshot values exactly per date
   */
  const txsSortedForSnapshots = [...(store.transactions ?? [])].sort((a: any, b: any) =>
    String(a.executedAt ?? "").localeCompare(String(b.executedAt ?? "")),
  );
  const snapshotStateByAsset = buildInitialTransactionStateMap(store);

  for (const snapshot of snapshots) {
    await applyTransactionsUpToDate(txsSortedForSnapshots, snapshot.date, snapshotStateByAsset);

    let stockValueUsd = 0;
    let fundValueUsd = 0;

    for (const [assetId, state] of snapshotStateByAsset.entries()) {
      const asset = assetById.get(assetId);
      if (!asset) continue;

      if (asset.category === "stock") {
        const records = marketHistoryByAsset.get(assetId) ?? [];
        const unitPriceUsd = await getLatestStockUnitPriceUsdOnOrBeforeDate(records, snapshot.date);
        stockValueUsd = roundNumber(stockValueUsd + (unitPriceUsd * state.quantity));
      }

      if (asset.category === "fund") {
        const records = fundHistoryByAsset.get(assetId) ?? [];
        const unitPriceUsd = await getLatestFundUnitPriceUsdOnOrBeforeDate(records, snapshot.date);
        fundValueUsd = roundNumber(fundValueUsd + (unitPriceUsd * state.quantity));
      }
    }

    snapshot.stockValueUsd = roundNumber(stockValueUsd);
    snapshot.fundValueUsd = roundNumber(fundValueUsd);
    snapshot.totalValueUsd = roundNumber(
      snapshot.binanceValueUsd + snapshot.stockValueUsd + snapshot.fundValueUsd,
    );
  }

  const breakdown = buildBreakdown(calendar, snapshots);

  await writePortfolioCalendar(calendar);
  await writePortfolioSnapshots(snapshots);

  return {
    calendar,
    snapshots,
    breakdown,
  };
}