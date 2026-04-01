import { paths } from "../config/paths";
import { readJsonFile, writeJsonFile } from "./json-file";
import type { StoreData } from "./storage.types";

const defaultStoreData: StoreData = {
  version: 1,
  baseCurrency: "USD",
  accounts: [],
  assets: [],
};

export async function readStore(): Promise<StoreData> {
  return readJsonFile<StoreData>(paths.storeFile, defaultStoreData);
}

export async function writeStore(data: StoreData): Promise<void> {
  await writeJsonFile(paths.storeFile, data);
}

export function getDefaultStoreData(): StoreData {
  return structuredClone(defaultStoreData);
}