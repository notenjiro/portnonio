import { BinanceProviderAdapter } from "./binance.adapter.js";
import { InnovestXProviderAdapter } from "./innovestx.adapter.js";
import type {
  PortfolioProviderAdapter,
  ProviderName,
} from "./provider.types.js";

const providers: Record<ProviderName, PortfolioProviderAdapter> = {
  binance: new BinanceProviderAdapter(),
  innovestx: new InnovestXProviderAdapter(),
};

export function getProviderAdapter(provider: ProviderName) {
  return providers[provider];
}

export function listProviderAdapters() {
  return Object.values(providers);
}