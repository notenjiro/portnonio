import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import crypto from "node:crypto";

import { getBinanceDailyAccountSnapshot } from "./services/binance.service.js";
import {
  getBinanceFuturesAccountInfo,
  getBinanceFuturesIncomeHistory,
  getBinanceFuturesPositions,
  summarizeFuturesAccount,
  type BinanceFuturesIncome,
  type BinanceIncomeType,
} from "./services/binance-futures.service.js";

import {
  buildProviderBreakdown,
  buildProviderSummary,
  mergePortfolioBreakdowns,
  mergePortfolioSummaries,
  testProviderConnection,
  type PortfolioSummary,
} from "./services/portfolio-provider.service.js";
import type { ProviderName } from "./services/providers/provider.types.js";

import {
  calculateStockPositions,
  createNormalizedStockOrder,
  createStockAsset,
  createStockOrder,
  listStockAssets,
  listStockOrders,
  listStockPrices,
  upsertStockPrice,
  type StockPriceSnapshot,
} from "./services/stock-ledger.service.js";

import {
  fetchFundNav,
  listSupportedFundSymbols,
} from "./services/fund-nav.service.js";

import {
  syncActiveFundNavs,
  syncActiveStockPrices,
  syncAllMarketData,
} from "./services/market-sync.service.js";

import {
  readStore,
  writeStore,
  type ConnectedAccount,
  type DailySnapshot,
  type Store,
} from "./lib/store.js";

import {
  savePortfolioSnapshotToday,
  savePortfolioSnapshotForDate,
  rebuildPortfolioHistoryRange,
  listPortfolioSnapshots,
  getPortfolioSnapshot,
  getPortfolioHistoryWindow,
  syncMarketHistoryFromStorePrices,
} from "./services/portfolio-snapshot.service.js";

import { backfillMarketHistory } from "./services/backfill.service.js";
import { buildPerformanceSeries } from "./services/performance.service.js";

import type {
  BinanceDailySnapshotResponse,
  BinanceDailySnapshotVo,
} from "./services/binance.service.js";

dotenv.config();

type Provider = ProviderName;

function sanitizeAscii(value: string) {
  return value.replace(/[^\x00-\x7F]/g, "").trim();
}

function isAscii(value: string) {
  return /^[\x00-\x7F]+$/.test(value);
}

function getLatestAccountByProvider(store: Store, provider: Provider) {
  const accounts = store.connectedAccounts.filter(
    (account) => account.provider === provider,
  );

  if (accounts.length === 0) return null;

  return accounts[accounts.length - 1] ?? null;
}

function getBangkokToday() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function toBangkokDateKey(timestamp: number) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(timestamp));
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function toBinanceCalendarDateKey(timestamp: number) {
  return addDaysToDateKey(toBangkokDateKey(timestamp), -1);
}

function parseMonthKey(monthKey?: string) {
  const fallback = new Date();
  const fallbackYear = fallback.getFullYear();
  const fallbackMonth = fallback.getMonth();

  if (!monthKey) {
    return { year: fallbackYear, monthIndex: fallbackMonth };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) {
    return { year: fallbackYear, monthIndex: fallbackMonth };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return { year: fallbackYear, monthIndex: fallbackMonth };
  }

  return {
    year,
    monthIndex: month - 1,
  };
}

function getMonthDatesInBangkok(monthKey?: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const { year, monthIndex } = parseMonthKey(monthKey);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const results: string[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    results.push(formatter.format(new Date(year, monthIndex, day)));
  }

  return results;
}

function getMonthRange(monthKey?: string) {
  const { year, monthIndex } = parseMonthKey(monthKey);

  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  return {
    startTime: start.getTime(),
    endTime: end.getTime(),
  };
}

function getExtendedMonthRange(monthKey?: string) {
  const { startTime, endTime } = getMonthRange(monthKey);

  const oneDayMs = 24 * 60 * 60 * 1000;

  return {
    startTime: startTime - oneDayMs,
    endTime: endTime + oneDayMs,
  };
}

function groupIncomeByDate(incomes: BinanceFuturesIncome[]) {
  const map = new Map<string, number>();

  for (const item of incomes) {
    const key = toBinanceCalendarDateKey(item.time);
    const current = map.get(key) ?? 0;
    map.set(key, current + Number(item.income));
  }

  return map;
}

