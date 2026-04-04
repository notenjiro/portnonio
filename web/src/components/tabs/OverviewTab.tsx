import { useEffect, useMemo, useState } from "react";

import AccountList from "@/components/accounts/AccountList";
import AddAssetModal from "@/components/assets/AddAssetModal";
import AllocationDonut from "@/components/charts/AllocationDonut";
import { fetchDashboard } from "@/lib/api";
import { pnlCardTone, pnlTextColor } from "@/lib/color";
import { formatMoney, formatSignedMoney } from "@/lib/format";

type DashboardData = Awaited<ReturnType<typeof fetchDashboard>>;

type Props = {
  refreshKey: number;
  filter: "all" | "binance" | "innovestx";
};

type AllocationItem = {
  key: string;
  label: string;
  value: number;
  percent: number;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function getAllocationItems(
  dashboard: DashboardData | null,
): AllocationItem[] {
  const allocation = Array.isArray(dashboard?.allocation)
    ? dashboard.allocation
    : [];

  const items = allocation.map((item) => ({
    key: item.key,
    label: item.label,
    value: Number(item.valueUsd ?? 0),
    percent: clampPercent(Number((item.weight ?? 0) * 100)),
  }));

  return items
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default function OverviewTab({ refreshKey, filter }: Props) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAddAsset, setOpenAddAsset] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const dashboardRes = await fetchDashboard();

        if (!cancelled) {
          setDashboard(dashboardRes);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("OverviewTab error:", err);
          setError(err?.message || "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, filter, localRefreshKey]);

  const futuresWallet =
    dashboard?.latestBinancePortfolio?.futures.totalNotionalUsd ??
    dashboard?.overview.binance.futuresNotionalUsd ??
    0;

  const futuresPnL =
    dashboard?.latestBinancePortfolio?.futures.totalUnrealizedPnl ??
    dashboard?.overview.binance.futuresUnrealizedPnl ??
    0;

  const stockValue = dashboard?.overview.totals.stockTrackedUsd ?? 0;
  const fundValue = dashboard?.overview.totals.fundTrackedUsd ?? 0;
  const cashBalance = dashboard?.overview.totals.cashTrackedUsd ?? 0;
  const totalTracked = dashboard?.overview.totals.totalTrackedUsd ?? 0;

  const lossPct =
    futuresWallet > 0 && futuresPnL < 0
      ? (Math.abs(futuresPnL) / futuresWallet) * 100
      : 0;

  const riskStatus = lossPct >= 70 ? "High" : lossPct >= 40 ? "Medium" : "Low";

  const riskTextClass =
    riskStatus === "High"
      ? "text-rose-600"
      : riskStatus === "Medium"
        ? "text-amber-600"
        : "text-emerald-600";

  const riskBarClass =
    lossPct >= 70
      ? "bg-rose-500"
      : lossPct >= 40
        ? "bg-amber-400"
        : "bg-emerald-500";

  const allocationItems = useMemo(
    () => getAllocationItems(dashboard),
    [dashboard],
  );

  const allocationTotal = allocationItems.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 text-sm text-slate-500 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6 text-sm text-rose-600 shadow-[0_12px_34px_rgba(244,63,94,0.08)]">
        Error: {error}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setOpenAddAsset(true)}
          className="inline-flex items-center rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50 to-cyan-50 px-4 py-2 text-sm font-semibold text-sky-900 shadow-[0_10px_24px_rgba(125,211,252,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:from-sky-100 hover:to-cyan-100 hover:shadow-[0_14px_30px_rgba(125,211,252,0.24)]"
        >
          + Add Asset
        </button>
      </div>

      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-b from-sky-50/85 to-white p-5 shadow-[0_10px_28px_rgba(125,211,252,0.08)]">
            <p className="text-sm text-slate-500">Total Tracked</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatMoney(totalTracked)}
            </p>
          </div>

          <div className={`rounded-3xl border p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] ${pnlCardTone(futuresPnL)}`}>
            <p className="text-sm text-slate-500">Futures Unrealized P/L</p>
            <p className={`mt-2 text-xl font-semibold ${pnlTextColor(futuresPnL)}`}>
              {formatSignedMoney(futuresPnL)}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-b from-slate-50/85 to-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-sm text-slate-500">Risk Status</p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  riskStatus === "High"
                    ? "bg-rose-500"
                    : riskStatus === "Medium"
                      ? "bg-amber-400"
                      : "bg-emerald-500"
                }`}
              />
              <span className={`text-sm font-semibold ${riskTextClass}`}>
                {riskStatus}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-b from-slate-50/85 to-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-sm text-slate-500">As Of</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {dashboard?.overview.asOf
                ? new Date(dashboard.overview.asOf).toLocaleString()
                : "-"}
            </p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-b from-sky-50/85 via-white to-white p-6 shadow-[0_14px_38px_rgba(125,211,252,0.10)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Risk Overview</h2>
                <p className="text-sm text-slate-500">
                  Based on current unrealized loss relative to futures notional
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    riskStatus === "High"
                      ? "bg-rose-500"
                      : riskStatus === "Medium"
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                  }`}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className={`rounded-2xl border p-4 shadow-sm ${pnlCardTone(-lossPct)}`}>
                <p className="text-sm text-muted-foreground">Unrealized Loss %</p>
                <p className={`mt-2 text-2xl font-semibold ${riskTextClass}`}>
                  {lossPct.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                  %
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 shadow-sm ${pnlCardTone(
                  futuresWallet + futuresPnL,
                )}`}
              >
                <p className="text-sm text-muted-foreground">Futures Buffer</p>
                <p
                  className={`mt-2 text-2xl font-semibold ${pnlTextColor(
                    futuresWallet + futuresPnL,
                  )}`}
                >
                  {formatMoney(futuresWallet + futuresPnL)}
                </p>
              </div>

              <div className={`rounded-2xl border p-4 shadow-sm ${pnlCardTone(futuresPnL)}`}>
                <p className="text-sm text-muted-foreground">Futures Unrealized P/L</p>
                <p
                  className={`mt-2 text-2xl font-semibold ${pnlTextColor(
                    futuresPnL,
                  )}`}
                >
                  {formatSignedMoney(futuresPnL)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-slate-500">Risk Exposure</p>
                <p className={`text-sm font-semibold ${riskTextClass}`}>
                  {riskStatus}
                </p>
              </div>

              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${riskBarClass}`}
                  style={{ width: `${Math.min(lossPct, 100)}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>0%</span>
                <span>40%</span>
                <span>70%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-violet-100 bg-gradient-to-b from-violet-50/85 via-white to-white p-6 shadow-[0_14px_38px_rgba(167,139,250,0.10)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Portfolio Allocation</h2>
                <p className="text-sm text-slate-500">
                  Current asset mix across monitored accounts
                </p>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-right shadow-sm">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Tracked Value</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatMoney(allocationTotal)}
                </p>
              </div>
            </div>

            {allocationItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-5">
                <p className="text-sm font-medium text-slate-900">No allocation data yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Connect Binance or add stock and fund data to build allocation.
                </p>
              </div>
            ) : (
              <AllocationDonut
                items={allocationItems}
                totalValue={allocationTotal}
              />
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Connected Accounts</h2>
          <AccountList refreshKey={localRefreshKey} />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-b from-sky-50/85 to-white p-5 shadow-[0_10px_28px_rgba(125,211,252,0.08)]">
            <p className="text-sm text-slate-500">Stocks</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatMoney(stockValue)}</p>
          </div>

          <div className="rounded-3xl border border-violet-100 bg-gradient-to-b from-violet-50/85 to-white p-5 shadow-[0_10px_28px_rgba(167,139,250,0.08)]">
            <p className="text-sm text-slate-500">Funds</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatMoney(fundValue)}</p>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50/85 to-white p-5 shadow-[0_10px_28px_rgba(16,185,129,0.08)]">
            <p className="text-sm text-slate-500">Cash</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatMoney(cashBalance)}</p>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-b from-slate-50/85 to-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-sm text-slate-500">As Of</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {dashboard?.overview.asOf
                ? new Date(dashboard.overview.asOf).toLocaleString()
                : "-"}
            </p>
          </div>
        </section>
      </div>

      <AddAssetModal
        open={openAddAsset}
        onClose={() => setOpenAddAsset(false)}
        onSuccess={() => {
          setOpenAddAsset(false);
          setLocalRefreshKey((prev) => prev + 1);
        }}
      />
    </>
  );
}