import { env } from "../config/env";
import { getJson } from "../lib/http-client";
import { ValidationError } from "../shared/errors";
import type { SecProviderHealth } from "./provider.types";

export interface SecFundNavResult {
  nav: number;
  changePercent: number | null;
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
    Accept: "application/json"
  };
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
  const url = `${env.SEC_API_BASE_URL}/fund/general-info/amcs`;

  const response = await getJson<SecListResponse<SecAmcRecord>>(url, {
    headers: getSecHeaders()
  });

  return Array.isArray(response.items) ? response.items : [];
}

export async function getSecFundSpecifications(
  fundClassName: string
): Promise<SecFundSpecificationRecord[]> {
  const url =
    `${env.SEC_API_BASE_URL}/fund/general-info/specifications` +
    `?fund_class_name=${encodeURIComponent(fundClassName)}`;

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

export async function getSecFundNav(_symbol: string): Promise<SecFundNavResult> {
  throw new ValidationError(
    "SEC fund NAV fetch is not implemented yet. Need exact NAV endpoint parameters from SEC docs."
  );
}