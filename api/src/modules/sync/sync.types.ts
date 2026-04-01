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