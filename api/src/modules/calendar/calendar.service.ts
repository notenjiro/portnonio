import { ValidationError } from "../../shared/errors";
import { readPortfolioCalendar } from "../../storage/history.repository";
import type { PortfolioCalendarDayRecord } from "../../storage/history.types";
import type { CalendarResponse, CalendarScope, CalendarSummary } from "./calendar.types";

function parsePnlValue(day: PortfolioCalendarDayRecord, scope: CalendarScope): number {
  if (scope === "stock") {
    return day.stockPnl ?? 0;
  }

  if (scope === "binance") {
    return day.binancePnl ?? 0;
  }

  return day.totalPnl ?? 0;
}

function filterDaysByScope(
  days: PortfolioCalendarDayRecord[],
  scope: CalendarScope
): PortfolioCalendarDayRecord[] {
  if (scope === "all") {
    return days;
  }

  if (scope === "binance") {
    return days.filter((day) => day.binancePnl !== null);
  }

  if (scope === "stock") {
    return days.filter((day) => day.stockPnl !== null);
  }

  return days;
}

function buildSummary(days: PortfolioCalendarDayRecord[], scope: CalendarScope): CalendarSummary {
  if (days.length === 0) {
    return {
      totalPnl: 0,
      averagePnl: null,
      dayCount: 0,
      bestDay: null,
      worstDay: null
    };
  }

  const totalPnl = Number(
    days.reduce((sum, day) => sum + parsePnlValue(day, scope), 0).toFixed(8)
  );

  const averagePnl = Number((totalPnl / days.length).toFixed(8));

  const sortedByPnl = [...days].sort(
    (a, b) => parsePnlValue(b, scope) - parsePnlValue(a, scope)
  );

  return {
    totalPnl,
    averagePnl,
    dayCount: days.length,
    bestDay: sortedByPnl[0] ?? null,
    worstDay: sortedByPnl[sortedByPnl.length - 1] ?? null
  };
}

export function parseCalendarScope(value: unknown): CalendarScope {
  if (value === undefined || value === "all") {
    return "all";
  }

  if (value === "binance" || value === "stock") {
    return value;
  }

  throw new ValidationError("Invalid calendar scope");
}

export async function getCalendarData(scope: CalendarScope): Promise<CalendarResponse> {
  const days = await readPortfolioCalendar();
  const filteredDays = filterDaysByScope(days, scope);
  const sortedDays: PortfolioCalendarDayRecord[] = [...filteredDays].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    scope,
    days: sortedDays,
    summary: buildSummary(sortedDays, scope)
  };
}