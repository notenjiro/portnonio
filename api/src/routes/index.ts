import { Router } from "express";
import { getHealthStatus } from "../modules/health/health.service";
import {
  getBinanceHistoryHandler,
  getFundHistoryHandler,
  getMarketHistoryHandler,
  getPortfolioCalendarHandler,
  getPortfolioSnapshotsHandler,
  seedDemoHistoryHandler
} from "../modules/store/store.history-controller";
import {
  bootstrapStoreHandler,
  createAccountHandler,
  createAssetHandler,
  getStoreHandler,
  linkAssetToAccountHandler,
  listAccountsHandler,
  listAccountAssetLinksHandler,
  listAssetsHandler,
  updateBinanceAccountSettingsHandler
} from "../modules/store/store.controller";
import {
  getBinanceFuturesPositionsHandler,
  getBinancePrivateAccountInfoHandler,
  getBinancePublicHealthHandler,
  getBinanceReadinessHandler,
  getBinanceSpotHoldingsHandler,
  listProvidersHandler,
  providerHealthHandler
} from "../modules/store/store.provider-controller";
import { runBinanceSyncHandler } from "../modules/sync/sync.controller";

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res, next) => {
  try {
    const status = await getHealthStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/providers", listProvidersHandler);
apiRouter.get("/providers/health", providerHealthHandler);
apiRouter.get("/providers/binance/public-health", getBinancePublicHealthHandler);
apiRouter.get("/providers/binance/accounts/:accountId/readiness", getBinanceReadinessHandler);
apiRouter.get(
  "/providers/binance/accounts/:accountId/private-account",
  getBinancePrivateAccountInfoHandler
);
apiRouter.get(
  "/providers/binance/accounts/:accountId/spot-holdings",
  getBinanceSpotHoldingsHandler
);
apiRouter.get(
  "/providers/binance/accounts/:accountId/futures-positions",
  getBinanceFuturesPositionsHandler
);

apiRouter.get("/history/binance", getBinanceHistoryHandler);
apiRouter.get("/history/market", getMarketHistoryHandler);
apiRouter.get("/history/fund", getFundHistoryHandler);
apiRouter.get("/history/calendar", getPortfolioCalendarHandler);
apiRouter.get("/history/snapshots", getPortfolioSnapshotsHandler);
apiRouter.post("/history/seed-demo", seedDemoHistoryHandler);

apiRouter.post("/sync/binance/accounts/:accountId", runBinanceSyncHandler);

apiRouter.get("/store", getStoreHandler);
apiRouter.post("/store/bootstrap", bootstrapStoreHandler);

apiRouter.get("/store/accounts", listAccountsHandler);
apiRouter.post("/store/accounts", createAccountHandler);
apiRouter.put("/store/accounts/:accountId/binance-settings", updateBinanceAccountSettingsHandler);

apiRouter.get("/store/assets", listAssetsHandler);
apiRouter.post("/store/assets", createAssetHandler);

apiRouter.get("/store/account-asset-links", listAccountAssetLinksHandler);
apiRouter.post("/store/account-asset-links", linkAssetToAccountHandler);