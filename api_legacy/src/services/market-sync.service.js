import { fetchFundNav, listSupportedFundSymbols, } from "./fund-nav.service.js";
import { fetchHistoricalStockPrices, fetchLiveStockPrice, } from "./market-price.service.js";
import { convertToUsd } from "./fx-rate.service.js";
import { listStockAssets, upsertStockPrice, updateStockAssetSyncState, } from "./stock-ledger.service.js";
function getBangkokToday() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(new Date());
}
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
        .reduce((acc, part) => {
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
function startOfMonth(dateKey) {
    return `${dateKey.slice(0, 7)}-01`;
}
function normalizeSource(source) {
    return source.trim().toLowerCase();
}
function shouldSkipFundSync(asset, options) {
    if (options?.force === true) {
        return { skip: false };
    }
    if (!asset.isActive) {
        return { skip: true, message: "Skipped: asset is inactive" };
    }
    if (asset.priceSource !== "daily_nav") {
        return { skip: true, message: `Skipped: source is ${asset.priceSource}` };
    }
    const supported = listSupportedFundSymbols();
    const isSupported = supported.includes(asset.symbol);
    if (!isSupported) {
        return {
            skip: true,
            message: "Skipped: not a supported fund symbol",
        };
    }
    const now = getBangkokNowParts();
    if (asset.lastSyncStatus === "success" &&
        asset.lastPriceDate === now.date &&
        asset.lastPriceSource &&
        normalizeSource(asset.lastPriceSource).includes("fund_nav")) {
        return { skip: true, message: "Skipped: already synced for today" };
    }
    return { skip: false };
}
function shouldSkipStockSync(asset, options) {
    if (options?.force === true) {
        return { skip: false };
    }
    if (!asset.isActive) {
        return { skip: true, message: "Skipped: asset is inactive" };
    }
    if (asset.assetType === "fund") {
        return { skip: true, message: "Skipped: fund asset" };
    }
    if (asset.priceSource !== "live_api") {
        return { skip: true, message: `Skipped: source is ${asset.priceSource}` };
    }
    const now = getBangkokNowParts();
    if (asset.lastSyncStatus === "success" &&
        asset.lastPriceDate === now.date &&
        asset.lastSyncedAt) {
        const lastSynced = new Date(asset.lastSyncedAt).getTime();
        const ageMs = Date.now() - lastSynced;
        if (Number.isFinite(lastSynced) && ageMs < 5 * 60 * 1000) {
            return { skip: true, message: "Skipped: next sync due later" };
        }
    }
    return { skip: false };
}
async function saveFundNavPrice(asset) {
    const result = await fetchFundNav(asset.symbol);
    const converted = await convertToUsd(Number(result.nav), asset.currency, result.priceDate);
    upsertStockPrice({
        assetId: asset.id,
        price: Number(result.nav),
        priceDate: result.priceDate,
        source: "fund_nav_daily",
        currency: asset.currency,
        baseCurrency: "USD",
        priceBase: converted.amountUsd,
        fxRateToBase: converted.fxRate,
        fxRateDate: converted.fxDate,
        fxSource: converted.source,
    });
    updateStockAssetSyncState(asset.id, {
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: "success",
        lastSyncMessage: `Updated from ${result.source}`,
        lastPriceDate: result.priceDate,
        lastPriceSource: "fund_nav_daily",
        lastPriceCurrency: asset.currency,
        lastPriceBase: converted.amountUsd,
        lastPriceBaseCurrency: "USD",
    });
    return {
        priceDate: result.priceDate,
        source: "fund_nav_daily",
        nativePrice: Number(result.nav),
        basePrice: converted.amountUsd,
    };
}
async function saveLiveStockPrice(asset) {
    const result = await fetchLiveStockPrice(asset);
    const converted = await convertToUsd(Number(result.price), asset.currency, result.priceDate);
    upsertStockPrice({
        assetId: asset.id,
        price: Number(result.price),
        priceDate: result.priceDate,
        source: result.source,
        currency: asset.currency,
        baseCurrency: "USD",
        priceBase: converted.amountUsd,
        fxRateToBase: converted.fxRate,
        fxRateDate: converted.fxDate,
        fxSource: converted.source,
    });
    updateStockAssetSyncState(asset.id, {
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: "success",
        lastSyncMessage: `Updated from ${result.source}`,
        lastPriceDate: result.priceDate,
        lastPriceSource: result.source,
        lastPriceCurrency: asset.currency,
        lastPriceBase: converted.amountUsd,
        lastPriceBaseCurrency: "USD",
    });
    return {
        priceDate: result.priceDate,
        source: result.source,
        nativePrice: Number(result.price),
        basePrice: converted.amountUsd,
    };
}
async function maybeBackfillCurrentMonthHistory(asset, dateKey) {
    if (asset.assetType === "fund") {
        return 0;
    }
    const startDate = startOfMonth(dateKey);
    const endDate = dateKey;
    const rows = await fetchHistoricalStockPrices(asset, startDate, endDate);
    let count = 0;
    for (const row of rows) {
        const converted = await convertToUsd(Number(row.price), asset.currency, row.priceDate);
        upsertStockPrice({
            assetId: asset.id,
            price: Number(row.price),
            priceDate: row.priceDate,
            source: row.source,
            currency: asset.currency,
            baseCurrency: "USD",
            priceBase: converted.amountUsd,
            fxRateToBase: converted.fxRate,
            fxRateDate: converted.fxDate,
            fxSource: converted.source,
        });
        count += 1;
    }
    return count;
}
export async function syncActiveFundNavs(options) {
    const assets = listStockAssets().filter((asset) => asset.assetType === "fund");
    const items = [];
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    for (const asset of assets) {
        const decision = shouldSkipFundSync(asset, options);
        if (decision.skip) {
            skipped += 1;
            updateStockAssetSyncState(asset.id, {
                lastSyncedAt: new Date().toISOString(),
                lastSyncStatus: "skipped",
                lastSyncMessage: decision.message ?? "Skipped",
                lastPriceDate: asset.lastPriceDate,
                lastPriceSource: asset.lastPriceSource,
                lastPriceCurrency: asset.lastPriceCurrency,
                lastPriceBase: asset.lastPriceBase,
                lastPriceBaseCurrency: asset.lastPriceBaseCurrency,
            });
            items.push({
                assetId: asset.id,
                symbol: asset.symbol,
                status: "skipped",
                message: decision.message ?? "Skipped",
                priceDate: asset.lastPriceDate,
                source: asset.lastPriceSource,
            });
            continue;
        }
        try {
            const saved = await saveFundNavPrice(asset);
            updated += 1;
            items.push({
                assetId: asset.id,
                symbol: asset.symbol,
                status: "updated",
                message: `Updated NAV ${saved.nativePrice} ${asset.currency} (${saved.basePrice.toFixed(6)} USD)`,
                priceDate: saved.priceDate,
                source: saved.source,
            });
        }
        catch (error) {
            failed += 1;
            updateStockAssetSyncState(asset.id, {
                lastSyncedAt: new Date().toISOString(),
                lastSyncStatus: "failed",
                lastSyncMessage: error instanceof Error ? error.message : "Unknown error",
                lastPriceDate: asset.lastPriceDate,
                lastPriceSource: asset.lastPriceSource,
                lastPriceCurrency: asset.lastPriceCurrency,
                lastPriceBase: asset.lastPriceBase,
                lastPriceBaseCurrency: asset.lastPriceBaseCurrency,
            });
            items.push({
                assetId: asset.id,
                symbol: asset.symbol,
                status: "failed",
                message: error instanceof Error ? error.message : "Unknown error",
                priceDate: asset.lastPriceDate,
                source: asset.lastPriceSource,
            });
        }
    }
    return {
        updated,
        skipped,
        failed,
        items,
    };
}
export async function syncActiveStockPrices(options) {
    const assets = listStockAssets().filter((asset) => asset.assetType !== "fund");
    const items = [];
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    for (const asset of assets) {
        const decision = shouldSkipStockSync(asset, options);
        if (decision.skip) {
            skipped += 1;
            updateStockAssetSyncState(asset.id, {
                lastSyncedAt: new Date().toISOString(),
                lastSyncStatus: "skipped",
                lastSyncMessage: decision.message ?? "Skipped",
                lastPriceDate: asset.lastPriceDate,
                lastPriceSource: asset.lastPriceSource,
                lastPriceCurrency: asset.lastPriceCurrency,
                lastPriceBase: asset.lastPriceBase,
                lastPriceBaseCurrency: asset.lastPriceBaseCurrency,
            });
            items.push({
                assetId: asset.id,
                symbol: asset.symbol,
                status: "skipped",
                message: decision.message ?? "Skipped",
                priceDate: asset.lastPriceDate,
                source: asset.lastPriceSource,
            });
            continue;
        }
        try {
            const saved = await saveLiveStockPrice(asset);
            await maybeBackfillCurrentMonthHistory(asset, saved.priceDate);
            updated += 1;
            items.push({
                assetId: asset.id,
                symbol: asset.symbol,
                status: "updated",
                message: `Updated live price ${saved.nativePrice} ${asset.currency} (${saved.basePrice.toFixed(6)} USD)`,
                priceDate: saved.priceDate,
                source: saved.source,
            });
        }
        catch (error) {
            failed += 1;
            updateStockAssetSyncState(asset.id, {
                lastSyncedAt: new Date().toISOString(),
                lastSyncStatus: "failed",
                lastSyncMessage: error instanceof Error ? error.message : "Unknown error",
                lastPriceDate: asset.lastPriceDate,
                lastPriceSource: asset.lastPriceSource,
                lastPriceCurrency: asset.lastPriceCurrency,
                lastPriceBase: asset.lastPriceBase,
                lastPriceBaseCurrency: asset.lastPriceBaseCurrency,
            });
            items.push({
                assetId: asset.id,
                symbol: asset.symbol,
                status: "failed",
                message: error instanceof Error ? error.message : "Unknown error",
                priceDate: asset.lastPriceDate,
                source: asset.lastPriceSource,
            });
        }
    }
    return {
        updated,
        skipped,
        failed,
        items,
    };
}
export async function syncAllMarketData(options) {
    const [funds, stocks] = await Promise.all([
        syncActiveFundNavs(options),
        syncActiveStockPrices(options),
    ]);
    return {
        updated: funds.updated + stocks.updated,
        skipped: funds.skipped + stocks.skipped,
        failed: funds.failed + stocks.failed,
        items: [...funds.items, ...stocks.items].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    };
}
