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