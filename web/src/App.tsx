import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConnectAccountDialog from "@/components/accounts/ConnectAccountDialog";
import TodaySummaryWidget from "@/components/common/TodaySummaryWidget";
import SkeletonCard from "@/components/common/SkeletonCard";
import HeaderNotifications from "@/components/layout/HeaderNotifications";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AssetLibraryDialog from "@/components/stocks/AssetLibraryDialog";
import SyncMarketButton from "@/components/stocks/SyncMarketButton";
import CalendarTab from "@/components/tabs/CalendarTab";
import OverviewTab from "@/components/tabs/OverviewTab";
import PositionsTab from "@/components/tabs/PositionsTab";
import {
  fetchAlerts,
  fetchDashboardBreakdown,
  fetchDashboardSummary,
} from "@/lib/api";
import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  type ThemeMode,
} from "@/lib/theme";
import type { AlertItem, Breakdown, Summary, TabKey } from "@/types/dashboard";
import AddAssetModal from "./components/stocks/AddAssetModal";
import AddOrderModal from "./components/stocks/AddOrderModal";
import { LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { Button } from "./components/ui/button";

type AccountFilter = "all" | "binance" | "innovestx";

const AUTO_REFRESH_MS = 3 * 60 * 1000;

function TabButton(props: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
        props.active
          ? "bg-foreground text-background"
          : "border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {props.children}
    </button>
  );
}

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [pendingOrderAssetId, setPendingOrderAssetId] = useState<
    string | undefined
  >(undefined);

  const isMountedRef = useRef(true);
  const refreshInFlightRef = useRef(false);
  const lastRefreshAtRef = useRef<number>(0);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetchDashboardSummary();

      if (!isMountedRef.current) return false;

      setSummary({
        totalValue: res.totalValue ?? 0,
        todayPnL: res.todayPnL ?? 0,
        accounts: res.accounts ?? 0,
        spotValue: res.spotValue ?? 0,
        futuresWallet: res.futuresWallet ?? 0,
        futuresPnL: res.futuresUnrealizedPnL ?? 0,
        stockValue: res.stockValue ?? 0,
        fundValue: res.fundValue ?? 0,
        cashBalance: res.cashBalance ?? 0,
      });

      return true;
    } catch (e) {
      console.error("Failed to load dashboard summary:", e);

      if (!isMountedRef.current) return false;

      setSummary((prev) =>
        prev ?? {
          totalValue: 0,
          todayPnL: 0,
          accounts: 0,
          spotValue: 0,
          futuresWallet: 0,
          futuresPnL: 0,
          stockValue: 0,
          fundValue: 0,
          cashBalance: 0,
        },
      );

      return false;
    }
  }, []);

  const loadBreakdown = useCallback(async () => {
    try {
      const res = await fetchDashboardBreakdown();

      if (!isMountedRef.current) return false;

      setBreakdown({
        spotValue: res.spotValue ?? 0,
        futuresWallet: res.futuresWallet ?? 0,
        futuresPnL: res.futuresPnL ?? 0,
        stockValue: res.stockValue ?? 0,
        fundValue: res.fundValue ?? 0,
        cashBalance: res.cashBalance ?? 0,
        spotHoldings: res.spotHoldings ?? [],
        futuresPositions: res.futuresPositions ?? [],
        stockHoldings: res.stockHoldings ?? [],
        fundHoldings: res.fundHoldings ?? [],
      });

      return true;
    } catch (e) {
      console.error("Failed to load breakdown:", e);

      if (!isMountedRef.current) return false;

      setBreakdown((prev) =>
        prev ?? {
          spotValue: 0,
          futuresWallet: 0,
          futuresPnL: 0,
          stockValue: 0,
          fundValue: 0,
          cashBalance: 0,
          spotHoldings: [],
          futuresPositions: [],
          stockHoldings: [],
          fundHoldings: [],
        },
      );

      return false;
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetchAlerts();

      if (!isMountedRef.current) return false;

      setAlerts(res.alerts ?? []);
      return true;
    } catch (e) {
      console.error("Failed to load alerts:", e);

      if (!isMountedRef.current) return false;

      setAlerts([]);
      return false;
    }
  }, []);

  const refreshAll = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      const silent = options?.silent ?? false;
      const force = options?.force ?? false;

      if (!force && document.visibilityState === "hidden") {
        return;
      }

      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      const shouldShowSkeleton = !silent && !hasLoadedOnce;

      try {
        if (shouldShowSkeleton) {
          setDashboardLoading(true);
        } else {
          setIsRefreshing(true);
        }

        const results = await Promise.all([
          loadSummary(),
          loadBreakdown(),
          loadAlerts(),
        ]);

        if (!isMountedRef.current) return;

        if (results.some(Boolean)) {
          const now = Date.now();
          lastRefreshAtRef.current = now;
          setLastUpdated(new Date(now));
        }

        setHasLoadedOnce(true);
      } finally {
        refreshInFlightRef.current = false;

        if (!isMountedRef.current) return;

        setDashboardLoading(false);
        setIsRefreshing(false);
      }
    },
    [hasLoadedOnce, loadAlerts, loadBreakdown, loadSummary],
  );

  useEffect(() => {
    isMountedRef.current = true;

    refreshAll({ force: true });

    return () => {
      isMountedRef.current = false;
    };
  }, [refreshAll]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshAll({ silent: true });
      }
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
  }, [refreshAll]);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const now = Date.now();
      const elapsed = now - lastRefreshAtRef.current;

      if (elapsed >= AUTO_REFRESH_MS) {
        refreshAll({ silent: true, force: true });
      }
    };

    const handleFocus = () => {
      handleVisibilityOrFocus();
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshAll]);

  useEffect(() => {
    applyTheme(theme);
    setStoredTheme(theme);

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");

    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  const isBinance = accountFilter === "binance";
  const isInno = accountFilter === "innovestx";

  const totalValue =
    accountFilter === "all"
      ? (summary?.totalValue ?? 0)
      : isBinance
        ? (summary?.spotValue ?? 0) + (summary?.futuresWallet ?? 0)
        : (summary?.stockValue ?? 0) +
          (summary?.fundValue ?? 0) +
          (summary?.cashBalance ?? 0);

  const todayPnL =
    accountFilter === "all"
      ? (summary?.todayPnL ?? 0)
      : isBinance
        ? (summary?.futuresPnL ?? 0)
        : 0;

  const accounts = summary?.accounts ?? 0;

  const spotValue = summary?.spotValue ?? 0;
  const futuresWallet = summary?.futuresWallet ?? 0;
  const stockValue = summary?.stockValue ?? 0;
  const fundValue = summary?.fundValue ?? 0;
  const cashBalance = summary?.cashBalance ?? 0;

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return "-";

    return lastUpdated.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [lastUpdated]);

  const handleConnected = useCallback(() => {
    refreshAll({ silent: true, force: true });
    setRefreshKey((k) => k + 1);
  }, [refreshAll]);

  const handleMarketSynced = useCallback(() => {
    refreshAll({ silent: true, force: true });
    setRefreshKey((k) => k + 1);
  }, [refreshAll]);

  const handleHistoryRebuilt = useCallback(() => {
    refreshAll({ silent: true, force: true });
    setRefreshKey((k) => k + 1);
  }, [refreshAll]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="font-semibold">portnonio</div>

          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onChange={setTheme} />
            <HeaderNotifications alerts={alerts} lastUpdated={lastUpdated} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 p-4">
        <section className="rounded-2xl border p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Connect Account</h2>
              <p className="text-sm text-muted-foreground">
                Add Stock or Binance
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  Connected Accounts
                </p>
                <p className="text-lg font-semibold">{accounts}</p>
              </div>

              <ConnectAccountDialog onConnected={handleConnected} />
            </div>
          </div>
        </section>

        <section className="flex items-center justify-between rounded-2xl border p-4">
          <div>
            <p className="text-sm font-semibold">Account View</p>
            <p className="text-xs text-muted-foreground">
              Switch between providers
            </p>
          </div>

          <div className="flex gap-2">
            {[
              { key: "all", label: "All" },
              { key: "binance", label: "Binance" },
              { key: "innovestx", label: "Stock" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setAccountFilter(item.key as AccountFilter)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  accountFilter === item.key
                    ? "bg-foreground text-background"
                    : "border bg-background hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-[108px]">
          {dashboardLoading ? (
            <div className="h-[108px]">
              <SkeletonCard className="h-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-2">
              <TodaySummaryWidget
                totalValue={totalValue}
                todayPnL={todayPnL}
                futuresPnL={summary?.futuresPnL ?? 0}
                stockValue={stockValue}
                fundValue={fundValue}
                cashBalance={cashBalance}
                spotValue={spotValue}
                futuresWallet={futuresWallet}
              />

              <div className="flex min-h-[20px] items-center justify-between px-1">
                <p className="text-xs text-muted-foreground">
                  Auto refresh every 3 minutes
                </p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => refreshAll({ silent: true, force: true })}
                    disabled={isRefreshing}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                    Refresh now
                  </Button>

                  {isRefreshing && (
                    <span className="inline-flex items-center gap-1">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      Refreshing...
                    </span>
                  )}

                  <span>Last updated {lastUpdatedText}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <TabButton
                active={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </TabButton>

              <TabButton
                active={activeTab === "calendar"}
                onClick={() => setActiveTab("calendar")}
              >
                Calendar
              </TabButton>

              <TabButton
                active={activeTab === "positions"}
                onClick={() => setActiveTab("positions")}
              >
                Positions
              </TabButton>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <AssetLibraryDialog refreshKey={refreshKey} />

              <SyncMarketButton
                onSynced={handleMarketSynced}
                onHistoryRebuilt={handleHistoryRebuilt}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddAsset(true)}
                className="gap-2 border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900/70"
              >
                <Plus className="h-4 w-4" />
                Asset
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddOrder(true)}
                className="gap-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
              >
                <Plus className="h-4 w-4" />
                Order
              </Button>
            </div>
          </div>
        </section>

        {activeTab === "overview" && (
          <OverviewTab
            futuresWallet={isInno ? 0 : (summary?.futuresWallet ?? 0)}
            futuresPnL={isInno ? 0 : (summary?.futuresPnL ?? 0)}
            stockValue={isBinance ? 0 : (summary?.stockValue ?? 0)}
            fundValue={isBinance ? 0 : (summary?.fundValue ?? 0)}
            cashBalance={isBinance ? 0 : (summary?.cashBalance ?? 0)}
            refreshKey={refreshKey}
          />
        )}

        {activeTab === "calendar" && (
          <CalendarTab refreshKey={refreshKey} filter={accountFilter} />
        )}

        {activeTab === "positions" && (
          <PositionsTab
            spotHoldings={isInno ? [] : (breakdown?.spotHoldings ?? [])}
            futuresPositions={isInno ? [] : (breakdown?.futuresPositions ?? [])}
            stockHoldings={isBinance ? [] : (breakdown?.stockHoldings ?? [])}
            fundHoldings={isBinance ? [] : (breakdown?.fundHoldings ?? [])}
          />
        )}

        {showAddAsset && (
          <AddAssetModal
            open={showAddAsset}
            onClose={() => setShowAddAsset(false)}
            onSuccess={(asset) => {
              refreshAll({ silent: true, force: true });
              setRefreshKey((k) => k + 1);
              setPendingOrderAssetId(asset.id);
              setShowAddOrder(true);
            }}
          />
        )}

        {showAddOrder && (
          <AddOrderModal
            open={showAddOrder}
            initialAssetId={pendingOrderAssetId}
            onClose={() => {
              setShowAddOrder(false);
              setPendingOrderAssetId(undefined);
            }}
            onSuccess={() => {
              refreshAll({ silent: true, force: true });
              setRefreshKey((k) => k + 1);
              setPendingOrderAssetId(undefined);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;