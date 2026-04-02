import type { CalendarResponse } from "../calendar/calendar.types";
import type { OverviewResponse } from "../overview/overview.types";
import type {
  BinanceFuturesPosition,
  BinanceSpotHolding
} from "../../providers/provider.types";

export interface AggregatedBinancePortfolioResponse {
  fetchedAt: string | null;
  accountCount: number;
  spot: {
    holdings: BinanceSpotHolding[];
    totalValueUsd: number;
    pricedCount: number;
    unpricedCount: number;
  };
  futures: {
    positions: BinanceFuturesPosition[];
    totalNotionalUsd: number;
    totalUnrealizedPnl: number;
    positionCount: number;
  };
}

export interface DashboardSummaryCard {
  key: string;
  label: string;
  value: number;
  unit: "USD" | "COUNT";
}

export interface DashboardRiskSection {
  futuresUnrealizedPnlUsd: number;
  futuresNotionalUsd: number;
  spotValueUsd: number;
  pricedSpotCount: number;
  unpricedSpotCount: number;
  openFuturesPositions: number;
}

export interface DashboardAllocationItem {
  key: string;
  label: string;
  valueUsd: number;
  weight: number;
}

export interface DashboardResponse {
  overview: OverviewResponse;
  calendar: CalendarResponse;
  latestBinancePortfolio: AggregatedBinancePortfolioResponse | null;
  summaryCards: DashboardSummaryCard[];
  risk: DashboardRiskSection | null;
  allocation: DashboardAllocationItem[];
}