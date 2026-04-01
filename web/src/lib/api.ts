export type ProviderName = "binance" | "innovestx";
export type MarketSyncScope = "stocks" | "funds" | "all";
export type SyncStatus = "idle" | "success" | "failed" | "skipped";

export type MarketSyncReasonCode =
  | "updated"
  | "inactive_asset"
  | "manual_source"
  | "source_mismatch"
  | "not_due_yet"
  | "symbol_unsupported"
  | "provider_error"
  | "parse_failed";

export type MarketSyncItem = {
  assetId: string;
  symbol: string;
  name?: string;
  assetType?: "fund" | "thai_stock" | "us_stock";
  market?: "FUND" | "SET" | "US";
  status: "updated" | "skipped" | "failed";
  reasonCode?: MarketSyncReasonCode;
  message: string;
  syncedAt?: string;
  price?: number;
  priceDate?: string;
  source?: string;
};

export type MarketSyncResult = {
  success: boolean;
  scope?: MarketSyncScope;
  startedAt?: string;
  finishedAt?: string;
  updated: number;
  skipped: number;
  failed: number;
  items: MarketSyncItem[];
};

export type StockAssetRecord = {
  id: string;
  symbol: string;
  name: string;
  assetType: "fund" | "thai_stock" | "us_stock";
  market: "FUND" | "SET" | "US";
  currency: "THB" | "USD";
  priceSource: "daily_nav" | "live_api" | "manual";
  isActive: boolean;
  createdAt: string;
  lastSyncedAt?: string;
  lastSyncStatus?: SyncStatus;
  lastSyncMessage?: string;
  lastPriceDate?: string;
  lastPriceSource?: string;
  lastPriceCurrency?: string;
  lastPriceBase?: number;
  lastPriceBaseCurrency?: "USD";
};

export type PortfolioHistoryPosition = {
  assetId: string;
  symbol: string;
  name: string;
  assetType: "fund" | "thai_stock" | "us_stock";
  market: "FUND" | "SET" | "US";
  currency: "THB" | "USD";
  qty: number;
  avgCost: number;
  price: number;
  value: number;
  costValue: number;
  unrealizedPnl: number;
};

export type PortfolioHistorySnapshot = {
  date: string;
  totalValue: number;
  stockValue: number;
  fundValue: number;
  cashBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  changeUnrealized: number;
  totalPnl: number;
  positions: PortfolioHistoryPosition[];
  meta: {
    source: "snapshot" | "backfill";
    syncedAt: string;
    baseCurrency?: "USD";
  };
};

type DashboardResponse = {
  success: boolean;
  totalValue: number;
  todayPnL: number;
  connectedAccounts: number;
  providerSummary?: {
    totalValue?: number;
    spotValue?: number;
    futuresWallet?: number;
    futuresUnrealizedPnL?: number;
    stockValue?: number;
    fundValue?: number;
    cashBalance?: number;
  };
  providerBreakdown?: {
    spotValue?: number;
    futuresWallet?: number;
    futuresPnL?: number;
    stockValue?: number;
    fundValue?: number;
    cashBalance?: number;
    spotHoldings?: Array<{
      asset: string;
      amount: number;
      value: number;
    }>;
    futuresPositions?: Array<{
      symbol: string;
      side: string;
      size: number;
      entryPrice: number;
      markPrice: number;
      pnl: number;
      notional: number;
      leverage: number | null;
    }>;
    stockHoldings?: Array<{
      symbol: string;
      name: string;
      quantity: number;
      averageCost: number;
      lastPrice: number;
      marketValue: number;
      costValue: number;
      unrealizedPnL: number;
      lastSyncedAt?: string;
      lastSyncStatus?: SyncStatus;
      lastSyncMessage?: string;
      lastPriceDate?: string;
      lastPriceSource?: string;
    }>;
    fundHoldings?: Array<{
      symbol: string;
      name: string;
      units: number;
      nav: number;
      marketValue: number;
      costValue: number;
      unrealizedPnL: number;
      lastSyncedAt?: string;
      lastSyncStatus?: SyncStatus;
      lastSyncMessage?: string;
      lastPriceDate?: string;
      lastPriceSource?: string;
    }>;
  };
  stockBreakdown?: {
    stockValue?: number;
    fundValue?: number;
    stockHoldings?: Array<{
      symbol: string;
      name: string;
      quantity: number;
      averageCost: number;
      lastPrice: number;
      marketValue: number;
      costValue: number;
      unrealizedPnL: number;
      lastSyncedAt?: string;
      lastSyncStatus?: SyncStatus;
      lastSyncMessage?: string;
      lastPriceDate?: string;
      lastPriceSource?: string;
    }>;
    fundHoldings?: Array<{
      symbol: string;
      name: string;
      units: number;
      nav: number;
      marketValue: number;
      costValue: number;
      unrealizedPnL: number;
      lastSyncedAt?: string;
      lastSyncStatus?: SyncStatus;
      lastSyncMessage?: string;
      lastPriceDate?: string;
      lastPriceSource?: string;
    }>;
  };
};

