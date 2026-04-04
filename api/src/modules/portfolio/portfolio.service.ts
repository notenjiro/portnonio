import { readStore } from "../../storage/store.repository";
import {
  readFundHistory,
  readMarketHistory
} from "../../storage/history.repository";
import type {
  FundDailyHistoryRecord,
  MarketDailyHistoryRecord
} from "../../storage/history.types";
import { getFxRateTHBUSD } from "../../services/fx-rate.service";

function round(value: number): number {
  return Number(value.toFixed(8));
}

function groupByAsset<T extends { assetId: string; date: string }>(
  records: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const record of records) {
    const list = map.get(record.assetId) ?? [];
    list.push(record);
    map.set(record.assetId, list);
  }

  for (const [assetId, list] of map.entries()) {
    map.set(
      assetId,
      [...list].sort((a, b) => a.date.localeCompare(b.date)),
    );
  }

  return map;
}

function getLastTwoRecords<T>(records: T[]): {
  latest: T | null;
  previous: T | null;
} {
  if (records.length === 0) {
    return { latest: null, previous: null };
  }

  if (records.length === 1) {
    return { latest: records[0] ?? null, previous: null };
  }

  return {
    latest: records[records.length - 1] ?? null,
    previous: records[records.length - 2] ?? null,
  };
}

async function getFundUsdUnitValue(record: FundDailyHistoryRecord): Promise<number> {
  if (record.currency === "THB") {
    const fx = await getFxRateTHBUSD(record.date);
    return round(record.nav * fx);
  }

  return round(record.nav);
}

export async function getPortfolioAssets() {
  const [store, marketHistory, fundHistory] = await Promise.all([
    readStore(),
    readMarketHistory(),
    readFundHistory(),
  ]);

  const marketByAsset = groupByAsset<MarketDailyHistoryRecord>(marketHistory);
  const fundByAsset = groupByAsset<FundDailyHistoryRecord>(fundHistory);

  const result = [];

  for (const link of store.accountAssetLinks ?? []) {
    const asset = store.assets.find((a) => a.id === link.assetId);
    if (!asset) continue;

    let price: number | null = null;
    let value: number | null = null;
    let lastUpdated: string | null = null;
    let dailyPnl: number | null = null;
    let changePercent: number | null = null;

    if (asset.category === "stock") {
      const records = marketByAsset.get(asset.id) ?? [];
      const { latest, previous } = getLastTwoRecords(records);

      if (latest) {
        price = round(latest.close);
        value = round(price * (link.quantity ?? 1));
        lastUpdated = latest.updatedAt;
        changePercent = latest.changePercent ?? null;

        if (previous) {
          dailyPnl = round((latest.close - previous.close) * (link.quantity ?? 1));
        }
      }
    }

    if (asset.category === "fund") {
      const records = fundByAsset.get(asset.id) ?? [];
      const { latest, previous } = getLastTwoRecords(records);

      if (latest) {
        const latestUsd = await getFundUsdUnitValue(latest);

        price = latestUsd;
        value = round(latestUsd * (link.quantity ?? 1));
        lastUpdated = latest.updatedAt;
        changePercent = latest.changePercent ?? null;

        if (previous) {
          const previousUsd = await getFundUsdUnitValue(previous);
          dailyPnl = round((latestUsd - previousUsd) * (link.quantity ?? 1));
        }
      }
    }

    result.push({
      linkId: link.id,
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      quantity: link.quantity ?? 1,
      price,
      value,
      dailyPnl,
      changePercent,
      lastUpdated,
    });
  }

  return result;
}