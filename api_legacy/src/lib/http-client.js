const PROVIDER_CONFIG = {
    twelvedata: {
        minIntervalMs: 1200,
        maxRetries: 3,
        retryBaseDelayMs: 1000,
    },
    fund: {
        minIntervalMs: 800,
        maxRetries: 3,
        retryBaseDelayMs: 700,
    },
    fx: {
        minIntervalMs: 500,
        maxRetries: 2,
        retryBaseDelayMs: 500,
    },
};
const lastRequestAt = {
    twelvedata: 0,
    fund: 0,
    fx: 0,
};
const providerQueues = {
    twelvedata: Promise.resolve(),
    fund: Promise.resolve(),
    fx: Promise.resolve(),
};
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function parseRetryAfterSeconds(value) {
    if (!value) {
        return undefined;
    }
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds;
    }
    const retryAt = Date.parse(value);
    if (Number.isNaN(retryAt)) {
        return undefined;
    }
    const diffMs = retryAt - Date.now();
    if (diffMs <= 0) {
        return 0;
    }
    return Math.ceil(diffMs / 1000);
}
function createTimeoutError(timeoutMs) {
    const error = new Error(`Request timeout after ${timeoutMs} ms`);
    error.name = "AbortError";
    return error;
}
function isRetryableStatus(status) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}
function isAbortError(error) {
    return (error instanceof Error &&
        (error.name === "AbortError" ||
            error.message.includes("aborted") ||
            error.message.includes("timeout")));
}
function isRetryableNetworkError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    const message = error.message.toLowerCase();
    return (message.includes("network") ||
        message.includes("socket") ||
        message.includes("econnreset") ||
        message.includes("etimedout") ||
        message.includes("fetch failed") ||
        message.includes("terminated") ||
        message.includes("connection"));
}
async function withProviderRateLimit(provider, task) {
    const run = async () => {
        const config = PROVIDER_CONFIG[provider];
        const now = Date.now();
        const elapsed = now - lastRequestAt[provider];
        const waitMs = Math.max(0, config.minIntervalMs - elapsed);
        if (waitMs > 0) {
            await sleep(waitMs);
        }
        lastRequestAt[provider] = Date.now();
        return task();
    };
    const previous = providerQueues[provider];
    let release;
    providerQueues[provider] = new Promise((resolve) => {
        release = resolve;
    });
    await previous;
    try {
        return await run();
    }
    finally {
        release();
    }
}
function getRetryDelayMs(provider, attempt, retryAfterSeconds) {
    if (typeof retryAfterSeconds === "number" &&
        Number.isFinite(retryAfterSeconds)) {
        return Math.max(0, retryAfterSeconds * 1000);
    }
    const base = PROVIDER_CONFIG[provider].retryBaseDelayMs;
    const jitter = Math.floor(Math.random() * 250);
    return base * attempt + jitter;
}
export async function httpGet(options) {
    const { url, provider, timeoutMs = 10_000, retries = PROVIDER_CONFIG[provider].maxRetries, headers = {}, } = options;
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            const response = await withProviderRateLimit(provider, async () => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    return await fetch(url, {
                        method: "GET",
                        headers,
                        signal: controller.signal,
                    });
                }
                catch (error) {
                    if (isAbortError(error)) {
                        throw createTimeoutError(timeoutMs);
                    }
                    throw error;
                }
                finally {
                    clearTimeout(timeout);
                }
            });
            if (!response.ok) {
                const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("retry-after"));
                const error = new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
                error.status = response.status;
                error.retryAfterSeconds = retryAfterSeconds;
                if (!isRetryableStatus(response.status) || attempt >= retries) {
                    throw error;
                }
                await sleep(getRetryDelayMs(provider, attempt, error.retryAfterSeconds));
                lastError = error;
                continue;
            }
            return await response.text();
        }
        catch (error) {
            lastError = error;
            const status = error instanceof Error
                ? error.status
                : undefined;
            const retryAfterSeconds = error instanceof Error
                ? error
                    .retryAfterSeconds
                : undefined;
            const shouldRetry = attempt < retries &&
                (isAbortError(error) ||
                    isRetryableNetworkError(error) ||
                    (typeof status === "number" && isRetryableStatus(status)));
            if (!shouldRetry) {
                throw error;
            }
            await sleep(getRetryDelayMs(provider, attempt, retryAfterSeconds));
        }
    }
    if (lastError instanceof Error) {
        throw lastError;
    }
    throw new Error(`Request failed for ${url}`);
}
