import { createApp } from "./app/create-app";
import { env } from "./config/env";
import { readStore } from "./storage/store.repository";
import { refreshMarketAsset } from "./modules/market/market.service";
import { refreshFundNav } from "./modules/fund/fund.service";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`portnonio-api listening on http://localhost:${env.PORT}`);
});

/* ========================================
   AUTO SYNC ENGINE
======================================== */

let isRunning = false;
let lastFundSync = 0;

async function runAutoSync() {
  if (isRunning) {
    console.log("⏳ Skip sync (already running)");
    return;
  }

  isRunning = true;

  try {
    console.log("🔄 Auto sync started");

    const store = await readStore();

    const stockAssets = store.assets.filter((a) => a.category === "stock");
    const fundAssets = store.assets.filter((a) => a.category === "fund");

    /* ========================
       STOCK SYNC
    ======================== */
    for (const asset of stockAssets) {
      try {
        await refreshMarketAsset(asset.id);
        console.log(`📈 Stock synced: ${asset.symbol}`);
      } catch (err) {
        console.log(`⚠️ Stock sync failed: ${asset.symbol}`);
      }
    }

    /* ========================
       FUND SYNC (daily)
    ======================== */
    const now = Date.now();

    if (now - lastFundSync > env.FUND_SYNC_INTERVAL_MS) {
      console.log("📊 Running fund sync");

      for (const asset of fundAssets) {
        try {
          await refreshFundNav(asset.id);
          console.log(`💰 Fund synced: ${asset.symbol}`);
        } catch (err) {
          console.log(`⚠️ Fund sync failed: ${asset.symbol}`);
        }
      }

      lastFundSync = now;
    }

    console.log("✅ Auto sync finished");
  } catch (err) {
    console.error("❌ Auto sync error:", err);
  } finally {
    isRunning = false;
  }
}

/* ========================================
   START LOOP
======================================== */

if (env.AUTO_SYNC_ENABLED) {
  console.log("🚀 Auto sync enabled");

  setInterval(() => {
    void runAutoSync();
  }, env.AUTO_SYNC_INTERVAL_MS);
}