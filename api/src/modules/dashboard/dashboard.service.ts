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
  stockTrackedValue: number,
  fundTrackedValue: number,
  cashTrackedValue: number,
  baseCurrency: string
): DashboardSummaryCard[] {
  const liveSpotValue = latestBinancePortfolio?.spot.totalValue ?? 0;
  const liveFuturesNotional = latestBinancePortfolio?.futures.totalNotional ?? 0;
  const liveOpenFuturesPositions = latestBinancePortfolio?.futures.positionCount ?? 0;

  const totalTracked = roundNumber(
    liveSpotValue + liveFuturesNotional + stockTrackedValue + fundTrackedValue + cashTrackedValue
  );

  return [
    {
      key: "totalTrackedValue",
      label: "Total Tracked",
      value: totalTracked,
      unit: baseCurrency as "THB"
    },
    {
      key: "spotValue",
      label: "Spot Value",
      value: liveSpotValue,
      unit: baseCurrency as "THB"
    },
    {
      key: "futuresNotional",
      label: "Futures Notional",
      value: liveFuturesNotional,
      unit: baseCurrency as "THB"
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
    futuresUnrealizedPnl: latestBinancePortfolio.futures.totalUnrealizedPnl,
    futuresNotional: latestBinancePortfolio.futures.totalNotional,
    spotValue: latestBinancePortfolio.spot.totalValue,
    pricedSpotCount: latestBinancePortfolio.spot.pricedCount,
    unpricedSpotCount: latestBinancePortfolio.spot.unpricedCount,
    openFuturesPositions: latestBinancePortfolio.futures.positionCount
  };
}

function buildAllocation(
  latestBinancePortfolio: AggregatedBinancePortfolioResponse | null,
  stockTrackedValue: number,
  fundTrackedValue: number
): DashboardAllocationItem[] {
  const items = [
    {
      key: "binanceSpot",
      label: "Binance Spot",
      value: latestBinancePortfolio?.spot.totalValue ?? 0
    },
    {
      key: "binanceFutures",
      label: "Binance Futures",
      value: latestBinancePortfolio?.futures.totalNotional ?? 0
    },
    {
      key: "stocks",
      label: "Stocks",
      value: stockTrackedValue
    },
    {
      key: "funds",
      label: "Funds",
      value: fundTrackedValue
    }
  ];

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return items.map((item) => ({
    ...item,
    weight: total > 0 ? roundNumber(item.value / total) : 0
  }));
}

import { convertAmount } from "../../services/fx-rate.service";

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

  /**
   * 🔥 FIX: convert USD → THB
   */
  let totalSpotValue = 0;
  let totalFuturesNotional = 0;
  let totalUnrealized = 0;

  for (const portfolio of portfolios) {
    const date = portfolio.fetchedAt;

    totalSpotValue += await convertAmount(
      portfolio.spot.totalValueUsd,
      "USD",
      "THB",
      date
    );

    totalFuturesNotional += await convertAmount(
      portfolio.futures.totalNotionalUsd,
      "USD",
      "THB",
      date
    );

    totalUnrealized += await convertAmount(
      portfolio.futures.totalUnrealizedPnl,
      "USD",
      "THB",
      date
    );
  }

  return {
    fetchedAt,
    accountCount: portfolios.length,

    spot: {
      holdings: spotHoldings,
      totalValue: roundNumber(totalSpotValue),
      pricedCount: portfolios.reduce((sum, p) => sum + p.spot.pricedCount, 0),
      unpricedCount: portfolios.reduce((sum, p) => sum + p.spot.unpricedCount, 0)
    },

    futures: {
      positions: futuresPositions,
      totalNotional: roundNumber(totalFuturesNotional),
      totalUnrealizedPnl: roundNumber(totalUnrealized),
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
    overview.totals.stockTrackedValue,
    overview.totals.fundTrackedValue,
    overview.totals.cashTrackedValue,
    overview.baseCurrency
  );

  const risk = buildRiskSection(latestBinancePortfolio);

  const allocation = buildAllocation(
    latestBinancePortfolio,
    overview.totals.stockTrackedValue,
    overview.totals.fundTrackedValue
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