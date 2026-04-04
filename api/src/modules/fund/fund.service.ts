import {
  getSecFundDailyNavRecords,
  getSecFundNav,
  resolveFundProjIdByClassName
} from "../../providers/sec.adapter";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { readFundHistory, writeFundHistory } from "../../storage/history.repository";
import { readStore } from "../../storage/store.repository";
import type { FundDailyHistoryRecord } from "../../storage/history.types";
import type { FundNavRefreshResult } from "./fund.types";

type FundNavBackfillResult = {
  assetId: string;
  symbol: string;
  projId: string;
  requestedDays: number;
  persistedCount: number;
  fetchedCount: number;
  startDate: string;
  endDate: string;
};

function getResolvedProjId(asset: {
  symbol: string;
  metadata?: {
    projId?: string | null;
  } | null;
}): Promise<string> {
  const metadataProjId = asset.metadata?.projId?.trim();

  if (metadataProjId) {
    return Promise.resolve(metadataProjId);
  }

  return resolveFundProjIdByClassName(asset.symbol);
}

function getDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getStartDateString(days: number): string {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - Math.max(days - 1, 0));
  return getDateString(start);
}

function normalizeDailyFundRecord(params: {
  assetId: string;
  symbol: string;
  currency: string;
  navDate: string;
  nav: number;
  changePercent: number | null;
  source: string;
  createdAt?: string;
}): FundDailyHistoryRecord {
  const nowIso = new Date().toISOString();

  return {
    date: params.navDate,
    assetId: params.assetId,
    symbol: params.symbol,
    nav: params.nav,
    currency: params.currency,
    changePercent: params.changePercent,
    source: params.source,
    createdAt: params.createdAt ?? nowIso,
    updatedAt: nowIso
  };
}

function mergeFundHistory(
  existingHistory: FundDailyHistoryRecord[],
  incomingHistory: FundDailyHistoryRecord[]
): {
  merged: FundDailyHistoryRecord[];
  persistedCount: number;
} {
  const existingMap = new Map<string, FundDailyHistoryRecord>();

  for (const record of existingHistory) {
    const key = `${record.assetId}::${record.date}`;
    existingMap.set(key, record);
  }

  let persistedCount = 0;

  for (const record of incomingHistory) {
    const key = `${record.assetId}::${record.date}`;
    const existing = existingMap.get(key);

    if (!existing) {
      existingMap.set(key, record);
      persistedCount += 1;
      continue;
    }

    const nextRecord: FundDailyHistoryRecord = {
      ...record,
      createdAt: existing.createdAt,
      updatedAt: record.updatedAt
    };

    const changed =
      existing.nav !== nextRecord.nav ||
      existing.changePercent !== nextRecord.changePercent ||
      existing.currency !== nextRecord.currency ||
      existing.source !== nextRecord.source;

    existingMap.set(key, nextRecord);

    if (changed) {
      persistedCount += 1;
    }
  }

  const merged = Array.from(existingMap.values()).sort((a, b) => {
    if (a.date === b.date) {
      return a.symbol.localeCompare(b.symbol);
    }

    return a.date.localeCompare(b.date);
  });

  return {
    merged,
    persistedCount
  };
}

export async function refreshFundNav(assetId: string): Promise<FundNavRefreshResult> {
  const store = await readStore();
  const asset = store.assets.find((item) => item.id === assetId);

  if (!asset) {
    throw new NotFoundError("Asset not found");
  }

  if (asset.category !== "fund") {
    throw new ValidationError("Asset is not a fund asset");
  }

  const projId = await getResolvedProjId(asset);
  const navResult = await getSecFundNav(asset.symbol, projId);
  const history = await readFundHistory();

  const record = normalizeDailyFundRecord({
    assetId: asset.id,
    symbol: asset.symbol,
    currency: asset.currency,
    navDate: navResult.navDate,
    nav: navResult.nav,
    changePercent: navResult.changePercent,
    source: "sec"
  });

  const { merged } = mergeFundHistory(history, [record]);

  await writeFundHistory(merged);

  return {
    assetId: asset.id,
    persisted: true,
    record
  };
}

export async function backfillFundNavHistory(
  assetId: string,
  days = 365
): Promise<FundNavBackfillResult> {
  const normalizedDays = Number.isFinite(days) ? Math.floor(days) : 365;

  if (normalizedDays <= 0) {
    throw new ValidationError("days must be greater than 0");
  }

  const store = await readStore();
  const asset = store.assets.find((item) => item.id === assetId);

  if (!asset) {
    throw new NotFoundError("Asset not found");
  }

  if (asset.category !== "fund") {
    throw new ValidationError("Asset is not a fund asset");
  }

  const projId = await getResolvedProjId(asset);
  const startDate = getStartDateString(normalizedDays);
  const endDate = getDateString(new Date());

  const collected: FundDailyHistoryRecord[] = [];
  let nextCursor: string | undefined = undefined;

  do {
    const response = await getSecFundDailyNavRecords({
      projId,
      fundClassName: asset.symbol,
      startNavDate: startDate,
      endNavDate: endDate,
      pageSize: 100,
      nextCursor
    });

    const items = Array.isArray(response.items) ? response.items : [];

    for (const item of items) {
      const nav = Number(item.last_val);

      if (!Number.isFinite(nav)) {
        continue;
      }

      collected.push(
        normalizeDailyFundRecord({
          assetId: asset.id,
          symbol: asset.symbol,
          currency: asset.currency,
          navDate: item.nav_date,
          nav,
          changePercent: null,
          source: "sec"
        })
      );
    }

    nextCursor = response.next_cursor?.trim() ? response.next_cursor.trim() : undefined;
  } while (nextCursor);

  const existingHistory = await readFundHistory();
  const { merged, persistedCount } = mergeFundHistory(existingHistory, collected);

  await writeFundHistory(merged);

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    projId,
    requestedDays: normalizedDays,
    persistedCount,
    fetchedCount: collected.length,
    startDate,
    endDate
  };
}