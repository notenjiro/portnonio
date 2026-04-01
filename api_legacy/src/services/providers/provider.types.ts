export type ProviderName = "binance" | "innovestx";

export type ProviderCredentials = {
  apiKey: string;
  apiSecret: string;
};

export type ProviderSummary = {
  totalValue: number;
  spotValue: number;
  futuresWallet: number;
  futuresUnrealizedPnL: number;
  stockValue: number;
  fundValue: number;
  cashBalance: number;
};

export type SpotHoldingView = {
  asset: string;
  amount: number;
  value: number;
};

export type FuturesPositionView = {
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  notional: number;
  leverage: number;
};

export type StockHoldingView = {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  lastPrice: number;
  marketValue: number;
  costValue: number;
  unrealizedPnL: number;
};

export type FundHoldingView = {
  symbol: string;
  name: string;
  units: number;
  nav: number;
  marketValue: number;
  costValue: number;
  unrealizedPnL: number;
};

export type ProviderBreakdown = {
  spotValue: number;
  futuresWallet: number;
  futuresPnL: number;
  stockValue: number;
  fundValue: number;
  cashBalance: number;
  spotHoldings: SpotHoldingView[];
  futuresPositions: FuturesPositionView[];
  stockHoldings: StockHoldingView[];
  fundHoldings: FundHoldingView[];
};

export type ProviderTestResult = {
  success: true;
  accountNo?: string;
  totalValue: number;
  summary: ProviderSummary;
  breakdown: ProviderBreakdown;
};

export interface PortfolioProviderAdapter {
  readonly provider: ProviderName;
  testConnection(credentials: ProviderCredentials): Promise<ProviderTestResult>;
  getSummary(credentials: ProviderCredentials): Promise<ProviderSummary>;
  getBreakdown(credentials: ProviderCredentials): Promise<ProviderBreakdown>;
}