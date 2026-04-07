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

function getLastTwoRecords<T>(records: T[]) {
  if (records.length === 0) return { latest: null, previous: null };
  if (records.length === 1) return { latest: records[0], previous: null };

  return {
    latest: records[records.length - 1],
    previous: records[records.length - 2],
  };
}

async function convertFeeToBase(tx: any): Promise<number> {
  const fee = Number(tx.fee ?? 0);
  if (!Number.isFinite(fee) || fee <= 0) return 0;

  return convertAmount(
    fee,
    tx.feeCurrency ?? tx.currency,
    BASE_CURRENCY,
    tx.executedAt
  );
}

/**
 * 🔥 CORE: derive EVERYTHING from transactions
 */
async function calculatePositionState(store: any, assetId: string) {
  const txs = (store.transactions ?? [])
    .filter((t: any) => t.assetId === assetId)
    .sort((a: any, b: any) => a.executedAt.localeCompare(b.executedAt));

  let openQty = 0;
  let openCost = 0;
  let realizedPnl = 0;

  for (const tx of txs) {
    const qty = Number(tx.quantity ?? 0);
    if (!qty || qty <= 0) continue;

    const priceBase = await convertAmount(
      Number(tx.price),
      tx.currency,
      BASE_CURRENCY,
      tx.executedAt
    );

    const feeBase = await convertFeeToBase(tx);

    if (tx.side === "buy") {
      openQty += qty;
      openCost += (priceBase * qty) + feeBase;
      continue;
    }

    if (tx.side === "sell") {
      if (openQty <= 0) continue;

      const sellQty = Math.min(qty, openQty);
      const avgCost = openQty > 0 ? openCost / openQty : 0;

      const proceeds = (priceBase * sellQty) - feeBase;
      const costRemoved = avgCost * sellQty;

      realizedPnl += proceeds - costRemoved;

      openQty -= sellQty;
      openCost -= costRemoved;

      if (openQty <= 0.00000001) {
        openQty = 0;
        openCost = 0;
      }
    }
  }

  const avgCost = openQty > 0 ? openCost / openQty : null;

  return {
    quantity: round(openQty),
    avgCost: avgCost ? round(avgCost) : null,
    costValue: openQty > 0 ? round(openCost) : null,
    realizedPnl: round(realizedPnl),
  };
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

  /**
   * 🔥 loop by ASSET (ไม่ใช้ link แล้ว)
   */
  for (const asset of store.assets) {
    const state = await calculatePositionState(store, asset.id);

    if (state.quantity <= 0) continue; // skip empty

    let price: number | null = null;
    let value: number | null = null;
    let lastUpdated: string | null = null;
    let dailyPnl: number | null = null;
    let changePercent: number | null = null;
    let unrealizedPnl: number | null = null;

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
        value = round(priceTHB * state.quantity);
        lastUpdated = latest.updatedAt;
        changePercent = latest.changePercent ?? null;

        if (state.avgCost !== null) {
          unrealizedPnl = round(
            (priceTHB - state.avgCost) * state.quantity
          );
        }

        if (previous) {
          const prevPriceTHB = await convertAmount(
            previous.close,
            "USD",
            BASE_CURRENCY,
            previous.date
          );

          dailyPnl = round(
            (priceTHB - prevPriceTHB) * state.quantity
          );
        }
      }
    }

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
        value = round(priceTHB * state.quantity);
        lastUpdated = latest.updatedAt;

        if (state.avgCost !== null) {
          unrealizedPnl = round(
            (priceTHB - state.avgCost) * state.quantity
          );
        }

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

          dailyPnl = round(
            (priceTHB - prevPriceTHB) * state.quantity
          );
        }
      }
    }

    result.push({
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,

      quantity: state.quantity,

      price,
      value,

      avgCost: state.avgCost,
      costValue: state.costValue,
      unrealizedPnl,
      realizedPnl: state.realizedPnl,

      dailyPnl,
      changePercent,
      lastUpdated,

      currency: BASE_CURRENCY,
    });
  }

  return result;
}