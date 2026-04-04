import { useEffect, useMemo, useState } from "react";
import {
  fetchAccounts,
  fetchAccountAssetLinks,
  fetchAssets,
  fetchPortfolioAssets,
  fetchPositions,
  refreshAssetPrice,
  rebuildDerivedViews,
  unlinkAccountAsset,
  updateAccountAssetLinkQuantity,
  type AccountAssetLinkItem,
  type PortfolioAssetValuationItem,
  type StoreAccountItem,
  type StoreAssetItem,
} from "@/lib/api";

type PositionsData = Awaited<ReturnType<typeof fetchPositions>>;

type PortfolioAssetRow = {
  linkId: string;
  assetId: string;
  symbol: string;
  name: string;
  source: StoreAssetItem["source"];
  category: StoreAssetItem["category"];
  currency: string;
  quantity: number;
  accountName: string;
  accountSource: StoreAccountItem["source"] | "unknown";
  providerLabel: string;
  metadataLabel: string | null;
  updatedAt: string;
  price: number | null;
  value: number | null;
  dailyPnl: number | null;
  changePercent: number | null;
  lastUpdated: string | null;
};

function formatUSD(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatSignedUSD(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  const numeric = Number(value);
  const formatted = Math.abs(numeric).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

  return numeric >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function formatNumber(value: number | null | undefined, digits = 4) {
  if (!Number.isFinite(Number(value ?? 0))) return "0";
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function Sparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  const width = 84;
  const height = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-6 w-20 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={positive ? "currentColor" : "currentColor"}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={positive ? "text-emerald-500" : "text-rose-500"}
      />
    </svg>
  );
}

function buildFuturesSparkline(item: {
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  quantity: number;
}) {
  const entry = Number(item.entryPrice ?? 0);
  const mark = Number(item.markPrice ?? 0);
  const pnl = Number(item.unrealizedPnl ?? 0);
  const qty = Math.abs(Number(item.quantity ?? 0)) || 1;

  const drift = Math.abs(mark - entry) || Math.max(entry * 0.015, 0.0001);
  const start = entry;
  const end = mark;

  const mid1 = start + drift * 0.18;
  const mid2 = start - drift * 0.08;
  const mid3 = start + drift * 0.34;
  const mid4 = start + (end - start) * 0.65;

  const values =
    pnl >= 0
      ? [start, mid1, mid2, mid3, mid4, end]
      : [
          start,
          start - drift * 0.12,
          start + drift * 0.06,
          start - drift * 0.24,
          mid4,
          end,
        ];

  return {
    values,
    positive: pnl >= 0 || (mark - entry) * qty >= 0,
  };
}

function getSourceTone(source: PortfolioAssetRow["source"]) {
  if (source === "stock") {
    return "bg-sky-100 text-sky-800";
  }

  if (source === "fund") {
    return "bg-violet-100 text-violet-800";
  }

  return "bg-slate-100 text-slate-800";
}

function getPnlTone(value: number | null) {
  if (value == null) {
    return "bg-slate-100 text-slate-700";
  }

  return value >= 0
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";
}

function buildPortfolioRows(
  assets: StoreAssetItem[],
  links: AccountAssetLinkItem[],
  accounts: StoreAccountItem[],
  valuations: PortfolioAssetValuationItem[],
): PortfolioAssetRow[] {
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const valuationMap = new Map(valuations.map((item) => [item.linkId, item]));

  const rows: PortfolioAssetRow[] = [];

  for (const link of links) {
    const asset = assetMap.get(link.assetId);
    if (!asset) {
      continue;
    }

    const account = accountMap.get(link.accountId);
    const valuation = valuationMap.get(link.id);

    const metadataLabel =
      asset.metadata?.provider === "sec"
        ? (asset.metadata.projId ?? null)
        : asset.metadata?.provider === "twelvedata"
          ? (asset.metadata.exchange ?? null)
          : null;

    rows.push({
      linkId: link.id,
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      source: asset.source,
      category: asset.category,
      currency: asset.currency,
      quantity: link.quantity,
      accountName: account?.name ?? "Unknown account",
      accountSource: account?.source ?? "unknown",
      providerLabel: asset.metadata?.provider ?? asset.source,
      metadataLabel,
      updatedAt: link.updatedAt,
      price: valuation?.price ?? null,
      value: valuation?.value ?? null,
      dailyPnl: valuation?.dailyPnl ?? null,
      changePercent: valuation?.changePercent ?? null,
      lastUpdated: valuation?.lastUpdated ?? null,
    });
  }

  rows.sort((a, b) => {
    if (a.source === b.source) {
      return a.symbol.localeCompare(b.symbol);
    }

    return a.source.localeCompare(b.source);
  });

  return rows;
}

export default function PositionsTab() {
  const [data, setData] = useState<PositionsData | null>(null);
  const [assets, setAssets] = useState<StoreAssetItem[]>([]);
  const [links, setLinks] = useState<AccountAssetLinkItem[]>([]);
  const [accounts, setAccounts] = useState<StoreAccountItem[]>([]);
  const [valuations, setValuations] = useState<PortfolioAssetValuationItem[]>(
    [],
  );
  const [draftQuantityByLink, setDraftQuantityByLink] = useState<
    Record<string, string>
  >({});
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);
  const [busyRefreshAssetId, setBusyRefreshAssetId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  async function loadPositions() {
    const res = await fetchPositions();
    setData(res);
  }

  async function loadPortfolioManager() {
    const [assetData, linkData, accountData, valuationData] = await Promise.all(
      [
        fetchAssets(),
        fetchAccountAssetLinks(),
        fetchAccounts(),
        fetchPortfolioAssets(),
      ],
    );

    setAssets(Array.isArray(assetData) ? assetData : []);
    setLinks(Array.isArray(linkData) ? linkData : []);
    setAccounts(Array.isArray(accountData) ? accountData : []);
    setValuations(Array.isArray(valuationData) ? valuationData : []);
    setDraftQuantityByLink(
      Object.fromEntries(
        (Array.isArray(linkData) ? linkData : []).map((link) => [
          link.id,
          String(link.quantity ?? 1),
        ]),
      ),
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);
        setPortfolioLoading(true);
        setError(null);
        setPortfolioError(null);

        const [positionsRes, assetData, linkData, accountData, valuationData] =
          await Promise.all([
            fetchPositions(),
            fetchAssets(),
            fetchAccountAssetLinks(),
            fetchAccounts(),
            fetchPortfolioAssets(),
          ]);

        if (cancelled) return;

        setData(positionsRes);
        setAssets(Array.isArray(assetData) ? assetData : []);
        setLinks(Array.isArray(linkData) ? linkData : []);
        setAccounts(Array.isArray(accountData) ? accountData : []);
        setValuations(Array.isArray(valuationData) ? valuationData : []);
        setDraftQuantityByLink(
          Object.fromEntries(
            (Array.isArray(linkData) ? linkData : []).map((link) => [
              link.id,
              String(link.quantity ?? 1),
            ]),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load positions";
        setError(message);
        setPortfolioError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPortfolioLoading(false);
        }
      }
    }

    void loadAll();

    return () => {
      cancelled = true;
    };
  }, []);

  const spotItems = Array.isArray(data?.spot?.items) ? data!.spot.items : [];
  const futuresItems = Array.isArray(data?.futures?.items)
    ? data!.futures.items
    : [];

  const portfolioRows = useMemo(
    () => buildPortfolioRows(assets, links, accounts, valuations),
    [assets, links, accounts, valuations],
  );

  const portfolioSummary = useMemo(() => {
    const stocks = portfolioRows.filter((row) => row.source === "stock").length;
    const funds = portfolioRows.filter((row) => row.source === "fund").length;
    const crypto = portfolioRows.filter(
      (row) => row.source === "binance",
    ).length;
    const totalValue = portfolioRows.reduce(
      (sum, row) => sum + Number(row.value ?? 0),
      0,
    );
    const totalDailyPnl = portfolioRows.reduce(
      (sum, row) => sum + Number(row.dailyPnl ?? 0),
      0,
    );

    return {
      stocks,
      funds,
      crypto,
      total: portfolioRows.length,
      totalValue,
      totalDailyPnl,
    };
  }, [portfolioRows]);

  const spotSummary = useMemo(() => {
    const pricedCount = spotItems.filter(
      (item) => item.priceUsd != null,
    ).length;
    const unpricedCount = spotItems.length - pricedCount;
    return { pricedCount, unpricedCount };
  }, [spotItems]);

  async function handleSaveQuantity(linkId: string) {
    const draftValue = Number(draftQuantityByLink[linkId]);

    if (!Number.isFinite(draftValue) || draftValue < 0) {
      setPortfolioError(
        "Quantity must be a valid number greater than or equal to 0",
      );
      return;
    }

    try {
      setBusyLinkId(linkId);
      setPortfolioError(null);

      await updateAccountAssetLinkQuantity(linkId, draftValue);
      try {
        await rebuildDerivedViews();
      } catch (err) {
        console.warn("Rebuild failed (non-blocking):", err);
      }
      await loadPortfolioManager();
    } catch (err) {
      setPortfolioError(
        err instanceof Error ? err.message : "Failed to update quantity",
      );
    } finally {
      setBusyLinkId(null);
    }
  }

  async function handleUnlink(linkId: string) {
    try {
      setBusyLinkId(linkId);
      setPortfolioError(null);

      await unlinkAccountAsset(linkId);
      try {
        await rebuildDerivedViews();
      } catch (err) {
        console.warn("Rebuild failed (non-blocking):", err);
      }
      await loadPortfolioManager();
    } catch (err) {
      setPortfolioError(
        err instanceof Error ? err.message : "Failed to unlink asset",
      );
    } finally {
      setBusyLinkId(null);
    }
  }

  async function handleRefreshAsset(row: PortfolioAssetRow) {
    try {
      setBusyRefreshAssetId(row.assetId);
      setPortfolioError(null);

      await refreshAssetPrice({
        id: row.assetId,
        source: row.source,
      });
      try {
        await rebuildDerivedViews();
      } catch (err) {
        console.warn("Rebuild failed (non-blocking):", err);
      }
      await Promise.all([loadPortfolioManager(), loadPositions()]);
    } catch (err) {
      setPortfolioError(
        err instanceof Error ? err.message : "Failed to refresh asset",
      );
    } finally {
      setBusyRefreshAssetId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 text-sm text-slate-500 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        Loading positions...
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
    <div className="space-y-6">
      <section className="rounded-3xl border border-violet-100 bg-gradient-to-b from-violet-50/85 via-white to-white p-6 shadow-[0_14px_38px_rgba(167,139,250,0.09)]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Portfolio Assets
            </h2>
            <p className="text-sm text-slate-500">
              Linked stock and fund assets managed inside this portfolio
            </p>
          </div>

          <div className="flex flex-wrap gap-3 md:justify-end">
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Assets
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {portfolioSummary.total}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Stock / Fund
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {portfolioSummary.stocks} / {portfolioSummary.funds}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Value
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatUSD(portfolioSummary.totalValue)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Daily P/L
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  portfolioSummary.totalDailyPnl >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {formatSignedUSD(portfolioSummary.totalDailyPnl)}
              </p>
            </div>
          </div>
        </div>

        {portfolioError ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
            {portfolioError}
          </div>
        ) : null}

        {portfolioLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-5 text-sm text-slate-500">
            Loading portfolio assets...
          </div>
        ) : portfolioRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-5 text-sm text-slate-500">
            No portfolio assets linked yet
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/70 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium text-right">Quantity</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Price / NAV
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Daily P/L
                  </th>
                  <th className="px-4 py-3 font-medium">Meta</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Last Sync
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {portfolioRows.map((row) => {
                  const busy = busyLinkId === row.linkId;
                  const busyRefresh = busyRefreshAssetId === row.assetId;

                  return (
                    <tr
                      key={row.linkId}
                      className="border-b border-slate-100 last:border-b-0 transition hover:bg-violet-50/35"
                    >
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            {row.symbol}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {row.name}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {row.accountName}
                          </p>
                          <p className="text-xs capitalize text-slate-500">
                            {row.accountSource}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getSourceTone(row.source)}`}
                          >
                            {row.source}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                            {row.providerLabel}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            value={
                              draftQuantityByLink[row.linkId] ??
                              String(row.quantity)
                            }
                            onChange={(e) =>
                              setDraftQuantityByLink((prev) => ({
                                ...prev,
                                [row.linkId]: e.target.value,
                              }))
                            }
                            className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                            inputMode="decimal"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveQuantity(row.linkId)}
                            disabled={busy}
                            className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Save
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        <div>{formatUSD(row.price)}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatPercent(row.changePercent)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatUSD(row.value)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${getPnlTone(row.dailyPnl)}`}
                        >
                          {formatSignedUSD(row.dailyPnl)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {row.metadataLabel ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-500">
                        {row.lastUpdated
                          ? new Date(row.lastUpdated).toLocaleDateString()
                          : "-"}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleRefreshAsset(row)}
                            disabled={busyRefresh}
                            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyRefresh ? "Refreshing..." : "Refresh"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleUnlink(row.linkId)}
                            disabled={busy}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-sky-100 bg-gradient-to-b from-sky-50/85 via-white to-white p-6 shadow-[0_14px_38px_rgba(125,211,252,0.10)]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Spot Holdings
            </h2>
            <p className="text-sm text-slate-500">
              Live Binance spot balances from the current portfolio snapshot
            </p>
          </div>

          <div className="flex flex-wrap gap-3 md:justify-end">
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Total Spot Value
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatUSD(data?.spot?.totalValueUsd ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Priced / Unpriced
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {spotSummary.pricedCount} / {spotSummary.unpricedCount}
              </p>
            </div>
          </div>
        </div>

        {spotItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-5 text-sm text-slate-500">
            No spot holdings
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/70 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium text-right">Free</th>
                  <th className="px-4 py-3 font-medium text-right">Locked</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                </tr>
              </thead>

              <tbody>
                {spotItems.map((item) => (
                  <tr
                    key={`${item.asset}-${item.symbol}`}
                    className="border-b border-slate-100 last:border-b-0 transition hover:bg-sky-50/50"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {item.asset}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.symbol}</td>
                    <td className="px-4 py-3 text-right">
                      {formatNumber(item.free, 8)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatNumber(item.locked, 8)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatNumber(item.total, 8)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.priceUsd == null ? "-" : formatUSD(item.priceUsd)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {item.valueUsd == null ? "-" : formatUSD(item.valueUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-rose-100 bg-gradient-to-b from-rose-50/85 via-white to-white p-6 shadow-[0_14px_38px_rgba(244,63,94,0.09)]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Futures Positions
            </h2>
            <p className="text-sm text-slate-500">
              Open futures positions, exposure, and current unrealized P/L
            </p>
          </div>

          <div className="flex flex-wrap gap-3 md:justify-end">
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Open Positions
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {futuresItems.length}
              </p>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Total Unrealized P/L
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  Number(data?.futures?.totalUnrealizedPnl ?? 0) >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {formatUSD(data?.futures?.totalUnrealizedPnl ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {futuresItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-5 text-sm text-slate-500">
            No open futures positions
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200/70 bg-slate-50/70 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 font-medium text-right">Quantity</th>
                  <th className="px-4 py-3 font-medium text-right">Entry</th>
                  <th className="px-4 py-3 font-medium text-right">Mark</th>
                  <th className="px-4 py-3 font-medium text-right">Notional</th>
                  <th className="px-4 py-3 font-medium text-right">Leverage</th>
                  <th className="px-4 py-3 font-medium text-center">Drift</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Unrealized P/L
                  </th>
                </tr>
              </thead>

              <tbody>
                {futuresItems.map((item) => {
                  const pnl = Number(item.unrealizedPnl ?? 0);
                  const sparkline = buildFuturesSparkline({
                    entryPrice: Number(item.entryPrice ?? 0),
                    markPrice: Number(item.markPrice ?? 0),
                    unrealizedPnl: pnl,
                    quantity: Number(item.quantity ?? 0),
                  });

                  return (
                    <tr
                      key={`${item.symbol}-${item.side}`}
                      className="border-b border-slate-100 last:border-b-0 transition hover:bg-rose-50/45"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {item.symbol}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{item.side}</td>
                      <td className="px-4 py-3 text-right">
                        {formatNumber(item.quantity, 8)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatNumber(item.entryPrice, 6)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatNumber(item.markPrice, 6)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatUSD(item.notionalUsd)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.leverage == null ? "-" : `${item.leverage}x`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Sparkline
                            values={sparkline.values}
                            positive={sparkline.positive}
                          />
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          pnl >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {formatUSD(pnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
