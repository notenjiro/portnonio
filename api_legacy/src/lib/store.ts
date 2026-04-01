import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  StockAsset,
  StockOrder,
  StockPriceSnapshot,
} from "../services/stock-ledger.service.js";
import type { ProviderName } from "../services/providers/provider.types.js";

export type ConnectedAccount = {
  id: string;
  provider: ProviderName;
  apiKey: string;
  apiSecret: string;
  createdAt: string;
};

export type DailySnapshot = {
  date: string;
  totalValue: number;
  spotValue: number;
  futuresWallet: number;
  futuresUnrealizedPnL: number;
  stockValue: number;
  fundValue: number;
  cashBalance: number;
};

export type Store = {
  totalValue: number;
  todayPnL: number;
  connectedAccounts: ConnectedAccount[];
  snapshots: DailySnapshot[];
  stockAssets: StockAsset[];
  stockOrders: StockOrder[];
  stockPrices: StockPriceSnapshot[];
};

type PartialStore = Partial<Store>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const storeFilePath = path.join(__dirname, "../../data/store.json");

function createEmptyStore(): Store {
  return {
    totalValue: 0,
    todayPnL: 0,
    connectedAccounts: [],
    snapshots: [],
    stockAssets: [],
    stockOrders: [],
    stockPrices: [],
  };
}

export function readStore(): Store {
  if (!fs.existsSync(storeFilePath)) {
    return createEmptyStore();
  }

  const raw = fs.readFileSync(storeFilePath, "utf-8").trim();
  const parsed = raw ? (JSON.parse(raw) as PartialStore) : {};

  return {
    totalValue: parsed.totalValue ?? 0,
    todayPnL: parsed.todayPnL ?? 0,
    connectedAccounts: parsed.connectedAccounts ?? [],
    snapshots: (parsed.snapshots ?? []).map((snapshot) => ({
      date: snapshot.date ?? "",
      totalValue: snapshot.totalValue ?? 0,
      spotValue: snapshot.spotValue ?? 0,
      futuresWallet: snapshot.futuresWallet ?? 0,
      futuresUnrealizedPnL: snapshot.futuresUnrealizedPnL ?? 0,
      stockValue: snapshot.stockValue ?? 0,
      fundValue: snapshot.fundValue ?? 0,
      cashBalance: snapshot.cashBalance ?? 0,
    })),
    stockAssets: parsed.stockAssets ?? [],
    stockOrders: parsed.stockOrders ?? [],
    stockPrices: parsed.stockPrices ?? [],
  };
}

export function writeStore(input: Store | PartialStore) {
  const existing = readStore();

  const next: Store = {
    ...existing,
    ...input,
    connectedAccounts: input.connectedAccounts ?? existing.connectedAccounts,
    snapshots: input.snapshots ?? existing.snapshots,
    stockAssets: input.stockAssets ?? existing.stockAssets,
    stockOrders: input.stockOrders ?? existing.stockOrders,
    stockPrices: input.stockPrices ?? existing.stockPrices,
  };

  fs.mkdirSync(path.dirname(storeFilePath), { recursive: true });
  fs.writeFileSync(storeFilePath, JSON.stringify(next, null, 2), "utf-8");
}