import crypto from "node:crypto";
import { readStore, writeStore } from "../lib/store.js";
import { convertToUsd } from "./fx-rate.service.js";

export type StockAssetType = "thai_stock" | "us_stock" | "fund";
export type StockMarket = "SET" | "US" | "FUND";
export type StockCurrency = "THB" | "USD";
export type StockPriceSource = "live_api" | "daily_nav" | "manual";
export type StockSyncStatus = "idle" | "success" | "failed" | "skipped";
export type BaseCurrency = "USD";
export type StockOrderSide = "buy" | "sell";
export type StockOrderInputMode = "quantity_price" | "amount_units";

export type StockAsset = {
  id: string;
  symbol: string;
  name: string;
  assetType: StockAssetType;
  market: StockMarket;
  currency: StockCurrency;
  baseCurrency?: BaseCurrency;
  priceSource: StockPriceSource;
  isActive: boolean;
  createdAt: string;
  lastSyncedAt?: string;
  lastSyncStatus?: StockSyncStatus;
  lastSyncMessage?: string;
  lastPriceDate?: string;
  lastPriceSource?: string;
  lastPriceCurrency?: string;
  lastPriceBase?: number;
  lastPriceBaseCurrency?: BaseCurrency;
};

export type FxSnapshot = {
  rateToBase: number;
  baseCurrency: BaseCurrency;
  quoteCurrency: string;
  rateDate: string;
  source: string;
};

export type StockOrder = {
  id: string;
  assetId: string;
  side: StockOrderSide;
  quantity: number;
  price: number;
  fee: number;
  tradeDate: string;
  note?: string;
  createdAt: string;

  inputMode?: StockOrderInputMode;
  inputCurrency?: string;
  inputGrossAmount?: number;
  inputUnitPrice?: number;
  feeCurrency?: string;

  derivedUnitPrice?: number;
  derivedGrossAmount?: number;
  derivedFeeAmount?: number;

  baseCurrency?: BaseCurrency;
  grossAmountBase?: number;
  unitPriceBase?: number;
  feeAmountBase?: number;

  fxRateToBase?: number;
  fxRateDate?: string;
  fxSource?: string;
};

export type StockPriceSnapshot = {
  id: string;
  assetId: string;
  price: number;
  priceDate: string;
  source: string;
  createdAt: string;

  currency?: string;
  baseCurrency?: BaseCurrency;
  priceBase?: number;
  fxRateToBase?: number;
  fxRateDate?: string;
  fxSource?: string;
};

export type StockAssetSyncPatch = {
  lastSyncedAt: string;
  lastSyncStatus: StockSyncStatus;
  lastSyncMessage: string;
  lastPriceDate?: string;
  lastPriceSource?: string;
  lastPriceCurrency?: string;
  lastPriceBase?: number;
  lastPriceBaseCurrency?: BaseCurrency;
};

export type LegacyCreateStockOrderInput = Omit<StockOrder, "id" | "createdAt">;

export type NormalizedCreateStockOrderInput = {
  assetId: string;
  side: StockOrderSide;
  tradeDate: string;
  note?: string;
  fee?: number;
  feeCurrency?: string;
} & (
  | {
      inputMode: "quantity_price";
      quantity: number;
      inputUnitPrice: number;
      inputCurrency: string;
    }
  | {
      inputMode: "amount_units";
      quantity: number;
      inputGrossAmount: number;
      inputCurrency: string;
    }
);

function nowIso() {
  return new Date().toISOString();
}

function normalizeCurrency(value?: string): string {
  return (value ?? "USD").trim().toUpperCase();
}

function getAssetById(assetId: string) {
  const store = readStore();
  return store.stockAssets.find((item) => String(item.id).trim() === assetId);
}

function ensureAssetExists(assetId: string) {
  const asset = getAssetById(assetId);

  if (!asset) {
    throw new Error("Stock asset not found");
  }

  return asset;
}

function ensurePositiveNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be greater than 0`);
  }
}

function ensureNonNegativeNumber(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be 0 or greater`);
  }
}

function getBaseCurrency(): BaseCurrency {
  return "USD";
}

function buildLegacyGrossAmount(input: {
  quantity: number;
  price: number;
}) {
  return Number(input.quantity) * Number(input.price);
}

function getSnapshotPriceBase(snapshot: StockPriceSnapshot) {
  const base = Number(snapshot.priceBase ?? 0);
  if (Number.isFinite(base) && base > 0) {
    return base;
  }

  const legacy = Number(snapshot.price ?? 0);
  return Number.isFinite(legacy) ? legacy : 0;
}

function getOrderGrossAmountBase(order: StockOrder, asset?: StockAsset) {
  const normalized = Number(order.grossAmountBase ?? 0);
  if (Number.isFinite(normalized) && normalized >= 0) {
    return normalized;
  }

  if (asset?.assetType === "fund") {
    const fundAmount = Number(
      order.derivedGrossAmount ?? order.inputGrossAmount ?? order.price ?? 0,
    );

    return Number.isFinite(fundAmount) ? fundAmount : 0;
  }

  if (typeof order.inputGrossAmount === "number") {
    return Number(order.inputGrossAmount);
  }

  return buildLegacyGrossAmount({
    quantity: Number(order.quantity),
    price: Number(order.price),
  });
}

function getOrderFeeBase(order: StockOrder) {
  const normalized = Number(order.feeAmountBase ?? 0);
  if (Number.isFinite(normalized) && normalized >= 0) {
    return normalized;
  }

  const derived = Number(order.derivedFeeAmount ?? order.fee ?? 0);
  return Number.isFinite(derived) ? derived : 0;
}

function comparePriceSnapshotsDesc(
  a: StockPriceSnapshot,
  b: StockPriceSnapshot,
) {
  if (a.priceDate !== b.priceDate) {
    return b.priceDate.localeCompare(a.priceDate);
  }

  return b.createdAt.localeCompare(a.createdAt);
}

function isReasonableFundPriceBase(input: {
  priceBase: number;
  averageCost: number;
}) {
  const priceBase = Number(input.priceBase);
  const averageCost = Number(input.averageCost);

  if (!Number.isFinite(priceBase) || priceBase <= 0) {
    return false;
  }

  if (!Number.isFinite(averageCost) || averageCost <= 0) {
    return true;
  }

  if (priceBase < averageCost * 0.25) {
    return false;
  }

  if (priceBase > averageCost * 4) {
    return false;
  }

  return true;
}

function pickLatestUsablePriceBase(input: {
  asset: StockAsset;
  averageCost: number;
  latestPriceMap: Map<string, StockPriceSnapshot>;
  allPrices: StockPriceSnapshot[];
}) {
  const { asset, averageCost, latestPriceMap, allPrices } = input;

  const today = new Date().toISOString().slice(0, 10);

  // 1. 👉 เอาราคา "ใกล้วันนี้ที่สุด"
  const recentPrices = allPrices
    .filter((p) => p.assetId === asset.id && (p.priceBase ?? 0) > 0)
    .sort((a, b) => {
      if (a.priceDate !== b.priceDate) {
        return b.priceDate.localeCompare(a.priceDate);
      }
      return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    });

  // 2. 👉 หา price ที่ "สมเหตุสมผล"
  const valid = recentPrices.find((p) => {
    const price = Number(p.priceBase);

    if (!Number.isFinite(price) || price <= 0) return false;

    // 🔥 กัน NAV พัง (เช่น 0.09)
    if (averageCost > 0) {
      if (price < averageCost * 0.3) return false;
      if (price > averageCost * 3) return false;
    }

    return true;
  });

  if (valid) {
    return Number(valid.priceBase);
  }

  // 3. 👉 fallback = last known good
  const lastKnown = Number(asset.lastPriceBase ?? 0);

  if (lastKnown > 0) {
    return lastKnown;
  }

  // 4. 👉 สุดท้าย = avgCost
  return averageCost;
}

