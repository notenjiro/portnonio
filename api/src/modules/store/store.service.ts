import { randomUUID } from "crypto";
import { NotFoundError, ValidationError } from "../../shared/errors";
import {
  getDefaultStoreData,
  readStore,
  writeStore,
} from "../../storage/store.repository";
import type {
  AccountAssetLinkRecord,
  AccountRecord,
  AssetRecord,
  StoreData,
  AccountSource,
  TransactionRecord,
} from "../../storage/storage.types";
import type {
  CreateAccountInput,
  CreateAssetInput,
  CreateAssetFromProviderInput,
  LinkAssetToAccountInput,
  UpdateBinanceAccountSettingsInput,
  CreateTransactionInput,
  UpdateTransactionInput,
} from "./store.schemas";

/**
 * -----------------------------
 * HELPERS
 * -----------------------------
 */

function normalizeCurrency(value: string): "USD" | "THB" {
  const upper = value.toUpperCase();

  if (upper === "USD" || upper === "THB") {
    return upper;
  }

  throw new ValidationError(`Unsupported currency: ${value}`);
}

function nowIso() {
  return new Date().toISOString();
}

function getDefaultAccountCurrency(source: AccountSource): "USD" | "THB" {
  if (source === "binance") return "USD";
  return "THB";
}

/**
 * -----------------------------
 * STORE CORE
 * -----------------------------
 */

export async function getStore(): Promise<StoreData> {
  return readStore();
}

export async function bootstrapStore(): Promise<StoreData> {
  const defaultStore = getDefaultStoreData();
  await writeStore(defaultStore);
  return defaultStore;
}

/**
 * -----------------------------
 * ACCOUNT / ASSET
 * -----------------------------
 */

export async function listAccounts(
  source?: AccountSource,
): Promise<AccountRecord[]> {
  const store = await readStore();

  if (!source) return store.accounts;

  return store.accounts.filter((account) => account.source === source);
}

export async function listAssets(
  source?: AccountSource,
): Promise<AssetRecord[]> {
  const store = await readStore();

  if (!source) return store.assets;

  return store.assets.filter((asset) => asset.source === source);
}

export async function listAccountAssetLinks(
  accountId?: string,
): Promise<AccountAssetLinkRecord[]> {
  const store = await readStore();

  if (!accountId) return store.accountAssetLinks;

  return store.accountAssetLinks.filter((link) => link.accountId === accountId);
}

/**
 * -----------------------------
 * ACCOUNT CREATE
 * -----------------------------
 */

export async function createAccount(
  input: CreateAccountInput,
): Promise<AccountRecord> {
  const store = await readStore();
  const now = nowIso();

  const duplicated = store.accounts.find(
    (account) =>
      account.source === input.source &&
      account.provider.toLowerCase() === input.provider.toLowerCase() &&
      account.name.toLowerCase() === input.name.toLowerCase(),
  );

  if (duplicated) {
    throw new ValidationError("Account already exists");
  }

  const record: AccountRecord = {
    id: randomUUID(),
    name: input.name,
    source: input.source,
    provider: input.provider,
    baseCurrency: getDefaultAccountCurrency(input.source),
    settings: null,
    createdAt: now,
    updatedAt: now,
  };

  store.accounts.push(record);
  await writeStore(store);

  return record;
}

/**
 * -----------------------------
 * ASSET CREATE
 * -----------------------------
 */

export async function createAsset(
  input: CreateAssetInput,
): Promise<AssetRecord> {
  const store = await readStore();
  const now = nowIso();

  const duplicated = store.assets.find(
    (asset) =>
      asset.source === input.source &&
      asset.symbol.toLowerCase() === input.symbol.toLowerCase(),
  );

  if (duplicated) {
    throw new ValidationError("Asset already exists");
  }

  const record: AssetRecord = {
    id: randomUUID(),
    symbol: input.symbol,
    name: input.name,
    source: input.source,
    category: input.category,
    currency: normalizeCurrency(input.currency),
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };

  store.assets.push(record);
  await writeStore(store);

  return record;
}

export async function createAssetFromProvider(
  input: CreateAssetFromProviderInput,
): Promise<AssetRecord> {
  const store = await readStore();
  const now = nowIso();

  if (input.provider === "twelvedata") {
    const duplicated = store.assets.find(
      (asset) =>
        asset.source === "stock" &&
        asset.symbol.toLowerCase() === input.symbol.toLowerCase(),
    );

    if (duplicated) {
      throw new ValidationError("Asset already exists");
    }

    const record: AssetRecord = {
      id: randomUUID(),
      symbol: input.symbol,
      name: input.name,
      source: "stock",
      category: "stock",
      currency: normalizeCurrency(input.currency),
      metadata: {
        provider: "twelvedata",
        exchange: input.exchange ?? null,
        projId: null,
      },
      createdAt: now,
      updatedAt: now,
    };

    store.assets.push(record);
    await writeStore(store);

    return record;
  }

  const duplicated = store.assets.find(
    (asset) =>
      asset.source === "fund" &&
      asset.symbol.toLowerCase() === input.symbol.toLowerCase(),
  );

  if (duplicated) {
    throw new ValidationError("Asset already exists");
  }

  const record: AssetRecord = {
    id: randomUUID(),
    symbol: input.symbol,
    name: input.name,
    source: "fund",
    category: "fund",
    currency: normalizeCurrency(input.currency),
    metadata: {
      provider: "sec",
      exchange: null,
      projId: input.projId,
    },
    createdAt: now,
    updatedAt: now,
  };

  store.assets.push(record);
  await writeStore(store);

  return record;
}

