import { getCalendarData } from "../calendar/calendar.service";
import { getOverviewData } from "../overview/overview.service";
import { readStore } from "../../storage/store.repository";
import { getBinancePortfolio } from "../../providers/binance.adapter";
import type {
  DashboardAllocationItem,
  DashboardResponse,
  DashboardRiskSection,
  DashboardSummaryCard
} from "./dashboard.types";

function buildSummaryCards(
  totalTrackedUsd: number,
  spotValueUsd: number,
  futuresNotionalUsd: number,
  openFuturesPositions: number
): DashboardSummaryCard[] {
  return [
    {
      key: "totalTrackedUsd",
      label: "Total Tracked",
      value: totalTrackedUsd,
      unit: "USD"
    },
    {
      key: "spotValueUsd",
      label: "Spot Value",
      value: spotValueUsd,
      unit: "USD"
    },
    {
      key: "futuresNotionalUsd",
      label: "Futures Notional",
      value: futuresNotionalUsd,
      unit: "USD"
    },
    {
      key: "openFuturesPositions",
      label: "Open Futures",
      value: openFuturesPositions,
      unit: "COUNT"
    }
  ];
}

function buildRiskSection(
  latestBinancePortfolio: DashboardResponse["latestBinancePortfolio"]
): DashboardRiskSection | null {
  if (!latestBinancePortfolio) {
    return null;
  }

  return {
    futuresUnrealizedPnlUsd: latestBinancePortfolio.futures.totalUnrealizedPnl,
    futuresNotionalUsd: latestBinancePortfolio.futures.totalNotionalUsd,
    spotValueUsd: latestBinancePortfolio.spot.totalValueUsd,
    pricedSpotCount: latestBinancePortfolio.spot.pricedCount,
    unpricedSpotCount: latestBinancePortfolio.spot.unpricedCount,
    openFuturesPositions: latestBinancePortfolio.futures.positionCount
  };
}

function buildAllocation(
  latestBinancePortfolio: DashboardResponse["latestBinancePortfolio"],
  stockTrackedUsd: number,
  fundTrackedUsd: number
): DashboardAllocationItem[] {
  const items = [
    {
      key: "binanceSpot",
      label: "Binance Spot",
      valueUsd: latestBinancePortfolio?.spot.totalValueUsd ?? 0
    },
    {
      key: "binanceFutures",
      label: "Binance Futures",
      valueUsd: latestBinancePortfolio?.futures.totalNotionalUsd ?? 0
    },
    {
      key: "stocks",
      label: "Stocks",
      valueUsd: stockTrackedUsd
    },
    {
      key: "funds",
      label: "Funds",
      valueUsd: fundTrackedUsd
    }
  ];

  const total = items.reduce((sum, item) => sum + item.valueUsd, 0);

  return items.map((item) => ({
    ...item,
    weight: total > 0 ? Number((item.valueUsd / total).toFixed(8)) : 0
  }));
}

export async function getDashboardData(): Promise<DashboardResponse> {
  const [overview, calendar, store] = await Promise.all([
    getOverviewData(),
    getCalendarData("all"),
    readStore()
  ]);

  const latestBinanceAccount = store.accounts.find(
    (account) => account.source === "binance" && account.provider === "binance"
  );

  let latestBinancePortfolio = null;

  if (latestBinanceAccount) {
    latestBinancePortfolio = await getBinancePortfolio(latestBinanceAccount.id);
  }

  const summaryCards = buildSummaryCards(
    overview.totals.totalTrackedUsd,
    overview.binance.spotValueUsd,
    overview.binance.futuresNotionalUsd,
    latestBinancePortfolio?.futures.positionCount ?? 0
  );

  const risk = buildRiskSection(latestBinancePortfolio);
  const allocation = buildAllocation(
    latestBinancePortfolio,
    overview.totals.stockTrackedUsd,
    overview.totals.fundTrackedUsd
  );

  return {
    overview,
    calendar,
    latestBinancePortfolio,
    summaryCards,
    risk,
    allocation
  };
}