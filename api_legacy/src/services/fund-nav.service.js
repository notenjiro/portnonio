import { getCache, setCache } from "../lib/cache.js";
import { httpGet } from "../lib/http-client.js";
const FUND_NAV_TTL_MS = 60 * 60 * 1000;
function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
function decodeHtml(value) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
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
function parseNumber(value) {
    const cleaned = value.replace(/,/g, "").trim();
    const result = Number(cleaned);
    if (!Number.isFinite(result)) {
        throw new Error(`Invalid number: ${value}`);
    }
    return result;
}
function pad2(value) {
    return String(value).padStart(2, "0");
}
function monthNameToNumber(value) {
    const months = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
    };
    return months[value.trim().toLowerCase()] ?? 0;
}
function toDateKey(year, month, day) {
    if (!year || !month || !day) {
        return undefined;
    }
    return `${year}-${pad2(month)}-${pad2(day)}`;
}
function parseSlashDate(value) {
    const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) {
        return undefined;
    }
    const day = match[1];
    const month = match[2];
    const year = match[3];
    if (!day || !month || !year) {
        return undefined;
    }
    return toDateKey(Number(year), Number(month), Number(day));
}
function parseEnglishLongDate(value) {
    const match = value.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (!match) {
        return undefined;
    }
    const day = match[1];
    const monthName = match[2];
    const year = match[3];
    if (!day || !monthName || !year) {
        return undefined;
    }
    return toDateKey(Number(year), monthNameToNumber(monthName), Number(day));
}
function parseScbamFundPage(html) {
    const clean = decodeHtml(normalizeWhitespace(html));
    const navMatchers = [
        /NAV\/Unit[^0-9]*([\d.,]+)/i,
        /NAV ประจำวัน[^0-9]*([\d.,]+)/i,
        /Value[^0-9]*([\d.,]+)/i,
        /มูลค่าหน่วยลงทุน[^0-9]*([\d.,]+)/i,
        /NAV[^0-9]*([\d.,]+)/i,
        /ราคาขาย[^0-9]*([\d.,]+)/i,
    ];
    let nav = null;
    for (const pattern of navMatchers) {
        const match = clean.match(pattern);
        if (match?.[1]) {
            nav = parseNumber(match[1]);
            break;
        }
    }
    if (!nav) {
        throw new Error("Unable to parse SCBAM NAV");
    }
    const dateMatchers = [
        /Date[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /ณ วันที่\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /ณ วันที่\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    ];
    let priceDate;
    for (const pattern of dateMatchers) {
        const match = clean.match(pattern);
        if (!match?.[1]) {
            continue;
        }
        priceDate =
            parseSlashDate(match[1]) || parseEnglishLongDate(match[1]) || undefined;
        if (priceDate) {
            break;
        }
    }
    return {
        nav,
        ...(priceDate ? { priceDate } : {}),
    };
}
function parseKassetFundPage(html) {
    const clean = decodeHtml(normalizeWhitespace(html));
    const navMatchers = [
        /Data as of[^0-9]*\d{1,2}\s+[A-Za-z]+\s+\d{4}[^0-9]*NAV[^0-9]*per unit[^0-9]*([\d.,]+)/i,
        /มูลค่าหน่วยลงทุน[^0-9]*([\d.,]+)/i,
        /NAV[^0-9]*per unit[^0-9]*([\d.,]+)/i,
        /Latest NAV[^0-9]*([\d.,]+)/i,
        /NAV[^0-9]*([\d.,]+)/i,
    ];
    let nav = null;
    for (const pattern of navMatchers) {
        const match = clean.match(pattern);
        if (match?.[1]) {
            nav = parseNumber(match[1]);
            break;
        }
    }
    if (!nav) {
        throw new Error("Unable to parse KAsset NAV");
    }
    const dateMatch = clean.match(/Data as of\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    const priceDate = dateMatch?.[1]
        ? parseEnglishLongDate(dateMatch[1])
        : undefined;
    return {
        nav,
        ...(priceDate ? { priceDate } : {}),
    };
}
const FUND_SOURCES = [
    {
        symbol: "SCBS&P500",
        url: "https://www.scbam.com/en/fund/foreign-investment-fund-equity/fund-information/scbs-p500",
        parser: parseScbamFundPage,
    },
    {
        symbol: "K-USXNDQ-A(D)",
        url: "https://www.kasikornasset.com/kasset/en/mutual-fund/fund-template/Pages/K-USXNDQ-A%28D%29.aspx",
        parser: parseKassetFundPage,
    },
    {
        symbol: "SCBGOLDHRMF",
        url: "https://www.scbam.com/en/fund/default/fund-information/SCBGOLDHRMF",
        parser: parseScbamFundPage,
    },
];
function getCacheKey(symbol) {
    return `fund-nav:${symbol}`;
}
function markFundNavAsStale(value) {
    return {
        ...value,
        source: value.source.includes("stale_cache")
            ? value.source
            : `${value.source}:stale_cache`,
    };
}
async function fetchText(url) {
    return httpGet({
        url,
        provider: "fund",
        timeoutMs: 15_000,
        retries: 3,
        headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "text/html,application/xhtml+xml",
        },
    });
}
export function listSupportedFundSymbols() {
    return FUND_SOURCES.map((item) => item.symbol);
}
export async function fetchFundNav(symbol) {
    const cacheKey = getCacheKey(symbol);
    const cached = getCache(cacheKey);
    if (cached) {
        return cached;
    }
    const source = FUND_SOURCES.find((item) => item.symbol === symbol);
    if (!source) {
        throw new Error(`Unsupported fund symbol: ${symbol}`);
    }
    try {
        const html = await fetchText(source.url);
        const parsed = source.parser(html);
        if (!Number.isFinite(parsed.nav) || parsed.nav <= 0) {
            throw new Error(`Invalid NAV parsed for ${symbol}`);
        }
        const result = {
            symbol,
            nav: parsed.nav,
            priceDate: parsed.priceDate ?? getBangkokToday(),
            source: source.url,
        };
        setCache(cacheKey, result, FUND_NAV_TTL_MS);
        return result;
    }
    catch (error) {
        const fallback = getCache(cacheKey);
        if (fallback) {
            return markFundNavAsStale(fallback);
        }
        throw error;
    }
}
export async function fetchAllSupportedFundNavs() {
    const results = [];
    for (const item of FUND_SOURCES) {
        results.push(await fetchFundNav(item.symbol));
    }
    return results;
}
