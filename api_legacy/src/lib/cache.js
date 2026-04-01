import fs from "node:fs";
import path from "node:path";
const cache = new Map();
const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "cache.json");
// ==========================
// LOAD CACHE FROM DISK
// ==========================
function loadCacheFromDisk() {
    try {
        if (!fs.existsSync(CACHE_FILE))
            return;
        const raw = fs.readFileSync(CACHE_FILE, "utf-8");
        if (!raw)
            return;
        const data = JSON.parse(raw);
        for (const [key, entry] of Object.entries(data)) {
            // 🔥 skip expired
            if (Date.now() > entry.expiresAt)
                continue;
            cache.set(key, entry);
        }
        console.log(`[cache] loaded ${cache.size} entries`);
    }
    catch (err) {
        console.error("[cache] load failed", err);
    }
}
// ==========================
// SAVE CACHE TO DISK
// ==========================
function persistCacheToDisk() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const obj = {};
        for (const [key, value] of cache.entries()) {
            obj[key] = value;
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2));
    }
    catch (err) {
        console.error("[cache] persist failed", err);
    }
}
// ==========================
// PUBLIC API
// ==========================
export function getCache(key) {
    const entry = cache.get(key);
    if (!entry)
        return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}
export function setCache(key, value, ttlMs) {
    cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
    });
    persistCacheToDisk(); // 🔥 save ทุกครั้ง
}
// ==========================
// INIT (เรียกตอน server start)
// ==========================
loadCacheFromDisk();
