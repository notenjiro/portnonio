import { getTwelveDataQuote } from "../../providers/twelvedata.adapter";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { readMarketHistory, writeMarketHistory } from "../../storage/history.repository";
import { readStore } from "../../storage/store.repository";
import type { MarketDailyHistoryRecord } from "../../storage/history.types";
import type { MarketRefreshResult } from "./market.types";

function getUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function refreshMarketAsset(assetId: string): Promise<MarketRefreshResult> {
  const store = await readStore();
  const asset = store.assets.find((item) => item.id === assetId);

  if (!asset) {
    throw new NotFoundError("Asset not found");
  }

  if (asset.category !== "stock") {
    throw new ValidationError("Asset is not a stock asset");
  }

  const quote = await getTwelveDataQuote(asset.symbol);
  const history = await readMarketHistory();

  const now = new Date();
  const nowIso = now.toISOString();
  const date = getUtcDateString(now);

  const record: MarketDailyHistoryRecord = {
    date,
    assetId: asset.id,
    symbol: quote.symbol,
    close: quote.close,
    currency: asset.currency,
    changePercent: quote.changePercent,
    source: "twelvedata",
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const existingIndex = history.findIndex(
    (item) => item.assetId === asset.id && item.date === date
  );

  let finalRecord: MarketDailyHistoryRecord;

  if (existingIndex >= 0) {
    const existingRecord = history[existingIndex];

    if (!existingRecord) {
      finalRecord = record;
      history.push(finalRecord);
    } else {
      finalRecord = {
        ...record,
        createdAt: existingRecord.createdAt,
        updatedAt: nowIso
      };
      history[existingIndex] = finalRecord;
    }
  } else {
    finalRecord = record;
    history.push(finalRecord);
  }

  history.sort((a, b) => {
    if (a.date === b.date) {
      return a.symbol.localeCompare(b.symbol);
    }
    return a.date.localeCompare(b.date);
  });

  await writeMarketHistory(history);

  return {
    assetId: asset.id,
    persisted: true,
    record: finalRecord
  };
}