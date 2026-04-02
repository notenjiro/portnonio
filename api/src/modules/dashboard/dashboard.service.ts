import { getBinancePortfolio } from "../../providers/binance.adapter";
import type {
  BinanceFuturesPosition,
  BinanceSpotHolding
} from "../../providers/provider.types";
import { readStore } from "../../storage/store.repository";
import { getCalendarData } from "../calendar/calendar.service";
import { getOverviewData } from "../overview/overview.service";
import type {
  AggregatedBinancePortfolioResponse,
  DashboardAllocationItem,
  DashboardResponse,
  DashboardRiskSection,
  DashboardSummaryCard
} from "./dashboard.types";

function roundNumber(value: number): number {
  return Number(value.toFixed(8));
}

function buildSummaryCards(
  latestBinancePortfolio: AggregatedBinancePortfolioResponse | null,
  stockTrackedUsd: number,
  fundTrackedUsd: number,
  cashTrackedUsd: number
): DashboardSummaryCard[] {
  const liveSpotValueUsd = latestBinancePortfolio?.spot.totalValueUsd ?? 0;
  const liveFuturesNotionalUsd = latestBinancePortfolio?.futures.totalNotionalUsd ?? 0;
  const liveOpenFuturesPositions = latestBinancePortfolio?.futures.positionCount ?? 0;

  const totalTrackedUsd = roundNumber(
    liveSpotValueUsd + liveFuturesNotionalUsd + stockTrackedUsd + fundTrackedUsd + cashTrackedUsd
  );

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
      value: liveSpotValueUsd,
      unit: "USD"
    },
    {
      key: "futuresNotionalUsd",
      label: "Futures Notional",
      value: liveFuturesNotionalUsd,
      unit: "USD"
    },
    {
      key: "openFuturesPositions",
      label: "Open Futures",
      value: liveOpenFuturesPositions,
      unit: "COUNT"
    }
  ];
}

function buildRiskSection(
  latestBinancePortfolio: AggregatedBinancePortfolioResponse | null
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
  latestBinancePortfolio: AggregatedBinancePortfolioResponse | null,
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
    weight: total > 0 ? roundNumber(item.valueUsd / total) : 0
  }));
}

async function getAggregatedBinancePortfolio(): Promise<AggregatedBinancePortfolioResponse | null> {
  const store = await readStore();

  const binanceAccounts = store.accounts.filter(
    (account) => account.source === "binance" && account.provider === "binance"
  );

  if (binanceAccounts.length === 0) {
    return null;
  }

  const portfolios = await Promise.all(
    binanceAccounts.map((account) => getBinancePortfolio(account.id))
  );

  const fetchedAt =
    [...portfolios]
      .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))
      .at(-1)?.fetchedAt ?? null;

  const spotHoldings: BinanceSpotHolding[] = portfolios.flatMap(
    (portfolio) => portfolio.spot.holdings
  );

  const futuresPositions: BinanceFuturesPosition[] = portfolios.flatMap(
    (portfolio) => portfolio.futures.positions
  );

  return {
    fetchedAt,
    accountCount: portfolios.length,
    spot: {
      holdings: spotHoldings,
      totalValueUsd: roundNumber(
        portfolios.reduce((sum, portfolio) => sum + portfolio.spot.totalValueUsd, 0)
      ),
      pricedCount: portfolios.reduce((sum, portfolio) => sum + portfolio.spot.pricedCount, 0),
      unpricedCount: portfolios.reduce((sum, portfolio) => sum + portfolio.spot.unpricedCount, 0)
    },
    futures: {
      positions: futuresPositions,
      totalNotionalUsd: roundNumber(
        portfolios.reduce((sum, portfolio) => sum + portfolio.futures.totalNotionalUsd, 0)
      ),
      totalUnrealizedPnl: roundNumber(
        portfolios.reduce((sum, portfolio) => sum + portfolio.futures.totalUnrealizedPnl, 0)
      ),
      positionCount: futuresPositions.length
    }
  };
}

export async function getDashboardData(): Promise<DashboardResponse> {
  const [overview, calendar, latestBinancePortfolio] = await Promise.all([
    getOverviewData(),
    getCalendarData("all"),
    getAggregatedBinancePortfolio()
  ]);

  const summaryCards = buildSummaryCards(
    latestBinancePortfolio,
    overview.totals.stockTrackedUsd,
    overview.totals.fundTrackedUsd,
    overview.totals.cashTrackedUsd
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