function upsertSnapshot(store: Store, snapshot: DailySnapshot) {
  const index = store.snapshots.findIndex((s) => s.date === snapshot.date);

  if (index >= 0) {
    store.snapshots[index] = snapshot;
  } else {
    store.snapshots.push(snapshot);
    store.snapshots.sort((a, b) => a.date.localeCompare(b.date));
  }
}

function mergeSnapshotWithExisting(
  summary: PortfolioSummary,
  existing?: DailySnapshot,
): DailySnapshot {
  return {
    date: getBangkokToday(),
    totalValue: summary.totalValue,
    spotValue: summary.spotValue || existing?.spotValue || 0,
    futuresWallet: summary.futuresWallet || existing?.futuresWallet || 0,
    futuresUnrealizedPnL:
      summary.futuresUnrealizedPnL || existing?.futuresUnrealizedPnL || 0,
    stockValue: summary.stockValue || existing?.stockValue || 0,
    fundValue: summary.fundValue || existing?.fundValue || 0,
    cashBalance: summary.cashBalance || existing?.cashBalance || 0,
  };
}

async function captureTodayProviderSnapshot(
  store: Store,
  provider: Provider,
  apiKey: string,
  apiSecret: string,
) {
  const summary = await buildProviderSummary(provider, apiKey, apiSecret);
  const existing = store.snapshots.find((s) => s.date === getBangkokToday());

  let mergedSummary: PortfolioSummary;

  if (provider === "binance") {
    mergedSummary = mergePortfolioSummaries(summary, {
      totalValue:
        (existing?.stockValue ?? 0) +
        (existing?.fundValue ?? 0) +
        (existing?.cashBalance ?? 0),
      spotValue: 0,
      futuresWallet: 0,
      futuresUnrealizedPnL: 0,
      stockValue: existing?.stockValue ?? 0,
      fundValue: existing?.fundValue ?? 0,
      cashBalance: existing?.cashBalance ?? 0,
    });
  } else {
    mergedSummary = mergePortfolioSummaries(
      {
        totalValue: (existing?.spotValue ?? 0) + (existing?.futuresWallet ?? 0),
        spotValue: existing?.spotValue ?? 0,
        futuresWallet: existing?.futuresWallet ?? 0,
        futuresUnrealizedPnL: existing?.futuresUnrealizedPnL ?? 0,
        stockValue: 0,
        fundValue: 0,
        cashBalance: 0,
      },
      summary,
    );
  }

  const snapshot = mergeSnapshotWithExisting(mergedSummary, existing);

  upsertSnapshot(store, snapshot);
  store.totalValue = snapshot.totalValue;

  if (provider === "binance") {
    store.todayPnL = summary.futuresUnrealizedPnL;
  }

  return {
    summary,
    snapshot,
  };
}

async function buildCombinedDashboard(store: Store) {
  const latestBinance = getLatestAccountByProvider(store, "binance");
  const latestInnovestX = getLatestAccountByProvider(store, "innovestx");

  const [binanceSummary, innovestxSummary] = await Promise.all([
    latestBinance
      ? buildProviderSummary(
          "binance",
          latestBinance.apiKey,
          latestBinance.apiSecret,
        )
      : Promise.resolve(null),
    latestInnovestX
      ? buildProviderSummary(
          "innovestx",
          latestInnovestX.apiKey,
          latestInnovestX.apiSecret,
        )
      : Promise.resolve(null),
  ]);

  const summary = mergePortfolioSummaries(binanceSummary, innovestxSummary);

  const snapshot: DailySnapshot = {
    date: getBangkokToday(),
    totalValue: summary.totalValue,
    spotValue: summary.spotValue,
    futuresWallet: summary.futuresWallet,
    futuresUnrealizedPnL: summary.futuresUnrealizedPnL,
    stockValue: summary.stockValue,
    fundValue: summary.fundValue,
    cashBalance: summary.cashBalance,
  };

  upsertSnapshot(store, snapshot);
  store.totalValue = summary.totalValue;
  store.todayPnL = summary.futuresUnrealizedPnL;

  return {
    summary,
    snapshot,
  };
}

async function buildAccountBreakdown(store: Store) {
  const accounts = [...store.connectedAccounts].reverse();

  const results = await Promise.all(
    accounts.map(async (account) => {
      const summary = await buildProviderSummary(
        account.provider,
        account.apiKey,
        account.apiSecret,
      );

      return {
        id: account.id,
        provider: account.provider,
        createdAt: account.createdAt,
        totalValue: summary.totalValue,
        spotValue: summary.spotValue,
        futuresWallet: summary.futuresWallet,
        futuresPnL: summary.futuresUnrealizedPnL,
        stockValue: summary.stockValue,
        fundValue: summary.fundValue,
        cashBalance: summary.cashBalance,
      };
    }),
  );

  return results;
}

