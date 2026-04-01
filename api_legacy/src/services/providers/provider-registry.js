import { BinanceProviderAdapter } from "./binance.adapter.js";
import { InnovestXProviderAdapter } from "./innovestx.adapter.js";
const providers = {
    binance: new BinanceProviderAdapter(),
    innovestx: new InnovestXProviderAdapter(),
};
export function getProviderAdapter(provider) {
    return providers[provider];
}
export function listProviderAdapters() {
    return Object.values(providers);
}