/**
 * -----------------------------
 * EXISTING ACCOUNT SETTINGS / LINKS
 * -----------------------------
 */

export async function updateBinanceAccountSettings(
  accountId: string,
  input: UpdateBinanceAccountSettingsInput,
): Promise<AccountRecord> {
  const store = await readStore();
  const now = nowIso();

  const account = store.accounts.find((item) => item.id === accountId);

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  if (account.source !== "binance") {
    throw new ValidationError(
      "Only binance accounts can have binance settings",
    );
  }

  account.settings = {
    apiKey: input.apiKey,
    apiSecret: input.apiSecret,
    isTestnet: input.isTestnet,
    permissions: input.permissions,
    label: input.label,
    lastValidatedAt: null,
  };
  account.updatedAt = now;

  await writeStore(store);

  return account;
}

export async function linkAssetToAccount(
  input: LinkAssetToAccountInput,
): Promise<AccountAssetLinkRecord> {
  const store = await readStore();
  const now = nowIso();

  const account = store.accounts.find((item) => item.id === input.accountId);
  if (!account) {
    throw new NotFoundError("Account not found");
  }

  const asset = store.assets.find((item) => item.id === input.assetId);
  if (!asset) {
    throw new NotFoundError("Asset not found");
  }

  const duplicated = store.accountAssetLinks.find(
    (link) =>
      link.accountId === input.accountId && link.assetId === input.assetId,
  );

  if (duplicated) {
    throw new ValidationError("Asset is already linked to account");
  }

  const record: AccountAssetLinkRecord = {
    id: randomUUID(),
    accountId: input.accountId,
    assetId: input.assetId,
    quantity: input.quantity ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  store.accountAssetLinks.push(record);
  await writeStore(store);

  return record;
}

export async function updateAccountAssetLinkQuantity(
  linkId: string,
  quantity: number,
): Promise<AccountAssetLinkRecord> {
  const store = await readStore();
  const now = nowIso();

  const link = store.accountAssetLinks.find((l) => l.id === linkId);
  if (!link) {
    throw new NotFoundError("Link not found");
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new ValidationError("Invalid quantity");
  }

  link.quantity = quantity;
  link.updatedAt = now;

  await writeStore(store);

  return link;
}

export async function unlinkAssetFromAccount(linkId: string): Promise<void> {
  const store = await readStore();

  const index = store.accountAssetLinks.findIndex((l) => l.id === linkId);

  if (index === -1) {
    throw new NotFoundError("Link not found");
  }

  store.accountAssetLinks.splice(index, 1);

  await writeStore(store);
}

export async function updateAccountName(
  accountId: string,
  name: string,
): Promise<AccountRecord> {
  const store = await readStore();
  const now = nowIso();
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new ValidationError("Name is required");
  }

  const account = store.accounts.find((a) => a.id === accountId);

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  const duplicated = store.accounts.find(
    (item) =>
      item.id !== accountId &&
      item.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (duplicated) {
    throw new ValidationError("Account name already exists");
  }

  account.name = normalizedName;
  account.updatedAt = now;

  await writeStore(store);

  return account;
}

/**
 * -----------------------------
 * TRANSACTION CORE
 * -----------------------------
 */

export async function listTransactions(accountId?: string) {
  const store = await readStore();

  if (!accountId) return store.transactions ?? [];

  return (store.transactions ?? []).filter(
    (t) => t.accountId === accountId
  );
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<TransactionRecord> {
  const store = await readStore();
  const now = nowIso();

  const account = store.accounts.find((a) => a.id === input.accountId);
  if (!account) throw new NotFoundError("Account not found");

  const asset = store.assets.find((a) => a.id === input.assetId);
  if (!asset) throw new NotFoundError("Asset not found");

  const record: TransactionRecord = {
    id: randomUUID(),
    accountId: input.accountId,
    assetId: input.assetId,
    side: input.side,
    quantity: input.quantity,
    price: input.price,
    currency: normalizeCurrency(input.currency),
    fee: input.fee ?? 0,
    feeCurrency: input.feeCurrency
      ? normalizeCurrency(input.feeCurrency)
      : normalizeCurrency(input.currency),
    executedAt: input.executedAt,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };

  store.transactions = [...(store.transactions ?? []), record];

  await writeStore(store);

  return record;
}

export async function updateTransaction(
  input: UpdateTransactionInput
): Promise<TransactionRecord> {
  const store = await readStore();
  const now = nowIso();

  const tx = (store.transactions ?? []).find((t) => t.id === input.id);
  if (!tx) throw new NotFoundError("Transaction not found");

  if (tx.source === "binance") {
    throw new ValidationError("Cannot modify binance transaction");
  }

  if (input.side) tx.side = input.side;
  if (input.quantity) tx.quantity = input.quantity;
  if (input.price) tx.price = input.price;

  if (input.currency) tx.currency = normalizeCurrency(input.currency);

  if (input.fee !== undefined) tx.fee = input.fee;
  if (input.feeCurrency) tx.feeCurrency = normalizeCurrency(input.feeCurrency);

  if (input.executedAt) tx.executedAt = input.executedAt;

  tx.updatedAt = now;

  await writeStore(store);

  return tx;
}

export async function deleteTransaction(id: string): Promise<void> {
  const store = await readStore();

  const index = (store.transactions ?? []).findIndex((t) => t.id === id);

  if (index === -1) throw new NotFoundError("Transaction not found");

  const tx = store.transactions[index];
  if (!tx) {
    throw new NotFoundError("Transaction not found");
  }

  if (tx.source === "binance") {
    throw new ValidationError("Cannot delete binance transaction");
  }

  store.transactions.splice(index, 1);

  await writeStore(store);
}