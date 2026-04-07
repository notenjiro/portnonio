export type AccountSource = "binance" | "stock" | "fund";
export type AssetCategory = "crypto" | "stock" | "fund";

export type Currency = "USD" | "THB"; // 👈 เพิ่ม

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

  baseCurrency: Currency; // 👈 เพิ่ม (สำคัญมาก)

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

  currency: Currency; // 👈 tighten type

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

export interface StoreData {
  version: 1;

  baseCurrency: Currency; // 👈 เปลี่ยนจาก fix เป็น dynamic

  accounts: AccountRecord[];
  assets: AssetRecord[];
  accountAssetLinks: AccountAssetLinkRecord[];
}