function buildStockLedgerBreakdown() {
  const positions = calculateStockPositions();
  const assets = listStockAssets();
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  const stockHoldings = positions
    .filter((item) => item.assetType !== "fund")
    .map((item) => {
      const asset = assetMap.get(item.assetId);

      return {
        symbol: item.symbol,
        name: item.name,
        quantity: item.quantity,
        averageCost: item.averageCost,
        lastPrice: item.lastPrice,
        marketValue: item.marketValue,
        costValue: item.costValue,
        unrealizedPnL: item.unrealizedPnL,
        lastSyncedAt: asset?.lastSyncedAt,
        lastSyncStatus: asset?.lastSyncStatus,
        lastSyncMessage: asset?.lastSyncMessage,
        lastPriceDate: asset?.lastPriceDate,
        lastPriceSource: asset?.lastPriceSource,
      };
    });

  const fundHoldings = positions
    .filter((item) => item.assetType === "fund")
    .map((item) => {
      const asset = assetMap.get(item.assetId);

      return {
        symbol: item.symbol,
        name: item.name,
        units: item.quantity,
        nav: item.lastPrice,
        marketValue: item.marketValue,
        costValue: item.costValue,
        unrealizedPnL: item.unrealizedPnL,
        lastSyncedAt: asset?.lastSyncedAt,
        lastSyncStatus: asset?.lastSyncStatus,
        lastSyncMessage: asset?.lastSyncMessage,
        lastPriceDate: asset?.lastPriceDate,
        lastPriceSource: asset?.lastPriceSource,
      };
    });

  const stockValue = stockHoldings.reduce(
    (sum, item) => sum + item.marketValue,
    0,
  );

  const fundValue = fundHoldings.reduce(
    (sum, item) => sum + item.marketValue,
    0,
  );

  return {
    stockValue,
    fundValue,
    stockHoldings,
    fundHoldings,
  };
}

function getLatestStockPrices() {
  const prices = listStockPrices();
  const latestByAsset = new Map<string, StockPriceSnapshot>();

  for (const price of prices) {
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

  return Array.from(latestByAsset.values())
    .map((item) => ({
      assetId: item.assetId,
      price: item.price,
      priceDate: item.priceDate,
      source: item.source,
      createdAt: item.createdAt,
    }))
    .sort((a, b) => a.assetId.localeCompare(b.assetId));
}

function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  const format = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    startDate: format(start),
    endDate: format(end),
  };
}

function refreshPortfolioHistoryArtifacts() {
  const marketHistory = syncMarketHistoryFromStorePrices();
  const portfolioSnapshot = savePortfolioSnapshotToday();
  const { startDate, endDate } = getCurrentMonthRange();
  const rebuilt = rebuildPortfolioHistoryRange(startDate, endDate);

  return {
    marketHistoryAssets: Object.keys(marketHistory).length,
    portfolioSnapshot,
    rebuiltDays: Object.keys(rebuilt).length,
  };
}

function sumSnapshotVoWalletBalance(
  snapshotVo:
    | {
        data?: {
          assets?: Array<{ walletBalance: string }>;
        };
      }
    | undefined,
) {
  return (
    snapshotVo?.data?.assets?.reduce(
      (sum, item) => sum + Number(item.walletBalance),
      0,
    ) ?? 0
  );
}

function sumSnapshotVoUnrealizedPnl(
  snapshotVo:
    | {
        data?: {
          position?: Array<{ unRealizedProfit: string }>;
        };
      }
    | undefined,
) {
  return (
    snapshotVo?.data?.position?.reduce(
      (sum, item) => sum + Number(item.unRealizedProfit),
      0,
    ) ?? 0
  );
}

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: true,
});

app.get("/health", async () => {
  return { ok: true, service: "portnonio-api" };
});

app.get("/summary", async () => {
  const store = readStore();

  return {
    totalValue: store.totalValue,
    todayPnL: store.todayPnL,
    accounts: store.connectedAccounts.length,
  };
});

