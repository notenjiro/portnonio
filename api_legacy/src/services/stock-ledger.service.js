import crypto from "node:crypto";
import { readStore, writeStore } from "../lib/store.js";
import { convertToUsd } from "./fx-rate.service.js";
function nowIso() {
    return new Date().toISOString();
}
function normalizeCurrency(value) {
    return (value ?? "USD").trim().toUpperCase();
}
function getAssetById(assetId) {
    const store = readStore();
    return store.stockAssets.find((item) => String(item.id).trim() === assetId);
}
function ensureAssetExists(assetId) {
    const asset = getAssetById(assetId);
    if (!asset) {
        throw new Error("Stock asset not found");
    }
    return asset;
}
function ensurePositiveNumber(value, fieldName) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${fieldName} must be greater than 0`);
    }
}
function ensureNonNegativeNumber(value, fieldName) {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${fieldName} must be 0 or greater`);
    }
}
function getBaseCurrency() {
    return "USD";
}
function buildLegacyGrossAmount(input) {
    return Number(input.quantity) * Number(input.price);
}
function getSnapshotPriceBase(snapshot) {
    return Number(snapshot.priceBase ?? snapshot.price ?? 0);
}
function getOrderGrossAmountBase(order, asset) {
    if (typeof order.grossAmountBase === "number") {
        return Number(order.grossAmountBase);
    }
    if (asset?.assetType === "fund" &&
        typeof order.derivedGrossAmount === "number") {
        return Number(order.derivedGrossAmount);
    }
    if (typeof order.inputGrossAmount === "number") {
        return Number(order.inputGrossAmount);
    }
    return buildLegacyGrossAmount({
        quantity: Number(order.quantity),
        price: Number(order.price),
    });
}
function getOrderFeeBase(order) {
    if (typeof order.feeAmountBase === "number") {
        return Number(order.feeAmountBase);
    }
    if (typeof order.derivedFeeAmount === "number") {
        return Number(order.derivedFeeAmount);
    }
    return Number(order.fee ?? 0);
}
export function listStockAssets() {
    const store = readStore();
    return store.stockAssets;
}
export function createStockAsset(input) {
    const store = readStore();
    const symbol = input.symbol.trim().toUpperCase();
    const name = input.name.trim();
    const exists = store.stockAssets.some((item) => item.symbol.trim().toUpperCase() === symbol &&
        item.market === input.market);
    if (exists) {
        throw new Error(`Stock asset already exists: ${symbol} (${input.market})`);
    }
    const asset = {
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
export function updateStockAssetSyncState(assetId, patch) {
    const store = readStore();
    const index = store.stockAssets.findIndex((item) => item.id === assetId);
    if (index < 0) {
        throw new Error(`Stock asset not found: ${assetId}`);
    }
    const current = store.stockAssets[index];
    if (!current) {
        throw new Error(`Stock asset not found: ${assetId}`);
    }
    const next = {
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
export function createStockOrder(input) {
    const store = readStore();
    const requestedAssetId = String(input.assetId).trim();
    const asset = store.stockAssets.find((item) => String(item.id).trim() === requestedAssetId);
    if (!asset) {
        throw new Error("Stock asset not found");
    }
    ensurePositiveNumber(Number(input.quantity), "Quantity");
    ensureNonNegativeNumber(Number(input.price), "Price");
    ensureNonNegativeNumber(Number(input.fee), "Fee");
    const trimmedNote = input.note?.trim();
    const order = {
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
        inputGrossAmount: asset.assetType === "fund"
            ? Number(input.price)
            : Number(input.quantity) * Number(input.price),
        inputUnitPrice: asset.assetType === "fund"
            ? Number(input.quantity) > 0
                ? Number(input.price) / Number(input.quantity)
                : 0
            : Number(input.price),
        feeCurrency: asset.currency,
        derivedUnitPrice: asset.assetType === "fund"
            ? Number(input.quantity) > 0
                ? Number(input.price) / Number(input.quantity)
                : 0
            : Number(input.price),
        derivedGrossAmount: asset.assetType === "fund"
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
export async function createNormalizedStockOrder(input) {
    const store = readStore();
    const requestedAssetId = String(input.assetId).trim();
    const asset = store.stockAssets.find((item) => String(item.id).trim() === requestedAssetId);
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
    }
    else {
        ensurePositiveNumber(Number(input.inputGrossAmount), "Gross amount");
        derivedGrossAmount = Number(input.inputGrossAmount);
        derivedUnitPrice = Number(input.inputGrossAmount) / Number(input.quantity);
    }
    const grossFx = await convertToUsd(derivedGrossAmount, inputCurrency, input.tradeDate);
    const unitFx = await convertToUsd(derivedUnitPrice, inputCurrency, input.tradeDate);
    const feeFx = await convertToUsd(Number(input.fee ?? 0), feeCurrency, input.tradeDate);
    const order = {
        id: crypto.randomUUID(),
        assetId: requestedAssetId,
        side: input.side,
        quantity: Number(input.quantity),
        // legacy compatibility
        price: input.inputMode === "quantity_price"
            ? Number(input.inputUnitPrice)
            : Number(input.inputGrossAmount),
        fee: Number(input.fee ?? 0),
        tradeDate: input.tradeDate,
        createdAt: nowIso(),
        inputMode: input.inputMode,
        inputCurrency,
        inputGrossAmount: derivedGrossAmount,
        inputUnitPrice: input.inputMode === "quantity_price"
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
export function upsertStockPrice(input) {
    const store = readStore();
    const asset = ensureAssetExists(input.assetId);
    const existingIndex = store.stockPrices.findIndex((item) => item.assetId === input.assetId &&
        item.priceDate === input.priceDate &&
        item.source === input.source);
    const existingItem = existingIndex >= 0 ? store.stockPrices[existingIndex] : null;
    const snapshot = {
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
    }
    else {
        store.stockPrices.push(snapshot);
    }
    writeStore(store);
    return snapshot;
}
export function getLatestPriceMap() {
    const store = readStore();
    const latestByAsset = new Map();
    for (const price of store.stockPrices) {
        const current = latestByAsset.get(price.assetId);
        if (!current ||
            price.priceDate > current.priceDate ||
            (price.priceDate === current.priceDate &&
                price.createdAt > current.createdAt)) {
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
        const assetOrders = store.stockOrders.filter((order) => order.assetId === asset.id);
        let quantity = 0;
        let totalCostBase = 0;
        for (const order of assetOrders) {
            const grossAmountBase = getOrderGrossAmountBase(order, asset);
            const feeAmountBase = getOrderFeeBase(order);
            if (order.side === "buy") {
                quantity += Number(order.quantity);
                totalCostBase += grossAmountBase + feeAmountBase;
            }
            else {
                const avgCostBase = quantity > 0 ? totalCostBase / quantity : 0;
                const reduceCostBase = avgCostBase * Number(order.quantity);
                quantity -= Number(order.quantity);
                totalCostBase -= reduceCostBase;
            }
        }
        const averageCost = quantity > 0 ? totalCostBase / quantity : 0;
        const latestPriceSnapshot = latestPriceMap.get(asset.id);
        const lastPrice = latestPriceSnapshot
            ? getSnapshotPriceBase(latestPriceSnapshot)
            : 0;
        const marketValue = quantity * lastPrice;
        const costValue = quantity * averageCost;
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
            lastPrice,
            marketValue,
            costValue,
            unrealizedPnL,
        };
    })
        .filter((item) => item.quantity > 0 || item.marketValue > 0);
}