export function listStockAssets() {
  const store = readStore();
  return store.stockAssets;
}

export function createStockAsset(
  input: Omit<StockAsset, "id" | "createdAt" | "isActive"> & {
    isActive?: boolean;
  },
) {
  const store = readStore();

  const symbol = input.symbol.trim().toUpperCase();
  const name = input.name.trim();

  const exists = store.stockAssets.some(
    (item) =>
      item.symbol.trim().toUpperCase() === symbol &&
      item.market === input.market,
  );

  if (exists) {
    throw new Error(`Stock asset already exists: ${symbol} (${input.market})`);
  }

  const asset: StockAsset = {
    id: crypto.randomUUID(),
    symbol,
    name,
    assetType: input.assetType,
    market: input.market,
    currency: input.currency,
    baseCurrency: input.baseCurrency ?? "USD",
    priceSource: input.priceSource,
    isActive: input.isActive ?? true,
    createdAt: nowIso(),
    lastSyncStatus: "idle",
    lastSyncMessage: "Not synced yet",
  };

  store.stockAssets.push(asset);
  writeStore(store);

  return asset;
}

export function updateStockAssetSyncState(
  assetId: string,
  patch: StockAssetSyncPatch,
) {
  const store = readStore();
  const index = store.stockAssets.findIndex((item) => item.id === assetId);

  if (index < 0) {
    throw new Error(`Stock asset not found: ${assetId}`);
  }

  const current = store.stockAssets[index];
  if (!current) {
    throw new Error(`Stock asset not found: ${assetId}`);
  }

  const next: StockAsset = {
    ...current,
    lastSyncedAt: patch.lastSyncedAt,
    lastSyncStatus: patch.lastSyncStatus,
    lastSyncMessage: patch.lastSyncMessage,
    ...(patch.lastPriceDate ? { lastPriceDate: patch.lastPriceDate } : {}),
    ...(patch.lastPriceSource ? { lastPriceSource: patch.lastPriceSource } : {}),
    ...(patch.lastPriceCurrency
      ? { lastPriceCurrency: patch.lastPriceCurrency }
      : {}),
    ...(typeof patch.lastPriceBase === "number"
      ? { lastPriceBase: patch.lastPriceBase }
      : {}),
    ...(patch.lastPriceBaseCurrency
      ? { lastPriceBaseCurrency: patch.lastPriceBaseCurrency }
      : {}),
  };

  store.stockAssets[index] = next;
  writeStore(store);

  return next;
}

export function listStockOrders() {
  const store = readStore();
  return store.stockOrders;
}

export function createStockOrder(input: LegacyCreateStockOrderInput) {
  const store = readStore();
  const requestedAssetId = String(input.assetId).trim();

  const asset = store.stockAssets.find(
    (item) => String(item.id).trim() === requestedAssetId,
  );

  if (!asset) {
    throw new Error("Stock asset not found");
  }

  ensurePositiveNumber(Number(input.quantity), "Quantity");
  ensureNonNegativeNumber(Number(input.price), "Price");
  ensureNonNegativeNumber(Number(input.fee), "Fee");

  const trimmedNote = input.note?.trim();

  const order: StockOrder = {
    id: crypto.randomUUID(),
    assetId: requestedAssetId,
    side: input.side,
    quantity: Number(input.quantity),
    price: Number(input.price),
    fee: Number(input.fee),
    tradeDate: input.tradeDate,
    createdAt: nowIso(),
    inputMode: asset.assetType === "fund" ? "amount_units" : "quantity_price",
    inputCurrency: asset.currency,
    inputGrossAmount:
      asset.assetType === "fund"
        ? Number(input.price)
        : Number(input.quantity) * Number(input.price),
    inputUnitPrice:
      asset.assetType === "fund"
        ? Number(input.quantity) > 0
          ? Number(input.price) / Number(input.quantity)
          : 0
        : Number(input.price),
    feeCurrency: asset.currency,
    derivedUnitPrice:
      asset.assetType === "fund"
        ? Number(input.quantity) > 0
          ? Number(input.price) / Number(input.quantity)
          : 0
        : Number(input.price),
    derivedGrossAmount:
      asset.assetType === "fund"
        ? Number(input.price)
        : Number(input.quantity) * Number(input.price),
    derivedFeeAmount: Number(input.fee),
    baseCurrency: "USD",
    ...(trimmedNote ? { note: trimmedNote } : {}),
  };

  store.stockOrders.push(order);
  writeStore(store);

  return order;
}