const BASE_URL = "http://localhost:3001";

async function parseJsonOrThrow<T>(res: Response, fallbackMessage: string) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || fallbackMessage);
  }

  return (await res.json()) as T;
}

function normalizeDashboardSummary(res: DashboardResponse) {
  return {
    totalValue: Number(res.totalValue ?? 0),
    todayPnL: Number(res.todayPnL ?? 0),
    accounts: Number(res.connectedAccounts ?? 0),
    spotValue: Number(res.providerSummary?.spotValue ?? 0),
    futuresWallet: Number(res.providerSummary?.futuresWallet ?? 0),
    futuresUnrealizedPnL: Number(
      res.providerSummary?.futuresUnrealizedPnL ?? 0,
    ),
    stockValue: Number(
      (res.providerSummary?.stockValue ?? 0) +
        (res.stockBreakdown?.stockValue ?? 0),
    ),
    fundValue: Number(
      (res.providerSummary?.fundValue ?? 0) + (res.stockBreakdown?.fundValue ?? 0),
    ),
    cashBalance: Number(res.providerSummary?.cashBalance ?? 0),
  };
}

function normalizeDashboardBreakdown(res: DashboardResponse) {
  return {
    spotValue: Number(res.providerBreakdown?.spotValue ?? 0),
    futuresWallet: Number(res.providerBreakdown?.futuresWallet ?? 0),
    futuresPnL: Number(
      res.providerBreakdown?.futuresPnL ??
        res.providerSummary?.futuresUnrealizedPnL ??
        0,
    ),
    stockValue: Number(
      (res.providerBreakdown?.stockValue ?? 0) +
        (res.stockBreakdown?.stockValue ?? 0),
    ),
    fundValue: Number(
      (res.providerBreakdown?.fundValue ?? 0) + (res.stockBreakdown?.fundValue ?? 0),
    ),
    cashBalance: Number(res.providerBreakdown?.cashBalance ?? 0),
    spotHoldings: Array.isArray(res.providerBreakdown?.spotHoldings)
      ? res.providerBreakdown.spotHoldings
      : [],
    futuresPositions: Array.isArray(res.providerBreakdown?.futuresPositions)
      ? res.providerBreakdown.futuresPositions
      : [],
    stockHoldings: Array.isArray(res.stockBreakdown?.stockHoldings)
      ? res.stockBreakdown.stockHoldings
      : [],
    fundHoldings: Array.isArray(res.stockBreakdown?.fundHoldings)
      ? res.stockBreakdown.fundHoldings
      : [],
  };
}

export async function fetchSummary() {
  const res = await fetch(`${BASE_URL}/summary`);
  return parseJsonOrThrow(res, "Failed to fetch summary");
}

export async function fetchDailyPnL(month?: string) {
  const url = month
    ? `${BASE_URL}/calendar?month=${encodeURIComponent(month)}`
    : `${BASE_URL}/calendar`;

  const res = await parseJsonOrThrow<{
    success: boolean;
    month: string;
    days: Array<{
      date: string;
      totalValue: number;
      dailyPnl: number;
      futuresWallet: number;
      futuresUnrealizedPnL: number;
      stockValue: number;
      fundValue: number;
      cashBalance: number;
    }>;
  }>(await fetch(url), "Failed to fetch pnl");

  return {
    success: res.success,
    month: res.month,
    points: (Array.isArray(res.days) ? res.days : []).map((item) => ({
      date: item.date,
      net: Number(item.dailyPnl ?? 0),
      fundingFee: 0,
      commission: 0,
      realizedPnl: 0,
      currentUnrealizedPnL: Number(item.dailyPnl ?? 0),
      totalValue: Number(item.totalValue ?? 0),
    })),
  };
}

