import { NotFoundError, ValidationError } from "../shared/errors";
import { readStore } from "../storage/store.repository";
import type { BinanceAccountSettings } from "../storage/storage.types";
import type { BinanceSyncReadiness } from "./provider.types";

function getApiKeyPreview(apiKey: string): string {
  if (apiKey.length <= 8) {
    return apiKey;
  }

  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function isBinanceSettings(settings: unknown): settings is BinanceAccountSettings {
  if (!settings || typeof settings !== "object") {
    return false;
  }

  const value = settings as Partial<BinanceAccountSettings>;

  return (
    typeof value.apiKey === "string" &&
    typeof value.isTestnet === "boolean" &&
    Array.isArray(value.permissions) &&
    ("lastValidatedAt" in value)
  );
}

export async function getBinanceSyncReadiness(accountId: string): Promise<BinanceSyncReadiness> {
  const store = await readStore();
  const account = store.accounts.find((item) => item.id === accountId);

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  if (account.source !== "binance" || account.provider !== "binance") {
    throw new ValidationError("Account is not a Binance account");
  }

  const reasons: string[] = [];

  if (!isBinanceSettings(account.settings)) {
    reasons.push("Missing Binance settings");
  }

  const settings = isBinanceSettings(account.settings) ? account.settings : null;

  if (settings && !settings.apiKey.trim()) {
    reasons.push("Missing API key");
  }

  if (settings && settings.permissions.length === 0) {
    reasons.push("No permissions configured");
  }

  return {
    accountId: account.id,
    provider: "binance",
    ready: reasons.length === 0,
    reasons,
    apiKeyPreview: settings ? getApiKeyPreview(settings.apiKey) : null,
    isTestnet: settings ? settings.isTestnet : null,
    permissions: settings ? settings.permissions : []
  };
}