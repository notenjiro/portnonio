import type { BinanceDailyHistoryRecord } from "../../storage/history.types";

export interface BinanceSyncSummary {
  accountId: string;
  provider: "binance";
  startedAt: string;
  finishedAt: string;
  ready: boolean;
  simulated: boolean;
  message: string;
  recordsPlanned: number;
}

export interface BinancePersistSnapshotSummary {
  accountId: string;
  provider: "binance";
  persisted: boolean;
  date: string;
  startedAt: string;
  finishedAt: string;
  record: BinanceDailyHistoryRecord;
}