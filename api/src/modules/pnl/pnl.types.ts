export interface DailyRealizedPnlRecord {
  date: string;
  realizedPnl: number;
  fundingFee: number;
  commission: number;
  netRealizedPnl: number;
}

export interface RealizedPnlResponse {
  accountCount: number;
  days: DailyRealizedPnlRecord[];
}