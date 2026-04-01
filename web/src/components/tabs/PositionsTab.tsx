import React, { useEffect, useState } from "react";
import { fetchDashboardBreakdown } from "@/lib/api";

function formatUSD(value: number) {
  if (!Number.isFinite(value)) return "$0";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function PositionsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardBreakdown()
      .then((res) => {
        setData(res ?? {});
      })
      .catch((err) => {
        console.error("Positions error:", err);
        setError(err?.message || "Failed to load data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 text-sm">
        Error: {error}
      </div>
    );
  }

  // 🔥 safe fallback
  const stockHoldings = Array.isArray(data?.stockHoldings)
    ? data.stockHoldings
    : [];

  const fundHoldings = Array.isArray(data?.fundHoldings)
    ? data.fundHoldings
    : [];

  return (
    <div className="space-y-6 p-4">
      {/* STOCK */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Stocks</h2>

        {stockHoldings.length === 0 ? (
          <div className="text-sm text-gray-500">No stock holdings</div>
        ) : (
          <div className="space-y-2">
            {stockHoldings.map((item: any) => (
              <div
                key={item.symbol || Math.random()}
                className="border rounded p-3 flex justify-between"
              >
                <div>
                  <div className="font-medium">
                    {item.symbol || "N/A"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Qty: {item.quantity ?? 0}
                  </div>
                </div>

                <div className="text-right">
                  <div>{formatUSD(Number(item.marketValue ?? 0))}</div>
                  <div
                    className={
                      Number(item.unrealizedPnL ?? 0) >= 0
                        ? "text-green-600 text-xs"
                        : "text-red-600 text-xs"
                    }
                  >
                    {formatUSD(Number(item.unrealizedPnL ?? 0))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FUND */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Funds</h2>

        {fundHoldings.length === 0 ? (
          <div className="text-sm text-gray-500">No fund holdings</div>
        ) : (
          <div className="space-y-2">
            {fundHoldings.map((item: any) => (
              <div
                key={item.symbol || Math.random()}
                className="border rounded p-3 flex justify-between"
              >
                <div>
                  <div className="font-medium">
                    {item.symbol || "N/A"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Units: {item.units ?? 0}
                  </div>
                </div>

                <div className="text-right">
                  <div>{formatUSD(Number(item.marketValue ?? 0))}</div>
                  <div
                    className={
                      Number(item.unrealizedPnL ?? 0) >= 0
                        ? "text-green-600 text-xs"
                        : "text-red-600 text-xs"
                    }
                  >
                    {formatUSD(Number(item.unrealizedPnL ?? 0))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}