export async function connectAccount(payload: {
  provider: ProviderName;
  apiKey: string;
  apiSecret: string;
}) {
  const res = await fetch(`${BASE_URL}/accounts/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow(res, "Failed to connect account");
}

export async function fetchAccounts() {
  const res = await fetch(`${BASE_URL}/accounts`);
  return parseJsonOrThrow(res, "Failed to fetch accounts");
}

export async function fetchAccountsBreakdown() {
  const res = await fetch(`${BASE_URL}/accounts/breakdown`);
  return parseJsonOrThrow(res, "Failed to fetch account breakdown");
}

export async function testProviderAccount(payload: {
  provider: ProviderName;
  apiKey: string;
  apiSecret: string;
}) {
  const res = await fetch(`${BASE_URL}/providers/${payload.provider}/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: payload.apiKey,
      apiSecret: payload.apiSecret,
    }),
  });

  return parseJsonOrThrow(res, "Failed to test provider account");
}

export async function fetchProviderPortfolio(payload: {
  provider: ProviderName;
  apiKey: string;
  apiSecret: string;
}) {
  const res = await fetch(
    `${BASE_URL}/providers/${payload.provider}/portfolio`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: payload.apiKey,
        apiSecret: payload.apiSecret,
      }),
    },
  );

  return parseJsonOrThrow(res, "Failed to fetch provider portfolio");
}

export async function fetchDashboardSummary() {
  const res = await parseJsonOrThrow<DashboardResponse>(
    await fetch(`${BASE_URL}/dashboard`),
    "Failed to fetch dashboard summary",
  );

  return normalizeDashboardSummary(res);
}

export async function fetchDashboardBreakdown() {
  const res = await parseJsonOrThrow<DashboardResponse>(
    await fetch(`${BASE_URL}/dashboard`),
    "Failed to fetch breakdown",
  );

  return normalizeDashboardBreakdown(res);
}

export async function fetchEquityCurve() {
  return {
    success: true,
    points: [],
  };
}

export async function fetchAlerts() {
  try {
    const res = await fetch(`${BASE_URL}/dashboard/alerts`);

    if (!res.ok) {
      return { success: true, alerts: [] };
    }

    return await res.json();
  } catch {
    return { success: true, alerts: [] };
  }
}

export async function captureProviderSnapshot(provider: ProviderName) {
  const res = await fetch(`${BASE_URL}/dashboard/${provider}/snapshot`, {
    method: "POST",
  });

  return parseJsonOrThrow(res, `Failed to capture ${provider} snapshot`);
}

export async function syncMarketData(scope: MarketSyncScope = "all") {
  const route =
    scope === "stocks"
      ? "/stock/prices/refresh"
      : scope === "funds"
        ? "/funds/nav/refresh"
        : "/market/refresh";

  const res = await fetch(`${BASE_URL}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ force: true }),
  });

  return parseJsonOrThrow(
    res,
    "Failed to sync market data",
  ) as Promise<MarketSyncResult>;
}

export async function fetchStockAssets() {
  const res = await fetch(`${BASE_URL}/stock/assets`);
  return parseJsonOrThrow(res, "Failed to fetch stock assets") as Promise<{
    success: boolean;
    assets: StockAssetRecord[];
  }>;
}

export async function fetchBinancePortfolio(apiKey: string, apiSecret: string) {
  return fetchProviderPortfolio({
    provider: "binance",
    apiKey,
    apiSecret,
  });
}

export async function fetchPerformance() {
  const res = await fetch(`${BASE_URL}/performance`);

  if (!res.ok) {
    throw new Error("Failed to fetch performance");
  }

  return res.json() as Promise<{
    success: boolean;
    month?: string;
    series?: Array<{
      date: string;
      totalValue?: number;
      dailyReturnPct?: number;
      drawdownPct?: number;
    }>;
  }>;
}

export async function fetchPortfolioHistory(params?: {
  startDate?: string;
  endDate?: string;
}) {
  const search = new URLSearchParams();

  if (params?.startDate) {
    search.set("startDate", params.startDate);
  }

  if (params?.endDate) {
    search.set("endDate", params.endDate);
  }

  const queryString = search.toString();
  const url = queryString
    ? `${BASE_URL}/portfolio-history?${queryString}`
    : `${BASE_URL}/portfolio-history`;

  const res = await parseJsonOrThrow<{
    success: boolean;
    snapshots: PortfolioHistorySnapshot[];
  }>(await fetch(url), "Failed to fetch portfolio history");

  return {
    success: res.success,
    data: Array.isArray(res.snapshots) ? res.snapshots : [],
  };
}