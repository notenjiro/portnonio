export type ProviderName = "binance" | "twelvedata" | "sec";

export interface ProviderHealthResult {
  ok: boolean;
  provider: ProviderName;
  message: string;
}

export interface BinanceSyncReadiness {
  accountId: string;
  provider: "binance";
  ready: boolean;
  reasons: string[];
  apiKeyPreview: string | null;
  isTestnet: boolean | null;
  permissions: string[];
}

export interface BinancePublicApiHealth {
  ok: boolean;
  provider: "binance";
  spotPingOk: boolean;
  futuresPingOk: boolean;
  serverTime: number | null;
  spotBaseUrl: string;
  futuresBaseUrl: string;
}

export interface BinancePrivateAccountInfo {
  makerCommission?: number;
  takerCommission?: number;
  buyerCommission?: number;
  sellerCommission?: number;
  canTrade?: boolean;
  canWithdraw?: boolean;
  canDeposit?: boolean;
  accountType?: string;
  balances?: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  permissions?: string[];
  uid?: number;
}

export interface BinanceSpotHolding {
  asset: string;
  free: number;
  locked: number;
  total: number;
  symbol: string | null;
  priceUsd: number | null;
  valueUsd: number | null;
}

export interface BinanceSpotHoldingsResponse {
  accountId: string;
  fetchedAt: string;
  holdings: BinanceSpotHolding[];
}

export interface BinanceFuturesPosition {
  symbol: string;
  side: "LONG" | "SHORT" | "BOTH";
  quantity: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  notionalUsd: number;
  leverage: number | null;
  marginAsset: string;
  isolated: boolean;
}

export interface BinanceFuturesPositionsResponse {
  accountId: string;
  fetchedAt: string;
  positions: BinanceFuturesPosition[];
}