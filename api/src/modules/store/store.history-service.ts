import {
  writeBinanceHistory,
  writeFundHistory,
  writeMarketHistory,
  writePortfolioCalendar,
  writePortfolioSnapshots
} from "../../storage/history.repository";
import type {
  BinanceDailyHistoryRecord,
  FundDailyHistoryRecord,
  MarketDailyHistoryRecord,
  PortfolioCalendarDayRecord,
  PortfolioSnapshotRecord
} from "../../storage/history.types";

function nowIso(): string {
  return new Date().toISOString();
}

export async function seedDemoHistory(): Promise<{
  binance: BinanceDailyHistoryRecord[];
  market: MarketDailyHistoryRecord[];
  fund: FundDailyHistoryRecord[];
  calendar: PortfolioCalendarDayRecord[];
  snapshots: PortfolioSnapshotRecord[];
}> {
  const now = nowIso();

  const binance: BinanceDailyHistoryRecord[] = [
    {
      date: "2026-03-30",
      accountId: "demo-binance-account",
      realizedPnl: 120.5,
      unrealizedPnl: -25.2,
      funding: 4.1,
      fees: 3.4,
      otherIncome: 0,
      netPnl: 96.0,
      endValueUsd: 15120.45,
      createdAt: now,
      updatedAt: now
    },
    {
      date: "2026-03-31",
      accountId: "demo-binance-account",
      realizedPnl: -40,
      unrealizedPnl: 18.25,
      funding: 2.8,
      fees: 1.05,
      otherIncome: 0,
      netPnl: -19.99,
      endValueUsd: 15100.46,
      createdAt: now,
      updatedAt: now
    }
  ];

  const market: MarketDailyHistoryRecord[] = [
    {
      date: "2026-03-31",
      assetId: "demo-stock-asset",
      symbol: "AAPL",
      close: 222.13,
      currency: "USD",
      changePercent: 1.24,
      source: "twelvedata",
      createdAt: now,
      updatedAt: now
    }
  ];

  const fund: FundDailyHistoryRecord[] = [
    {
      date: "2026-03-31",
      assetId: "demo-fund-asset",
      symbol: "SCBSET50",
      nav: 12.3456,
      currency: "THB",
      changePercent: -0.42,
      source: "sec",
      createdAt: now,
      updatedAt: now
    }
  ];

  const calendar: PortfolioCalendarDayRecord[] = [
    {
      date: "2026-03-30",
      totalPnl: 96.0,
      realizedPnl: 120.5,
      unrealizedPnl: -25.2,
      binancePnl: 96.0,
      stockPnl: null,
      endValueUsd: 15120.45,
      hasData: true,
      createdAt: now,
      updatedAt: now
    },
    {
      date: "2026-03-31",
      totalPnl: 12.5,
      realizedPnl: -40,
      unrealizedPnl: 18.25,
      binancePnl: -19.99,
      stockPnl: 32.49,
      endValueUsd: 15222.59,
      hasData: true,
      createdAt: now,
      updatedAt: now
    }
  ];

  const snapshots: PortfolioSnapshotRecord[] = [
    {
      date: "2026-03-30",
      totalValueUsd: 18020.45,
      binanceValueUsd: 15120.45,
      stockValueUsd: 2400,
      fundValueUsd: 500,
      cashValueUsd: 0,
      totalPnlUsd: 96.0,
      createdAt: now,
      updatedAt: now
    },
    {
      date: "2026-03-31",
      totalValueUsd: 18122.59,
      binanceValueUsd: 15100.46,
      stockValueUsd: 2522.13,
      fundValueUsd: 500,
      cashValueUsd: 0,
      totalPnlUsd: 12.5,
      createdAt: now,
      updatedAt: now
    }
  ];

  await writeBinanceHistory(binance);
  await writeMarketHistory(market);
  await writeFundHistory(fund);
  await writePortfolioCalendar(calendar);
  await writePortfolioSnapshots(snapshots);

  return {
    binance,
    market,
    fund,
    calendar,
    snapshots
  };
}