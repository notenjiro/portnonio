export interface OverviewResponse {
  asOf: string | null;
  totals: {
    totalTrackedUsd: number;
    binanceTrackedUsd: number;
    stockTrackedUsd: number;
    fundTrackedUsd: number;
    cashTrackedUsd: number;
  };
  binance: {
    spotValueUsd: number;
    futuresNotionalUsd: number;
    futuresUnrealizedPnl: number;
  };
  calendar: {
    totalPnl: number;
    averagePnl: number | null;
    dayCount: number;
  };
}