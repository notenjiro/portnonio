import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  CircleAlert,
  Clock3,
  FolderKanban,
  PauseCircle,
  RefreshCw,
  Search,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import AssetIcon from "@/components/common/AssetIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  fetchStockAssets,
  type StockAssetRecord,
} from "@/lib/api";
import { getFreshness } from "@/lib/freshness";

type Props = {
  refreshKey?: number;
};

export default function AssetLibraryDialog({ refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<StockAssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      const res = await fetchStockAssets();
      if (!cancelled) {
        setAssets(res.assets ?? []);
        setLoading(false);
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

    return assets.filter((a) =>
      `${a.symbol} ${a.name}`.toLowerCase().includes(q),
    );
  }, [assets, query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <FolderKanban className="mr-2 size-4" />
        Asset Library
      </Button>

      <DialogContent className="max-w-5xl p-0">
        {/* 🔥 FIX: flex + จำกัดความสูง */}
        <div className="flex max-h-[90vh] flex-col">

          {/* HEADER */}
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-xl font-semibold">
              Asset Library
            </DialogTitle>
          </DialogHeader>

          {/* 🔥 BODY = scroll container */}
          <div className="flex-1 overflow-y-auto px-6 py-4">

            {/* SEARCH */}
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
                variant="outline"
                onClick={async () => {
                  setLoading(true);
                  const res = await fetchStockAssets();
                  setAssets(res.assets ?? []);
                  setLoading(false);
                }}
              >
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
            </div>

            {/* LIST */}
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Loading...
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
                    <div
                      key={asset.id}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AssetIcon symbol={asset.symbol} />
                          <div>
                            <p className="font-medium">
                              {asset.symbol}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {asset.name}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {freshness.label}
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        Last sync: {asset.lastSyncedAt || "-"}
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