type Provider = "twelvedata" | "fund" | "fx";

type HeaderMap = Record<string, string>;

export interface HttpGetOptions {
  url: string;
  provider: Provider;
  timeoutMs?: number;
  retries?: number;
  headers?: HeaderMap;
}

type ProviderConfig = {
  minIntervalMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
};

const PROVIDER_CONFIG: Record<Provider, ProviderConfig> = {
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

const lastRequestAt: Record<Provider, number> = {
  twelvedata: 0,
  fund: 0,
  fx: 0,
};

const providerQueues: Record<Provider, Promise<void>> = {
  twelvedata: Promise.resolve(),
  fund: Promise.resolve(),
  fx: Promise.resolve(),
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(value: string | null) {
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

function createTimeoutError(timeoutMs: number) {
  const error = new Error(`Request timeout after ${timeoutMs} ms`);
  error.name = "AbortError";
  return error;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.includes("aborted") ||
      error.message.includes("timeout"))
  );
}

function isRetryableNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("network") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("fetch failed") ||
    message.includes("terminated") ||
    message.includes("connection")
  );
}

async function withProviderRateLimit<T>(
  provider: Provider,
  task: () => Promise<T>,
): Promise<T> {
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
  let release!: () => void;

  providerQueues[provider] = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await run();
  } finally {
    release();
  }
}

function getRetryDelayMs(
  provider: Provider,
  attempt: number,
  retryAfterSeconds?: number,
) {
  if (
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds)
  ) {
    return Math.max(0, retryAfterSeconds * 1000);
  }

  const base = PROVIDER_CONFIG[provider].retryBaseDelayMs;
  const jitter = Math.floor(Math.random() * 250);

  return base * attempt + jitter;
}

export async function httpGet(options: HttpGetOptions): Promise<string> {
  const {
    url,
    provider,
    timeoutMs = 10_000,
    retries = PROVIDER_CONFIG[provider].maxRetries,
    headers = {},
  } = options;

  let lastError: unknown;

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
        } catch (error) {
          if (isAbortError(error)) {
            throw createTimeoutError(timeoutMs);
          }

          throw error;
        } finally {
          clearTimeout(timeout);
        }
      });

      if (!response.ok) {
        const retryAfterSeconds = parseRetryAfterSeconds(
          response.headers.get("retry-after"),
        );

        const error = new Error(
          `HTTP ${response.status} ${response.statusText} for ${url}`,
        ) as Error & {
          status?: number;
          retryAfterSeconds?: number;
        };

        error.status = response.status;
        error.retryAfterSeconds = retryAfterSeconds;

        if (!isRetryableStatus(response.status) || attempt >= retries) {
          throw error;
        }

        await sleep(
          getRetryDelayMs(provider, attempt, error.retryAfterSeconds),
        );

        lastError = error;
        continue;
      }

      return await response.text();
    } catch (error) {
      lastError = error;

      const status =
        error instanceof Error
          ? (error as Error & { status?: number }).status
          : undefined;

      const retryAfterSeconds =
        error instanceof Error
          ? (error as Error & { retryAfterSeconds?: number })
              .retryAfterSeconds
          : undefined;

      const shouldRetry =
        attempt < retries &&
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