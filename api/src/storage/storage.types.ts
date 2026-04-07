export type AccountSource = "binance" | "stock" | "fund";
export type AssetCategory = "crypto" | "stock" | "fund";

export type Currency = "USD" | "THB";

/**
 * 🧠 TRANSACTION SIDE
 */
export type TransactionSide = "buy" | "sell";

/**
 * 🧠 TRANSACTION RECORD (หัวใจ PnL)
 */
export interface TransactionRecord {
  id: string;

  accountId: string;
  assetId: string;

  side: TransactionSide;

  quantity: number;
  price: number; // price ต่อ unit
  currency: Currency;

  fee: number;
  feeCurrency: Currency;

  executedAt: string;

  /**
   * optional สำหรับ sync provider
   */
  source?: "binance" | "manual" | "import";
  orderId?: string | null;
  tradeId?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface BinanceAccountSettings {
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
  permissions: string[];
  label?: string;
  lastValidatedAt: string | null;
}

export interface AccountRecord {
  id: string;
  name: string;
  source: AccountSource;
  provider: string;

  baseCurrency: Currency;

  settings: BinanceAccountSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetMetadata {
  provider?: "twelvedata" | "sec";
  exchange?: string | null;
  projId?: string | null;
}

export interface AssetRecord {
  id: string;
  symbol: string;
  name: string;
  source: AccountSource;
  category: AssetCategory;

  currency: Currency;

  metadata: AssetMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountAssetLinkRecord {
  id: string;
  accountId: string;
  assetId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 🔥 STORE ROOT
 */
export interface StoreData {
  version: 2; // 👈 bump version

  baseCurrency: Currency;

  accounts: AccountRecord[];
  assets: AssetRecord[];

  accountAssetLinks: AccountAssetLinkRecord[];

  /**
   * 🔥 NEW: transaction layer
   */
  transactions: TransactionRecord[];
}