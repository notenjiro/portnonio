import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import {
  fetchAccounts,
  onboardAsset,
  searchAssets,
  type SearchAssetResultItem,
  type StoreAccountItem,
} from "@/lib/api";

type SearchProvider = "twelvedata" | "sec";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

function matchesQuery(item: SearchAssetResultItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return (
    item.symbol.toLowerCase().includes(q) ||
    item.name.toLowerCase().includes(q) ||
    (item.exchange ?? "").toLowerCase().includes(q) ||
    (item.projId ?? "").toLowerCase().includes(q)
  );
}

function sortAccountsForSelection(accounts: StoreAccountItem[]) {
  return [...accounts].sort((a, b) => {
    if (a.source === "binance" && b.source !== "binance") return -1;
    if (a.source !== "binance" && b.source === "binance") return 1;
    return a.name.localeCompare(b.name);
  });
}

export default function AddAssetModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [provider, setProvider] = useState<SearchProvider>("twelvedata");
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [results, setResults] = useState<SearchAssetResultItem[]>([]);
  const [accounts, setAccounts] = useState<StoreAccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submittingSymbol, setSubmittingSymbol] = useState<string | null>(null);
  const [error, setError] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setProvider("twelvedata");
      setQuery("");
      setQuantity("1");
      setResults([]);
      setAccounts([]);
      setSelectedAccountId("");
      setSearching(false);
      setLoadingAccounts(false);
      setSubmittingSymbol(null);
      setError("");
      activeRequestIdRef.current += 1;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      return;
    }

    void loadAccounts();
  }, [open]);

  useEffect(() => {
    const sorted = sortAccountsForSelection(accounts);
    const preferred = sorted.find((account) => account.source === "binance") ?? sorted[0];
    setSelectedAccountId(preferred?.id ?? "");
  }, [accounts]);

  const placeholder = useMemo(() => {
    return provider === "twelvedata"
      ? "Search stock symbol or name, e.g. AAPL"
      : "Search fund code, e.g. SCB";
  }, [provider]);

  const selectableAccounts = useMemo(() => {
    return sortAccountsForSelection(accounts);
  }, [accounts]);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (trimmed.length === 0) {
      setResults([]);
      setError("");
      setSearching(false);
      activeRequestIdRef.current += 1;
      return;
    }

    if (trimmed.length < 2) {
      setResults([]);
      setError("Type at least 2 characters");
      setSearching(false);
      activeRequestIdRef.current += 1;
      return;
    }

    setSearching(true);
    setError("");
    setResults([]);

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchAssets(provider, trimmed);

        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        const filtered = (Array.isArray(data) ? data : []).filter((item) =>
          matchesQuery(item, trimmed),
        );

        setResults(filtered);

        if (filtered.length === 0) {
          setError("No results found");
        }
      } catch (err) {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        setResults([]);
        setError(err instanceof Error ? err.message : "Failed to search assets");
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query, provider, open]);

  async function loadAccounts() {
    try {
      setLoadingAccounts(true);
      const data = await fetchAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoadingAccounts(false);
    }
  }

  function handleProviderChange(nextProvider: SearchProvider) {
    setProvider(nextProvider);
    setQuery("");
    setResults([]);
    setError("");
    setSearching(false);
    activeRequestIdRef.current += 1;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  async function handleSelect(item: SearchAssetResultItem) {
    const parsedQuantity = Number(quantity);

    if (!selectedAccountId) {
      setError("Please select an account first");
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    try {
      setSubmittingSymbol(item.symbol);
      setError("");

      await onboardAsset({
        provider,
        symbol: item.symbol,
        name: item.name,
        exchange: item.exchange ?? null,
        projId: item.projId,
        currency: provider === "sec" ? "THB" : "USD",
        accountId: selectedAccountId,
        quantity: parsedQuantity,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add asset");
    } finally {
      setSubmittingSymbol(null);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[720px] rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.20)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Add Asset</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search a stock or fund, choose an account, then onboard it into your monitoring flow
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleProviderChange("twelvedata")}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                provider === "twelvedata"
                  ? "border-sky-200 bg-sky-100/90 text-sky-900 shadow-[0_8px_24px_rgba(125,211,252,0.20)]"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Stocks
            </button>

            <button
              type="button"
              onClick={() => handleProviderChange("sec")}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                provider === "sec"
                  ? "border-violet-200 bg-violet-100/90 text-violet-900 shadow-[0_8px_24px_rgba(167,139,250,0.20)]"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Funds
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_220px_140px]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                  placeholder={placeholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {searching ? (
                  <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                ) : null}
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Account
              </span>
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={loadingAccounts}
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <option value="">
                    {loadingAccounts ? "Loading accounts..." : "Select account"}
                  </option>
                  {selectableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                      {account.source === "binance" ? " (master)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Quantity
              </span>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                inputMode="decimal"
                placeholder="1"
              />
            </label>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          <div className="max-h-[340px] space-y-3 overflow-auto pr-1">
            {results.map((item) => {
              const busy = submittingSymbol === item.symbol;

              return (
                <button
                  key={`${item.symbol}-${item.projId ?? item.exchange ?? "item"}`}
                  type="button"
                  onClick={() => void handleSelect(item)}
                  disabled={busy}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {item.symbol}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{item.name}</p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.exchange ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
                            {item.exchange}
                          </span>
                        ) : null}

                        {item.projId ? (
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">
                            {item.projId}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                        provider === "twelvedata"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-violet-100 text-violet-800"
                      }`}
                    >
                      {busy ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Adding...
                        </span>
                      ) : (
                        "Add"
                      )}
                    </span>
                  </div>
                </button>
              );
            })}

            {!searching && results.length === 0 && !error && query.trim().length < 2 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                Type at least 2 characters to search
              </div>
            ) : null}

            {!searching && results.length === 0 && !error && query.trim().length >= 2 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                No results found
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-200/70 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}