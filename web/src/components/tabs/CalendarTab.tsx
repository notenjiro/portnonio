import { useEffect, useMemo, useState } from "react";

import SkeletonCard from "@/components/common/SkeletonCard";
import {
  fetchDailyPnL,
  fetchPortfolioHistory,
  type PortfolioHistorySnapshot,
} from "@/lib/api";
import { formatMoney, formatSignedMoney } from "@/lib/format";

type Props = {
  refreshKey: number;
  filter: "all" | "binance" | "innovestx";
};

type BinanceDailyPoint = {
  date: string;
  net: number;
  fundingFee: number;
  commission: number;
  realizedPnl: number;
  currentUnrealizedPnL?: number;
  changeUnrealized?: number;
  totalValue?: number;
};

type CalendarEntry = {
  date: string;
  totalPnl: number;
  realizedPnl: number;
  changeUnrealized: number;
  totalValue: number;
  binancePnl: number;
  stockPnl: number;
  fundingFee: number;
  commission: number;
};

type CalendarCell = {
  date: string;
  inCurrentMonth: boolean;
  entry: CalendarEntry | null;
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthKey(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, 1);
}

function shiftMonth(monthKey: string, offset: number) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + offset);
  return formatMonthKey(date);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthLabelFromKey(monthKey: string) {
  const date = parseMonthKey(monthKey);
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function getMonthWindow(monthKey: string) {
  const firstDay = parseMonthKey(monthKey);
  const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);

  return {
    startDate: formatDateKey(firstDay),
    endDate: formatDateKey(lastDay),
  };
}

function getValueTone(value: number) {
  if (value > 0) {
    return {
      wrapper:
        "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",
      text: "text-emerald-600 dark:text-emerald-400",
      accent: "bg-emerald-500/90 dark:bg-emerald-500/80",
      subtext: "text-emerald-700/70 dark:text-emerald-300/70",
    };
  }

  if (value < 0) {
    return {
      wrapper:
        "border-rose-200/80 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20",
      text: "text-rose-600 dark:text-rose-400",
      accent: "bg-rose-500/90 dark:bg-rose-500/80",
      subtext: "text-rose-700/70 dark:text-rose-300/70",
    };
  }

  return {
    wrapper:
      "border-border bg-background/70 dark:border-white/10 dark:bg-white/[0.03]",
    text: "text-foreground",
    accent: "bg-muted-foreground/20 dark:bg-white/10",
    subtext: "text-muted-foreground",
  };
}

function getStreakTone(
  streak: { type: "positive" | "negative" | "neutral"; count: number; label: string },
) {
  if (streak.type === "positive") {
    return {
      card: "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",
      text: "text-emerald-600 dark:text-emerald-400",
      subtext: "text-emerald-700/70 dark:text-emerald-300/70",
    };
  }

  if (streak.type === "negative") {
    return {
      card: "border-rose-200/80 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20",
      text: "text-rose-600 dark:text-rose-400",
      subtext: "text-rose-700/70 dark:text-rose-300/70",
    };
  }

  return {
    card: "border-border bg-background/70 dark:border-white/10 dark:bg-white/[0.03]",
    text: "text-foreground",
    subtext: "text-muted-foreground",
  };
}

function isTodayBangkok(dateString: string) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return today === dateString;
}

