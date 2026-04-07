import { randomUUID } from "crypto";
import { env } from "../config/env";
import { createBinanceSignature, buildQueryString } from "../lib/binance-signature";
import { getJson } from "../lib/http-client";
import { NotFoundError, ValidationError } from "../shared/errors";
import { readStore, writeStore } from "../storage/store.repository";
import type { BinanceAccountSettings } from "../storage/storage.types";
import type {
  BinanceFuturesPosition,
  BinanceFuturesPositionsResponse,
  BinancePortfolioResponse,
  BinancePrivateAccountInfo,
  BinancePublicApiHealth,
  BinanceSpotHolding,
  BinanceSpotHoldingsResponse,
  BinanceSyncReadiness
} from "./provider.types";

interface BinanceSpotTradeApiItem {
  symbol: string;
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
}

interface BinanceFuturesTradeApiItem {
  symbol: string;
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  side: "BUY" | "SELL";
}

interface BinanceTickerPriceResponse {
  symbol: string;
  price: string;
}

interface BinanceFuturesPositionRiskResponseItem {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  maxNotionalValue: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: "BOTH" | "LONG" | "SHORT";
  notional: string;
  isolatedWallet: string;
  updateTime: number;
  marginAsset?: string;
}

interface BinanceFuturesIncomeApiItem {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  info: string;
  time: number;
  tranId: number;
  tradeId?: string;
}

