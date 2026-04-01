export type PriceSource = "live_api" | "daily_nav" | "manual" | string;

type FreshnessResult = {
  isStale: boolean;
  level: "fresh" | "aging" | "stale";
  label: string;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function isStaleCacheSource(value?: string) {
  return (value ?? "").toLowerCase().includes("stale_cache");
}

function getStaleCacheLabel(source: PriceSource | undefined) {
  if (source === "live_api") {
    return "Cached live price";
  }

  if (source === "daily_nav") {
    return "Cached NAV";
  }

  return "Cached data";
}

export function getFreshness(
  source?: PriceSource,
  lastSyncedAt?: string,
  lastPriceSource?: string,
): FreshnessResult {
  if (isStaleCacheSource(lastPriceSource)) {
    return {
      isStale: true,
      level: "stale",
      label: getStaleCacheLabel(source),
    };
  }

  if (!lastSyncedAt) {
    return {
      isStale: true,
      level: "stale",
      label: "Never synced",
    };
  }

  const ts = new Date(lastSyncedAt).getTime();

  if (Number.isNaN(ts)) {
    return {
      isStale: true,
      level: "stale",
      label: "Invalid date",
    };
  }

  const age = Date.now() - ts;

  if (source === "live_api") {
    if (age < 30 * MINUTE) {
      return {
        isStale: false,
        level: "fresh",
        label: "Live",
      };
    }

    if (age < 60 * MINUTE) {
      return {
        isStale: false,
        level: "aging",
        label: "Slight delay",
      };
    }

    return {
      isStale: true,
      level: "stale",
      label: "Delayed",
    };
  }

  if (source === "daily_nav") {
    if (age < 24 * HOUR) {
      return {
        isStale: false,
        level: "fresh",
        label: "Daily NAV",
      };
    }

    if (age < 48 * HOUR) {
      return {
        isStale: false,
        level: "aging",
        label: "1 day old",
      };
    }

    return {
      isStale: true,
      level: "stale",
      label: "Outdated NAV",
    };
  }

  if (source === "manual") {
    return {
      isStale: false,
      level: "fresh",
      label: "Manual",
    };
  }

  return {
    isStale: true,
    level: "stale",
    label: "Unknown",
  };
}