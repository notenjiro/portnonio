import { paths } from "../config/paths";
import { readJsonFile, writeJsonFile } from "./json-file";
import type { StoreData } from "./storage.types";

const defaultStoreData: StoreData = {
  version: 1,
  baseCurrency: "USD",
  accounts: [],
  assets: [],
  accountAssetLinks: []
};

function normalizeStoreData(input: Partial<StoreData> | null | undefined): StoreData {
  return {
    version: 1,
    baseCurrency: "USD",
    accounts: Array.isArray(input?.accounts) ? input.accounts : [],
    assets: Array.isArray(input?.assets) ? input.assets : [],
    accountAssetLinks: Array.isArray(input?.accountAssetLinks)
      ? input.accountAssetLinks.map((link: any) => ({
          ...link,
          quantity: typeof link.quantity === "number" ? link.quantity : 1 // ⭐ default
        }))
      : []
  };
}

export async function readStore(): Promise<StoreData> {
  const raw = await readJsonFile<Partial<StoreData>>(paths.storeFile, defaultStoreData);
  return normalizeStoreData(raw);
}

export async function writeStore(data: StoreData): Promise<void> {
  await writeJsonFile(paths.storeFile, normalizeStoreData(data));
}

export function getDefaultStoreData(): StoreData {
  return structuredClone(defaultStoreData);
}