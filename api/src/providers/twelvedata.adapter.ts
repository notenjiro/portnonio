import { env } from "../config/env";
import { getJson } from "../lib/http-client";
import { ValidationError } from "../shared/errors";
import type { TwelveDataProviderHealth } from "./provider.types";

interface TwelveDataQuoteResponse {
  symbol?: string;
  close?: string;
  previous_close?: string;
  percent_change?: string;
  exchange?: string;
  is_market_open?: boolean;
}

export async function getTwelveDataProviderHealth(): Promise<TwelveDataProviderHealth> {
  return {
    ok: Boolean(env.TWELVEDATA_API_BASE_URL),
    provider: "twelvedata",
    configured: true,
    hasApiKey: Boolean(env.TWELVEDATA_API_KEY),
    baseUrl: env.TWELVEDATA_API_BASE_URL
  };
}

export async function getTwelveDataQuote(symbol: string): Promise<{
  symbol: string;
  close: number;
  changePercent: number | null;
}> {
  if (!env.TWELVEDATA_API_KEY) {
    throw new ValidationError("TWELVEDATA_API_KEY is not configured");
  }

  const url =
    `${env.TWELVEDATA_API_BASE_URL}/quote` +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(env.TWELVEDATA_API_KEY)}`;

  const response = await getJson<TwelveDataQuoteResponse>(url);

  const close = Number(response.close);

  if (!Number.isFinite(close)) {
    throw new ValidationError(`Invalid Twelve Data close price for symbol ${symbol}`);
  }

  const parsedChangePercent =
    response.percent_change !== undefined ? Number(response.percent_change) : null;

  return {
    symbol: response.symbol ?? symbol,
    close,
    changePercent:
      parsedChangePercent !== null && Number.isFinite(parsedChangePercent)
        ? parsedChangePercent
        : null
  };
}