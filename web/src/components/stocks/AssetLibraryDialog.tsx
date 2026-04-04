import { useEffect, useMemo, useState } from "react";
import { FolderKanban, RefreshCw, Search } from "lucide-react";

import AssetIcon from "@/components/common/AssetIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchStockAssets, type StockAssetRecord } from "@/lib/api";
import { getFreshness } from "@/lib/freshness";

type Props = {
  refreshKey?: number;
};

export default function AssetLibraryDialog({ refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<StockAssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetchStockAssets();

        if (cancelled) return;

        const nextAssets = Array.isArray((res as { assets?: StockAssetRecord[] })?.assets)
          ? ((res as { assets?: StockAssetRecord[] }).assets ?? [])
          : Array.isArray((res as { data?: StockAssetRecord[] })?.data)
            ? ((res as { data?: StockAssetRecord[] }).data ?? [])
            : [];

        setAssets(nextAssets);
      } catch (err) {
        if (cancelled) return;

        console.error("Asset library load error:", err);
        setAssets([]);
        setError(err instanceof Error ? err.message : "Failed to load asset library");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, refreshKey]);

  const filtered = useMemo(() => {
    if (!query) return assets;

    const q = query.toLowerCase();

    return assets.filter((asset) =>
      `${asset.symbol} ${asset.name}`.toLowerCase().includes(q),
    );
  }, [assets, query]);

  async function handleRefresh() {
    try {
      setLoading(true);
      setError("");

      const res = await fetchStockAssets();

      const nextAssets = Array.isArray((res as { assets?: StockAssetRecord[] })?.assets)
        ? ((res as { assets?: StockAssetRecord[] }).assets ?? [])
        : Array.isArray((res as { data?: StockAssetRecord[] })?.data)
          ? ((res as { data?: StockAssetRecord[] }).data ?? [])
          : [];

      setAssets(nextAssets);
    } catch (err) {
      console.error("Asset library refresh error:", err);
      setAssets([]);
      setError(err instanceof Error ? err.message : "Failed to refresh asset library");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" onClick={() => setOpen(true)}>
        <FolderKanban className="mr-2 size-4" />
        Asset Library
      </Button>

      <DialogContent className="max-w-5xl p-0">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-xl font-semibold">
              Asset Library
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {query ? "No matching assets" : "No assets found"}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((asset) => {
                  const freshness = getFreshness(
                    asset.priceSource,
                    asset.lastSyncedAt,
                    asset.lastPriceSource,
                  );

                  return (
                    <div key={asset.id} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <AssetIcon symbol={asset.symbol} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{asset.symbol}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {asset.name}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-xs text-muted-foreground">
                          {freshness.label}
                        </div>
                      </div>

                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                        <div>Market: {asset.market}</div>
                        <div>Currency: {asset.currency}</div>
                        <div>Source: {asset.priceSource}</div>
                        <div>Status: {asset.isActive ? "Active" : "Inactive"}</div>
                        <div className="md:col-span-2">
                          Last sync: {asset.lastSyncedAt || "-"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}