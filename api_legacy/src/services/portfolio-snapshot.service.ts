import fs from "fs";
import path from "path";
import { readStore } from "../lib/store.js";

const DATA_PATH = path.resolve("data");
const PORTFOLIO_HISTORY_FILE = path.join(DATA_PATH, "portfolio-history.json");
const MARKET_HISTORY_FILE = path.join(DATA_PATH, "market-history.json");

type PortfolioPositionSnapshot = {
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  market: string;
  currency: "USD";
  qty: number;
  avgCost: number;
  price: number;
  value: number;
  costValue: number;
  unrealizedPnl: number;
};

type PortfolioDailySnapshot = {
  date: string;
  totalValue: number;
  stockValue: number;
  fundValue: number;
  cashBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  changeUnrealized: number;
  totalPnl: number;
  positions: PortfolioPositionSnapshot[];
};

type MarketHistoryEntry = {
  priceBase: number;
};

type MarketHistoryMap = Record<string, Record<string, MarketHistoryEntry>>;
type PortfolioHistoryMap = Record<string, PortfolioDailySnapshot>;

function ensureFile(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({}, null, 2), "utf-8");
  }
}

function readJSON<T>(file: string, fallback: T): T {
  ensureFile(file);

  try {
    const raw = fs.readFileSync(file, "utf-8").trim();

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getPriceBase(
  asset: { id: string },
  prices: Array<any>,
  date: string,
  avgCost: number,
) {
  const candidates = prices
    .filter(
      (x: any) =>
        x.assetId === asset.id &&
        x.priceDate <= date &&
        typeof x.priceBase === "number" &&
        Number.isFinite(Number(x.priceBase)) &&
        Number(x.priceBase) > 0,
    )
    .sort((a: any, b: any) => {
      if (a.priceDate !== b.priceDate) {
        return b.priceDate.localeCompare(a.priceDate);
      }

      return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    });

  const valid = candidates.find((p: any) => {
    const price = Number(p.priceBase);

    if (!Number.isFinite(price) || price <= 0) {
      return false;
    }

    if (avgCost > 0) {
      if (price < avgCost * 0.3) return false;
      if (price > avgCost * 3) return false;
    }

    return true;
  });

  if (valid) {
    return Number(valid.priceBase);
  }

  return avgCost;
}

function getOrderCostBase(order: any) {
  return Number(order.grossAmountBase ?? 0) + Number(order.feeAmountBase ?? 0);
}

export function buildPortfolioSnapshot(date: string): PortfolioDailySnapshot {
  const store = readStore();

  let totalValue = 0;
  let stockValue = 0;
  let fundValue = 0;

  const positions: PortfolioPositionSnapshot[] = [];

  for (const asset of store.stockAssets.filter((x) => x.isActive)) {
    const orders = store.stockOrders
      .filter((o) => o.assetId === asset.id && o.tradeDate <= date)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

    let qty = 0;
    let costBase = 0;

    for (const o of orders) {
      if (o.side === "buy") {
        qty += Number(o.quantity);
        costBase += getOrderCostBase(o);
      } else {
        const avg = qty > 0 ? costBase / qty : 0;
        const reduce = avg * Number(o.quantity);
        qty -= Number(o.quantity);
        costBase -= reduce;
      }
    }

    if (qty <= 0) continue;

    const avgCost = qty > 0 ? costBase / qty : 0;
    const price = getPriceBase(asset, store.stockPrices, date, avgCost);
    const value = qty * price;
    const pnl = value - costBase;

    positions.push({
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      market: asset.market,
      currency: "USD",
      qty,
      avgCost,
      price,
      value,
      costValue: costBase,
      unrealizedPnl: pnl,
    });

    totalValue += value;

    if (asset.assetType === "fund") {
      fundValue += value;
    } else {
      stockValue += value;
    }
  }

  const unrealizedPnl = positions.reduce(
    (sum, position) => sum + position.unrealizedPnl,
    0,
  );

  return {
    date,
    totalValue,
    stockValue,
    fundValue,
    cashBalance: 0,
    realizedPnl: 0,
    unrealizedPnl,
    changeUnrealized: 0,
    totalPnl: 0,
    positions,
  };
}

export function savePortfolioSnapshotToday() {
  return savePortfolioSnapshotForDate(today());
}

export function savePortfolioSnapshotForDate(
  date: string,
  _options?: { source?: string },
) {
  const history = readJSON<PortfolioHistoryMap>(PORTFOLIO_HISTORY_FILE, {});

  const snapshot = buildPortfolioSnapshot(date);
  history[date] = snapshot;

  writeJSON(PORTFOLIO_HISTORY_FILE, history);

  return snapshot;
}

export function rebuildPortfolioHistoryRange(
  startDate: string,
  endDate: string,
) {
  const history = readJSON<PortfolioHistoryMap>(PORTFOLIO_HISTORY_FILE, {});

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    history[date] = buildPortfolioSnapshot(date);
  }

  writeJSON(PORTFOLIO_HISTORY_FILE, history);

  return history;
}

export function listPortfolioSnapshots() {
  const history = readJSON<PortfolioHistoryMap>(PORTFOLIO_HISTORY_FILE, {});

  return Object.values(history).sort((a, b) => a.date.localeCompare(b.date));
}

export function getPortfolioSnapshot(date: string) {
  const history = readJSON<PortfolioHistoryMap>(PORTFOLIO_HISTORY_FILE, {});
  return history[date] || null;
}

export function getPortfolioHistoryWindow(
  startDate: string,
  endDate: string,
) {
  const history = readJSON<PortfolioHistoryMap>(PORTFOLIO_HISTORY_FILE, {});

  return Object.values(history).filter(
    (x) => x.date >= startDate && x.date <= endDate,
  );
}

export function syncMarketHistoryFromStorePrices(_dateKey?: string) {
  const store = readStore();
  const history = readJSON<MarketHistoryMap>(MARKET_HISTORY_FILE, {});

  for (const p of store.stockPrices) {
    if (!history[p.assetId]) {
      history[p.assetId] = {};
    }

    history[p.assetId]![p.priceDate] = {
      priceBase: Number(p.priceBase ?? 0),
    };
  }

  writeJSON(MARKET_HISTORY_FILE, history);

  return history;
}