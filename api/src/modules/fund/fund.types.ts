import type { FundDailyHistoryRecord } from "../../storage/history.types";

export interface FundNavRefreshResult {
  assetId: string;
  persisted: boolean;
  record: FundDailyHistoryRecord;
}