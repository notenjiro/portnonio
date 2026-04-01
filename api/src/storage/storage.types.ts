export type AccountSource = "binance" | "stock" | "fund";

export interface AccountRecord {
  id: string;
  name: string;
  source: AccountSource;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRecord {
  id: string;
  symbol: string;
  name: string;
  source: AccountSource;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreData {
  version: 1;
  baseCurrency: "USD";
  accounts: AccountRecord[];
  assets: AssetRecord[];
}