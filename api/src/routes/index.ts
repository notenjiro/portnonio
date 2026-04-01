import { Router } from "express";
import { getCalendarHandler } from "../modules/calendar/calendar.controller";
import { getDashboardHandler } from "../modules/dashboard/dashboard.controller";
import { refreshFundNavHandler } from "../modules/fund/fund.controller";
import { getHealthStatus } from "../modules/health/health.service";
import { refreshMarketAssetHandler } from "../modules/market/market.controller";
import { getOverviewHandler } from "../modules/overview/overview.controller";
import { getPositionsHandler } from "../modules/positions/positions.controller";
import {
  getBinanceHistoryHandler,
  getFundHistoryHandler,
  getMarketHistoryHandler,
  getPortfolioCalendarHandler,
  getPortfolioSnapshotsHandler,
  rebuildDerivedPortfolioViewsHandler
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
  getBinancePortfolioHandler,
  getBinancePrivateAccountInfoHandler,
  getBinancePublicHealthHandler,
  getBinanceReadinessHandler,
  getBinanceSpotHoldingsHandler,
  getSecHealthHandler,
  getSecAmcListHandler,
  getSecFundSpecificationsHandler,
  resolveSecFundProjIdHandler,
  getTwelveDataHealthHandler,
  listProvidersHandler,
  providerHealthHandler
} from "../modules/store/store.provider-controller";
import {
  persistBinanceSnapshotHandler,
  runBinanceSyncHandler
} from "../modules/sync/sync.controller";

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res, next) => {
  try {
    const status = await getHealthStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/dashboard", getDashboardHandler);
apiRouter.get("/overview", getOverviewHandler);
apiRouter.get("/calendar", getCalendarHandler);
apiRouter.get("/positions", getPositionsHandler);

apiRouter.get("/providers", listProvidersHandler);
apiRouter.get("/providers/health", providerHealthHandler);
apiRouter.get("/providers/binance/public-health", getBinancePublicHealthHandler);
apiRouter.get("/providers/twelvedata/health", getTwelveDataHealthHandler);
apiRouter.get("/providers/sec/health", getSecHealthHandler);
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
apiRouter.get(
  "/providers/binance/accounts/:accountId/portfolio",
  getBinancePortfolioHandler
);

apiRouter.post("/market/refresh/:assetId", refreshMarketAssetHandler);
apiRouter.post("/fund/nav/refresh/:assetId", refreshFundNavHandler);

apiRouter.get("/history/binance", getBinanceHistoryHandler);
apiRouter.get("/history/market", getMarketHistoryHandler);
apiRouter.get("/history/fund", getFundHistoryHandler);
apiRouter.get("/history/calendar", getPortfolioCalendarHandler);
apiRouter.get("/history/snapshots", getPortfolioSnapshotsHandler);
apiRouter.post("/history/rebuild-derived", rebuildDerivedPortfolioViewsHandler);

apiRouter.post("/sync/binance/accounts/:accountId", runBinanceSyncHandler);
apiRouter.post(
  "/sync/binance/accounts/:accountId/persist-snapshot",
  persistBinanceSnapshotHandler
);

apiRouter.get("/store", getStoreHandler);
apiRouter.post("/store/bootstrap", bootstrapStoreHandler);

apiRouter.get("/store/accounts", listAccountsHandler);
apiRouter.post("/store/accounts", createAccountHandler);
apiRouter.put("/store/accounts/:accountId/binance-settings", updateBinanceAccountSettingsHandler);

apiRouter.get("/store/assets", listAssetsHandler);
apiRouter.post("/store/assets", createAssetHandler);

apiRouter.get("/store/account-asset-links", listAccountAssetLinksHandler);
apiRouter.post("/store/account-asset-links", linkAssetToAccountHandler);

apiRouter.get("/providers/sec/amc", getSecAmcListHandler);
apiRouter.get("/providers/sec/specifications", getSecFundSpecificationsHandler);
apiRouter.get("/providers/sec/resolve-proj-id", resolveSecFundProjIdHandler);