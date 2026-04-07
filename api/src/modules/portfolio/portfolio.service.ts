import { readStore } from "../../storage/store.repository";
import {
  readFundHistory,
  readMarketHistory
} from "../../storage/history.repository";
import type {
  FundDailyHistoryRecord,
  MarketDailyHistoryRecord
} from "../../storage/history.types";
import { convertAmount } from "../../services/fx-rate.service";

const BASE_CURRENCY = "THB";

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

/**
 * 🔥 TEMP COST BASIS (Phase 1)
 * ตอนนี้ยังไม่มี order → ใช้ heuristic ไปก่อน
 */
function getAvgCostFallback(price: number | null): number | null {
  if (!price) return null;
  return price * 0.9; // 👈 สมมติว่าซื้อถูกกว่า 10% (placeholder)
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

    let avgCost: number | null = null;
    let costValue: number | null = null;
    let unrealizedPnl: number | null = null;

    const qty = link.quantity ?? 1;

    /**
     * 📈 STOCK
     */
    if (asset.category === "stock") {
      const records = marketByAsset.get(asset.id) ?? [];
      const { latest, previous } = getLastTwoRecords(records);

      if (latest) {
        const priceTHB = await convertAmount(
          latest.close,
          "USD",
          BASE_CURRENCY,
          latest.date
        );

        price = round(priceTHB);
        value = round(priceTHB * qty);
        lastUpdated = latest.updatedAt;
        changePercent = latest.changePercent ?? null;

        // 🔥 cost basis
        avgCost = getAvgCostFallback(priceTHB);
        costValue = avgCost ? round(avgCost * qty) : null;
        unrealizedPnl =
          avgCost !== null ? round((priceTHB - avgCost) * qty) : null;

        if (previous) {
          const prevPriceTHB = await convertAmount(
            previous.close,
            "USD",
            BASE_CURRENCY,
            previous.date
          );

          dailyPnl = round((priceTHB - prevPriceTHB) * qty);
        }
      }
    }

    /**
     * 💰 FUND
     */
    if (asset.category === "fund") {
      const records = fundByAsset.get(asset.id) ?? [];
      const { latest, previous } = getLastTwoRecords(records);

      if (latest) {
        const priceTHB =
          latest.currency === BASE_CURRENCY
            ? latest.nav
            : await convertAmount(
                latest.nav,
                latest.currency,
                BASE_CURRENCY,
                latest.date
              );

        price = round(priceTHB);
        value = round(priceTHB * qty);
        lastUpdated = latest.updatedAt;
        changePercent = latest.changePercent ?? null;

        // 🔥 cost basis
        avgCost = getAvgCostFallback(priceTHB);
        costValue = avgCost ? round(avgCost * qty) : null;
        unrealizedPnl =
          avgCost !== null ? round((priceTHB - avgCost) * qty) : null;

        if (previous) {
          const prevPriceTHB =
            previous.currency === BASE_CURRENCY
              ? previous.nav
              : await convertAmount(
                  previous.nav,
                  previous.currency,
                  BASE_CURRENCY,
                  previous.date
                );

          dailyPnl = round((priceTHB - prevPriceTHB) * qty);
        }
      }
    }

    result.push({
      linkId: link.id,
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      quantity: qty,

      price,
      value,

      // 🔥 NEW (สำคัญ)
      avgCost,
      costValue,
      unrealizedPnl,

      // เดิม
      dailyPnl,
      changePercent,
      lastUpdated,

      currency: BASE_CURRENCY,
    });
  }

  return result;
}