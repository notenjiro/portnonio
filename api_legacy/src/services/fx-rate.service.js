import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { httpGet } from "../lib/http-client.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "../../data");
const fxFilePath = path.join(dataDir, "fx-rates.json");
// 🔥 ใช้ Frankfurter (ฟรี + รองรับ historical)
const FX_BASE_URL = "https://api.frankfurter.app";
function ensureDataDir() {
    fs.mkdirSync(dataDir, { recursive: true });
}
function nowIso() {
    return new Date().toISOString();
}
function buildKey(from, to, date) {
    return `${date}:${from}->${to}`;
}
function readFxStore() {
    ensureDataDir();
    if (!fs.existsSync(fxFilePath)) {
        return {};
    }
    try {
        const raw = fs.readFileSync(fxFilePath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
function writeFxStore(store) {
    ensureDataDir();
    fs.writeFileSync(fxFilePath, JSON.stringify(store, null, 2));
}
// ==========================
// CORE FX FETCH
// ==========================
async function fetchFxRateFromApi(from, to, date) {
    if (from === to)
        return 1;
    // Frankfurter ต้องใช้ EUR เป็น base
    const url = `${FX_BASE_URL}/${date}?from=${from}&to=${to}`;
    const res = await httpGet({
        url,
        provider: "fx",
        timeoutMs: 10000,
        retries: 2,
    });
    const json = JSON.parse(res);
    if (!json?.rates?.[to]) {
        throw new Error(`FX rate not found: ${from}->${to} @ ${date}`);
    }
    return Number(json.rates[to]);
}
// ==========================
// PUBLIC API
// ==========================
export async function getFxRate(from, to, date) {
    const key = buildKey(from, to, date);
    const store = readFxStore();
    // ✅ cache hit
    if (store[key]) {
        return store[key];
    }
    try {
        const rate = await fetchFxRateFromApi(from, to, date);
        const entry = {
            from,
            to,
            date,
            rate,
            source: "frankfurter",
            fetchedAt: nowIso(),
        };
        store[key] = entry;
        writeFxStore(store);
        return entry;
    }
    catch (err) {
        // 🔥 fallback: หา rate ล่าสุดก่อนหน้า
        const fallback = Object.values(store)
            .filter((r) => r.from === from && r.to === to && r.date <= date)
            .sort((a, b) => b.date.localeCompare(a.date))[0];
        if (fallback) {
            return {
                ...fallback,
                source: `${fallback.source}:fallback_cache`,
            };
        }
        throw err;
    }
}
// ==========================
// CONVERT MONEY
// ==========================
export async function convertToUsd(amount, fromCurrency, date) {
    if (fromCurrency === "USD") {
        return {
            amountUsd: amount,
            fxRate: 1,
            fxDate: date,
            source: "identity",
        };
    }
    const fx = await getFxRate(fromCurrency, "USD", date);
    return {
        amountUsd: amount * fx.rate,
        fxRate: fx.rate,
        fxDate: fx.date,
        source: fx.source,
    };
}
// ==========================
// HELPER
// ==========================
export async function convert(amount, from, to, date) {
    if (from === to) {
        return {
            amount,
            rate: 1,
            date,
            source: "identity",
        };
    }
    const fx = await getFxRate(from, to, date);
    return {
        amount: amount * fx.rate,
        rate: fx.rate,
        date: fx.date,
        source: fx.source,
    };
}
