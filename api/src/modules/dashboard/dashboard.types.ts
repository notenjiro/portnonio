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
    totalValue: number; // 👈 rename
    pricedCount: number;
    unpricedCount: number;
  };
  futures: {
    positions: BinanceFuturesPosition[];
    totalNotional: number; // 👈 rename
    totalUnrealizedPnl: number;
    positionCount: number;
  };
}

export interface DashboardSummaryCard {
  key: string;
  label: string;
  value: number;
  unit: "THB" | "COUNT"; // 👈 เปลี่ยนจาก USD
}

export interface DashboardRiskSection {
  futuresUnrealizedPnl: number; // 👈 rename
  futuresNotional: number;      // 👈 rename
  spotValue: number;            // 👈 rename
  pricedSpotCount: number;
  unpricedSpotCount: number;
  openFuturesPositions: number;
}

export interface DashboardAllocationItem {
  key: string;
  label: string;
  value: number; // 👈 rename
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