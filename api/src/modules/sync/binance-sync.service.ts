import { getBinancePortfolio, getBinanceSyncReadiness } from "../../providers/binance.adapter";
import { readBinanceHistory, writeBinanceHistory } from "../../storage/history.repository";
import type { BinanceDailyHistoryRecord } from "../../storage/history.types";
import type { BinancePersistSnapshotSummary, BinanceSyncSummary } from "./sync.types";

function getUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function runBinanceSync(accountId: string): Promise<BinanceSyncSummary> {
  const startedAt = new Date().toISOString();
  const readiness = await getBinanceSyncReadiness(accountId);
  const finishedAt = new Date().toISOString();

  if (!readiness.ready) {
    return {
      accountId,
      provider: "binance",
      startedAt,
      finishedAt,
      ready: false,
      simulated: true,
      message: readiness.reasons.join(", ") || "Binance account is not ready",
      recordsPlanned: 0
    };
  }

  return {
    accountId,
    provider: "binance",
    startedAt,
    finishedAt,
    ready: true,
    simulated: true,
    message: "Binance sync simulation is ready for implementation",
    recordsPlanned: 365
  };
}

export async function persistBinanceDailySnapshot(
  accountId: string
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
      (portfolio.spot.totalValueUsd + portfolio.futures.totalNotionalUsd).toFixed(8)
    ),
    fetchedAt: portfolio.fetchedAt,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const existingIndex = history.findIndex(
    (item) => item.accountId === accountId && item.date === date
  );

  let finalRecord: BinanceDailyHistoryRecord;

  if (existingIndex >= 0) {
    const existingRecord = history[existingIndex];

    if (!existingRecord) {
      finalRecord = nextRecord;
      history.push(finalRecord);
    } else {
      finalRecord = {
        ...nextRecord,
        createdAt: existingRecord.createdAt,
        updatedAt: nowIso
      };

      history[existingIndex] = finalRecord;
    }
  } else {
    finalRecord = nextRecord;
    history.push(finalRecord);
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
    record: finalRecord
  };
}