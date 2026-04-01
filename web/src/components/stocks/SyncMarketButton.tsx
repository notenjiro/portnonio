import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  History,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { syncMarketData, type MarketSyncResult } from "@/lib/api";
import { getMarketSyncToastText } from "@/lib/sync-reasons";

type Props = {
  onSynced?: (result: MarketSyncResult) => void;
  onHistoryRebuilt?: () => void;
};

type ToastTone = "success" | "error" | "info";

type ToastState = {
  visible: boolean;
  tone: ToastTone;
  title: string;
  description: string;
};

const TOAST_DURATION_MS = 3000;
const API_BASE_URL = "http://localhost:3001";

function getToastClasses(tone: ToastTone) {
  switch (tone) {
    case "success":
      return {
        wrap: "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-100/80 dark:border-emerald-900/60 dark:bg-emerald-950/90 dark:text-emerald-100",
        icon: "text-emerald-600 dark:text-emerald-300",
      };
    case "error":
      return {
        wrap: "border-red-200 bg-red-50 text-red-900 shadow-red-100/80 dark:border-red-900/60 dark:bg-red-950/90 dark:text-red-100",
        icon: "text-red-600 dark:text-red-300",
      };
    default:
      return {
        wrap: "border-slate-200 bg-white text-slate-900 shadow-slate-200/80 dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100",
        icon: "text-slate-600 dark:text-slate-300",
      };
  }
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return <CheckCircle2 className="h-5 w-5" />;
  }

  if (tone === "error") {
    return <XCircle className="h-5 w-5" />;
  }

  return <AlertCircle className="h-5 w-5" />;
}

function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();

  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0);

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

async function rebuildPortfolioHistoryForCurrentMonth() {
  const { startDate, endDate } = getCurrentMonthRange();

  const res = await fetch(`${API_BASE_URL}/portfolio-history/rebuild`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to rebuild portfolio history");
  }

  return res.json() as Promise<{
    success: boolean;
    days?: number;
    message?: string;
  }>;
}

export default function SyncMarketButton({
  onSynced,
  onHistoryRebuilt,
}: Props) {
  const [syncing, setSyncing] = useState(false);
  const [rebuildingHistory, setRebuildingHistory] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    tone: "info",
    title: "",
    description: "",
  });

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const toastClasses = useMemo(
    () => getToastClasses(toast.tone),
    [toast.tone],
  );

  function showToast(next: Omit<ToastState, "visible">) {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    setToast({
      visible: true,
      ...next,
    });

    timerRef.current = window.setTimeout(() => {
      setToast((prev) => ({
        ...prev,
        visible: false,
      }));
    }, TOAST_DURATION_MS);
  }

  async function handleSync() {
    try {
      setSyncing(true);

      const result = await syncMarketData("all");
      onSynced?.(result);

      const toastText = getMarketSyncToastText(result);

      showToast({
        tone: toastText.tone,
        title: toastText.title,
        description: toastText.description,
      });
    } catch (err) {
      showToast({
        tone: "error",
        title: "Market sync failed",
        description:
          err instanceof Error ? err.message : "Failed to sync market data",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleRebuildHistory() {
    try {
      setRebuildingHistory(true);

      const result = await rebuildPortfolioHistoryForCurrentMonth();

      onHistoryRebuilt?.();

      showToast({
        tone: "success",
        title: "History rebuilt",
        description: `Rebuilt portfolio history for ${result.days ?? 0} day(s) in the current month`,
      });
    } catch (err) {
      showToast({
        tone: "error",
        title: "Rebuild history failed",
        description:
          err instanceof Error
            ? err.message
            : "Failed to rebuild portfolio history",
      });
    } finally {
      setRebuildingHistory(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          onClick={handleSync}
          disabled={syncing || rebuildingHistory}
          className="gap-2 border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Market"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleRebuildHistory}
          disabled={syncing || rebuildingHistory}
          className="gap-2 border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50"
        >
          <History
            className={`h-4 w-4 ${rebuildingHistory ? "animate-spin" : ""}`}
          />
          {rebuildingHistory ? "Rebuilding..." : "Rebuild History"}
        </Button>
      </div>

      <div
        className={`pointer-events-none fixed right-4 top-4 z-[120] transition-all duration-300 ${
          toast.visible
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0"
        }`}
      >
        <div
          className={`pointer-events-auto flex min-w-[280px] max-w-[380px] items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${toastClasses.wrap}`}
        >
          <div className={`mt-0.5 shrink-0 ${toastClasses.icon}`}>
            <ToastIcon tone={toast.tone} />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className="mt-1 text-xs leading-5 opacity-90">
              {toast.description}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}