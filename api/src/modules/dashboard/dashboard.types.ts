import type { CalendarResponse } from "../calendar/calendar.types";
import type { OverviewResponse } from "../overview/overview.types";
import type { BinancePortfolioResponse } from "../../providers/provider.types";

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
  latestBinancePortfolio: BinancePortfolioResponse | null;
  summaryCards: DashboardSummaryCard[];
  risk: DashboardRiskSection | null;
  allocation: DashboardAllocationItem[];
}