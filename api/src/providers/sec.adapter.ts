import { env } from "../config/env";
import { getJson } from "../lib/http-client";
import { ValidationError } from "../shared/errors";
import type { SecProviderHealth } from "./provider.types";

export interface SecFundNavResult {
  nav: number;
  changePercent: number | null;
  navDate: string;
  fundClassName: string;
  projId: string;
  lastUpdatedAt: string | null;
}

export interface SecAmcRecord {
  unique_id: string;
  comp_name_en: string;
  comp_name_th: string;
  last_upd_date: string;
}

export interface SecFundSpecificationRecord {
  proj_id: string;
  fund_class_name: string;
  spec_code: string;
  spec_desc: string;
  last_upd_date: string;
}

export interface SecFundDailyNavRecord {
  proj_id: string;
  unique_id: string;
  fund_class_name: string;
  nav_date: string;
  net_asset: number;
  last_val: number;
  sell_price: number | null;
  buy_price: number | null;
  sell_swap_price: number | null;
  buy_swap_price: number | null;
  last_upd_date: string;
}

interface SecListResponse<T> {
  message: string;
  page_size: number;
  next_cursor: string;
  items: T[];
}

function getSecHeaders(): Record<string, string> {
  if (!env.SEC_API_KEY) {
    throw new ValidationError("SEC_API_KEY is not configured");
  }

  return {
    "Ocp-Apim-Subscription-Key": env.SEC_API_KEY,
    Accept: "application/json",
    "Cache-Control": "no-cache"
  };
}

function buildSecUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${env.SEC_API_BASE_URL}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function getSecProviderHealth(): Promise<SecProviderHealth> {
  return {
    ok: Boolean(env.SEC_API_BASE_URL),
    provider: "sec",
    configured: true,
    baseUrl: env.SEC_API_BASE_URL
  };
}

export async function getSecAmcList(): Promise<SecAmcRecord[]> {
  const url = buildSecUrl("/fund/general-info/amcs");

  const response = await getJson<SecListResponse<SecAmcRecord>>(url, {
    headers: getSecHeaders()
  });

  return Array.isArray(response.items) ? response.items : [];
}

export async function getSecFundSpecifications(
  fundClassName: string
): Promise<SecFundSpecificationRecord[]> {
  const url = buildSecUrl("/fund/general-info/specifications", {
    fund_class_name: fundClassName
  });

  const response = await getJson<SecListResponse<SecFundSpecificationRecord>>(url, {
    headers: getSecHeaders()
  });

  return Array.isArray(response.items) ? response.items : [];
}

export async function resolveFundProjIdByClassName(
  fundClassName: string
): Promise<string> {
  const items = await getSecFundSpecifications(fundClassName);

  const exactMatch =
    items.find((item) => item.fund_class_name === fundClassName)?.proj_id ??
    items[0]?.proj_id;

  if (!exactMatch) {
    throw new ValidationError(`SEC proj_id not found for fund class ${fundClassName}`);
  }

  return exactMatch;
}

export async function getSecFundDailyNavRecords(params: {
  projId?: string;
  fundClassName?: string;
  startNavDate?: string;
  endNavDate?: string;
  pageSize?: number;
  nextCursor?: string;
}): Promise<SecListResponse<SecFundDailyNavRecord>> {
  const url = buildSecUrl("/fund/daily-info/nav", {
    proj_id: params.projId,
    fund_class_name: params.fundClassName,
    start_nav_date: params.startNavDate,
    end_nav_date: params.endNavDate,
    page_size: params.pageSize,
    next_cursor: params.nextCursor
  });

  return getJson<SecListResponse<SecFundDailyNavRecord>>(url, {
    headers: getSecHeaders()
  });
}

export async function getSecFundNav(
  symbol: string,
  projId: string
): Promise<SecFundNavResult> {
  const response = await getSecFundDailyNavRecords({
    projId,
    fundClassName: symbol,
    pageSize: 100
  });

  const items = Array.isArray(response.items) ? response.items : [];

  const filtered = items.filter(
    (item) =>
      item.proj_id === projId &&
      (item.fund_class_name === symbol || item.fund_class_name.startsWith(symbol))
  );

  const candidates = filtered.length > 0 ? filtered : items;

  if (candidates.length === 0) {
    throw new ValidationError(`SEC NAV data not found for fund ${symbol} (${projId})`);
  }

  const sorted = [...candidates].sort((a, b) => {
    if (a.nav_date === b.nav_date) {
      return a.last_upd_date.localeCompare(b.last_upd_date);
    }
    return a.nav_date.localeCompare(b.nav_date);
  });

  const latest = sorted[sorted.length - 1];

  if (!latest) {
    throw new ValidationError(`SEC NAV data not found for fund ${symbol} (${projId})`);
  }

  const nav = Number(latest.last_val);

  if (!Number.isFinite(nav)) {
    throw new ValidationError(`Invalid SEC NAV value for fund ${symbol} (${projId})`);
  }

  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const previousNav = previous ? Number(previous.last_val) : null;

  let changePercent: number | null = null;

  if (
    previousNav !== null &&
    Number.isFinite(previousNav) &&
    previousNav !== 0
  ) {
    changePercent = Number((((nav - previousNav) / previousNav) * 100).toFixed(8));
  }

  return {
    nav,
    changePercent,
    navDate: latest.nav_date,
    fundClassName: latest.fund_class_name,
    projId: latest.proj_id,
    lastUpdatedAt: latest.last_upd_date ?? null
  };
}