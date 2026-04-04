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

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type DashboardApiData = {
  overview: {
    asOf: string | null;
    totals: {
      totalTrackedUsd: number;
      binanceTrackedUsd: number;
      stockTrackedUsd: number;
      fundTrackedUsd: number;
      cashTrackedUsd: number;
    };
    binance: {
      spotValueUsd: number;
      futuresNotionalUsd: number;
      futuresUnrealizedPnl: number;
    };
    calendar: {
      totalPnl: number;
      averagePnl: number | null;
      dayCount: number;
    };
  };
  calendar: {
    scope: "all" | "binance" | "stock";
    days: Array<{
      date: string;
      totalPnl: number | null;
      realizedPnl: number | null;
      unrealizedPnl: number | null;
      binancePnl: number | null;
      stockPnl: number | null;
      fundPnl?: number | null;
      endValueUsd: number | null;
      hasData: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    summary: {
      totalPnl: number;
      averagePnl: number | null;
      dayCount: number;
      bestDay: {
        date: string;
        totalPnl: number | null;
      } | null;
      worstDay: {
        date: string;
        totalPnl: number | null;
      } | null;
    };
  };
  latestBinancePortfolio: {
    fetchedAt: string | null;
    accountCount: number;
    spot: {
      holdings: Array<{
        asset: string;
        free: number;
        locked: number;
        total: number;
        symbol: string;
        priceUsd: number | null;
        valueUsd: number | null;
      }>;
      totalValueUsd: number;
      pricedCount: number;
      unpricedCount: number;
    };
    futures: {
      positions: Array<{
        symbol: string;
        side: string;
        quantity: number;
        entryPrice: number;
        markPrice: number;
        unrealizedPnl: number;
        notionalUsd: number;
        leverage: number | null;
        marginAsset: string;
        isolated: boolean;
      }>;
      totalNotionalUsd: number;
      totalUnrealizedPnl: number;
      positionCount: number;
    };
  } | null;
  summaryCards: Array<{
    key: string;
    label: string;
    value: number;
    unit: "USD" | "COUNT";
  }>;
  risk: {
    futuresUnrealizedPnlUsd: number;
    futuresNotionalUsd: number;
    spotValueUsd: number;
    pricedSpotCount: number;
    unpricedSpotCount: number;
    openFuturesPositions: number;
  } | null;
  allocation: Array<{
    key: string;
    label: string;
    valueUsd: number;
    weight: number;
  }>;
};

type PositionsApiData = {
  asOf: string | null;
  spot: {
    items: Array<{
      asset: string;
      free: number;
      locked: number;
      total: number;
      symbol: string;
      priceUsd: number | null;
      valueUsd: number | null;
    }>;
    count: number;
    totalValueUsd: number;
  };
  futures: {
    items: Array<{
      symbol: string;
      side: string;
      quantity: number;
      entryPrice: number;
      markPrice: number;
      unrealizedPnl: number;
      notionalUsd: number;
      leverage: number | null;
      marginAsset: string;
      isolated: boolean;
    }>;
    count: number;
    totalNotionalUsd: number;
    totalUnrealizedPnl: number;
  };
};

type OverviewApiData = {
  asOf: string | null;
  totals: {
    totalTrackedUsd: number;
    binanceTrackedUsd: number;
    stockTrackedUsd: number;
    fundTrackedUsd: number;
    cashTrackedUsd: number;
  };
  binance: {
    spotValueUsd: number;
    futuresNotionalUsd: number;
    futuresUnrealizedPnl: number;
  };
  calendar: {
    totalPnl: number;
    averagePnl: number | null;
    dayCount: number;
  };
};

type CalendarApiData = DashboardApiData["calendar"];

type HistorySnapshotApiItem = {
  date: string;
  totalValueUsd: number;
  binanceValueUsd: number;
  stockValueUsd: number;
  fundValueUsd: number;
  cashValueUsd: number;
  totalPnlUsd: number | null;
  createdAt: string;
  updatedAt: string;
};

export type StoreAccountItem = {
  id: string;
  name: string;
  source: "binance" | "stock" | "fund";
  provider?: string;
  settings?: {
    label?: string;
    isTestnet?: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type SearchAssetResultItem = {
  symbol: string;
  name: string;
  exchange?: string | null;
  projId?: string;
};

export type StoreAssetItem = {
  id: string;
  symbol: string;
  name: string;
  source: "binance" | "stock" | "fund";
  category: "crypto" | "stock" | "fund";
  currency: string;
  metadata?: {
    provider?: "twelvedata" | "sec";
    exchange?: string | null;
    projId?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountAssetLinkItem = {
  id: string;
  accountId: string;
  assetId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioAssetValuationItem = {
  linkId: string;
  assetId: string;
  symbol: string;
  name: string;
  category: "crypto" | "stock" | "fund";
  quantity: number;
  price: number | null;
  value: number | null;
  dailyPnl: number | null;
  changePercent: number | null;
  lastUpdated: string | null;
};

type OnboardResponse = {
  asset: unknown;
  link: unknown;
  refresh: unknown;
  rebuild: unknown;
  warnings?: {
    refresh?: string | null;
    rebuild?: string | null;
  };
};

const BASE_URL = "http://localhost:3001/api";
const DEFAULT_TIMEOUT_MS = 20_000;

async function parseJsonOrThrow<T>(
  res: Response,
  fallbackMessage: string,
): Promise<T> {
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      text ||
      fallbackMessage;

    throw new Error(message);
  }

  return payload as T;
}

function notImplemented(name: string): never {
  throw new Error(`${name} is not wired to the new backend yet`);
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeDashboardSummary(data: DashboardApiData) {
  const liveSpotValue =
    data.latestBinancePortfolio?.spot.totalValueUsd ??
    data.overview.binance.spotValueUsd ??
    0;

  const liveFuturesNotional =
    data.latestBinancePortfolio?.futures.totalNotionalUsd ??
    data.overview.binance.futuresNotionalUsd ??
    0;

  const liveFuturesUnrealizedPnL =
    data.latestBinancePortfolio?.futures.totalUnrealizedPnl ??
    data.overview.binance.futuresUnrealizedPnl ??
    0;

  return {
    totalValue: Number(data.overview.totals.totalTrackedUsd ?? 0),
    todayPnL: Number(data.overview.calendar.totalPnl ?? 0),
    accounts: Number(data.latestBinancePortfolio?.accountCount ?? 0),
    spotValue: Number(liveSpotValue),
    futuresWallet: Number(liveFuturesNotional),
    futuresUnrealizedPnL: Number(liveFuturesUnrealizedPnL),
    stockValue: Number(data.overview.totals.stockTrackedUsd ?? 0),
    fundValue: Number(data.overview.totals.fundTrackedUsd ?? 0),
    cashBalance: Number(data.overview.totals.cashTrackedUsd ?? 0),
  };
}

function normalizeDashboardBreakdown(data: DashboardApiData) {
  return {
    spotValue: Number(
      data.latestBinancePortfolio?.spot.totalValueUsd ??
        data.overview.binance.spotValueUsd ??
        0,
    ),
    futuresWallet: Number(
      data.latestBinancePortfolio?.futures.totalNotionalUsd ??
        data.overview.binance.futuresNotionalUsd ??
        0,
    ),
    futuresPnL: Number(
      data.latestBinancePortfolio?.futures.totalUnrealizedPnl ??
        data.overview.binance.futuresUnrealizedPnl ??
        0,
    ),
    stockValue: Number(data.overview.totals.stockTrackedUsd ?? 0),
    fundValue: Number(data.overview.totals.fundTrackedUsd ?? 0),
    cashBalance: Number(data.overview.totals.cashTrackedUsd ?? 0),
    spotHoldings: Array.isArray(data.latestBinancePortfolio?.spot.holdings)
      ? data.latestBinancePortfolio!.spot.holdings.map((item) => ({
          asset: item.asset,
          amount: Number(item.total ?? 0),
          value: Number(item.valueUsd ?? 0),
        }))
      : [],
    futuresPositions: Array.isArray(data.latestBinancePortfolio?.futures.positions)
      ? data.latestBinancePortfolio!.futures.positions.map((item) => ({
          symbol: item.symbol,
          side: item.side,
          size: Number(item.quantity ?? 0),
          entryPrice: Number(item.entryPrice ?? 0),
          markPrice: Number(item.markPrice ?? 0),
          pnl: Number(item.unrealizedPnl ?? 0),
          notional: Number(item.notionalUsd ?? 0),
          leverage: item.leverage ?? null,
        }))
      : [],
    stockHoldings: [],
    fundHoldings: [],
  };
}

export async function fetchDashboard() {
  const res = await parseJsonOrThrow<ApiEnvelope<DashboardApiData>>(
    await fetchWithTimeout(`${BASE_URL}/dashboard`),
    "Failed to fetch dashboard",
  );

  return res.data;
}

export async function fetchOverview() {
  const res = await parseJsonOrThrow<ApiEnvelope<OverviewApiData>>(
    await fetchWithTimeout(`${BASE_URL}/overview`),
    "Failed to fetch overview",
  );

  return res.data;
}

export async function fetchPositions() {
  const res = await parseJsonOrThrow<ApiEnvelope<PositionsApiData>>(
    await fetchWithTimeout(`${BASE_URL}/positions`),
    "Failed to fetch positions",
  );

  return res.data;
}

export async function fetchCalendar(
  scope: "all" | "binance" | "stock" = "all",
) {
  const res = await parseJsonOrThrow<ApiEnvelope<CalendarApiData>>(
    await fetchWithTimeout(`${BASE_URL}/calendar?scope=${encodeURIComponent(scope)}`),
    "Failed to fetch calendar",
  );

  return res.data;
}

export async function rebuildDerivedViews() {
  const res = await parseJsonOrThrow<
    ApiEnvelope<{
      calendar: CalendarApiData["days"];
      snapshots: HistorySnapshotApiItem[];
    }>
  >(
    await fetchWithTimeout(`${BASE_URL}/history/rebuild-derived`, {
      method: "POST",
    }, 30_000),
    "Failed to rebuild derived history",
  );

  return res.data;
}

export async function refreshPortfolioData() {
  const accountsRes = await parseJsonOrThrow<ApiEnvelope<StoreAccountItem[]>>(
    await fetchWithTimeout(`${BASE_URL}/store/accounts?source=binance`),
    "Failed to fetch Binance accounts",
  );

  const accounts = Array.isArray(accountsRes.data) ? accountsRes.data : [];
  const results: Array<{
    accountId: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const account of accounts) {
    try {
      await parseJsonOrThrow(
        await fetchWithTimeout(
          `${BASE_URL}/sync/binance/accounts/${encodeURIComponent(account.id)}`,
          { method: "POST" },
          30_000,
        ),
        `Failed to sync Binance account ${account.id}`,
      );

      results.push({
        accountId: account.id,
        ok: true,
      });
    } catch (error) {
      results.push({
        accountId: account.id,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown sync error",
      });
    }
  }

  try {
    await rebuildDerivedViews();
  } catch (error) {
    console.warn("Rebuild derived views failed after re-sync:", error);
  }

  return {
    syncedAccounts: results.filter((item) => item.ok).length,
    failedAccounts: results.filter((item) => !item.ok).length,
    results,
  };
}

export async function fetchSummary() {
  return fetchDashboardSummary();
}

export async function fetchDailyPnL(month?: string) {
  const calendar = await fetchCalendar("all");

  const filteredDays = Array.isArray(calendar.days)
    ? month
      ? calendar.days.filter((item) => item.date.startsWith(month))
      : calendar.days
    : [];

  return {
    success: true,
    month: month ?? filteredDays[0]?.date?.slice(0, 7) ?? "",
    points: filteredDays.map((item) => ({
      date: item.date,
      net: Number(item.totalPnl ?? 0),
      fundingFee: 0,
      commission: 0,
      realizedPnl: Number(item.realizedPnl ?? 0),
      currentUnrealizedPnL: Number(item.unrealizedPnl ?? 0),
      totalValue: Number(item.endValueUsd ?? 0),
    })),
  };
}

export async function connectAccount(_payload: {
  provider: ProviderName;
  apiKey: string;
  apiSecret: string;
}) {
  return notImplemented("connectAccount");
}

export async function fetchAccounts() {
  const res = await parseJsonOrThrow<ApiEnvelope<StoreAccountItem[]>>(
    await fetchWithTimeout(`${BASE_URL}/store/accounts`),
    "Failed to fetch accounts",
  );

  return res.data;
}

export async function fetchAssets(source?: "binance" | "stock" | "fund") {
  const suffix = source ? `?source=${encodeURIComponent(source)}` : "";
  const res = await parseJsonOrThrow<ApiEnvelope<StoreAssetItem[]>>(
    await fetchWithTimeout(`${BASE_URL}/store/assets${suffix}`),
    "Failed to fetch assets",
  );

  return res.data;
}

export async function fetchAccountAssetLinks(accountId?: string) {
  const suffix = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
  const res = await parseJsonOrThrow<ApiEnvelope<AccountAssetLinkItem[]>>(
    await fetchWithTimeout(`${BASE_URL}/store/account-asset-links${suffix}`),
    "Failed to fetch asset links",
  );

  return res.data;
}

export async function fetchPortfolioAssets() {
  const res = await parseJsonOrThrow<ApiEnvelope<PortfolioAssetValuationItem[]>>(
    await fetchWithTimeout(`${BASE_URL}/portfolio/assets`),
    "Failed to fetch portfolio assets",
  );

  return res.data;
}

export async function updateAccountAssetLinkQuantity(
  linkId: string,
  quantity: number,
) {
  const res = await parseJsonOrThrow<ApiEnvelope<AccountAssetLinkItem>>(
    await fetchWithTimeout(
      `${BASE_URL}/store/account-asset-links/${encodeURIComponent(linkId)}/quantity`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity }),
      },
      20_000,
    ),
    "Failed to update quantity",
  );

  return res.data;
}

export async function unlinkAccountAsset(linkId: string) {
  await parseJsonOrThrow<ApiEnvelope<null>>(
    await fetchWithTimeout(
      `${BASE_URL}/store/account-asset-links/${encodeURIComponent(linkId)}`,
      {
        method: "DELETE",
      },
      20_000,
    ),
    "Failed to unlink asset",
  );

  return true;
}

export async function refreshAssetPrice(asset: Pick<StoreAssetItem, "id" | "source">) {
  const path =
    asset.source === "fund"
      ? `/fund/nav/refresh/${encodeURIComponent(asset.id)}`
      : `/market/refresh/${encodeURIComponent(asset.id)}`;

  const res = await parseJsonOrThrow<ApiEnvelope<unknown>>(
    await fetchWithTimeout(`${BASE_URL}${path}`, {
      method: "POST",
    }, 20_000),
    "Failed to refresh asset",
  );

  return res.data;
}

export async function fetchAccountsBreakdown() {
  return notImplemented("fetchAccountsBreakdown");
}

export async function testProviderAccount(_payload: {
  provider: ProviderName;
  apiKey: string;
  apiSecret: string;
}) {
  return notImplemented("testProviderAccount");
}

export async function fetchProviderPortfolio(_payload: {
  provider: ProviderName;
  apiKey: string;
  apiSecret: string;
}) {
  return notImplemented("fetchProviderPortfolio");
}

export async function fetchDashboardSummary() {
  const data = await fetchDashboard();
  return normalizeDashboardSummary(data);
}

export async function fetchDashboardBreakdown() {
  const data = await fetchDashboard();
  return normalizeDashboardBreakdown(data);
}

export async function fetchEquityCurve() {
  const res = await parseJsonOrThrow<ApiEnvelope<HistorySnapshotApiItem[]>>(
    await fetchWithTimeout(`${BASE_URL}/history/snapshots`),
    "Failed to fetch equity curve",
  );

  return {
    success: true,
    points: res.data.map((item) => ({
      date: item.date,
      totalValue: Number(item.totalValueUsd ?? 0),
      spotValue: 0,
      futuresWallet: Number(item.binanceValueUsd ?? 0),
      stockValue: Number(item.stockValueUsd ?? 0),
      fundValue: Number(item.fundValueUsd ?? 0),
      cashBalance: Number(item.cashValueUsd ?? 0),
    })),
  };
}

export async function fetchAlerts() {
  return { success: true, alerts: [] };
}

export async function captureProviderSnapshot(_provider: ProviderName) {
  return notImplemented("captureProviderSnapshot");
}

export async function syncMarketData(_scope: MarketSyncScope = "all") {
  return notImplemented("syncMarketData");
}

export async function fetchStockAssets() {
  return notImplemented("fetchStockAssets");
}

export async function fetchBinancePortfolio(
  _apiKey: string,
  _apiSecret: string,
) {
  return notImplemented("fetchBinancePortfolio");
}

export async function fetchPerformance() {
  const res = await parseJsonOrThrow<ApiEnvelope<HistorySnapshotApiItem[]>>(
    await fetchWithTimeout(`${BASE_URL}/history/snapshots`),
    "Failed to fetch performance",
  );

  return {
    success: true,
    month: "",
    series: res.data.map((item) => ({
      date: item.date,
      totalValue: Number(item.totalValueUsd ?? 0),
      dailyReturnPct: undefined,
      drawdownPct: undefined,
    })),
  };
}

export async function fetchPortfolioHistory(params?: {
  startDate?: string;
  endDate?: string;
}) {
  const res = await parseJsonOrThrow<ApiEnvelope<HistorySnapshotApiItem[]>>(
    await fetchWithTimeout(`${BASE_URL}/history/snapshots`),
    "Failed to fetch portfolio history",
  );

  const filtered = res.data.filter((item) => {
    if (params?.startDate && item.date < params.startDate) {
      return false;
    }

    if (params?.endDate && item.date > params.endDate) {
      return false;
    }

    return true;
  });

  return {
    success: true,
    data: filtered.map((item) => ({
      date: item.date,
      totalValue: Number(item.totalValueUsd ?? 0),
      stockValue: Number(item.stockValueUsd ?? 0),
      fundValue: Number(item.fundValueUsd ?? 0),
      cashBalance: Number(item.cashValueUsd ?? 0),
      realizedPnl: 0,
      unrealizedPnl: 0,
      changeUnrealized: 0,
      totalPnl: Number(item.totalPnlUsd ?? 0),
      positions: [],
      meta: {
        source: "snapshot" as const,
        syncedAt: item.updatedAt,
        baseCurrency: "USD" as const,
      },
    })),
  };
}

export async function searchAssets(
  provider: "twelvedata" | "sec",
  query: string,
): Promise<SearchAssetResultItem[]> {
  const res = await parseJsonOrThrow<ApiEnvelope<SearchAssetResultItem[]>>(
    await fetchWithTimeout(
      `${BASE_URL}/providers/${provider}/search?query=${encodeURIComponent(query)}`,
      {},
      15_000,
    ),
    "Failed to search assets",
  );

  return res.data;
}

export async function onboardAsset(payload: {
  provider: "twelvedata" | "sec";
  symbol: string;
  name: string;
  exchange?: string | null;
  projId?: string;
  currency: string;
  accountId: string;
  quantity?: number;
}): Promise<OnboardResponse> {
  const res = await parseJsonOrThrow<ApiEnvelope<OnboardResponse>>(
    await fetchWithTimeout(
      `${BASE_URL}/store/assets/onboard-from-provider`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      30_000,
    ),
    "Failed to onboard asset",
  );

  return res.data;
}

export async function updateAccountName(accountId: string, name: string) {
  const res = await parseJsonOrThrow<ApiEnvelope<StoreAccountItem>>(
    await fetchWithTimeout(
      `${BASE_URL}/store/accounts/${encodeURIComponent(accountId)}/name`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      },
      15_000,
    ),
    "Failed to update account name",
  );

  return res.data;
}