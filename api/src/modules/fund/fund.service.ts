import { getSecFundNav, resolveFundProjIdByClassName } from "../../providers/sec.adapter";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { readFundHistory, writeFundHistory } from "../../storage/history.repository";
import { readStore } from "../../storage/store.repository";
import type { FundDailyHistoryRecord } from "../../storage/history.types";
import type { FundNavRefreshResult } from "./fund.types";

export async function refreshFundNav(assetId: string): Promise<FundNavRefreshResult> {
  const store = await readStore();
  const asset = store.assets.find((item) => item.id === assetId);

  if (!asset) {
    throw new NotFoundError("Asset not found");
  }

  if (asset.category !== "fund") {
    throw new ValidationError("Asset is not a fund asset");
  }

  const projId = await resolveFundProjIdByClassName(asset.symbol);
  const navResult = await getSecFundNav(asset.symbol, projId);
  const history = await readFundHistory();

  const nowIso = new Date().toISOString();
  const date = navResult.navDate;

  const record: FundDailyHistoryRecord = {
    date,
    assetId: asset.id,
    symbol: asset.symbol,
    nav: navResult.nav,
    currency: asset.currency,
    changePercent: navResult.changePercent,
    source: "sec",
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const existingIndex = history.findIndex(
    (item) => item.assetId === asset.id && item.date === date
  );

  let finalRecord: FundDailyHistoryRecord;

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

  await writeFundHistory(history);

  return {
    assetId: asset.id,
    persisted: true,
    record: finalRecord
  };
}