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