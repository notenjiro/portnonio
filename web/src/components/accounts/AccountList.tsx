import { useEffect, useState } from "react";
import { fetchAccounts, type StoreAccountItem } from "@/lib/api";

type Props = {
  refreshKey?: number;
};

function getAccountTone(source: StoreAccountItem["source"]) {
  if (source === "binance") {
    return {
      wrapper:
        "relative overflow-hidden border-[#2a2a2a] bg-[linear-gradient(135deg,#050505_0%,#0b0b0b_35%,#121212_70%,#1a1a1a_100%)] shadow-[0_14px_28px_rgba(0,0,0,0.25)]",
      glow:
        "absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#F0B90B]/70 to-transparent",
      title: "text-[#F0B90B]",
      badge:
        "border border-[#F0B90B]/20 bg-[#F0B90B]/10 text-[#F0B90B]",
      miniCard:
        "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)]",
      miniLabel: "text-[#F0B90B]/60",
      miniValue: "text-white",
    };
  }

  if (source === "stock") {
    return {
      wrapper: "relative overflow-hidden border-sky-100 bg-gradient-to-b from-sky-50/80 to-white",
      glow: "",
      title: "text-slate-900",
      badge: "bg-sky-100 text-sky-800",
      miniCard: "border border-slate-200/70 bg-white/75",
      miniLabel: "text-slate-500",
      miniValue: "text-slate-900",
    };
  }

  return {
    wrapper: "relative overflow-hidden border-violet-100 bg-gradient-to-b from-violet-50/80 to-white",
    glow: "",
    title: "text-slate-900",
    badge: "bg-violet-100 text-violet-800",
    miniCard: "border border-slate-200/70 bg-white/75",
    miniLabel: "text-slate-500",
    miniValue: "text-slate-900",
  };
}

export default function AccountList({ refreshKey }: Props) {
  const [accounts, setAccounts] = useState<StoreAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const data = await fetchAccounts();

        if (!cancelled) {
          setAccounts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load accounts");
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
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
        Loading accounts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
        No connected accounts yet
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => {
        const tone = getAccountTone(account.source);

        return (
          <div
            key={account.id}
            className={`rounded-xl border px-4 py-3 ${tone.wrapper}`}
          >
            {tone.glow ? <div className={tone.glow} /> : null}

            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className={`truncate text-lg font-semibold ${tone.title}`}>
                  {account.name}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${tone.badge}`}
              >
                {account.source}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className={`rounded-lg px-3 py-2 ${tone.miniCard}`}>
                <p className={`text-[10px] uppercase tracking-wide ${tone.miniLabel}`}>
                  Created
                </p>

                <p className={`mt-1 text-sm font-semibold ${tone.miniValue}`}>
                  {new Date(account.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className={`rounded-lg px-3 py-2 ${tone.miniCard}`}>
                <p className={`text-[10px] uppercase tracking-wide ${tone.miniLabel}`}>
                  Updated
                </p>

                <p className={`mt-1 text-sm font-semibold ${tone.miniValue}`}>
                  {new Date(account.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}