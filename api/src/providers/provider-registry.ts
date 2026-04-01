import type { ProviderHealthResult, ProviderName } from "./provider.types";

const supportedProviders: ProviderName[] = ["binance", "twelvedata", "sec"];

export function listSupportedProviders(): ProviderName[] {
  return [...supportedProviders];
}

export function getProviderHealth(): ProviderHealthResult[] {
  return supportedProviders.map((provider) => ({
    ok: true,
    provider,
    message: "Provider is registered"
  }));
}