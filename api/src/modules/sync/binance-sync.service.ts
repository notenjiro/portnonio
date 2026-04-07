import {
  getBinancePortfolio,
  getBinanceSyncReadiness,
  syncBinanceTradesToStore // 🔥 NEW
} from "../../providers/binance.adapter";

import {
  readBinanceHistory,
  writeBinanceHistory,
} from "../../storage/history.repository";

import type { BinanceDailyHistoryRecord } from "../../storage/history.types";

import type {
  BinancePersistSnapshotSummary,
  BinanceSyncSummary,
} from "./sync.types";

import { rebuildDerivedPortfolioViewsFromHistory } from "../store/store.history-service";

function getUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function runBinanceSync(accountId: string): Promise<BinanceSyncSummary> {
  const startedAt = new Date().toISOString();

  const readiness = await getBinanceSyncReadiness(accountId);

  if (!readiness.ready) {
    return {
      accountId,
      provider: "binance",
      startedAt,
      finishedAt: new Date().toISOString(),
      ready: false,
      simulated: false,
      message: readiness.reasons.join(", ") || "Binance account is not ready",
      recordsPlanned: 0,
    };
  }

  /**
   * 🔥 STEP 1: SYNC TRADES (ของจริง)
   */
  const tradeSync = await syncBinanceTradesToStore(accountId);

  /**
   * 🔥 STEP 2: SNAPSHOT (optional แต่ยัง useful)
   */
  const snapshotResult = await persistBinanceDailySnapshot(accountId);

  /**
   * 🔥 STEP 3: REBUILD ทั้งระบบจาก transactions
   */
  const rebuild = await rebuildDerivedPortfolioViewsFromHistory();

  const finishedAt = new Date().toISOString();

  return {
    accountId,
    provider: "binance",
    startedAt,
    finishedAt,
    ready: true,
    simulated: false,
    message: `Binance sync done | new trades: ${tradeSync.inserted}`,
    recordsPlanned: tradeSync.inserted,
  };
}

/**
 * 🟡 SNAPSHOT (ยังเก็บไว้เพื่อ UI / quick view)
 */
export async function persistBinanceDailySnapshot(
  accountId: string,
): Promise<BinancePersistSnapshotSummary> {
  const startedAt = new Date();
  const portfolio = await getBinancePortfolio(accountId);
  const history = await readBinanceHistory();

  const date = getUtcDateString(startedAt);
  const nowIso = new Date().toISOString();

  const nextRecord: BinanceDailyHistoryRecord = {
    date,
    accountId,

    spotValueUsd: portfolio.spot.totalValueUsd,
    futuresNotionalUsd: portfolio.futures.totalNotionalUsd,
    futuresUnrealizedPnl: portfolio.futures.totalUnrealizedPnl,

    totalTrackedUsd: Number(
      (portfolio.spot.totalValueUsd + portfolio.futures.totalNotionalUsd).toFixed(8),
    ),

    /**
     * 🔥 IMPORTANT
     * realized จะไม่ใช้ตรงนี้แล้ว
     */
    realizedPnl: 0,
    funding: 0,
    fees: 0,
    netRealizedPnl: 0,

    fetchedAt: portfolio.fetchedAt,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const existingIndex = history.findIndex(
    (item) => item.accountId === accountId && item.date === date,
  );

  if (existingIndex >= 0) {
    history[existingIndex] = {
      ...nextRecord,
      createdAt: history[existingIndex]?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
  } else {
    history.push(nextRecord);
  }

  history.sort((a, b) => {
    if (a.date === b.date) {
      return a.accountId.localeCompare(b.accountId);
    }

    return a.date.localeCompare(b.date);
  });

  await writeBinanceHistory(history);

  return {
    accountId,
    provider: "binance",
    persisted: true,
    date,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    record: nextRecord,
  };
}