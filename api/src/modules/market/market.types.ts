import type { MarketDailyHistoryRecord } from "../../storage/history.types";

export interface MarketRefreshResult {
  assetId: string;
  persisted: boolean;
  record: MarketDailyHistoryRecord;
}