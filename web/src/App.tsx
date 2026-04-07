import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Pencil,
  RefreshCw,
  RotateCcw,
  UserCircle2,
} from "lucide-react";

import OverviewTab from "@/components/tabs/OverviewTab";
import CalendarTab from "@/components/tabs/CalendarTab";
import PositionsTab from "@/components/tabs/PositionsTab";

import {
  fetchAccounts,
  fetchOverview,
  refreshPortfolioData,
  updateAccountName,
  type StoreAccountItem,
} from "@/lib/api";
import { Toaster, toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TabKey = "overview" | "calendar" | "positions";
type FilterKey = "all" | "binance" | "innovestx";

const FILTER_OPTIONS: Array<{
  key: FilterKey;
  label: string;
  activeClassName: string;
}> = [
  {
    key: "all",
    label: "All",
    activeClassName:
      "border-sky-200 bg-sky-100/90 text-sky-900 shadow-[0_6px_18px_rgba(125,211,252,0.28)]",
  },
  {
    key: "binance",
    label: "Binance",
    activeClassName:
      "border-amber-200 bg-amber-100/90 text-amber-900 shadow-[0_6px_18px_rgba(253,230,138,0.30)]",
  },
  {
    key: "innovestx",
    label: "Stocks/Funds",
    activeClassName:
      "border-violet-200 bg-violet-100/90 text-violet-900 shadow-[0_6px_18px_rgba(221,214,254,0.32)]",
  },
];

function getPrimaryAccount(accounts: StoreAccountItem[]) {
  return accounts.find((account) => account.source === "binance") ?? accounts[0] ?? null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [refreshKey, setRefreshKey] = useState(0);
  const [isResyncing, setIsResyncing] = useState(false);

  const [, setOverview] = useState<any>(null);
  const [accounts, setAccounts] = useState<StoreAccountItem[]>([]);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<StoreAccountItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchOverview()
      .then(setOverview)
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    void loadAccounts();
  }, [refreshKey]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadAccounts() {
    try {
      const data = await fetchAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setAccounts([]);
    }
  }

  function handleRefresh() {
    if (isResyncing) {
      return;
    }

    setRefreshKey((prev) => prev + 1);
  }

  async function handleResync() {
    if (isResyncing) {
      return;
    }

    const loadingToastId = toast.loading("Re-syncing portfolio data...");

    try {
      setIsResyncing(true);

      await withTimeout(
        refreshPortfolioData(),
        20000,
        "Re-sync timed out after 20 seconds",
      );

      toast.success("Re-sync completed", { id: loadingToastId });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to re-sync portfolio data:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to re-sync portfolio data",
        { id: loadingToastId }
      );
    } finally {
      setIsResyncing(false);
    }
  }

  function handleRenameAccount(account: StoreAccountItem) {
    setRenameTarget(account);
    setRenameValue(account.name);
    setRenameDialogOpen(true);
  }

  async function submitRenameAccount() {
    if (!renameTarget) {
      return;
    }

    const trimmedName = renameValue.trim();

    if (!trimmedName || trimmedName === renameTarget.name) {
      setRenameDialogOpen(false);
      setRenameTarget(null);
      return;
    }

    try {
      await updateAccountName(renameTarget.id, trimmedName);
      await loadAccounts();
      setRefreshKey((prev) => prev + 1);
      setIsAccountMenuOpen(false);
      toast.success("Account renamed");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to rename account",
      );
    } finally {
      setRenameDialogOpen(false);
      setRenameTarget(null);
    }
  }

  const primaryAccount = getPrimaryAccount(accounts);

  return (
    <div className="mx-auto min-h-screen max-w-[1478px] text-foreground">
      <Toaster position="top-right" richColors />

      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) {
            setRenameTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename account</DialogTitle>
          </DialogHeader>

          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitRenameAccount();
              }
            }}
            autoFocus
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false);
                setRenameTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitRenameAccount()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="border-b border-slate-200/70 bg-white px-6 py-4 dark:border-white/10 dark:bg-slate-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Portnonio
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-slate-900">
              {FILTER_OPTIONS.map((item) => {
                const isActive = filter === item.key;

                return (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key)}
                    className={`w-[118px] rounded-xl border px-3.5 py-1.5 text-center text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? item.activeClassName
                        : "border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isResyncing}
              className="ml-1 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100/80 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleResync}
                disabled={isResyncing}
                className={`relative inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-80 ${
                  isResyncing
                    ? "border-orange-200/90 bg-gradient-to-b from-orange-50 via-rose-50 to-pink-50 text-orange-900 shadow-[0_14px_34px_rgba(251,146,60,0.22)] dark:border-white/10 dark:from-orange-950/35 dark:via-rose-950/15 dark:to-pink-950/20 dark:text-orange-100"
                    : "border-orange-200/80 bg-gradient-to-b from-orange-50 via-amber-50 to-rose-50 text-orange-900 shadow-[0_12px_28px_rgba(251,146,60,0.16)] hover:-translate-y-0.5 hover:from-orange-100 hover:via-amber-100 hover:to-rose-100 hover:shadow-[0_16px_34px_rgba(251,146,60,0.24)] dark:border-white/10 dark:from-orange-950/25 dark:via-amber-950/10 dark:to-rose-950/15 dark:text-orange-100 dark:hover:from-orange-900/35 dark:hover:via-amber-900/20 dark:hover:to-rose-900/20"
                }`}
              >
                {isResyncing && (
                  <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,_rgba(251,146,60,0.18),_transparent_65%)] animate-pulse" />
                )}

                <RotateCcw
                  className={`relative h-4 w-4 ${isResyncing ? "animate-spin" : ""}`}
                />
                <span className="relative">
                  {isResyncing ? "Re-syncing..." : "Re-sync"}
                </span>
              </button>

              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-semibold tracking-wide ${
                  isResyncing
                    ? "border-orange-200 bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
                    : "border-emerald-200 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isResyncing
                      ? "bg-orange-500 animate-pulse"
                      : "bg-emerald-500"
                  }`}
                />
                {isResyncing ? "SYNC" : "LIVE"}
              </span>
            </div>

            <div className="relative ml-1" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition hover:bg-slate-100/80 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <UserCircle2 className="h-5 w-5" />
                <span className="max-w-[140px] truncate">
                  {primaryAccount?.name ?? "Accounts"}
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {isAccountMenuOpen ? (
                <div className="absolute right-0 z-50 isolate mt-2 w-[280px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-900">
                  <div className="px-3 pb-2 pt-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Account Settings
                    </p>
                  </div>

                  <div className="space-y-1">
                    {accounts.length === 0 ? (
                      <div className="rounded-xl px-3 py-3 text-sm text-slate-500">
                        No accounts found
                      </div>
                    ) : (
                      accounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {account.name}
                            </p>
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              {account.source}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRenameAccount(account)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Rename
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-200/70 bg-white px-6 py-3 dark:border-white/10 dark:bg-slate-950/90">
        <div className="w-fit rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-900">
          <div className="flex gap-2">
            {[
              { key: "overview", label: "Overview" },
              { key: "positions", label: "Positions" },
              { key: "calendar", label: "Calendar" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="p-6">
        {activeTab === "overview" && (
          <OverviewTab refreshKey={refreshKey} filter={filter} />
        )}

        {activeTab === "positions" && <PositionsTab />}

        {activeTab === "calendar" && (
          <CalendarTab refreshKey={refreshKey} filter={filter} />
        )}
      </main>
    </div>
  );
}