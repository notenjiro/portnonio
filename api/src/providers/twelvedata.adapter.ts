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

interface TwelveDataSymbolSearchItem {
  symbol?: string;
  instrument_name?: string;
  exchange?: string;
}

interface TwelveDataSymbolSearchResponse {
  data?: TwelveDataSymbolSearchItem[];
  status?: string;
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

export async function searchTwelveDataSymbols(query: string): Promise<
  Array<{
    symbol: string;
    name: string;
    exchange: string | null;
  }>
> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new ValidationError("query is required");
  }

  if (!env.TWELVEDATA_API_KEY) {
    throw new ValidationError("TWELVEDATA_API_KEY is not configured");
  }

  const url =
    `${env.TWELVEDATA_API_BASE_URL}/symbol_search` +
    `?symbol=${encodeURIComponent(trimmedQuery)}` +
    `&apikey=${encodeURIComponent(env.TWELVEDATA_API_KEY)}`;

  const response = await getJson<TwelveDataSymbolSearchResponse>(url);
  const items = Array.isArray(response.data) ? response.data : [];

  return items
    .filter((item) => typeof item.symbol === "string" && item.symbol.trim() !== "")
    .map((item) => ({
      symbol: item.symbol!.trim(),
      name: item.instrument_name?.trim() || item.symbol!.trim(),
      exchange: item.exchange?.trim() || null
    }));
}