app.post("/accounts/connect", async (request, reply) => {
  const body = request.body as {
    provider: Provider;
    apiKey: string;
    apiSecret: string;
  };

  const store = readStore();

  let apiKey = body.apiKey;
  let apiSecret = body.apiSecret;

  if (body.provider === "binance") {
    apiKey = sanitizeAscii(body.apiKey);
    apiSecret = sanitizeAscii(body.apiSecret);

    if (!apiKey || !apiSecret) {
      return reply.status(400).send({
        success: false,
        message: "Binance API key/secret is empty after sanitizing",
      });
    }

    if (!isAscii(apiKey) || !isAscii(apiSecret)) {
      return reply.status(400).send({
        success: false,
        message: "Binance API key/secret contains invalid characters",
      });
    }
  }

  const newAccount: ConnectedAccount = {
    id: crypto.randomUUID(),
    provider: body.provider,
    apiKey,
    apiSecret,
    createdAt: new Date().toISOString(),
  };

  store.connectedAccounts.push(newAccount);

  try {
    await captureTodayProviderSnapshot(store, body.provider, apiKey, apiSecret);

    writeStore(store);

    return reply.send({
      success: true,
      message: `Connected ${body.provider} successfully`,
      account: {
        id: newAccount.id,
        provider: newAccount.provider,
        createdAt: newAccount.createdAt,
      },
    });
  } catch (error) {
    store.connectedAccounts = store.connectedAccounts.filter(
      (account) => account.id !== newAccount.id,
    );

    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to connect account",
    });
  }
});

app.get("/accounts", async () => {
  const store = readStore();

  return store.connectedAccounts.map((account) => ({
    id: account.id,
    provider: account.provider,
    createdAt: account.createdAt,
  }));
});

app.get("/accounts/breakdown", async (_request, reply) => {
  try {
    const store = readStore();
    const accounts = await buildAccountBreakdown(store);

    return reply.send({
      success: true,
      accounts,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to load account breakdown",
    });
  }
});

