import { getBinancePortfolio, getBinanceSyncReadiness } from "../../providers/binance.adapter";
import { readBinanceHistory, writeBinanceHistory } from "../../storage/history.repository";
import type { BinanceDailyHistoryRecord } from "../../storage/history.types";
import type { BinancePersistSnapshotSummary, BinanceSyncSummary } from "./sync.types";
import { getRealizedPnlData } from "../pnl/pnl.service";

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

  // ตอนนี้ pnl.service ยัง aggregate ตาม days อย่างเดียว
  // ซึ่งใช้ได้กับสถานะปัจจุบันที่มี Binance account เดียว
  const pnlData = await getRealizedPnlData(1);
  const todayPnl = pnlData.days.find((day) => day.date === date) ?? pnlData.days.at(-1);

  const nextRecord: BinanceDailyHistoryRecord = {
    date,
    accountId,
    spotValueUsd: portfolio.spot.totalValueUsd,
    futuresNotionalUsd: portfolio.futures.totalNotionalUsd,
    futuresUnrealizedPnl: portfolio.futures.totalUnrealizedPnl,
    totalTrackedUsd: Number(
      (portfolio.spot.totalValueUsd + portfolio.futures.totalNotionalUsd).toFixed(8)
    ),

    realizedPnl: todayPnl?.netRealizedPnl ?? 0,
    funding: todayPnl?.fundingFee ?? 0,
    fees: todayPnl?.commission ?? 0,
    netRealizedPnl: todayPnl?.netRealizedPnl ?? 0,

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

    finalRecord = {
      ...nextRecord,
      createdAt: existingRecord?.createdAt ?? nowIso,
      updatedAt: nowIso
    };

    history[existingIndex] = finalRecord;
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

export async function backfillBinanceRealizedPnl(
  accountId: string,
  days: number = 30
): Promise<{
  accountId: string;
  provider: "binance";
  backfilled: true;
  days: number;
  startedAt: string;
  finishedAt: string;
  updatedRecords: number;
}> {
  const startedAt = new Date().toISOString();
  const history = await readBinanceHistory();
  const nowIso = new Date().toISOString();

  // ตอนนี้ pnl.service ยัง aggregate ตาม days อย่างเดียว
  // ใช้ได้กับสถานะปัจจุบันที่มี Binance account เดียว
  const pnlData = await getRealizedPnlData(days);

  for (const day of pnlData.days) {
    const existingIndex = history.findIndex(
      (item) => item.accountId === accountId && item.date === day.date
    );

    const realizedPnl = day.netRealizedPnl ?? 0;
    const funding = day.fundingFee ?? 0;
    const fees = day.commission ?? 0;
    const netRealizedPnl = day.netRealizedPnl ?? 0;

    if (existingIndex >= 0) {
      const existingRecord = history[existingIndex];

      if (!existingRecord) {
        continue;
      }

      history[existingIndex] = {
        ...existingRecord,
        realizedPnl,
        funding,
        fees,
        netRealizedPnl,
        updatedAt: nowIso
      };
    } else {
      history.push({
        date: day.date,
        accountId,
        spotValueUsd: 0,
        futuresNotionalUsd: 0,
        futuresUnrealizedPnl: 0,
        totalTrackedUsd: 0,
        realizedPnl,
        funding,
        fees,
        netRealizedPnl,
        fetchedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }
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
    backfilled: true,
    days,
    startedAt,
    finishedAt: new Date().toISOString(),
    updatedRecords: pnlData.days.length
  };
}