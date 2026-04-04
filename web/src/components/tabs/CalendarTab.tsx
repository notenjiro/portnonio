import { useEffect, useMemo, useState } from "react";

import SkeletonCard from "@/components/common/SkeletonCard";
import { fetchCalendar } from "@/lib/api";
import { formatMoney, formatSignedMoney } from "@/lib/format";

type Props = {
  refreshKey: number;
  filter: "all" | "binance" | "innovestx";
};

type CalendarApiData = Awaited<ReturnType<typeof fetchCalendar>>;
type CalendarDay = CalendarApiData["days"][number];

type CalendarCell = {
  date: string;
  inCurrentMonth: boolean;
  entry: CalendarDay | null;
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

function getValueTone(value: number) {
  if (value > 0) {
    return {
      wrapper: "border-emerald-200/90 bg-emerald-50/75",
      text: "text-emerald-600",
      accent: "bg-emerald-500",
      subtext: "text-emerald-700/70",
    };
  }

  if (value < 0) {
    return {
      wrapper: "border-rose-200/90 bg-rose-50/75",
      text: "text-rose-600",
      accent: "bg-rose-500",
      subtext: "text-rose-700/70",
    };
  }

  return {
    wrapper: "border-slate-200/80 bg-white/70",
    text: "text-slate-900",
    accent: "bg-slate-300",
    subtext: "text-slate-500",
  };
}

function getStreakTone(
  streak: { type: "positive" | "negative" | "neutral"; count: number; label: string },
) {
  if (streak.type === "positive") {
    return {
      card: "border-emerald-200/90 bg-emerald-50/75",
      text: "text-emerald-600",
      subtext: "text-emerald-700/70",
    };
  }

  if (streak.type === "negative") {
    return {
      card: "border-rose-200/90 bg-rose-50/75",
      text: "text-rose-600",
      subtext: "text-rose-700/70",
    };
  }

  return {
    card: "border-slate-200/80 bg-white/70",
    text: "text-slate-900",
    subtext: "text-slate-500",
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

function buildCalendarGrid(
  monthKey: string,
  items: CalendarDay[],
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

  while (cells.length < 35) {
    const extraIndex = cells.length - (firstWeekday + daysInMonth) + 1;
    const date = new Date(year, month + 1, extraIndex);
    cells.push({
      date: formatDateKey(date),
      inCurrentMonth: false,
      entry: null,
    });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

function getCurrentPnlStreak(values: number[]) {
  let positive = 0;
  let negative = 0;

  for (let i = values.length - 1; i >= 0; i -= 1) {
    const pnl = Number(values[i] ?? 0);

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

function mapFilterToScope(filter: Props["filter"]): "all" | "binance" | "stock" {
  if (filter === "binance") return "binance";
  if (filter === "innovestx") return "stock";
  return "all";
}

function getDisplayDayPnl(day: CalendarDay, filter: Props["filter"]): number {
  if (filter === "binance") {
    return Number(day.binancePnl ?? 0);
  }

  if (filter === "innovestx") {
    return Number(day.stockPnl ?? 0) + Number(day.fundPnl ?? 0);
  }

  return Number(day.totalPnl ?? 0);
}

export default function CalendarTab({ refreshKey, filter }: Props) {
  const [calendarData, setCalendarData] = useState<CalendarApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthKey, setMonthKey] = useState(() => formatMonthKey(new Date()));

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const scope = mapFilterToScope(filter);
        const res = await fetchCalendar(scope);

        if (!mounted) return;
        setCalendarData(res);
      } catch (err) {
        if (!mounted) return;

        const message =
          err instanceof Error ? err.message : "Failed to load calendar";

        setError(message);
        setCalendarData(null);
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
  }, [refreshKey, filter]);

  const monthItems = useMemo(() => {
    const raw = Array.isArray(calendarData?.days) ? calendarData.days : [];
    return raw.filter((item) => item.date.startsWith(monthKey));
  }, [calendarData, monthKey]);

  const weeks = useMemo(() => buildCalendarGrid(monthKey, monthItems), [monthKey, monthItems]);

  const summary = useMemo(() => {
    const visibleValues = monthItems.map((item) => ({
      item,
      displayPnl: getDisplayDayPnl(item, filter),
    }));

    const bestDay =
      visibleValues.length > 0
        ? visibleValues.reduce((best, current) => {
            if (!best || current.displayPnl > best.displayPnl) {
              return current;
            }

            return best;
          }, null as { item: CalendarDay; displayPnl: number } | null)
        : null;

    const worstDay =
      visibleValues.length > 0
        ? visibleValues.reduce((worst, current) => {
            if (!worst || current.displayPnl < worst.displayPnl) {
              return current;
            }

            return worst;
          }, null as { item: CalendarDay; displayPnl: number } | null)
        : null;

    const totalPnl = visibleValues.reduce((sum, current) => sum + current.displayPnl, 0);
    const realizedPnl = monthItems.reduce((sum, item) => sum + Number(item.realizedPnl ?? 0), 0);
    const unrealizedPnl = monthItems.reduce((sum, item) => sum + Number(item.unrealizedPnl ?? 0), 0);
    const binancePnl = monthItems.reduce((sum, item) => sum + Number(item.binancePnl ?? 0), 0);
    const stockPnl = monthItems.reduce((sum, item) => sum + Number(item.stockPnl ?? 0), 0);
    const fundPnl = monthItems.reduce((sum, item) => sum + Number(item.fundPnl ?? 0), 0);
    const endValue = Number(monthItems[monthItems.length - 1]?.endValueUsd ?? 0);

    const averageDailyPnl = monthItems.length > 0 ? totalPnl / monthItems.length : 0;
    const streak = getCurrentPnlStreak(visibleValues.map((item) => item.displayPnl));

    return {
      totalPnl,
      realizedPnl,
      unrealizedPnl,
      binancePnl,
      stockPnl,
      fundPnl,
      endValue,
      bestDay: bestDay?.item ?? null,
      bestDayValue: bestDay?.displayPnl ?? 0,
      worstDay: worstDay?.item ?? null,
      worstDayValue: worstDay?.displayPnl ?? 0,
      averageDailyPnl,
      streak,
    };
  }, [monthItems, filter]);

  if (loading) {
    return (
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-2">
          <SkeletonCard className="h-[72px] rounded-3xl" />
          <div className="grid gap-1.5 md:grid-cols-7">
            {Array.from({ length: 35 }).map((_, index) => (
              <SkeletonCard key={index} className="aspect-[1/0.75] rounded-2xl" />
            ))}
          </div>
        </div>

        <aside className="space-y-2">
          <SkeletonCard className="h-[92px] rounded-3xl" />
          <SkeletonCard className="h-[220px] rounded-3xl" />
        </aside>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50/80 p-5 shadow-[0_12px_34px_rgba(244,63,94,0.08)]">
        <h2 className="text-lg font-semibold text-slate-900">Portfolio Calendar</h2>
        <p className="mt-2 text-sm text-rose-600">{error}</p>
      </section>
    );
  }

  const totalPnlTone = getValueTone(summary.totalPnl);
  const realizedTone = getValueTone(summary.realizedPnl);
  const unrealizedTone = getValueTone(summary.unrealizedPnl);
  const endValueTone = getValueTone(summary.endValue);
  const bestDayTone = getValueTone(summary.bestDayValue);
  const worstDayTone = getValueTone(summary.worstDayValue);
  const avgTone = getValueTone(summary.averageDailyPnl);
  const streakTone = getStreakTone(summary.streak);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Portfolio Calendar</h2>
            <p className="text-sm text-slate-500">
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
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              ←
            </button>

            <div className="min-w-[138px] rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-center text-sm font-semibold text-slate-900 shadow-sm">
              {getMonthLabelFromKey(monthKey)}
            </div>

            <button
              type="button"
              onClick={() => setMonthKey((prev) => shiftMonth(prev, 1))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              →
            </button>

            <button
              type="button"
              onClick={() => setMonthKey(formatMonthKey(new Date()))}
              className="ml-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Today
            </button>
          </div>
        </div>

        <div className="hidden grid-cols-7 gap-1 md:grid">
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {weeks.map((week, weekIndex) => (
            <div key={`week-${weekIndex}`} className="grid gap-1.5 md:grid-cols-7">
              {week.map((cell, dayIndex) => {
                const dayNumber = cell.date.slice(-2);
                const isToday = isTodayBangkok(cell.date);
                const entryDisplayPnl = cell.entry ? getDisplayDayPnl(cell.entry, filter) : 0;

                const tone = cell.entry
                  ? getValueTone(entryDisplayPnl)
                  : {
                      wrapper: "border-slate-200/80 bg-white/60",
                      text: "text-slate-900",
                      accent: "bg-slate-300",
                      subtext: "text-slate-500",
                    };

                return (
                  <div
                    key={`${cell.date}-${dayIndex}`}
                    className={`relative aspect-[1/0.75] overflow-hidden rounded-2xl border p-2 transition ${
                      cell.entry ? "shadow-sm hover:-translate-y-[1px]" : ""
                    } ${
                      cell.inCurrentMonth
                        ? tone.wrapper
                        : "border-dashed border-slate-200/80 bg-slate-50/40 opacity-70"
                    } ${
                      isToday && cell.inCurrentMonth
                        ? "ring-2 ring-slate-300/80"
                        : ""
                    }`}
                  >
                    {cell.entry ? (
                      <div className={`absolute left-0 top-0 h-full w-1 ${tone.accent}`} />
                    ) : null}

                    <div className="flex h-full flex-col">
                      <div className="mb-1 flex items-start justify-between gap-1">
                        <p
                          className={`text-base font-bold leading-none ${
                            cell.inCurrentMonth ? "text-slate-900" : "text-slate-400"
                          }`}
                        >
                          {dayNumber}
                        </p>

                        {isToday && cell.inCurrentMonth ? (
                          <span className="rounded-full border border-slate-200 bg-white/90 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm">
                            Today
                          </span>
                        ) : null}
                      </div>

                      {cell.entry ? (
                        <div className="mt-auto space-y-1">
                          <p className={`text-sm font-semibold ${tone.text}`}>
                            {formatSignedMoney(entryDisplayPnl)}
                          </p>

                          <div className="space-y-0.5 text-[9px] text-slate-500">
                            {filter !== "innovestx" ? (
                              <div className="flex items-center justify-between gap-2">
                                <span>Binance</span>
                                <span>{formatSignedMoney(Number(cell.entry.binancePnl ?? 0))}</span>
                              </div>
                            ) : null}

                            {filter !== "binance" ? (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <span>Stock</span>
                                  <span>{formatSignedMoney(Number(cell.entry.stockPnl ?? 0))}</span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <span>Fund</span>
                                  <span>{formatSignedMoney(Number(cell.entry.fundPnl ?? 0))}</span>
                                </div>
                              </>
                            ) : null}

                            <div className="flex items-center justify-between gap-2">
                              <span>Value</span>
                              <span>{formatMoney(Number(cell.entry.endValueUsd ?? 0))}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto">
                          <p className="text-[9px] text-slate-400">
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
        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold text-slate-900">Month Summary</p>

          <div className="mt-3 grid gap-3">
            <div className={`rounded-2xl border p-3 shadow-sm ${totalPnlTone.wrapper}`}>
              <p className={`text-xs ${totalPnlTone.subtext}`}>Total PnL</p>
              <p className={`mt-1 text-lg font-semibold ${totalPnlTone.text}`}>
                {formatSignedMoney(summary.totalPnl)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-2xl border p-3 shadow-sm ${realizedTone.wrapper}`}>
                <p className={`text-xs ${realizedTone.subtext}`}>Realized</p>
                <p className={`mt-1 text-sm font-semibold ${realizedTone.text}`}>
                  {formatSignedMoney(summary.realizedPnl)}
                </p>
              </div>

              <div className={`rounded-2xl border p-3 shadow-sm ${unrealizedTone.wrapper}`}>
                <p className={`text-xs ${unrealizedTone.subtext}`}>Δ Unrealized</p>
                <p className={`mt-1 text-sm font-semibold ${unrealizedTone.text}`}>
                  {formatSignedMoney(summary.unrealizedPnl)}
                </p>
              </div>
            </div>

            <div className={`rounded-2xl border p-3 shadow-sm ${endValueTone.wrapper}`}>
              <p className={`text-xs ${endValueTone.subtext}`}>End Value</p>
              <p className={`mt-1 text-sm font-semibold ${endValueTone.text}`}>
                {formatMoney(summary.endValue)}
              </p>
            </div>

            {filter === "all" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm">
                  <p className="text-xs text-slate-500">Δ Binance PnL</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatSignedMoney(summary.binancePnl)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm">
                  <p className="text-xs text-slate-500">Δ Stock PnL</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatSignedMoney(summary.stockPnl)}
                  </p>
                </div>
              </div>
            ) : null}

            {filter !== "binance" ? (
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm">
                <p className="text-xs text-slate-500">Δ Fund PnL</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatSignedMoney(summary.fundPnl)}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <p className="text-sm font-semibold text-slate-900">Stats</p>

          <div className="mt-3 space-y-3">
            <div className={`rounded-2xl border p-3 shadow-sm ${bestDayTone.wrapper}`}>
              <p className={`text-xs ${bestDayTone.subtext}`}>Best Day</p>
              <p className={`mt-1 text-sm font-semibold ${bestDayTone.text}`}>
                {summary.bestDay
                  ? `${formatDayLabel(summary.bestDay.date)} · ${formatSignedMoney(
                      summary.bestDayValue,
                    )}`
                  : "-"}
              </p>
            </div>

            <div className={`rounded-2xl border p-3 shadow-sm ${worstDayTone.wrapper}`}>
              <p className={`text-xs ${worstDayTone.subtext}`}>Worst Day</p>
              <p className={`mt-1 text-sm font-semibold ${worstDayTone.text}`}>
                {summary.worstDay
                  ? `${formatDayLabel(summary.worstDay.date)} · ${formatSignedMoney(
                      summary.worstDayValue,
                    )}`
                  : "-"}
              </p>
            </div>

            <div className={`rounded-2xl border p-3 shadow-sm ${avgTone.wrapper}`}>
              <p className={`text-xs ${avgTone.subtext}`}>Average Daily PnL</p>
              <p className={`mt-1 text-sm font-semibold ${avgTone.text}`}>
                {formatSignedMoney(summary.averageDailyPnl)}
              </p>
            </div>

            <div className={`rounded-2xl border p-3 shadow-sm ${streakTone.card}`}>
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