export async function createNormalizedStockOrder(
  input: NormalizedCreateStockOrderInput,
) {
  const store = readStore();
  const requestedAssetId = String(input.assetId).trim();
  const asset = store.stockAssets.find(
    (item) => String(item.id).trim() === requestedAssetId,
  );

  if (!asset) {
    throw new Error("Stock asset not found");
  }

  ensurePositiveNumber(Number(input.quantity), "Quantity");
  ensureNonNegativeNumber(Number(input.fee ?? 0), "Fee");

  const inputCurrency = normalizeCurrency(input.inputCurrency);
  const feeCurrency = normalizeCurrency(input.feeCurrency ?? inputCurrency);
  const trimmedNote = input.note?.trim();

  let derivedUnitPrice = 0;
  let derivedGrossAmount = 0;

  if (input.inputMode === "quantity_price") {
    ensurePositiveNumber(Number(input.inputUnitPrice), "Unit price");
    derivedUnitPrice = Number(input.inputUnitPrice);
    derivedGrossAmount = Number(input.quantity) * Number(input.inputUnitPrice);
  } else {
    ensurePositiveNumber(Number(input.inputGrossAmount), "Gross amount");
    derivedGrossAmount = Number(input.inputGrossAmount);
    derivedUnitPrice = Number(input.inputGrossAmount) / Number(input.quantity);
  }

  const grossFx = await convertToUsd(
    derivedGrossAmount,
    inputCurrency,
    input.tradeDate,
  );

  const unitFx = await convertToUsd(
    derivedUnitPrice,
    inputCurrency,
    input.tradeDate,
  );

  const feeFx = await convertToUsd(
    Number(input.fee ?? 0),
    feeCurrency,
    input.tradeDate,
  );

  const order: StockOrder = {
    id: crypto.randomUUID(),
    assetId: requestedAssetId,
    side: input.side,
    quantity: Number(input.quantity),

    price:
      input.inputMode === "quantity_price"
        ? Number(input.inputUnitPrice)
        : Number(input.inputGrossAmount),
    fee: Number(input.fee ?? 0),

    tradeDate: input.tradeDate,
    createdAt: nowIso(),

    inputMode: input.inputMode,
    inputCurrency,
    inputGrossAmount: derivedGrossAmount,
    inputUnitPrice:
      input.inputMode === "quantity_price"
        ? Number(input.inputUnitPrice)
        : undefined,
    feeCurrency,

    derivedUnitPrice,
    derivedGrossAmount,
    derivedFeeAmount: Number(input.fee ?? 0),

    baseCurrency: "USD",
    grossAmountBase: grossFx.amountUsd,
    unitPriceBase: unitFx.amountUsd,
    feeAmountBase: feeFx.amountUsd,

    fxRateToBase: grossFx.fxRate,
    fxRateDate: grossFx.fxDate,
    fxSource: grossFx.source,

    ...(trimmedNote ? { note: trimmedNote } : {}),
  };

  store.stockOrders.push(order);
  writeStore(store);

  return order;
}

export function listStockPrices() {
  const store = readStore();
  return store.stockPrices;
}

