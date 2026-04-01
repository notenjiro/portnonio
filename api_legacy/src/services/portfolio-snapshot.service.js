import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readStore } from "../lib/store.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "../../data");
const marketHistoryFilePath = path.join(dataDir, "market-history.json");
const portfolioHistoryFilePath = path.join(dataDir, "portfolio-history.json");
function ensureDataDir() {
    fs.mkdirSync(dataDir, { recursive: true });
}
function nowIso() {
    return new Date().toISOString();
}
function toBangkokDateKey(input) {
    const date = typeof input === "string"
        ? new Date(`${input}T00:00:00`)
        : input instanceof Date
            ? input
            : new Date();
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}
function parseDateKey(dateKey) {
    return new Date(`${dateKey}T00:00:00`);
}
function listDateKeysInclusive(startDate, endDate) {
    const result = [];
    const cursor = parseDateKey(startDate);
    const end = parseDateKey(endDate);
    while (cursor.getTime() <= end.getTime()) {
        result.push(toBangkokDateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return result;
}
function compareDateAsc(a, b) {
    return a.localeCompare(b);
}
function readJsonFile(filePath, fallback) {
    ensureDataDir();
    if (!fs.existsSync(filePath)) {
        return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) {
        return fallback;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
function writeJsonFile(filePath, data) {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
export function readMarketHistory() {
    return readJsonFile(marketHistoryFilePath, {});
}
export function writeMarketHistory(data) {
    writeJsonFile(marketHistoryFilePath, data);
}
export function readPortfolioHistory() {
    return readJsonFile(portfolioHistoryFilePath, {});
}
export function writePortfolioHistory(data) {
    writeJsonFile(portfolioHistoryFilePath, data);
}
function getAssetHistoryValueBase(entry) {
    if (!entry)
        return 0;
    const baseValue = Number(entry.priceBase ?? entry.navBase ?? 0);
    if (Number.isFinite(baseValue) && baseValue > 0) {
        return baseValue;
    }
    const legacyValue = Number(entry.price ?? entry.nav ?? 0);
    return Number.isFinite(legacyValue) ? legacyValue : 0;
}
function getHistoryTypeForAsset(asset) {
    return asset.assetType === "fund" ? "nav" : "price";
}
function getOrCreateAssetMarketHistory(history, asset) {
    const existing = history[asset.symbol];
    if (existing) {
        if (!existing.baseCurrency) {
            existing.baseCurrency = "USD";
        }
        return existing;
    }
    const created = {
        type: asset.assetType,
        market: asset.market,
        currency: asset.currency,
        baseCurrency: "USD",
        history: {},
    };
    history[asset.symbol] = created;
    return created;
}
function getFundSourcePriority(source) {
    switch ((source ?? "").toLowerCase()) {
        case "fund_nav_live":
            return 300;
        case "fund_nav_daily":
            return 200;
        case "backfill_nav":
            return 100;
        default:
            return -1;
    }
}
function getStockSourcePriority(source) {
    switch ((source ?? "").toLowerCase()) {
        case "twelvedata_live":
            return 300;
        case "twelvedata_history":
            return 200;
        case "manual":
            return 100;
        default:
            return 0;
    }
}
function getSourcePriorityForAsset(asset, source) {
    if (asset.assetType === "fund") {
        return getFundSourcePriority(source);
    }
    return getStockSourcePriority(source);
}
function isUsableSourceForAsset(asset, source) {
    if (!source)
        return false;
    if (asset.assetType === "fund") {
        return getFundSourcePriority(source) >= 0;
    }
    return true;
}
function sortOrdersAsc(orders) {
    return [...orders].sort((a, b) => {
        const byTradeDate = compareDateAsc(a.tradeDate, b.tradeDate);
        if (byTradeDate !== 0)
            return byTradeDate;
        return a.createdAt.localeCompare(b.createdAt);
    });
}
function getLatestOrderPriceOnOrBeforeDate(orders, dateKey) {
    return sortOrdersAsc(orders)
        .filter((order) => order.tradeDate <= dateKey)
        .at(-1);
}
function getSnapshotPriceBase(price) {
    const base = Number(price.priceBase ?? 0);
    if (Number.isFinite(base) && base > 0) {
        return base;
    }
    const legacy = Number(price.price ?? 0);
    return Number.isFinite(legacy) ? legacy : 0;
}
function getLatestStorePriceOnOrBeforeDate(asset, prices, dateKey) {
    return prices
        .filter((item) => item.assetId === asset.id &&
        item.priceDate <= dateKey &&
        isUsableSourceForAsset(asset, item.source))
        .sort((a, b) => {
        const byDate = compareDateAsc(b.priceDate, a.priceDate);
        if (byDate !== 0)
            return byDate;
        const bySource = getSourcePriorityForAsset(asset, b.source) -
            getSourcePriorityForAsset(asset, a.source);
        if (bySource !== 0)
            return bySource;
        return b.createdAt.localeCompare(a.createdAt);
    })[0];
}
function getLatestHistoryEntryOnOrBeforeDate(asset, history, dateKey) {
    const bucket = history[asset.symbol];
    if (!bucket) {
        return null;
    }
    const eligibleDates = Object.keys(bucket.history)
        .filter((key) => key <= dateKey)
        .sort(compareDateAsc);
    if (eligibleDates.length === 0) {
        return null;
    }
    const latestDate = eligibleDates[eligibleDates.length - 1];
    if (!latestDate) {
        return null;
    }
    const entry = bucket.history[latestDate];
    if (!entry || !isUsableSourceForAsset(asset, entry.source)) {
        return null;
    }
    return {
        date: latestDate,
        entry,
    };
}
export function syncMarketHistoryFromStorePrices(dateKey) {
    const store = readStore();
    const history = readMarketHistory();
    const targetDate = dateKey ?? toBangkokDateKey();
    for (const asset of store.stockAssets) {
        const latestForDate = getLatestStorePriceOnOrBeforeDate(asset, store.stockPrices, targetDate);
        if (!latestForDate) {
            continue;
        }
        const bucket = getOrCreateAssetMarketHistory(history, asset);
        const valueKey = getHistoryTypeForAsset(asset);
        const priceBase = getSnapshotPriceBase(latestForDate);
        bucket.history[targetDate] = {
            ...(valueKey === "nav"
                ? {
                    nav: Number(latestForDate.price),
                    navBase: priceBase,
                }
                : {
                    price: Number(latestForDate.price),
                    priceBase,
                }),
            currency: latestForDate.currency ?? asset.currency,
            baseCurrency: "USD",
            source: latestForDate.source,
            ...(typeof latestForDate.fxRateToBase === "number"
                ? { fxRateToBase: Number(latestForDate.fxRateToBase) }
                : {}),
            ...(latestForDate.fxRateDate
                ? { fxRateDate: latestForDate.fxRateDate }
                : {}),
            ...(latestForDate.fxSource ? { fxSource: latestForDate.fxSource } : {}),
            syncedAt: nowIso(),
        };
    }
    writeMarketHistory(history);
    return history;
}
function getHistoricalMarketValueForAssetBase(asset, history, storePrices, orders, dateKey) {
    const latestStorePrice = getLatestStorePriceOnOrBeforeDate(asset, storePrices, dateKey);
    if (latestStorePrice) {
        return getSnapshotPriceBase(latestStorePrice);
    }
    const latestHistory = getLatestHistoryEntryOnOrBeforeDate(asset, history, dateKey);
    if (latestHistory) {
        return getAssetHistoryValueBase(latestHistory.entry);
    }
    if (asset.assetType !== "fund") {
        const latestOrder = getLatestOrderPriceOnOrBeforeDate(orders, dateKey);
        if (latestOrder) {
            const unitPriceBase = Number(latestOrder.unitPriceBase ?? 0);
            if (Number.isFinite(unitPriceBase) && unitPriceBase > 0) {
                return unitPriceBase;
            }
            return Number(latestOrder.price);
        }
    }
    return 0;
}
function getOrderGrossAmountBase(order, assetType) {
    const normalized = Number(order.grossAmountBase ?? 0);
    if (Number.isFinite(normalized) && normalized >= 0) {
        return normalized;
    }
    if (assetType === "fund") {
        const fundAmount = Number(order.derivedGrossAmount ?? order.inputGrossAmount ?? order.price ?? 0);
        return Number.isFinite(fundAmount) ? fundAmount : 0;
    }
    const qty = Number(order.quantity ?? 0);
    const price = Number(order.derivedUnitPrice ?? order.inputUnitPrice ?? order.price ?? 0);
    return Number.isFinite(qty * price) ? qty * price : 0;
}
function getOrderFeeAmountBase(order) {
    const normalized = Number(order.feeAmountBase ?? 0);
    if (Number.isFinite(normalized) && normalized >= 0) {
        return normalized;
    }
    const derived = Number(order.derivedFeeAmount ?? order.fee ?? 0);
    return Number.isFinite(derived) ? derived : 0;
}
function buildPositionStateUpToDate(orders, dateKey, assetType) {
    const state = {
        qty: 0,
        totalCostBase: 0,
        realizedPnlBase: 0,
    };
    const relevantOrders = sortOrdersAsc(orders).filter((order) => order.tradeDate <= dateKey);
    for (const order of relevantOrders) {
        const qty = Number(order.quantity);
        const grossAmountBase = getOrderGrossAmountBase(order, assetType);
        const feeAmountBase = getOrderFeeAmountBase(order);
        if (order.side === "buy") {
            state.qty += qty;
            state.totalCostBase += grossAmountBase + feeAmountBase;
            continue;
        }
        const avgCostBase = state.qty > 0 ? state.totalCostBase / state.qty : 0;
        const costRemovedBase = avgCostBase * qty;
        let proceedsBase = 0;
        if (typeof order.grossAmountBase === "number") {
            proceedsBase = Number(order.grossAmountBase) - feeAmountBase;
        }
        else if (typeof order.unitPriceBase === "number") {
            proceedsBase = Number(order.unitPriceBase) * qty - feeAmountBase;
        }
        else {
            proceedsBase = Number(order.price) * qty - feeAmountBase;
        }
        state.realizedPnlBase += proceedsBase - costRemovedBase;
        state.qty -= qty;
        state.totalCostBase -= costRemovedBase;
        if (state.qty <= 0) {
            state.qty = 0;
            state.totalCostBase = 0;
        }
    }
    return state;
}
function getRealizedPnlForDate(orders, dateKey, assetType) {
    const sorted = sortOrdersAsc(orders);
    const state = {
        qty: 0,
        totalCostBase: 0,
        realizedPnlBase: 0,
    };
    let realizedTodayBase = 0;
    for (const order of sorted) {
        if (order.tradeDate > dateKey) {
            break;
        }
        const qty = Number(order.quantity);
        const grossAmountBase = getOrderGrossAmountBase(order, assetType);
        const feeAmountBase = getOrderFeeAmountBase(order);
        if (order.side === "buy") {
            state.qty += qty;
            state.totalCostBase += grossAmountBase + feeAmountBase;
            continue;
        }
        const avgCostBase = state.qty > 0 ? state.totalCostBase / state.qty : 0;
        const costRemovedBase = avgCostBase * qty;
        let proceedsBase = 0;
        if (typeof order.grossAmountBase === "number") {
            proceedsBase = Number(order.grossAmountBase) - feeAmountBase;
        }
        else if (typeof order.unitPriceBase === "number") {
            proceedsBase = Number(order.unitPriceBase) * qty - feeAmountBase;
        }
        else {
            proceedsBase = Number(order.price) * qty - feeAmountBase;
        }
        const realized = proceedsBase - costRemovedBase;
        if (order.tradeDate === dateKey) {
            realizedTodayBase += realized;
        }
        state.realizedPnlBase += realized;
        state.qty -= qty;
        state.totalCostBase -= costRemovedBase;
        if (state.qty <= 0) {
            state.qty = 0;
            state.totalCostBase = 0;
        }
    }
    return realizedTodayBase;
}
function buildPortfolioSnapshotForDateInternal(dateKey, portfolioHistory, options) {
    const store = readStore();
    const history = readMarketHistory();
    const positions = [];
    let stockValue = 0;
    let fundValue = 0;
    let unrealizedPnl = 0;
    let realizedPnl = 0;
    for (const asset of store.stockAssets.filter((item) => item.isActive)) {
        const assetOrders = store.stockOrders.filter((order) => order.assetId === asset.id);
        const state = buildPositionStateUpToDate(assetOrders, dateKey, asset.assetType);
        const realizedToday = getRealizedPnlForDate(assetOrders, dateKey, asset.assetType);
        const marketPriceBase = getHistoricalMarketValueForAssetBase(asset, history, store.stockPrices, assetOrders, dateKey);
        const avgCostBase = state.qty > 0 ? state.totalCostBase / state.qty : 0;
        const valueBase = state.qty * marketPriceBase;
        const costValueBase = state.qty * avgCostBase;
        const positionUnrealizedPnl = valueBase - costValueBase;
        realizedPnl += realizedToday;
        unrealizedPnl += positionUnrealizedPnl;
        if (state.qty <= 0 && valueBase <= 0 && realizedToday === 0) {
            continue;
        }
        const position = {
            assetId: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            assetType: asset.assetType,
            market: asset.market,
            currency: "USD",
            nativeCurrency: asset.currency,
            qty: Number(state.qty),
            avgCost: Number(avgCostBase),
            price: Number(marketPriceBase),
            value: Number(valueBase),
            costValue: Number(costValueBase),
            unrealizedPnl: Number(positionUnrealizedPnl),
        };
        positions.push(position);
        if (asset.assetType === "fund") {
            fundValue += valueBase;
        }
        else {
            stockValue += valueBase;
        }
    }
    const previousDate = Object.keys(portfolioHistory)
        .filter((key) => key < dateKey)
        .sort(compareDateAsc)
        .at(-1);
    const previousUnrealized = previousDate && portfolioHistory[previousDate]
        ? Number(portfolioHistory[previousDate].unrealizedPnl ?? 0)
        : 0;
    const cashBalance = 0;
    const changeUnrealized = unrealizedPnl - previousUnrealized;
    const totalPnl = realizedPnl + changeUnrealized;
    const totalValue = stockValue + fundValue + cashBalance;
    const snapshot = {
        date: dateKey,
        totalValue: Number(totalValue),
        stockValue: Number(stockValue),
        fundValue: Number(fundValue),
        cashBalance: Number(cashBalance),
        realizedPnl: Number(realizedPnl),
        unrealizedPnl: Number(unrealizedPnl),
        changeUnrealized: Number(changeUnrealized),
        totalPnl: Number(totalPnl),
        positions: positions.sort((a, b) => a.symbol.localeCompare(b.symbol)),
        meta: {
            source: options?.source ?? "snapshot",
            syncedAt: nowIso(),
            baseCurrency: "USD",
        },
    };
    return snapshot;
}
export function buildPortfolioSnapshotForDate(dateKey, options) {
    const portfolioHistory = readPortfolioHistory();
    return buildPortfolioSnapshotForDateInternal(dateKey, portfolioHistory, options);
}
export function savePortfolioSnapshotForDate(dateKey, options) {
    const history = readPortfolioHistory();
    const snapshot = buildPortfolioSnapshotForDateInternal(dateKey, history, options);
    history[dateKey] = snapshot;
    writePortfolioHistory(history);
    return snapshot;
}
export function savePortfolioSnapshotToday() {
    const dateKey = toBangkokDateKey();
    return savePortfolioSnapshotForDate(dateKey, { source: "snapshot" });
}
export function rebuildPortfolioHistoryRange(startDate, endDate) {
    const dates = listDateKeysInclusive(startDate, endDate);
    const history = readPortfolioHistory();
    for (const dateKey of dates) {
        history[dateKey] = buildPortfolioSnapshotForDateInternal(dateKey, history, {
            source: "backfill",
        });
    }
    writePortfolioHistory(history);
    return history;
}
export function getPortfolioSnapshot(dateKey) {
    const history = readPortfolioHistory();
    return history[dateKey] ?? null;
}
export function listPortfolioSnapshots() {
    const history = readPortfolioHistory();
    return Object.keys(history)
        .sort(compareDateAsc)
        .map((date) => history[date]);
}
export function getPortfolioHistoryWindow(startDate, endDate) {
    const history = readPortfolioHistory();
    const dates = Object.keys(history)
        .filter((date) => date >= startDate && date <= endDate)
        .sort(compareDateAsc);
    return dates.map((date) => history[date]);
}