app.post("/providers/:provider/test", async (request, reply) => {
  const params = request.params as {
    provider: Provider;
  };

  const body = request.body as {
    apiKey: string;
    apiSecret: string;
  };

  try {
    const result = await testProviderConnection(
      params.provider,
      body.apiKey,
      body.apiSecret,
    );

    return reply.send(result);
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/providers/:provider/portfolio", async (request, reply) => {
  const params = request.params as {
    provider: Provider;
  };

  const body = request.body as {
    apiKey: string;
    apiSecret: string;
  };

  try {
    const summary = await buildProviderSummary(
      params.provider,
      body.apiKey,
      body.apiSecret,
    );

    const breakdown = await buildProviderBreakdown(
      params.provider,
      body.apiKey,
      body.apiSecret,
    );

    return reply.send({
      success: true,
      provider: params.provider,
      summary,
      breakdown,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/dashboard/refresh", async (_request, reply) => {
  try {
    const store = readStore();
    const { summary, snapshot } = await buildCombinedDashboard(store);

    writeStore(store);

    return reply.send({
      success: true,
      summary,
      snapshot,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to refresh dashboard",
    });
  }
});

app.get("/dashboard/overview", async (_request, reply) => {
  try {
    const store = readStore();
    const latestBinance = getLatestAccountByProvider(store, "binance");
    const latestInnovestX = getLatestAccountByProvider(store, "innovestx");

    const [binanceSummary, innovestxSummary] = await Promise.all([
      latestBinance
        ? buildProviderSummary(
            "binance",
            latestBinance.apiKey,
            latestBinance.apiSecret,
          )
        : Promise.resolve(null),
      latestInnovestX
        ? buildProviderSummary(
            "innovestx",
            latestInnovestX.apiKey,
            latestInnovestX.apiSecret,
          )
        : Promise.resolve(null),
    ]);

    const stockBreakdown = buildStockLedgerBreakdown();

    const providerSummary = mergePortfolioSummaries(
      binanceSummary,
      innovestxSummary,
    );

    const totalValue =
      providerSummary.totalValue +
      stockBreakdown.stockValue +
      stockBreakdown.fundValue;

    return reply.send({
      success: true,
      totalValue,
      todayPnL: providerSummary.futuresUnrealizedPnL,
      connectedAccounts: store.connectedAccounts.length,
      providerSummary,
      stockBreakdown,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to load overview",
    });
  }
});

app.get("/dashboard", async (_request, reply) => {
  try {
    const store = readStore();

    const latestBinance = getLatestAccountByProvider(store, "binance");
    const latestInnovestX = getLatestAccountByProvider(store, "innovestx");

    const [binanceSummary, innovestxSummary] = await Promise.all([
      latestBinance
        ? buildProviderSummary(
            "binance",
            latestBinance.apiKey,
            latestBinance.apiSecret,
          )
        : Promise.resolve(null),
      latestInnovestX
        ? buildProviderSummary(
            "innovestx",
            latestInnovestX.apiKey,
            latestInnovestX.apiSecret,
          )
        : Promise.resolve(null),
    ]);

    const providerSummary = mergePortfolioSummaries(
      binanceSummary,
      innovestxSummary,
    );

    const providerBreakdown = mergePortfolioBreakdowns(
      latestBinance
        ? await buildProviderBreakdown(
            "binance",
            latestBinance.apiKey,
            latestBinance.apiSecret,
          )
        : null,
      latestInnovestX
        ? await buildProviderBreakdown(
            "innovestx",
            latestInnovestX.apiKey,
            latestInnovestX.apiSecret,
          )
        : null,
    );

    const stockBreakdown = buildStockLedgerBreakdown();

    const totalValue =
      providerSummary.totalValue +
      stockBreakdown.stockValue +
      stockBreakdown.fundValue;

    return reply.send({
      success: true,
      totalValue,
      todayPnL: providerSummary.futuresUnrealizedPnL,
      connectedAccounts: store.connectedAccounts.length,
      providerSummary,
      providerBreakdown,
      stockBreakdown,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to load dashboard",
    });
  }
});

app.get("/calendar", async (request, reply) => {
  try {
    const query = request.query as {
      month?: string;
    };

    const selectedMonthPrefix = (
      query.month ?? getBangkokToday().slice(0, 7)
    ).trim();
    const monthDates = getMonthDatesInBangkok(selectedMonthPrefix);
    const { startTime, endTime } = getExtendedMonthRange(selectedMonthPrefix);

    const store = readStore();
    const latestAccount = getLatestAccountByProvider(store, "binance");

    let accountSnapshot: BinanceDailySnapshotResponse | null = null;
    let incomes: BinanceFuturesIncome[] = [];

    if (latestAccount) {
      try {
        const [snapshotResult, incomeResult] = await Promise.all([
          getBinanceDailyAccountSnapshot(
            latestAccount.apiKey,
            latestAccount.apiSecret,
            "FUTURES",
            startTime,
            endTime,
            90,
          ),
          getBinanceFuturesIncomeHistory(
            latestAccount.apiKey,
            latestAccount.apiSecret,
            "REALIZED_PNL",
            startTime,
            endTime,
          ),
        ]);

        accountSnapshot = snapshotResult;
        incomes = incomeResult;
      } catch {
        accountSnapshot = null;
        incomes = [];
      }
    }

    const incomeMap = groupIncomeByDate(incomes);

    const localSnapshotMap = new Map(
      (store.snapshots ?? []).map((snapshot) => [snapshot.date, snapshot]),
    );

    const orderedSnapshotVos = [...(accountSnapshot?.snapshotVos ?? [])].sort(
      (a, b) => a.updateTime - b.updateTime,
    );

    const shiftedAccountSnapshots = orderedSnapshotVos.map((item) => {
      const dateKey = toBinanceCalendarDateKey(item.updateTime);
      const futuresWallet = Number(sumSnapshotVoWalletBalance(item));
      const futuresUnrealizedPnL = Number(sumSnapshotVoUnrealizedPnl(item));

      return {
        item,
        dateKey,
        futuresWallet,
        futuresUnrealizedPnL,
        totalValue: futuresWallet,
      };
    });

    const exactAccountSnapshotMap = new Map(
      shiftedAccountSnapshots.map((entry) => [entry.dateKey, entry]),
    );

    const shiftedDailyPnlMap = new Map<string, number>();

    for (let i = 0; i < shiftedAccountSnapshots.length; i += 1) {
      const current = shiftedAccountSnapshots[i];
      const previous = shiftedAccountSnapshots[i - 1];

      if (!current || !previous) {
        continue;
      }

      shiftedDailyPnlMap.set(
        current.dateKey,
        current.totalValue - previous.totalValue,
      );
    }

    function getLatestLocalSnapshotOnOrBefore(date: string) {
      const snapshots = (store.snapshots ?? [])
        .filter((s: DailySnapshot) => s.date <= date)
        .sort((a: DailySnapshot, b: DailySnapshot) =>
          b.date.localeCompare(a.date),
        );

      return snapshots[0] ?? null;
    }

    function getLatestShiftedSnapshotOnOrBefore(date: string) {
      const candidates = shiftedAccountSnapshots
        .filter((entry) => entry.dateKey <= date)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

      return candidates[0] ?? null;
    }

    const days: Array<any> = [];

    for (const date of monthDates) {
      const exactSnapshot = exactAccountSnapshotMap.get(date);
      const fallbackSnapshot = getLatestShiftedSnapshotOnOrBefore(date);
      const accountSnapshotEntry = exactSnapshot ?? fallbackSnapshot;

      const futuresWallet = accountSnapshotEntry?.futuresWallet ?? 0;
      const futuresUnrealizedPnL =
        accountSnapshotEntry?.futuresUnrealizedPnL ?? 0;

      const localSnapshot =
        localSnapshotMap.get(date) ?? getLatestLocalSnapshotOnOrBefore(date);

      const stockValue = Number(localSnapshot?.stockValue ?? 0);
      const fundValue = Number(localSnapshot?.fundValue ?? 0);
      const cashBalance = Number(localSnapshot?.cashBalance ?? 0);

      const totalValue = futuresWallet + stockValue + fundValue + cashBalance;

      const realizedPnl = incomeMap.get(date) ?? 0;
      const dailyPnl = shiftedDailyPnlMap.get(date) ?? 0;
      const changeUnrealized = dailyPnl - realizedPnl;

      days.push({
        date,
        totalValue,
        dailyPnl,
        realizedPnl,
        changeUnrealized,
        futuresWallet,
        futuresUnrealizedPnL,
        stockValue,
        fundValue,
        cashBalance,
      });
    }

    return reply.send({
      success: true,
      month: selectedMonthPrefix,
      days,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to load calendar",
    });
  }
});

app.get("/performance", async (request, reply) => {
  try {
    const query = request.query as {
      month?: string;
    };

    const selectedMonth = query.month ?? getBangkokToday().slice(0, 7);
    const series = buildPerformanceSeries().filter((item) =>
      item.date.startsWith(selectedMonth),
    );

    return reply.send({
      success: true,
      month: selectedMonth,
      series,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to load performance",
    });
  }
});

app.post("/portfolio-history/snapshot", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      date?: string;
    };

    const dateKey = body.date ?? getBangkokToday();
    const marketHistory = syncMarketHistoryFromStorePrices(dateKey);
    const snapshot = savePortfolioSnapshotForDate(dateKey, {
      source: "snapshot",
    });

    return reply.send({
      success: true,
      date: dateKey,
      marketHistoryAssets: Object.keys(marketHistory).length,
      snapshot,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to save snapshot",
    });
  }
});

app.post("/portfolio-history/rebuild", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      startDate: string;
      endDate: string;
    };

    if (!body.startDate || !body.endDate) {
      return reply.status(400).send({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const rebuilt = rebuildPortfolioHistoryRange(body.startDate, body.endDate);

    return reply.send({
      success: true,
      startDate: body.startDate,
      endDate: body.endDate,
      days: Object.keys(rebuilt).length,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to rebuild history",
    });
  }
});

app.get("/portfolio-history", async (request, reply) => {
  try {
    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    if (query.startDate && query.endDate) {
      return reply.send({
        success: true,
        snapshots: getPortfolioHistoryWindow(query.startDate, query.endDate),
      });
    }

    return reply.send({
      success: true,
      snapshots: listPortfolioSnapshots(),
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to load history",
    });
  }
});

app.get("/portfolio-history/:date", async (request, reply) => {
  try {
    const params = request.params as {
      date: string;
    };

    const snapshot = getPortfolioSnapshot(params.date);

    if (!snapshot) {
      return reply.status(404).send({
        success: false,
        message: "Snapshot not found",
      });
    }

    return reply.send({
      success: true,
      snapshot,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to load snapshot",
    });
  }
});

app.post("/market-history/backfill", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      startDate: string;
      endDate: string;
      symbols?: string[];
    };

    if (!body.startDate || !body.endDate) {
      return reply.status(400).send({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const result = await backfillMarketHistory(body.startDate, body.endDate);

    return reply.send(result);
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to backfill history",
    });
  }
});

