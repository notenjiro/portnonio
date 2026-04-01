import { listStockAssets, upsertStockPrice } from "./stock-ledger.service.js";
import {
  fetchHistoricalStockPrices,
} from "./market-price.service.js";
import { fetchFundNav } from "./fund-nav.service.js";

export async function backfillMarketHistory(
  startDate: string,
  endDate: string,
) {
  const assets = listStockAssets();

  let total = 0;

  for (const asset of assets) {
    console.log("backfill:", asset.symbol);

    try {
      // =========================
      // FUND (REAL NAV DATE)
      // =========================
      if (asset.assetType === "fund") {
        const nav = await fetchFundNav(asset.symbol as never);

        // 🔥 ใช้ date จริงจากเว็บ
        upsertStockPrice({
          assetId: asset.id,
          price: nav.nav,
          priceDate: nav.priceDate, // ✅ สำคัญมาก
          source: "fund_nav_live",
        });

        total++;
      }

      // =========================
      // STOCK (REAL HISTORY)
      // =========================
      else {
        const history = await fetchHistoricalStockPrices(
          asset,
          startDate,
          endDate,
        );

        for (const h of history) {
          upsertStockPrice({
            assetId: h.assetId,
            price: h.price,
            priceDate: h.priceDate,
            source: h.source,
          });

          total++;
        }
      }
    } catch (err) {
      console.error("backfill failed:", asset.symbol, err);
    }
  }

  return {
    success: true,
    total,
  };
}