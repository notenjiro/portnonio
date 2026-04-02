import { paths } from "../config/paths";
import { readJsonFile, writeJsonFile } from "./json-file";
import type {
  BinanceDailyHistoryRecord,
  FundDailyHistoryRecord,
  MarketDailyHistoryRecord,
  PortfolioCalendarDayRecord,
  PortfolioSnapshotRecord,
  FxDailyRateRecord
} from "./history.types";

async function readArrayFile<T>(filePath: string): Promise<T[]> {
  const raw = await readJsonFile<unknown>(filePath, []);

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw as T[];
}

export async function readBinanceHistory(): Promise<BinanceDailyHistoryRecord[]> {
  return readArrayFile<BinanceDailyHistoryRecord>(paths.binanceHistoryFile);
}

export async function writeBinanceHistory(records: BinanceDailyHistoryRecord[]): Promise<void> {
  await writeJsonFile(paths.binanceHistoryFile, records);
}

export async function readMarketHistory(): Promise<MarketDailyHistoryRecord[]> {
  return readArrayFile<MarketDailyHistoryRecord>(paths.marketHistoryFile);
}

export async function writeMarketHistory(records: MarketDailyHistoryRecord[]): Promise<void> {
  await writeJsonFile(paths.marketHistoryFile, records);
}

export async function readFundHistory(): Promise<FundDailyHistoryRecord[]> {
  return readArrayFile<FundDailyHistoryRecord>(paths.fundHistoryFile);
}

export async function writeFundHistory(records: FundDailyHistoryRecord[]): Promise<void> {
  await writeJsonFile(paths.fundHistoryFile, records);
}

export async function readPortfolioCalendar(): Promise<PortfolioCalendarDayRecord[]> {
  return readArrayFile<PortfolioCalendarDayRecord>(paths.portfolioCalendarFile);
}

export async function writePortfolioCalendar(records: PortfolioCalendarDayRecord[]): Promise<void> {
  await writeJsonFile(paths.portfolioCalendarFile, records);
}

export async function readPortfolioSnapshots(): Promise<PortfolioSnapshotRecord[]> {
  return readArrayFile<PortfolioSnapshotRecord>(paths.portfolioSnapshotsFile);
}

export async function writePortfolioSnapshots(records: PortfolioSnapshotRecord[]): Promise<void> {
  await writeJsonFile(paths.portfolioSnapshotsFile, records);
}

export async function readFxHistory(): Promise<FxDailyRateRecord[]> {
  return readArrayFile<FxDailyRateRecord>(paths.fxHistoryFile);
}

export async function writeFxHistory(records: FxDailyRateRecord[]): Promise<void> {
  await writeJsonFile(paths.fxHistoryFile, records);
}