export function upsertStockPrice(
  input: Omit<StockPriceSnapshot, "id" | "createdAt">,
) {
  const store = readStore();
  const asset = ensureAssetExists(input.assetId);

  const existingIndex = store.stockPrices.findIndex(
    (item) =>
      item.assetId === input.assetId &&
      item.priceDate === input.priceDate &&
      item.source === input.source,
  );

  const existingItem =
    existingIndex >= 0 ? store.stockPrices[existingIndex] : null;

  const snapshot: StockPriceSnapshot = {
    id: existingItem ? existingItem.id : crypto.randomUUID(),
    assetId: input.assetId,
    price: Number(input.price),
    priceDate: input.priceDate,
    source: input.source,
    currency: input.currency ?? asset.currency,
    baseCurrency: input.baseCurrency ?? "USD",
    ...(typeof input.priceBase === "number"
      ? { priceBase: Number(input.priceBase) }
      : {}),
    ...(typeof input.fxRateToBase === "number"
      ? { fxRateToBase: Number(input.fxRateToBase) }
      : {}),
    ...(input.fxRateDate ? { fxRateDate: input.fxRateDate } : {}),
    ...(input.fxSource ? { fxSource: input.fxSource } : {}),
    createdAt: existingItem ? existingItem.createdAt : nowIso(),
  };

  if (existingIndex >= 0) {
    store.stockPrices[existingIndex] = snapshot;
  } else {
    store.stockPrices.push(snapshot);
  }

  writeStore(store);

  return snapshot;
}

export function getLatestPriceMap() {
  const store = readStore();
  const latestByAsset = new Map<string, StockPriceSnapshot>();

  for (const price of store.stockPrices) {
    const current = latestByAsset.get(price.assetId);

    if (
      !current ||
      price.priceDate > current.priceDate ||
      (price.priceDate === current.priceDate &&
        price.createdAt > current.createdAt)
    ) {
      latestByAsset.set(price.assetId, price);
    }
  }

  return latestByAsset;
}

export function calculateStockPositions() {
  const store = readStore();
  const latestPriceMap = getLatestPriceMap();

  return store.stockAssets
    .filter((asset) => asset.isActive)
    .map((asset) => {
      const assetOrders = store.stockOrders.filter(
        (order) => order.assetId === asset.id,
      );

      let quantity = 0;
      let totalCostBase = 0;

      for (const order of assetOrders) {
        const grossAmountBase = getOrderGrossAmountBase(order, asset);
        const feeAmountBase = getOrderFeeBase(order);

        if (order.side === "buy") {
          quantity += Number(order.quantity);
          totalCostBase += grossAmountBase + feeAmountBase;
        } else {
          const avgCostBase = quantity > 0 ? totalCostBase / quantity : 0;
          const reduceCostBase = avgCostBase * Number(order.quantity);

          quantity -= Number(order.quantity);
          totalCostBase -= reduceCostBase;
        }
      }

      if (quantity < 0) {
        quantity = 0;
      }

      if (totalCostBase < 0) {
        totalCostBase = 0;
      }

      const averageCost =
        quantity > 0 && Number.isFinite(totalCostBase / quantity)
          ? totalCostBase / quantity
          : 0;

      const lastPrice = pickLatestUsablePriceBase({
        asset,
        averageCost,
        latestPriceMap,
        allPrices: store.stockPrices,
      });

      const marketValue = quantity * lastPrice;
      const costValue = totalCostBase;
      const unrealizedPnL = marketValue - costValue;

      return {
        assetId: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        market: asset.market,
        currency: asset.baseCurrency ?? "USD",
        nativeCurrency: asset.currency,
        quantity,
        averageCost,
        totalCostBase,
        lastPrice,
        marketValue,
        costValue,
        unrealizedPnL,
      };
    })
    .filter((item) => item.quantity > 0 || item.marketValue > 0);
}