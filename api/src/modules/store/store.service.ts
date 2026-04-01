import { getDefaultStoreData, readStore, writeStore } from "../../storage/store.repository";
import type { StoreData } from "../../storage/storage.types";

export async function getStore(): Promise<StoreData> {
  return readStore();
}

export async function bootstrapStore(): Promise<StoreData> {
  const defaultStore = getDefaultStoreData();
  await writeStore(defaultStore);
  return defaultStore;
}