app.get("/binance/income", async (request, reply) => {
  try {
    const query = request.query as {
      type?: BinanceIncomeType;
    };

    const incomeType: BinanceIncomeType = query.type ?? "REALIZED_PNL";

    const store = readStore();
    const latestAccount = getLatestAccountByProvider(store, "binance");

    if (!latestAccount) {
      return reply.status(404).send({
        success: false,
        message: "No connected binance account found",
      });
    }

    const incomes = await getBinanceFuturesIncomeHistory(
      latestAccount.apiKey,
      latestAccount.apiSecret,
      incomeType,
    );

    return reply.send({
      success: true,
      incomeType,
      incomes,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/binance/futures/account", async (_request, reply) => {
  try {
    const store = readStore();
    const latestAccount = getLatestAccountByProvider(store, "binance");

    if (!latestAccount) {
      return reply.status(404).send({
        success: false,
        message: "No connected binance account found",
      });
    }

    const account = await getBinanceFuturesAccountInfo(
      latestAccount.apiKey,
      latestAccount.apiSecret,
    );

    const positions = await getBinanceFuturesPositions(
      latestAccount.apiKey,
      latestAccount.apiSecret,
    );

    const summary = summarizeFuturesAccount(account);

    return reply.send({
      success: true,
      summary,
      positions,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/stock/assets", async () => {
  return {
    success: true,
    assets: listStockAssets(),
  };
});

app.post("/stock/assets", async (request, reply) => {
  try {
    const body = request.body as {
      symbol: string;
      name: string;
      assetType: "thai_stock" | "us_stock" | "fund";
      market: "SET" | "US" | "FUND";
      currency: "THB" | "USD";
      priceSource: "live_api" | "daily_nav" | "manual";
      isActive?: boolean;
    };

    const asset = createStockAsset(body);

    return reply.send({
      success: true,
      asset,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/stock/orders", async () => {
  return {
    success: true,
    orders: listStockOrders(),
  };
});

app.post("/stock/orders", async (request, reply) => {
  try {
    const body = request.body as
      | {
          assetId: string;
          side: "buy" | "sell";
          quantity: number;
          price: number;
          fee: number;
          tradeDate: string;
          note?: string;
        }
      | {
          assetId: string;
          side: "buy" | "sell";
          tradeDate: string;
          note?: string;
          fee?: number;
          feeCurrency?: string;
          inputMode: "quantity_price";
          quantity: number;
          inputUnitPrice: number;
          inputCurrency: string;
        }
      | {
          assetId: string;
          side: "buy" | "sell";
          tradeDate: string;
          note?: string;
          fee?: number;
          feeCurrency?: string;
          inputMode: "amount_units";
          quantity: number;
          inputGrossAmount: number;
          inputCurrency: string;
        };

    const order =
      "inputMode" in body
        ? await createNormalizedStockOrder(body)
        : createStockOrder(body);

    return reply.send({
      success: true,
      order,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/stock/prices", async () => {
  return {
    success: true,
    prices: listStockPrices(),
  };
});

app.get("/stock/prices/latest", async () => {
  return {
    success: true,
    prices: getLatestStockPrices(),
  };
});

app.post("/stock/prices", async (request, reply) => {
  try {
    const body = request.body as {
      assetId: string;
      price: number;
      priceDate: string;
      source: string;
    };

    const price = upsertStockPrice(body);

    return reply.send({
      success: true,
      price,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/stock/prices/refresh", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      force?: boolean;
    };

    const result = await syncActiveStockPrices({
      force: body.force === true,
      triggeredBy: "manual",
    });

    const { marketHistoryAssets, portfolioSnapshot } =
      refreshPortfolioHistoryArtifacts();

    return reply.send({
      success: true,
      ...result,
      marketHistoryAssets,
      portfolioSnapshot,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to refresh stock prices",
    });
  }
});

app.get("/stock/positions", async () => {
  return {
    success: true,
    positions: calculateStockPositions(),
  };
});

app.get("/stock/summary", async () => {
  const positions = calculateStockPositions();

  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

  const stockValue = positions
    .filter((p) => p.assetType !== "fund")
    .reduce((sum, p) => sum + p.marketValue, 0);

  const fundValue = positions
    .filter((p) => p.assetType === "fund")
    .reduce((sum, p) => sum + p.marketValue, 0);

  return {
    success: true,
    totalValue,
    stockValue,
    fundValue,
    positions,
  };
});

app.get("/funds/supported", async () => {
  return {
    success: true,
    symbols: listSupportedFundSymbols(),
  };
});

app.get("/funds/nav/:symbol", async (request, reply) => {
  try {
    const params = request.params as {
      symbol: "SCBS&P500" | "K-USXNDQ-A(D)" | "SCBGOLDHRMF";
    };

    const result = await fetchFundNav(params.symbol);

    return reply.send({
      success: true,
      ...result,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/funds/nav/refresh", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      force?: boolean;
    };

    const result = await syncActiveFundNavs({
      force: body.force === true,
      triggeredBy: "manual",
    });

    const { marketHistoryAssets, portfolioSnapshot } =
      refreshPortfolioHistoryArtifacts();

    return reply.send({
      success: true,
      ...result,
      marketHistoryAssets,
      portfolioSnapshot,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/market/refresh", async (request, reply) => {
  try {
    const body = (request.body ?? {}) as {
      force?: boolean;
    };

    const result = await syncAllMarketData({
      force: body.force === true,
      triggeredBy: "manual",
    });

    const { marketHistoryAssets, portfolioSnapshot } =
      refreshPortfolioHistoryArtifacts();

    return reply.send({
      success: true,
      ...result,
      marketHistoryAssets,
      portfolioSnapshot,
    });
  } catch (error) {
    return reply.status(400).send({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to refresh market data",
    });
  }
});

let lastFundNavSchedulerRunKey = "";
let lastStockSchedulerRunKey = "";
let lastPortfolioSnapshotRunKey = "";

function getBangkokNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function startFundNavScheduler() {
  setInterval(async () => {
    try {
      const now = getBangkokNowParts();

      if (now.minute !== 0) {
        return;
      }

      const runKey = `${now.date}-${String(now.hour).padStart(2, "0")}`;

      if (lastFundNavSchedulerRunKey === runKey) {
        return;
      }

      const result = await syncActiveFundNavs({
        force: false,
        triggeredBy: "scheduler",
      });

      if (result.updated > 0) {
        const { marketHistoryAssets, portfolioSnapshot, rebuiltDays } =
          refreshPortfolioHistoryArtifacts();

        app.log.info({
          msg: "[fund-nav] history updated after sync",
          marketHistoryAssets,
          rebuiltDays,
          snapshotDate: portfolioSnapshot.date,
        });
      }

      lastFundNavSchedulerRunKey = runKey;

      if (result.updated > 0 || result.failed > 0) {
        app.log.info({
          msg: "[fund-nav] scheduler run completed",
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          items: result.items,
        });
      }
    } catch (error) {
      app.log.error({
        msg: "[fund-nav] scheduler failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 30 * 1000);
}

function startStockPriceScheduler() {
  setInterval(async () => {
    try {
      const now = getBangkokNowParts();

      if (now.minute % 5 !== 0) {
        return;
      }

      const runKey = `${now.date}-${String(now.hour).padStart(2, "0")}-${String(
        now.minute,
      ).padStart(2, "0")}`;

      if (lastStockSchedulerRunKey === runKey) {
        return;
      }

      const result = await syncActiveStockPrices({
        force: false,
        triggeredBy: "scheduler",
      });

      if (result.updated > 0) {
        const { marketHistoryAssets, portfolioSnapshot, rebuiltDays } =
          refreshPortfolioHistoryArtifacts();

        app.log.info({
          msg: "[stock-prices] history updated after sync",
          marketHistoryAssets,
          rebuiltDays,
          snapshotDate: portfolioSnapshot.date,
        });
      }

      lastStockSchedulerRunKey = runKey;

      if (result.updated > 0 || result.failed > 0) {
        app.log.info({
          msg: "[stock-prices] scheduler run completed",
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          items: result.items,
        });
      }
    } catch (error) {
      app.log.error({
        msg: "[stock-prices] scheduler failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 30 * 1000);
}

function startPortfolioSnapshotScheduler() {
  setInterval(async () => {
    try {
      const now = getBangkokNowParts();

      if (now.hour !== 23 || now.minute !== 59) {
        return;
      }

      const runKey = now.date;

      if (lastPortfolioSnapshotRunKey === runKey) {
        return;
      }

      const marketHistory = syncMarketHistoryFromStorePrices(now.date);
      const snapshot = savePortfolioSnapshotForDate(now.date, {
        source: "snapshot",
      });

      lastPortfolioSnapshotRunKey = runKey;

      app.log.info({
        msg: "[portfolio-history] daily snapshot saved",
        date: snapshot.date,
        marketHistoryAssets: Object.keys(marketHistory).length,
        totalValue: snapshot.totalValue,
      });
    } catch (error) {
      app.log.error({
        msg: "[portfolio-history] scheduler failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, 30 * 1000);
}

const port = Number(process.env.PORT || 3001);

const start = async () => {
  try {
    await app.listen({
      port,
      host: "0.0.0.0",
    });

    startFundNavScheduler();
    startStockPriceScheduler();
    startPortfolioSnapshotScheduler();

    app.log.info(`API running at http://localhost:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();