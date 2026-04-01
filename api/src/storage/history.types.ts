export interface BinanceDailyHistoryRecord {
  date: string; // YYYY-MM-DD
  accountId: string;
  realizedPnl: number;
  unrealizedPnl: number;
  funding: number;
  fees: number;
  otherIncome: number;
  netPnl: number;
  endValueUsd: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketDailyHistoryRecord {
  date: string; // YYYY-MM-DD
  assetId: string;
  symbol: string;
  close: number;
  currency: string;
  changePercent: number | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface FundDailyHistoryRecord {
  date: string; // YYYY-MM-DD
  assetId: string;
  symbol: string;
  nav: number;
  currency: string;
  changePercent: number | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioCalendarDayRecord {
  date: string; // YYYY-MM-DD
  totalPnl: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  binancePnl: number | null;
  stockPnl: number | null;
  endValueUsd: number | null;
  hasData: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSnapshotRecord {
  date: string; // YYYY-MM-DD
  totalValueUsd: number;
  binanceValueUsd: number;
  stockValueUsd: number;
  fundValueUsd: number;
  cashValueUsd: number;
  totalPnlUsd: number | null;
  createdAt: string;
  updatedAt: string;
}