function formatDayLabel(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function mapBinancePoint(item: BinanceDailyPoint): CalendarEntry {
  return {
    date: item.date,
    totalPnl: Number(item.net ?? 0),
    realizedPnl: Number(item.realizedPnl ?? 0),
    changeUnrealized: Number(item.changeUnrealized ?? item.currentUnrealizedPnL ?? 0),
    totalValue: Number(item.totalValue ?? 0),
    binancePnl: Number(item.net ?? 0),
    stockPnl: 0,
    fundingFee: Number(item.fundingFee ?? 0),
    commission: Number(item.commission ?? 0),
  };
}

function mapPortfolioPoint(item: PortfolioHistorySnapshot): CalendarEntry {
  return {
    date: item.date,
    totalPnl: Number(item.totalPnl ?? 0),
    realizedPnl: Number(item.realizedPnl ?? 0),
    changeUnrealized: Number(item.changeUnrealized ?? 0),
    totalValue: Number(item.totalValue ?? 0),
    binancePnl: 0,
    stockPnl: Number(item.totalPnl ?? 0),
    fundingFee: 0,
    commission: 0,
  };
}

function mergeEntries(
  binanceItems: CalendarEntry[],
  portfolioItems: CalendarEntry[],
): CalendarEntry[] {
  const map = new Map<string, CalendarEntry>();

  for (const item of binanceItems) {
    map.set(item.date, { ...item });
  }

  for (const item of portfolioItems) {
    const existing = map.get(item.date);

    if (!existing) {
      map.set(item.date, { ...item });
      continue;
    }

    map.set(item.date, {
      date: item.date,
      totalPnl: existing.totalPnl + item.totalPnl,
      realizedPnl: existing.realizedPnl + item.realizedPnl,
      changeUnrealized: existing.changeUnrealized + item.changeUnrealized,
      totalValue: item.totalValue || existing.totalValue,
      binancePnl: existing.binancePnl + item.binancePnl,
      stockPnl: existing.stockPnl + item.stockPnl,
      fundingFee: existing.fundingFee + item.fundingFee,
      commission: existing.commission + item.commission,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildCalendarGrid(
  monthKey: string,
  items: CalendarEntry[],
): CalendarCell[][] {
  const firstDay = parseMonthKey(monthKey);
  const year = firstDay.getFullYear();
  const month = firstDay.getMonth();

  const firstWeekday = (() => {
    const jsDay = firstDay.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  })();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entryMap = new Map(items.map((item) => [item.date, item]));

  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const date = new Date(year, month, 1 - (firstWeekday - i));
    cells.push({
      date: formatDateKey(date),
      inCurrentMonth: false,
      entry: null,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = formatDateKey(date);

    cells.push({
      date: dateKey,
      inCurrentMonth: true,
      entry: entryMap.get(dateKey) ?? null,
    });
  }

  while (cells.length % 7 !== 0) {
    const offset = cells.length - (firstWeekday + daysInMonth) + 1;
    const date = new Date(year, month + 1, offset);
    cells.push({
      date: formatDateKey(date),
      inCurrentMonth: false,
      entry: null,
    });
  }

  if (cells.length < 35) {
    while (cells.length < 35) {
      const extraIndex = cells.length - (firstWeekday + daysInMonth) + 1;
      const date = new Date(year, month + 1, extraIndex);
      cells.push({
        date: formatDateKey(date),
        inCurrentMonth: false,
        entry: null,
      });
    }
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

function getBestDay(items: CalendarEntry[]) {
  if (items.length === 0) return null;

  return items.reduce((best, item) => {
    if (!best || item.totalPnl > best.totalPnl) return item;
    return best;
  }, null as CalendarEntry | null);
}

function getWorstDay(items: CalendarEntry[]) {
  if (items.length === 0) return null;

  return items.reduce((worst, item) => {
    if (!worst || item.totalPnl < worst.totalPnl) return item;
    return worst;
  }, null as CalendarEntry | null);
}

function getAverageDailyPnl(items: CalendarEntry[]) {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.totalPnl, 0) / items.length;
}

function getCurrentPnlStreak(items: CalendarEntry[]) {
  let positive = 0;
  let negative = 0;

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const pnl = items[i].totalPnl;

    if (pnl > 0) {
      if (negative > 0) break;
      positive += 1;
    } else if (pnl < 0) {
      if (positive > 0) break;
      negative += 1;
    } else {
      break;
    }
  }

  if (positive > 0) {
    return {
      type: "positive" as const,
      count: positive,
      label: `${positive} positive day${positive > 1 ? "s" : ""}`,
    };
  }

  if (negative > 0) {
    return {
      type: "negative" as const,
      count: negative,
      label: `${negative} negative day${negative > 1 ? "s" : ""}`,
    };
  }

  return {
    type: "neutral" as const,
    count: 0,
    label: "No active streak",
  };
}

export default function CalendarTab({ refreshKey, filter }: Props) {
  const [items, setItems] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthKey, setMonthKey] = useState(() => formatMonthKey(new Date()));

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const { startDate, endDate } = getMonthWindow(monthKey);

        let nextItems: CalendarEntry[] = [];

        if (filter === "binance") {
          const res = await fetchDailyPnL(monthKey);
          const raw = Array.isArray(res?.points) ? res.points : [];
          nextItems = raw.map(mapBinancePoint);
        } else if (filter === "innovestx") {
          const res = await fetchPortfolioHistory({ startDate, endDate });
          const raw = Array.isArray(res?.data) ? res.data : [];
          nextItems = raw.map(mapPortfolioPoint);
        } else {
          const [binanceRes, portfolioRes] = await Promise.all([
            fetchDailyPnL(monthKey),
            fetchPortfolioHistory({ startDate, endDate }),
          ]);

          const binanceItems = (Array.isArray(binanceRes?.points)
            ? binanceRes.points
            : []
          ).map(mapBinancePoint);

          const portfolioItems = (Array.isArray(portfolioRes?.data)
            ? portfolioRes.data
            : []
          ).map(mapPortfolioPoint);

          nextItems = mergeEntries(binanceItems, portfolioItems);
        }

        if (!mounted) return;
        setItems(nextItems);
      } catch (err) {
        if (!mounted) return;

        const message =
          err instanceof Error ? err.message : "Failed to load calendar";

        setError(message);
        setItems([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [refreshKey, monthKey, filter]);

  const weeks = useMemo(() => buildCalendarGrid(monthKey, items), [monthKey, items]);

  const summary = useMemo(() => {
    const totals = items.reduce(
      (acc, item) => {
        acc.totalPnl += item.totalPnl;
        acc.realizedPnl += item.realizedPnl;
        acc.changeUnrealized += item.changeUnrealized;
        acc.endValue = item.totalValue;
        acc.binancePnl += item.binancePnl;
        acc.stockPnl += item.stockPnl;
        return acc;
      },
      {
        totalPnl: 0,
        realizedPnl: 0,
        changeUnrealized: 0,
        endValue: 0,
        binancePnl: 0,
        stockPnl: 0,
      },
    );

    const bestDay = getBestDay(items);
    const worstDay = getWorstDay(items);
    const averageDailyPnl = getAverageDailyPnl(items);
    const streak = getCurrentPnlStreak(items);

    return {
      ...totals,
      bestDay,
      worstDay,
      averageDailyPnl,
      streak,
    };
  }, [items]);

  if (loading) {
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <SkeletonCard className="h-[72px]" />
          <div className="grid gap-2 md:grid-cols-7">
            {Array.from({ length: 35 }).map((_, index) => (
              <SkeletonCard key={index} className="aspect-[1.05/1]" />
            ))}
          </div>
        </div>

        <aside className="space-y-3">
          <SkeletonCard className="h-[72px]" />
          <SkeletonCard className="h-[88px]" />
          <SkeletonCard className="h-[88px]" />
          <SkeletonCard className="h-[88px]" />
        </aside>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border p-6 dark:border-white/10 dark:bg-white/[0.02]">
        <h2 className="text-xl font-semibold">Portfolio Calendar</h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      </section>
    );
  }

  const totalPnlTone = getValueTone(summary.totalPnl);
  const realizedTone = getValueTone(summary.realizedPnl);
  const unrealizedTone = getValueTone(summary.changeUnrealized);
  const endValueTone = getValueTone(summary.endValue);
  const bestDayTone = getValueTone(summary.bestDay?.totalPnl ?? 0);
  const worstDayTone = getValueTone(summary.worstDay?.totalPnl ?? 0);
  const avgTone = getValueTone(summary.averageDailyPnl);
  const streakTone = getStreakTone(summary.streak);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-2xl border p-4 dark:border-white/10 dark:bg-white/[0.02] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Portfolio Calendar</h2>
            <p className="text-sm text-muted-foreground">
              {filter === "binance"
                ? "Binance daily PnL"
                : filter === "innovestx"
                  ? "Stock and fund daily PnL"
                  : "Combined daily PnL across Binance and stock/fund"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthKey((prev) => shiftMonth(prev, -1))}
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            >
              ←
            </button>

            <div className="min-w-[150px] rounded-xl border bg-muted/30 px-4 py-2 text-center text-sm font-semibold dark:border-white/10 dark:bg-white/[0.04]">
              {getMonthLabelFromKey(monthKey)}
            </div>

            <button
              type="button"
              onClick={() => setMonthKey((prev) => shiftMonth(prev, 1))}
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            >
              →
            </button>

            <button
              type="button"
              onClick={() => setMonthKey(formatMonthKey(new Date()))}
              className="ml-1 rounded-xl border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            >
              Today
            </button>
          </div>
        </div>

        <div className="hidden grid-cols-7 gap-2 md:grid">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {weeks.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="grid gap-2 md:grid-cols-7">
              {week.map((cell, dayIndex) => {
                const dayNumber = cell.date.slice(-2);
                const isToday = isTodayBangkok(cell.date);
                const tone = cell.entry
                  ? getValueTone(cell.entry.totalPnl)
                  : {
                      wrapper:
                        "border-border bg-background/70 dark:border-white/10 dark:bg-white/[0.03]",
                      text: "text-foreground",
                      accent: "bg-muted-foreground/20 dark:bg-white/10",
                      subtext: "text-muted-foreground",
                    };

                return (
                  <div
                    key={`${cell.date}-${dayIndex}`}
                    className={`relative aspect-[1.05/1] overflow-hidden rounded-xl border p-2 transition ${
                      cell.entry ? "hover:shadow-sm dark:shadow-none" : ""
                    } ${
                      cell.inCurrentMonth
                        ? tone.wrapper
                        : "border-dashed bg-muted/10 opacity-65 dark:border-white/10 dark:bg-white/[0.02]"
                    } ${
                      isToday && cell.inCurrentMonth
                        ? "ring-2 ring-foreground/15 dark:ring-white/20"
                        : ""
                    }`}
                  >
                    {cell.entry ? (
                      <div className={`absolute left-0 top-0 h-full w-1 ${tone.accent}`} />
                    ) : null}

                    <div className="flex h-full flex-col">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p
                          className={`text-xl font-bold leading-none ${
                            cell.inCurrentMonth
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {dayNumber}
                        </p>

                        {isToday && cell.inCurrentMonth ? (
                          <span className="rounded-full border bg-background/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-foreground dark:border-white/10 dark:bg-white/[0.08] dark:text-white">
                            Today
                          </span>
                        ) : null}
                      </div>

                      {cell.entry ? (
                        <div className="mt-auto space-y-1">
                          <p className={`text-sm font-semibold ${tone.text}`}>
                            {formatSignedMoney(cell.entry.totalPnl)}
                          </p>

                          <div className="space-y-0.5 text-[10px] text-muted-foreground">
                            {filter !== "innovestx" ? (
                              <div className="flex items-center justify-between gap-2">
                                <span>Binance</span>
                                <span>{formatSignedMoney(cell.entry.binancePnl)}</span>
                              </div>
                            ) : null}

                            {filter !== "binance" ? (
                              <div className="flex items-center justify-between gap-2">
                                <span>Stock</span>
                                <span>{formatSignedMoney(cell.entry.stockPnl)}</span>
                              </div>
                            ) : null}

                            <div className="flex items-center justify-between gap-2">
                              <span>Value</span>
                              <span>{formatMoney(cell.entry.totalValue)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto">
                          <p className="text-[10px] text-muted-foreground">
                            {cell.inCurrentMonth ? "No data" : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-2xl border p-4 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-sm font-semibold">Month Summary</p>

          <div className="mt-3 grid gap-3">
            <div className={`rounded-xl border p-3 ${totalPnlTone.wrapper}`}>
              <p className={`text-xs ${totalPnlTone.subtext}`}>Total PnL</p>
              <p className={`mt-1 text-lg font-semibold ${totalPnlTone.text}`}>
                {formatSignedMoney(summary.totalPnl)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl border p-3 ${realizedTone.wrapper}`}>
                <p className={`text-xs ${realizedTone.subtext}`}>Realized</p>
                <p className={`mt-1 text-sm font-semibold ${realizedTone.text}`}>
                  {formatSignedMoney(summary.realizedPnl)}
                </p>
              </div>

              <div className={`rounded-xl border p-3 ${unrealizedTone.wrapper}`}>
                <p className={`text-xs ${unrealizedTone.subtext}`}>Δ Unrealized</p>
                <p className={`mt-1 text-sm font-semibold ${unrealizedTone.text}`}>
                  {formatSignedMoney(summary.changeUnrealized)}
                </p>
              </div>
            </div>

            <div className={`rounded-xl border p-3 ${endValueTone.wrapper}`}>
              <p className={`text-xs ${endValueTone.subtext}`}>End Value</p>
              <p className={`mt-1 text-sm font-semibold ${endValueTone.text}`}>
                {formatMoney(summary.endValue)}
              </p>
            </div>

            {filter === "all" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs text-muted-foreground">Binance PnL</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatSignedMoney(summary.binancePnl)}
                  </p>
                </div>

                <div className="rounded-xl border p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs text-muted-foreground">Stock PnL</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatSignedMoney(summary.stockPnl)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border p-4 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-sm font-semibold">Stats</p>

          <div className="mt-3 space-y-3">
            <div className={`rounded-xl border p-3 ${bestDayTone.wrapper}`}>
              <p className={`text-xs ${bestDayTone.subtext}`}>Best Day</p>
              <p className={`mt-1 text-sm font-semibold ${bestDayTone.text}`}>
                {summary.bestDay
                  ? `${formatDayLabel(summary.bestDay.date)} · ${formatSignedMoney(
                      summary.bestDay.totalPnl,
                    )}`
                  : "-"}
              </p>
            </div>

            <div className={`rounded-xl border p-3 ${worstDayTone.wrapper}`}>
              <p className={`text-xs ${worstDayTone.subtext}`}>Worst Day</p>
              <p className={`mt-1 text-sm font-semibold ${worstDayTone.text}`}>
                {summary.worstDay
                  ? `${formatDayLabel(summary.worstDay.date)} · ${formatSignedMoney(
                      summary.worstDay.totalPnl,
                    )}`
                  : "-"}
              </p>
            </div>

            <div className={`rounded-xl border p-3 ${avgTone.wrapper}`}>
              <p className={`text-xs ${avgTone.subtext}`}>Average Daily PnL</p>
              <p className={`mt-1 text-sm font-semibold ${avgTone.text}`}>
                {formatSignedMoney(summary.averageDailyPnl)}
              </p>
            </div>

            <div className={`rounded-xl border p-3 ${streakTone.card}`}>
              <p className={`text-xs ${streakTone.subtext}`}>Streak</p>
              <p className={`mt-1 text-sm font-semibold ${streakTone.text}`}>
                {summary.streak.label}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}