export interface OverviewResponse {
  asOf: string | null;

  baseCurrency: string; // 👈 เพิ่ม (สำคัญสุด)

  totals: {
    totalTrackedValue: number;
    binanceTrackedValue: number;
    stockTrackedValue: number;
    fundTrackedValue: number;
    cashTrackedValue: number;
  };

  binance: {
    spotValue: number;
    futuresNotional: number;
    futuresUnrealizedPnl: number;
  };

  calendar: {
    totalPnl: number;
    averagePnl: number | null;
    dayCount: number;
  };
}