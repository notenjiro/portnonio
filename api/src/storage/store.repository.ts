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
    assets: Array.isArray(input?.assets)
      ? input.assets.map((asset: any) => ({
          ...asset,
          metadata:
            asset?.metadata && typeof asset.metadata === "object"
              ? {
                  provider:
                    asset.metadata.provider === "twelvedata" || asset.metadata.provider === "sec"
                      ? asset.metadata.provider
                      : undefined,
                  exchange:
                    typeof asset.metadata.exchange === "string" || asset.metadata.exchange === null
                      ? asset.metadata.exchange
                      : undefined,
                  projId:
                    typeof asset.metadata.projId === "string" || asset.metadata.projId === null
                      ? asset.metadata.projId
                      : undefined
                }
              : null
        }))
      : [],
    accountAssetLinks: Array.isArray(input?.accountAssetLinks)
      ? input.accountAssetLinks.map((link: any) => ({
          ...link,
          quantity: typeof link.quantity === "number" ? link.quantity : 1
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