function getApiKeyPreview(apiKey: string): string {
  if (apiKey.length <= 8) {
    return apiKey;
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function isBinanceSettings(settings: unknown): settings is BinanceAccountSettings {
  if (!settings || typeof settings !== "object") {
    return false;
  }

  const value = settings as Partial<BinanceAccountSettings>;

  return (
    typeof value.apiKey === "string" &&
    typeof value.apiSecret === "string" &&
    typeof value.isTestnet === "boolean" &&
    Array.isArray(value.permissions) &&
    ("lastValidatedAt" in value)
  );
}

async function getBinanceAccountSettings(accountId: string): Promise<{
  accountId: string;
  settings: BinanceAccountSettings;
}> {
  const store = await readStore();
  const account = store.accounts.find((item) => item.id === accountId);

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  if (account.source !== "binance" || account.provider !== "binance") {
    throw new ValidationError("Account is not a Binance account");
  }

  if (!isBinanceSettings(account.settings)) {
    throw new ValidationError("Missing Binance settings");
  }

  return {
    accountId: account.id,
    settings: account.settings
  };
}

function toPositiveNumber(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}

function toNumber(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function buildSpotSymbol(asset: string): string | null {
  if (asset === "USDT") {
    return "USDTUSDT";
  }

  if (asset === "FDUSD") {
    return "FDUSDUSDT";
  }

  if (asset === "USDC") {
    return "USDCUSDT";
  }

  if (asset === "BUSD") {
    return "BUSDUSDT";
  }

  return `${asset}USDT`;
}

async function getSpotAssetPriceUsd(asset: string): Promise<{ symbol: string | null; priceUsd: number | null }> {
  if (asset === "USDT" || asset === "FDUSD" || asset === "USDC" || asset === "BUSD") {
    return {
      symbol: buildSpotSymbol(asset),
      priceUsd: 1
    };
  }

  const symbol = buildSpotSymbol(asset);

  if (!symbol) {
    return {
      symbol: null,
      priceUsd: null
    };
  }

  try {
    const response = await getJson<BinanceTickerPriceResponse>(
      `${env.BINANCE_API_BASE_URL}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`
    );

    const priceUsd = Number(response.price);

    if (!Number.isFinite(priceUsd)) {
      return {
        symbol,
        priceUsd: null
      };
    }

    return {
      symbol,
      priceUsd
    };
  } catch {
    return {
      symbol,
      priceUsd: null
    };
  }
}

async function signedSpotGet<T>(
  accountId: string,
  path: string,
  extraParams: Record<string, string | number | boolean> = {}
): Promise<T> {
  const { settings } = await getBinanceAccountSettings(accountId);

  const queryString = buildQueryString({
    timestamp: Date.now(),
    recvWindow: 10000,
    ...extraParams
  });

  const signature = createBinanceSignature(queryString, settings.apiSecret);
  const url = `${env.BINANCE_API_BASE_URL}${path}?${queryString}&signature=${signature}`;

  return getJson<T>(url, {
    headers: {
      "X-MBX-APIKEY": settings.apiKey
    }
  });
}

async function signedFuturesGet<T>(
  accountId: string,
  path: string,
  extraParams: Record<string, string | number | boolean> = {}
): Promise<T> {
  const { settings } = await getBinanceAccountSettings(accountId);

  const queryString = buildQueryString({
    timestamp: Date.now(),
    recvWindow: 10000,
    ...extraParams
  });

  const signature = createBinanceSignature(queryString, settings.apiSecret);
  const url = `${env.BINANCE_FAPI_BASE_URL}${path}?${queryString}&signature=${signature}`;

  return getJson<T>(url, {
    headers: {
      "X-MBX-APIKEY": settings.apiKey
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toIsoFromEpochMs(value: number): string {
  return new Date(value).toISOString();
}

function buildExistingTradeKey(assetId: string, market: "spot" | "futures", tradeId: string): string {
  return `${assetId}_${market}_${tradeId}`;
}

function getLastTradeCursorByAssetAndMarket(
  transactions: any[],
  market: "spot" | "futures"
): Map<string, number> {
  const result = new Map<string, number>();

  for (const tx of transactions) {
    if (tx?.source !== "binance") continue;
    if (tx?.market !== market) continue;
    if (typeof tx?.assetId !== "string") continue;

    const parsedTradeId = Number(tx.tradeId);
    if (!Number.isFinite(parsedTradeId)) continue;

    const prev = result.get(tx.assetId) ?? 0;
    if (parsedTradeId > prev) {
      result.set(tx.assetId, parsedTradeId);
    }
  }

  return result;
}

export async function getBinanceSyncReadiness(accountId: string): Promise<BinanceSyncReadiness> {
  const store = await readStore();
  const account = store.accounts.find((item) => item.id === accountId);

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  if (account.source !== "binance" || account.provider !== "binance") {
    throw new ValidationError("Account is not a Binance account");
  }

  const reasons: string[] = [];

  if (!isBinanceSettings(account.settings)) {
    reasons.push("Missing Binance settings");
  }

  const settings = isBinanceSettings(account.settings) ? account.settings : null;

  if (settings && !settings.apiKey.trim()) {
    reasons.push("Missing API key");
  }

  if (settings && !settings.apiSecret.trim()) {
    reasons.push("Missing API secret");
  }

  if (settings && settings.permissions.length === 0) {
    reasons.push("No permissions configured");
  }

  return {
    accountId: account.id,
    provider: "binance",
    ready: reasons.length === 0,
    reasons,
    apiKeyPreview: settings ? getApiKeyPreview(settings.apiKey) : null,
    isTestnet: settings ? settings.isTestnet : null,
    permissions: settings ? settings.permissions : []
  };
}

export async function getBinancePublicApiHealth(): Promise<BinancePublicApiHealth> {
  let spotPingOk = false;
  let futuresPingOk = false;
  let serverTime: number | null = null;

  try {
    await getJson<Record<string, never>>(`${env.BINANCE_API_BASE_URL}/api/v3/ping`);
    spotPingOk = true;
  } catch {
    spotPingOk = false;
  }

  try {
    await getJson<Record<string, never>>(`${env.BINANCE_FAPI_BASE_URL}/fapi/v1/ping`);
    futuresPingOk = true;
  } catch {
    futuresPingOk = false;
  }

  try {
    const timeResponse = await getJson<{ serverTime: number }>(
      `${env.BINANCE_API_BASE_URL}/api/v3/time`
    );
    serverTime = timeResponse.serverTime;
  } catch {
    serverTime = null;
  }

  return {
    ok: spotPingOk || futuresPingOk,
    provider: "binance",
    spotPingOk,
    futuresPingOk,
    serverTime,
    spotBaseUrl: env.BINANCE_API_BASE_URL,
    futuresBaseUrl: env.BINANCE_FAPI_BASE_URL
  };
}

export async function getBinancePrivateAccountInfo(
  accountId: string
): Promise<BinancePrivateAccountInfo> {
  const accountInfo = await signedSpotGet<BinancePrivateAccountInfo>(accountId, "/api/v3/account");

  const store = await readStore();
  const account = store.accounts.find((item) => item.id === accountId);

  if (account && account.settings && isBinanceSettings(account.settings)) {
    account.settings.lastValidatedAt = new Date().toISOString();
    account.updatedAt = new Date().toISOString();
    await writeStore(store);
  }

  return accountInfo;
}

export async function getBinanceSpotHoldings(
  accountId: string
): Promise<BinanceSpotHoldingsResponse> {
  const accountInfo = await getBinancePrivateAccountInfo(accountId);
  const balances = Array.isArray(accountInfo.balances) ? accountInfo.balances : [];

  const activeBalances = balances
    .map((balance) => {
      const free = toPositiveNumber(balance.free);
      const locked = toPositiveNumber(balance.locked);
      const total = free + locked;

      return {
        asset: balance.asset,
        free,
        locked,
        total
      };
    })
    .filter((balance) => balance.total > 0);

  const holdings: BinanceSpotHolding[] = [];

  for (const balance of activeBalances) {
    const pricing = await getSpotAssetPriceUsd(balance.asset);
    const valueUsd =
      pricing.priceUsd !== null ? Number((balance.total * pricing.priceUsd).toFixed(8)) : null;

    holdings.push({
      asset: balance.asset,
      free: balance.free,
      locked: balance.locked,
      total: balance.total,
      symbol: pricing.symbol,
      priceUsd: pricing.priceUsd,
      valueUsd
    });
  }

  holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  return {
    accountId,
    fetchedAt: new Date().toISOString(),
    holdings
  };
}

export async function getBinanceFuturesPositions(
  accountId: string
): Promise<BinanceFuturesPositionsResponse> {
  const response = await signedFuturesGet<BinanceFuturesPositionRiskResponseItem[]>(
    accountId,
    "/fapi/v2/positionRisk"
  );

  const positions: BinanceFuturesPosition[] = response
    .map((item) => {
      const quantity = toNumber(item.positionAmt);
      const entryPrice = toNumber(item.entryPrice);
      const markPrice = toNumber(item.markPrice);
      const unrealizedPnl = toNumber(item.unRealizedProfit);
      const notionalUsd = Math.abs(toNumber(item.notional));
      const leverage = item.leverage ? toNumber(item.leverage) : null;

      return {
        symbol: item.symbol,
        side: item.positionSide,
        quantity,
        entryPrice,
        markPrice,
        unrealizedPnl,
        notionalUsd,
        leverage,
        marginAsset: item.marginAsset ?? "USDT",
        isolated: item.marginType === "isolated"
      };
    })
    .filter(
      (position) =>
        position.quantity !== 0 || position.notionalUsd !== 0 || position.unrealizedPnl !== 0
    );

  positions.sort((a, b) => b.notionalUsd - a.notionalUsd);

  return {
    accountId,
    fetchedAt: new Date().toISOString(),
    positions
  };
}

export async function getBinancePortfolio(
  accountId: string
): Promise<BinancePortfolioResponse> {
  const [spotResult, futuresResult] = await Promise.all([
    getBinanceSpotHoldings(accountId),
    getBinanceFuturesPositions(accountId)
  ]);

  const totalSpotValueUsd = Number(
    spotResult.holdings
      .reduce((sum, holding) => sum + (holding.valueUsd ?? 0), 0)
      .toFixed(8)
  );

  const pricedCount = spotResult.holdings.filter((holding) => holding.valueUsd !== null).length;
  const unpricedCount = spotResult.holdings.length - pricedCount;

  const totalNotionalUsd = Number(
    futuresResult.positions.reduce((sum, position) => sum + position.notionalUsd, 0).toFixed(8)
  );

  const totalUnrealizedPnl = Number(
    futuresResult.positions.reduce((sum, position) => sum + position.unrealizedPnl, 0).toFixed(8)
  );

  return {
    accountId,
    fetchedAt: new Date().toISOString(),
    spot: {
      holdings: spotResult.holdings,
      totalValueUsd: totalSpotValueUsd,
      pricedCount,
      unpricedCount
    },
    futures: {
      positions: futuresResult.positions,
      totalNotionalUsd,
      totalUnrealizedPnl,
      positionCount: futuresResult.positions.length
    }
  };
}

export async function getBinanceFuturesIncomeHistory(
  accountId: string,
  params: {
    incomeType?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}
): Promise<import("./provider.types").BinanceFuturesIncomeRecord[]> {
  const response = await signedFuturesGet<BinanceFuturesIncomeApiItem[]>(
    accountId,
    "/fapi/v1/income",
    {
      incomeType: params.incomeType ?? "",
      startTime: params.startTime ?? "",
      endTime: params.endTime ?? "",
      limit: params.limit ?? 1000
    }
  );

  return response.map((item) => ({
    symbol: item.symbol,
    incomeType: item.incomeType,
    income: Number(item.income),
    asset: item.asset,
    info: item.info,
    time: item.time,
    tranId: item.tranId,
    tradeId: item.tradeId
  }));
}

export async function getBinanceSpotTrades(
  accountId: string,
  symbol: string,
  params: {
    limit?: number;
    fromId?: number;
  } = {}
): Promise<BinanceSpotTradeApiItem[]> {
  return signedSpotGet<BinanceSpotTradeApiItem[]>(
    accountId,
    "/api/v3/myTrades",
    {
      symbol,
      limit: params.limit ?? 500,
      ...(params.fromId ? { fromId: params.fromId } : {})
    }
  );
}

export async function getBinanceFuturesTrades(
  accountId: string,
  symbol: string,
  params: {
    limit?: number;
    fromId?: number;
  } = {}
): Promise<BinanceFuturesTradeApiItem[]> {
  return signedFuturesGet<BinanceFuturesTradeApiItem[]>(
    accountId,
    "/fapi/v1/userTrades",
    {
      symbol,
      limit: params.limit ?? 500,
      ...(params.fromId ? { fromId: params.fromId } : {})
    }
  );
}

function mapSpotTradeToTransaction(
  trade: BinanceSpotTradeApiItem,
  assetId: string
) {
  return {
    assetId,
    market: "spot" as const,
    side: trade.isBuyer ? "buy" : "sell",
    quantity: Number(trade.qty),
    price: Number(trade.price),
    currency: "USD" as const,
    fee: Number(trade.commission),
    feeCurrency: trade.commissionAsset,
    executedAt: toIsoFromEpochMs(trade.time),
    source: "binance" as const,
    orderId: String(trade.orderId),
    tradeId: String(trade.id)
  };
}

function mapFuturesTradeToTransaction(
  trade: BinanceFuturesTradeApiItem,
  assetId: string
) {
  return {
    assetId,
    market: "futures" as const,
    side: trade.side === "BUY" ? "buy" : "sell",
    quantity: Number(trade.qty),
    price: Number(trade.price),
    currency: "USD" as const,
    fee: Number(trade.commission),
    feeCurrency: trade.commissionAsset,
    executedAt: toIsoFromEpochMs(trade.time),
    source: "binance" as const,
    orderId: String(trade.orderId),
    tradeId: String(trade.id)
  };
}

async function fetchAllSpotTradesIncremental(
  accountId: string,
  assetId: string,
  symbol: string,
  lastTradeId?: number
): Promise<ReturnType<typeof mapSpotTradeToTransaction>[]> {
  const collected: ReturnType<typeof mapSpotTradeToTransaction>[] = [];
  let fromId = lastTradeId && lastTradeId > 0 ? lastTradeId + 1 : undefined;

  while (true) {
    const page = await getBinanceSpotTrades(accountId, symbol, {
      limit: 500,
      fromId
    });

    if (!page.length) {
      break;
    }

    for (const trade of page) {
      collected.push(mapSpotTradeToTransaction(trade, assetId));
    }

    if (page.length < 500) {
      break;
    }

    const last = page[page.length - 1];
    if (!last) {
      break;
    }

    fromId = last.id + 1;
    await sleep(200);
  }

  return collected;
}

async function fetchAllFuturesTradesIncremental(
  accountId: string,
  assetId: string,
  symbol: string,
  lastTradeId?: number
): Promise<ReturnType<typeof mapFuturesTradeToTransaction>[]> {
  const collected: ReturnType<typeof mapFuturesTradeToTransaction>[] = [];
  let fromId = lastTradeId && lastTradeId > 0 ? lastTradeId + 1 : undefined;

  while (true) {
    const page = await getBinanceFuturesTrades(accountId, symbol, {
      limit: 500,
      fromId
    });

    if (!page.length) {
      break;
    }

    for (const trade of page) {
      collected.push(mapFuturesTradeToTransaction(trade, assetId));
    }

    if (page.length < 500) {
      break;
    }

    const last = page[page.length - 1];
    if (!last) {
      break;
    }

    fromId = last.id + 1;
    await sleep(200);
  }

  return collected;
}

export async function syncBinanceTradesToStore(accountId: string) {
  const store = await readStore();

  const assets = store.assets.filter((a) => a.source === "binance");
  const existingTx = store.transactions ?? [];

  const lastSpotTradeIdByAsset = getLastTradeCursorByAssetAndMarket(existingTx, "spot");
  const lastFuturesTradeIdByAsset = getLastTradeCursorByAssetAndMarket(existingTx, "futures");

  const existingKeys = new Set(
    existingTx
      .filter((t: any) => t?.source === "binance")
      .map((t: any) =>
        buildExistingTradeKey(
          t.assetId,
          t.market === "futures" ? "futures" : "spot",
          String(t.tradeId)
        )
      )
  );

  const newTransactions: any[] = [];

  for (const asset of assets) {
    const symbol = asset.symbol;

    try {
      const spotTrades = await fetchAllSpotTradesIncremental(
        accountId,
        asset.id,
        symbol,
        lastSpotTradeIdByAsset.get(asset.id)
      );

      for (const trade of spotTrades) {
        const key = buildExistingTradeKey(asset.id, "spot", trade.tradeId);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        newTransactions.push(trade);
      }
    } catch {
      // ignore per-symbol failures to keep sync resilient
    }

    await sleep(150);

    try {
      const futuresTrades = await fetchAllFuturesTradesIncremental(
        accountId,
        asset.id,
        symbol,
        lastFuturesTradeIdByAsset.get(asset.id)
      );

      for (const trade of futuresTrades) {
        const key = buildExistingTradeKey(asset.id, "futures", trade.tradeId);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        newTransactions.push(trade);
      }
    } catch {
      // ignore per-symbol failures to keep sync resilient
    }

    await sleep(150);
  }

  store.transactions = [
    ...existingTx,
    ...newTransactions.map((t) => ({
      id: randomUUID(),
      accountId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...t
    }))
  ];

  await writeStore(store);

  return {
    inserted: newTransactions.length
  };
}