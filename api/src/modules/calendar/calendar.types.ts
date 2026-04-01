import type { PortfolioCalendarDayRecord } from "../../storage/history.types";

export type CalendarScope = "all" | "binance" | "stock";

export interface CalendarSummary {
  totalPnl: number;
  averagePnl: number | null;
  dayCount: number;
  bestDay: PortfolioCalendarDayRecord | null;
  worstDay: PortfolioCalendarDayRecord | null;
}

export interface CalendarResponse {
  scope: CalendarScope;
  days: PortfolioCalendarDayRecord[];
  summary: CalendarSummary;
}