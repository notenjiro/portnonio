import { getCache, setCache } from "../lib/cache.js";
import { httpGet } from "../lib/http-client.js";
const BASE_URL = "https://api.twelvedata.com";
const LIVE_TTL = 60 * 1000;
const HISTORY_TTL = 6 * 60 * 60 * 1000;
function getApiKey() {
    const key = process.env.TWELVE_DATA_API_KEY;
    if (!key)
        throw new Error("TWELVE_DATA_API_KEY not set");
    return key;
}
function mapSymbol(asset) {
    if (asset.market === "SET")
        return `${asset.symbol}.BK`;
    return asset.symbol;
}
function normalizeDate(dateStr) {
    return dateStr.slice(0, 10);
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
function parseJson(text, context) {
    try {
        return JSON.parse(text);
    }
    catch (error) {
        throw new Error(`${context}: invalid JSON response${error instanceof Error ? ` (${error.message})` : ""}`);
    }
}
function assertValidPriceNumber(value, context) {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`${context}: invalid price value`);
    }
    return price;
}
function markLiveAsStale(value) {
    return {
        ...value,
        source: value.source.includes("stale_cache")
            ? value.source
            : `${value.source}:stale_cache`,
    };
}
function markHistoryAsStale(values) {
    return values.map((item) => ({
        ...item,
        source: item.source.includes("stale_cache")
            ? item.source
            : `${item.source}:stale_cache`,
    }));
}
// ==========================
// LIVE
// ==========================
export async function fetchLiveStockPrice(asset) {
    const symbol = mapSymbol(asset);
    const cacheKey = `live:${symbol}`;
    const cached = getCache(cacheKey);
    if (cached)
        return cached;
    const apiKey = getApiKey();
    const params = new URLSearchParams({
        symbol,
        apikey: apiKey,
    });
    const url = `${BASE_URL}/price?${params.toString()}`;
    try {
        const text = await httpGet({
            url,
            provider: "twelvedata",
            timeoutMs: 10_000,
        });
        const json = parseJson(text, `Live price error for ${symbol}`);
        if (json.status === "error") {
            throw new Error(`Live price error: ${json.message || "unknown"}`);
        }
        const result = {
            assetId: asset.id,
            price: assertValidPriceNumber(json.price, `Live price error for ${symbol}`),
            priceDate: getBangkokToday(),
            source: "twelvedata_live",
        };
        setCache(cacheKey, result, LIVE_TTL);
        return result;
    }
    catch (error) {
        const fallback = getCache(cacheKey);
        if (fallback)
            return markLiveAsStale(fallback);
        throw error;
    }
}
// ==========================
// HISTORY
// ==========================
export async function fetchHistoricalStockPrices(asset, startDate, endDate) {
    const symbol = mapSymbol(asset);
    const cacheKey = `history:${symbol}:${startDate}:${endDate}`;
    const cached = getCache(cacheKey);
    if (cached)
        return cached;
    const apiKey = getApiKey();
    const params = new URLSearchParams({
        symbol,
        interval: "1day",
        start_date: startDate,
        end_date: endDate,
        apikey: apiKey,
    });
    const url = `${BASE_URL}/time_series?${params.toString()}`;
    try {
        const text = await httpGet({
            url,
            provider: "twelvedata",
            timeoutMs: 15_000,
        });
        const json = parseJson(text, `Historical price error for ${symbol}`);
        if (json.status === "error") {
            throw new Error(`Historical error: ${json.message || "unknown"}`);
        }
        const values = json.values ?? [];
        const result = values
            .map((item) => {
            const price = Number(item.close);
            if (!Number.isFinite(price) || !item.datetime)
                return null;
            return {
                assetId: asset.id,
                price,
                priceDate: normalizeDate(item.datetime),
                source: "twelvedata_history",
            };
        })
            .filter((i) => i !== null);
        setCache(cacheKey, result, HISTORY_TTL);
        return result;
    }
    catch (error) {
        const fallback = getCache(cacheKey);
        if (fallback?.length)
            return markHistoryAsStale(fallback);
        throw error;
    }
}
